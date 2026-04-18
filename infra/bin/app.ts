#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { configFor } from '../lib/config';
import { NetworkStack } from '../lib/stacks/network-stack';
import { EcrStack } from '../lib/stacks/ecr-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { DnsStack } from '../lib/stacks/dns-stack';
import { EcsStack } from '../lib/stacks/ecs-stack';
import { CdnStack } from '../lib/stacks/cdn-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { IamStack } from '../lib/stacks/iam-stack';

const app = new App();
const envFlag = app.node.tryGetContext('env') as string | undefined;
const cfg = configFor(envFlag);

const env = { account: cfg.awsAccountId, region: cfg.awsRegion };
const prefix = `${cfg.appName}-${cfg.environment}`;

const network = new NetworkStack(app, `${prefix}-network`, { env, cfg });
const ecr = new EcrStack(app, `${prefix}-ecr`, { env, cfg });
const secrets = new SecretsStack(app, `${prefix}-secrets`, { env, cfg });
const dns = new DnsStack(app, `${prefix}-dns`, { env, cfg });
const ecs = new EcsStack(app, `${prefix}-ecs`, {
  env, cfg,
  vpc: network.vpc,
  repository: ecr.repository,
  secrets: secrets.secrets,
  certificate: dns.certificate,
  hostedZone: dns.hostedZone,
});
new CdnStack(app, `${prefix}-cdn`, {
  env, cfg,
  alb: ecs.alb,
  hostedZone: dns.hostedZone,
  certificate: dns.certificate,
});
new MonitoringStack(app, `${prefix}-monitoring`, {
  env, cfg,
  cluster: ecs.cluster,
  service: ecs.fargateService,
  alb: ecs.alb,
});
new IamStack(app, `${prefix}-iam`, {
  env, cfg,
  repository: ecr.repository,
  cluster: ecs.cluster,
  service: ecs.fargateService,
});
