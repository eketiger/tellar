import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { AppConfig } from '../config';

export type AppSecretKey =
  | 'database-url'
  | 'jwt-secret'
  | 'share-token-secret'
  | 'google-client-secret'
  | 'github-client-secret'
  | 'stripe-secret-key'
  | 'stripe-webhook-secret'
  | 'anthropic-api-key'
  | 'voyage-api-key'
  | 'pinecone-api-key';

const SECRET_KEYS: AppSecretKey[] = [
  'database-url',
  'jwt-secret',
  'share-token-secret',
  'google-client-secret',
  'github-client-secret',
  'stripe-secret-key',
  'stripe-webhook-secret',
  'anthropic-api-key',
  'voyage-api-key',
  'pinecone-api-key',
];

const PARAMS = [
  ['NEXTAUTH_URL', (c: AppConfig) => `https://${c.domainName}`],
  ['GOOGLE_CLIENT_ID', () => 'REPLACE_ME'],
  ['GITHUB_CLIENT_ID', () => 'REPLACE_ME'],
  ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', () => 'REPLACE_ME'],
  ['NEXT_PUBLIC_MIXPANEL_TOKEN', () => 'REPLACE_ME'],
  ['PINECONE_INDEX_NAME', (c: AppConfig) => `${c.appName}-knowledge-base`],
  ['WEB_ORIGIN', (c: AppConfig) => `https://${c.domainName}`],
] as const;

interface SecretsStackProps extends StackProps { cfg: AppConfig }

export class SecretsStack extends Stack {
  public readonly secrets: Record<AppSecretKey, secretsmanager.Secret>;
  public readonly parameters: Record<string, ssm.StringParameter>;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);
    const base = `/${props.cfg.appName}/${props.cfg.environment}`;

    this.secrets = {} as Record<AppSecretKey, secretsmanager.Secret>;
    for (const key of SECRET_KEYS) {
      const secret = new secretsmanager.Secret(this, `Secret-${key}`, {
        secretName: `${base}/${key}`,
        description: `Populate ${base}/${key} via the Console after cdk deploy`,
        removalPolicy: RemovalPolicy.RETAIN,
      });
      this.secrets[key] = secret;
      new CfnOutput(this, `SecretArn-${key}`, { value: secret.secretArn, exportName: `${id}-${key}` });
    }

    this.parameters = {};
    for (const [k, v] of PARAMS) {
      this.parameters[k] = new ssm.StringParameter(this, `Param-${k}`, {
        parameterName: `${base}/${k}`,
        stringValue: v(props.cfg),
      });
    }
  }
}
