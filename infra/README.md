# Tellar infrastructure (AWS CDK)

All production and staging infra lives here as code. Nothing is created manually in the
AWS Console.

## Prerequisites

- Node 20+
- AWS CLI v2 configured (`aws configure` with an admin or bootstrap-equivalent IAM user)
- CDK bootstrapped for the target account + region:
  ```bash
  npx cdk bootstrap aws://$ACCOUNT_ID/$REGION
  ```

## Install

```bash
cd infra
npm install   # or pnpm install
```

## Deploy

Staging (default):
```bash
npm run deploy -- -c env=staging
```

Production:
```bash
npm run deploy -- -c env=production
```

Preview changes without applying:
```bash
npm run diff -- -c env=production
```

## After the first deploy

1. **Populate secrets.** Each `Secret-<key>` was created as an empty placeholder. Fill them
   in via the console or CLI:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id /tellar/production/database-url \
     --secret-string 'postgresql://...'
   ```
   The full list of secret names is in `lib/stacks/secrets-stack.ts`.

2. **Wire GitHub Actions.** Copy the `GithubActionsRoleArn` output into a repository secret
   called `AWS_ROLE_ARN`. The `cd.yml` workflow uses OIDC to assume it — no static access
   keys needed.

3. **DNS.** The Route 53 hosted zone is imported by id (`hostedZoneId` in `lib/config.ts`).
   Update those ids before your first deploy.

## Rollback

```bash
aws ecs update-service \
  --cluster tellar-production \
  --service tellar-production-svc \
  --task-definition $PREVIOUS_TASK_DEF_ARN
```

## Tear down

```bash
npm run destroy
```

`RETAIN` policies protect the ECR repository, the Secrets Manager secrets, and the assets
bucket. Those must be deleted manually if truly wanted.

## Stack layout

- `network-stack` — VPC, public + private subnets, NAT gateways, VPC flow logs
- `ecr-stack` — ECR repository with scan-on-push + lifecycle rules
- `secrets-stack` — Secrets Manager entries + SSM parameters for env config
- `dns-stack` — imported hosted zone + ACM certificate
- `ecs-stack` — ECS cluster, Fargate task + service, ALB, Route53 A records
- `cdn-stack` — CloudFront + S3 assets bucket; apex A records repoint to CloudFront
- `monitoring-stack` — CloudWatch alarms, SNS email topic, dashboard
- `iam-stack` — OIDC provider + least-privilege role for GitHub Actions
