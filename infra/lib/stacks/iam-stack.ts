import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { AppConfig } from '../config';

interface IamStackProps extends StackProps {
  cfg: AppConfig;
  repository: ecr.IRepository;
  cluster: ecs.Cluster;
  service: ecs.FargateService;
}

export class IamStack extends Stack {
  public readonly githubActionsRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);
    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const subject = `repo:${props.cfg.githubOrg}/${props.cfg.githubRepo}:ref:refs/heads/main`;
    this.githubActionsRole = new iam.Role(this, 'GithubActionsRole', {
      roleName: `${props.cfg.appName}-${props.cfg.environment}-github-actions`,
      assumedBy: new iam.FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': subject,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      description: 'Assumed by GitHub Actions on the main branch to deploy the app',
    });

    // ECR — auth token is account-wide; repo pushes are scoped to our repo ARN.
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
      ],
      resources: [props.repository.repositoryArn],
    }));

    // ECS
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecs:RegisterTaskDefinition',
        'ecs:DescribeTaskDefinition',
      ],
      resources: ['*'],
    }));
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecs:UpdateService', 'ecs:DescribeServices', 'ecs:RunTask'],
      resources: [
        `arn:aws:ecs:${props.cfg.awsRegion}:${props.cfg.awsAccountId}:service/${props.cluster.clusterName}/${props.service.serviceName}`,
        `arn:aws:ecs:${props.cfg.awsRegion}:${props.cfg.awsAccountId}:task-definition/*`,
      ],
    }));

    // iam:PassRole scoped to the ECS execution role (always created by Fargate task defs)
    const execRole = props.service.taskDefinition.executionRole;
    if (execRole) {
      this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [execRole.roleArn],
      }));
    }

    // Logs for the one-off migration task
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [`arn:aws:logs:${props.cfg.awsRegion}:${props.cfg.awsAccountId}:log-group:/ecs/${props.cfg.appName}/${props.cfg.environment}*`],
    }));

    new CfnOutput(this, 'GithubActionsRoleArn', {
      value: this.githubActionsRole.roleArn,
      description: 'Set this as the AWS_ROLE_ARN GitHub Actions secret.',
      exportName: `${id}-role-arn`,
    });
  }
}
