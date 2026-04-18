import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { staging } from '../lib/config';
import { NetworkStack } from '../lib/stacks/network-stack';
import { EcrStack } from '../lib/stacks/ecr-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { DnsStack } from '../lib/stacks/dns-stack';
import { EcsStack } from '../lib/stacks/ecs-stack';
import { CdnStack } from '../lib/stacks/cdn-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { IamStack } from '../lib/stacks/iam-stack';

function synthAll() {
  const app = new App();
  const env = { account: staging.awsAccountId, region: staging.awsRegion };
  const prefix = `${staging.appName}-${staging.environment}`;
  const network = new NetworkStack(app, `${prefix}-network`, { env, cfg: staging });
  const ecr = new EcrStack(app, `${prefix}-ecr`, { env, cfg: staging });
  const secrets = new SecretsStack(app, `${prefix}-secrets`, { env, cfg: staging });
  const dns = new DnsStack(app, `${prefix}-dns`, { env, cfg: staging });
  const ecs = new EcsStack(app, `${prefix}-ecs`, {
    env, cfg: staging,
    vpc: network.vpc,
    repository: ecr.repository,
    secrets: secrets.secrets,
    certificate: dns.certificate,
    hostedZone: dns.hostedZone,
  });
  const cdn = new CdnStack(app, `${prefix}-cdn`, {
    env, cfg: staging,
    alb: ecs.alb,
    hostedZone: dns.hostedZone,
    certificate: dns.certificate,
  });
  const monitoring = new MonitoringStack(app, `${prefix}-monitoring`, {
    env, cfg: staging,
    cluster: ecs.cluster,
    service: ecs.fargateService,
    alb: ecs.alb,
  });
  const iam = new IamStack(app, `${prefix}-iam`, {
    env, cfg: staging,
    repository: ecr.repository,
    cluster: ecs.cluster,
    service: ecs.fargateService,
  });
  return { app, network, ecr, secrets, dns, ecs, cdn, monitoring, iam };
}

describe('CDK stacks', () => {
  const { network, ecr, secrets, ecs, cdn, iam } = synthAll();

  it('ECR has imageScanOnPush', () => {
    Template.fromStack(ecr).hasResourceProperties('AWS::ECR::Repository', {
      ImageScanningConfiguration: { ScanOnPush: true },
    });
  });

  it('Secrets are RETAIN', () => {
    const tpl = Template.fromStack(secrets);
    tpl.allResources('AWS::SecretsManager::Secret', Match.objectLike({
      DeletionPolicy: 'Retain',
    }));
  });

  it('ECS cluster has Container Insights', () => {
    Template.fromStack(ecs).hasResourceProperties('AWS::ECS::Cluster', {
      ClusterSettings: Match.arrayWith([
        Match.objectLike({ Name: 'containerInsights', Value: 'enabled' }),
      ]),
    });
  });

  it('Task SG does not allow 0.0.0.0/0 on 3000', () => {
    const tpl = Template.fromStack(ecs);
    const ingresses = tpl.findResources('AWS::EC2::SecurityGroupIngress');
    for (const r of Object.values(ingresses)) {
      const p = (r as any).Properties || {};
      if (p.FromPort === 3000 || p.ToPort === 3000) {
        expect(p.CidrIp).not.toBe('0.0.0.0/0');
      }
    }
  });

  it('S3 assets bucket blocks all public access', () => {
    Template.fromStack(cdn).hasResourceProperties('AWS::S3::Bucket', Match.objectLike({
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    }));
  });

  it('VPC has 2 AZs', () => {
    const tpl = Template.fromStack(network);
    tpl.resourceCountIs('AWS::EC2::VPC', 1);
    tpl.resourceCountIs('AWS::EC2::Subnet', 4);
  });

  it('IAM role is scoped to refs/heads/main', () => {
    const tpl = Template.fromStack(iam);
    const policy = tpl.toJSON().Resources;
    const roleResource: any = Object.values(policy).find((r: any) => r.Type === 'AWS::IAM::Role');
    const sub = roleResource.Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals['token.actions.githubusercontent.com:sub'];
    expect(sub).toMatch(/refs\/heads\/main$/);
  });

  it('Fargate service has circuit breaker with rollback', () => {
    Template.fromStack(ecs).hasResourceProperties('AWS::ECS::Service', Match.objectLike({
      DeploymentConfiguration: Match.objectLike({
        DeploymentCircuitBreaker: { Enable: true, Rollback: true },
      }),
    }));
  });
});
