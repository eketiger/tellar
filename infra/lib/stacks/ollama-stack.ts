import { Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { AppConfig } from '../config';

interface OllamaStackProps extends StackProps {
  cfg: AppConfig;
  vpc: ec2.Vpc;
  /** SG of the consumers that should be allowed to call Ollama:11434.
   *  Typically the ECS service's SG. */
  consumerSecurityGroup?: ec2.ISecurityGroup;
}

/**
 * Self-hosted LLM server (Ollama) for Tellar. Single EC2 instance in the
 * private subnet, only reachable from the consumer SG (ECS) on port 11434.
 * The API app points at it via OPENAI_BASE_URL = http://<privateIp>:11434/v1.
 *
 * Why a single EC2 and not ECS / Fargate:
 * - GPU access: Fargate has no GPU support. ECS on EC2 is possible but
 *   overkill for a one-box inference workload.
 * - Model cache: the models (several GB each) live on an EBS volume and
 *   persist across restarts. Containers would re-download on every boot.
 * - Start-up: EC2 + systemd is simpler to debug when things go wrong than
 *   an opaque ECS task definition.
 *
 * Config knobs (see AppConfig.ollama):
 * - instanceType: g5.xlarge (A10G, 24 GB VRAM, ~$720/mo) by default.
 *   g4dn.xlarge (T4, 16 GB VRAM, ~$380/mo) is a cheaper alternative that
 *   still runs 7-14 B params comfortably. t3.xlarge (CPU, ~$122/mo) works
 *   for tiny models but is slow.
 * - chatModel: the Ollama model name the cloud-init pulls on boot.
 * - embedModel: optional embedding model, pulled alongside the chat model.
 */
export class OllamaStack extends Stack {
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly instance: ec2.Instance;
  public readonly privateUrl: string;

  constructor(scope: Construct, id: string, props: OllamaStackProps) {
    super(scope, id, props);

    const ollamaCfg = props.cfg.ollama;
    if (!ollamaCfg) {
      throw new Error('OllamaStack instantiated without cfg.ollama configured');
    }

    const name = `${props.cfg.appName}-${props.cfg.environment}-ollama`;

    // ------- Security group: only consumers (ECS tasks) may reach :11434.
    this.securityGroup = new ec2.SecurityGroup(this, 'Sg', {
      vpc: props.vpc,
      description: 'Ollama inference — ingress only from Tellar consumers',
      allowAllOutbound: true,
      securityGroupName: name,
    });
    if (props.consumerSecurityGroup) {
      this.securityGroup.addIngressRule(
        ec2.Peer.securityGroupId(props.consumerSecurityGroup.securityGroupId),
        ec2.Port.tcp(11434),
        'Ollama HTTP API from ECS tasks',
      );
    } else {
      // Fallback: allow the VPC CIDR so operators can wire the ECS SG later.
      this.securityGroup.addIngressRule(
        ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
        ec2.Port.tcp(11434),
        'Ollama HTTP API (VPC-wide)',
      );
    }

    // ------- IAM role with SSM + CloudWatch so we can exec in and tail logs.
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // ------- AMI: Deep Learning Base GPU AMI (Ubuntu 22.04) via SSM public
    // parameter. NVIDIA drivers + CUDA + Docker ship pre-installed, so the
    // user data just has to install Ollama on top.
    const amiParam = ec2.MachineImage.fromSsmParameter(
      '/aws/service/deeplearning/ami/x86_64/Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)/latest/ami-id',
      { os: ec2.OperatingSystemType.LINUX },
    );

    // ------- User data: install Ollama, pull models, start systemd service.
    const chatModel = ollamaCfg.chatModel;
    const embedModel = ollamaCfg.embedModel || '';
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -eux',
      'exec > >(tee /var/log/tellar-ollama-setup.log) 2>&1',
      'export DEBIAN_FRONTEND=noninteractive',
      'apt-get update -y',
      // Install Ollama. Script detects NVIDIA drivers and enables GPU mode.
      'curl -fsSL https://ollama.com/install.sh | sh',
      // Bind to all interfaces so the ECS task can reach it; systemd unit
      // ships with a localhost-only default in some versions.
      'mkdir -p /etc/systemd/system/ollama.service.d',
      'cat > /etc/systemd/system/ollama.service.d/override.conf <<EOF\n[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\nEnvironment="OLLAMA_KEEP_ALIVE=30m"\nEOF',
      'systemctl daemon-reload',
      'systemctl enable --now ollama',
      // Wait for Ollama to be ready before pulling.
      'for i in $(seq 1 30); do curl -sf http://127.0.0.1:11434/api/tags && break || sleep 2; done',
      `ollama pull ${chatModel}`,
      embedModel ? `ollama pull ${embedModel}` : 'echo "no embed model configured"',
      'echo "[tellar] Ollama ready."',
    );

    // ------- Root volume large enough for a couple of models.
    const rootDevice: ec2.BlockDevice = {
      deviceName: '/dev/sda1',
      volume: ec2.BlockDeviceVolume.ebs(ollamaCfg.diskGiB, {
        volumeType: ec2.EbsDeviceVolumeType.GP3,
        encrypted: true,
        deleteOnTermination: false, // keep the model cache across replaces
      }),
    };

    this.instance = new ec2.Instance(this, 'Instance', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: new ec2.InstanceType(ollamaCfg.instanceType),
      machineImage: amiParam,
      securityGroup: this.securityGroup,
      role,
      userData,
      blockDevices: [rootDevice],
      instanceName: name,
      // Stopping is cheaper than terminating when you want to pause the bill;
      // the EBS root survives a stop.
      instanceInitiatedShutdownBehavior: ec2.InstanceInitiatedShutdownBehavior.STOP,
    });

    // ------- CloudWatch log group for setup output (cfn doesn't stream user
    // data automatically — SSM run-command can fetch /var/log/cloud-init-output.log).
    new logs.LogGroup(this, 'SetupLogs', {
      logGroupName: `/ec2/${name}/user-data`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ------- Publish the private URL so the API stack can pick it up via
    // an SSM lookup (no cross-stack import dance required).
    this.privateUrl = `http://${this.instance.instancePrivateIp}:11434/v1`;
    new ssm.StringParameter(this, 'OpenaiBaseUrlParam', {
      parameterName: `/${props.cfg.appName}/${props.cfg.environment}/OPENAI_BASE_URL`,
      stringValue: this.privateUrl,
      description: 'Ollama HTTP API URL for Tellar inference',
    });
    new ssm.StringParameter(this, 'OpenaiModelParam', {
      parameterName: `/${props.cfg.appName}/${props.cfg.environment}/OPENAI_MODEL`,
      stringValue: chatModel,
    });
    if (embedModel) {
      new ssm.StringParameter(this, 'OpenaiEmbedModelParam', {
        parameterName: `/${props.cfg.appName}/${props.cfg.environment}/OPENAI_EMBED_MODEL`,
        stringValue: embedModel,
      });
    }

    new CfnOutput(this, 'OllamaPrivateIp',  { value: this.instance.instancePrivateIp });
    new CfnOutput(this, 'OllamaUrl',         { value: this.privateUrl });
    new CfnOutput(this, 'OllamaInstanceId',  { value: this.instance.instanceId, description: `aws ssm start-session --target <id> to shell in` });
  }
}
