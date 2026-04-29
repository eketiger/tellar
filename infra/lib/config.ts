export interface AppConfig {
  appName: string;
  environment: 'staging' | 'production';
  domainName: string;
  hostedZoneId: string;
  awsRegion: string;
  awsAccountId: string;
  taskCpu: number;
  taskMemoryMiB: number;
  desiredCount: number;
  alarmEmail: string;
  githubOrg: string;
  githubRepo: string;
}

const common = {
  appName: 'tellar',
  githubOrg: 'eketiger',
  githubRepo: 'tellar',
  awsAccountId: process.env.CDK_DEFAULT_ACCOUNT || '000000000000',
  awsRegion: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

export const staging: AppConfig = {
  ...common,
  environment: 'staging',
  domainName: 'tuna.com.ar',
  hostedZoneId: 'Z052525635CPTMMOPMMHH',
  taskCpu: 512,
  taskMemoryMiB: 1024,
  desiredCount: 1,
  alarmEmail: 'ops@tellar.studio',
};

export const production: AppConfig = {
  ...common,
  environment: 'production',
  domainName: 'tellar.studio',
  hostedZoneId: 'Z00000000000000000000',
  taskCpu: 1024,
  taskMemoryMiB: 2048,
  desiredCount: 2,
  alarmEmail: 'ops@tellar.studio',
};

export function configFor(env: string | undefined): AppConfig {
  if (env === 'production') return production;
  return staging;
}
