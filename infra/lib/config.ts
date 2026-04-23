export interface OllamaConfig {
  instanceType: string;   // e.g. 'g5.xlarge' (GPU) or 't3.xlarge' (CPU)
  chatModel: string;      // e.g. 'qwen2.5:7b-instruct'
  embedModel?: string;    // e.g. 'nomic-embed-text'
  diskGiB: number;        // root EBS size — models are big
}

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
  /** Opt-in self-hosted LLM. When set, `bin/app.ts` includes OllamaStack
   *  and the ECS task env is auto-wired via SSM Parameter Store. Unset =
   *  no stack, no cost. */
  ollama?: OllamaConfig;
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
