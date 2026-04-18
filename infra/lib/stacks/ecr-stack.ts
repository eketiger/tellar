import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { AppConfig } from '../config';

interface EcrStackProps extends StackProps { cfg: AppConfig }

export class EcrStack extends Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: `${props.cfg.appName}-${props.cfg.environment}`,
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          rulePriority: 1,
          description: 'Keep last 10 SHA-tagged images',
          tagPrefixList: ['sha-'],
          maxImageCount: 10,
        },
        {
          rulePriority: 2,
          description: 'Expire untagged images after 7 days',
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: Duration.days(7),
        },
      ],
    });

    new CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      exportName: `${id}-repo-uri`,
    });
  }
}
