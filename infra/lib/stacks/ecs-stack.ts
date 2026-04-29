import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { AppConfig } from '../config';
import type { AppSecretKey } from './secrets-stack';

interface EcsStackProps extends StackProps {
  cfg: AppConfig;
  vpc: ec2.Vpc;
  repository: ecr.IRepository;
  secrets: Record<AppSecretKey, secretsmanager.Secret>;
  certificate: acm.Certificate;
  hostedZone: route53.IHostedZone;
}

export class EcsStack extends Stack {
  public readonly cluster: ecs.Cluster;
  public readonly fargateService: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);
    const name = `${props.cfg.appName}-${props.cfg.environment}`;

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: name,
      containerInsights: true,
    });

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${props.cfg.appName}/${props.cfg.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: props.cfg.taskCpu,
      memoryLimitMiB: props.cfg.taskMemoryMiB,
    });

    // The container image points at our ECR repository; pulling is granted
    // by the AmazonECSTaskExecutionRolePolicy that CDK attaches to every
    // FargateTaskDefinition's executionRole automatically. No explicit
    // grantPull() call is needed (and it fails synth across stack boundaries).

    const envFromSsm: Record<string, string> = {
      NEXTAUTH_URL:                     ssm.StringParameter.valueForStringParameter(this, `/${props.cfg.appName}/${props.cfg.environment}/NEXTAUTH_URL`),
      GOOGLE_CLIENT_ID:                 ssm.StringParameter.valueForStringParameter(this, `/${props.cfg.appName}/${props.cfg.environment}/GOOGLE_CLIENT_ID`),
      GITHUB_CLIENT_ID:                 ssm.StringParameter.valueForStringParameter(this, `/${props.cfg.appName}/${props.cfg.environment}/GITHUB_CLIENT_ID`),
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ssm.StringParameter.valueForStringParameter(this, `/${props.cfg.appName}/${props.cfg.environment}/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`),
      NEXT_PUBLIC_MIXPANEL_TOKEN:       ssm.StringParameter.valueForStringParameter(this, `/${props.cfg.appName}/${props.cfg.environment}/NEXT_PUBLIC_MIXPANEL_TOKEN`),
      PINECONE_INDEX_NAME:              ssm.StringParameter.valueForStringParameter(this, `/${props.cfg.appName}/${props.cfg.environment}/PINECONE_INDEX_NAME`),
      WEB_ORIGIN:                       ssm.StringParameter.valueForStringParameter(this, `/${props.cfg.appName}/${props.cfg.environment}/WEB_ORIGIN`),
      NODE_ENV: 'production',
      PORT: '3000',
    };

    const secretsForContainer: Record<string, ecs.Secret> = {
      DATABASE_URL:          ecs.Secret.fromSecretsManager(props.secrets['database-url']),
      JWT_SECRET:            ecs.Secret.fromSecretsManager(props.secrets['jwt-secret']),
      SHARE_TOKEN_SECRET:    ecs.Secret.fromSecretsManager(props.secrets['share-token-secret']),
      GOOGLE_CLIENT_SECRET:  ecs.Secret.fromSecretsManager(props.secrets['google-client-secret']),
      GITHUB_CLIENT_SECRET:  ecs.Secret.fromSecretsManager(props.secrets['github-client-secret']),
      STRIPE_SECRET_KEY:     ecs.Secret.fromSecretsManager(props.secrets['stripe-secret-key']),
      STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(props.secrets['stripe-webhook-secret']),
      ANTHROPIC_API_KEY:     ecs.Secret.fromSecretsManager(props.secrets['anthropic-api-key']),
      VOYAGE_API_KEY:        ecs.Secret.fromSecretsManager(props.secrets['voyage-api-key']),
      PINECONE_API_KEY:      ecs.Secret.fromSecretsManager(props.secrets['pinecone-api-key']),
    };

    this.taskDefinition.addContainer('app', {
      image: ecs.ContainerImage.fromEcrRepository(props.repository, 'latest'),
      containerName: 'app',
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'app', logGroup }),
      environment: envFromSsm,
      secrets: secretsForContainer,
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/api/health || exit 1'],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(60),
      },
    });

    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: props.vpc,
      description: 'ALB ingress',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    const taskSg = new ec2.SecurityGroup(this, 'TaskSg', {
      vpc: props.vpc,
      description: 'Fargate task ingress',
      allowAllOutbound: true,
    });
    taskSg.addIngressRule(albSg, ec2.Port.tcp(3000), 'from ALB');

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      loadBalancerName: `${name}-alb`,
    });

    this.fargateService = new ecs.FargateService(this, 'Service', {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: props.cfg.desiredCount,
      securityGroups: [taskSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
      serviceName: `${name}-svc`,
    });

    const tg = new elbv2.ApplicationTargetGroup(this, 'Tg', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/api/health',
        healthyHttpCodes: '200',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
      },
      deregistrationDelay: Duration.seconds(20),
    });
    this.fargateService.attachToApplicationTargetGroup(tg);

    this.alb.addListener('Http', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({ protocol: 'HTTPS', port: '443', permanent: true }),
    });
    this.alb.addListener('Https', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [props.certificate],
      defaultAction: elbv2.ListenerAction.forward([tg]),
    });

    new route53.ARecord(this, 'Apex', {
      zone: props.hostedZone,
      recordName: props.cfg.domainName,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(this.alb)),
    });
    new route53.ARecord(this, 'Www', {
      zone: props.hostedZone,
      recordName: `www.${props.cfg.domainName}`,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(this.alb)),
    });

    new CfnOutput(this, 'ClusterName', { value: this.cluster.clusterName });
    new CfnOutput(this, 'ServiceName', { value: this.fargateService.serviceName });
    new CfnOutput(this, 'AlbDns',      { value: this.alb.loadBalancerDnsName });
  }
}
