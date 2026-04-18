# CLAUDE-infra.md — Infrastructure & deploy instructions

> Companion to `CLAUDE.md`. Documents the AWS CDK project in `infra/` and the CI/CD pipeline.

## Implementation summary

- `infra/` is an AWS CDK v2 project in TypeScript. Entry point: `infra/bin/app.ts`.
- Config: `infra/lib/config.ts` exports `staging` and `production` `AppConfig` objects, picked
  by `cdk deploy -c env=staging|production`.
- Eight stacks, wired by props (never via SSM lookups between sibling stacks):
  1. `network-stack` — VPC, public + private subnets, NAT, VPC flow logs
  2. `ecr-stack` — ECR repo with scan-on-push + lifecycle rules, RETAIN
  3. `secrets-stack` — Secrets Manager placeholders (populated after first deploy) + SSM
     parameters for non-sensitive config
  4. `dns-stack` — Imported Route 53 hosted zone + ACM certificate
  5. `ecs-stack` — Cluster, Fargate task + service, ALB, Route 53 A records, health check
     against `/api/health`
  6. `cdn-stack` — CloudFront with two origins (ALB + S3); apex re-aliased to the distribution
  7. `monitoring-stack` — CloudWatch alarms + SNS email topic + dashboard
  8. `iam-stack` — OIDC provider + least-privilege `main`-scoped role for GitHub Actions

## CI/CD

- `.github/workflows/ci.yml` — install, prisma generate, db push, typecheck, tests,
  build both apps, validate `openapi.yaml` with Redocly, run CDK synth + tests.
- `.github/workflows/cd.yml` — **OIDC only**, no static credentials:
  ```yaml
  permissions:
    id-token: write
    contents: read
  steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        aws-region: ${{ secrets.AWS_REGION }}
  ```
  Builds and pushes both app images to ECR, updates two ECS services, runs a one-off Prisma
  migrate task, and Slacks on failure.

## Runtime env injection

At container startup, ECS reads:

- Non-sensitive `environment` values from SSM parameters (`/tellar/{env}/{KEY}`)
- Secrets via `ecs.Secret.fromSecretsManager(secret)` — the task execution role is granted
  `secretsmanager:GetSecretValue` automatically by CDK. These are never visible in the task
  definition plaintext.

When adding a new env var:
- If non-sensitive: add to the `PARAMS` list in `secrets-stack.ts` AND to the `envFromSsm`
  object in `ecs-stack.ts`.
- If sensitive: add to `AppSecretKey` and `SECRET_KEYS` in `secrets-stack.ts`, then inject
  it via `secretsForContainer` in `ecs-stack.ts`.

## Populating secrets

After `cdk deploy --all`, Secrets Manager holds empty placeholders. Populate them via CLI:

```bash
aws secretsmanager put-secret-value \
  --secret-id /tellar/production/database-url \
  --secret-string 'postgresql://...'
```

Full list: `database-url`, `jwt-secret`, `share-token-secret`, `google-client-secret`,
`github-client-secret`, `stripe-secret-key`, `stripe-webhook-secret`, `anthropic-api-key`,
`openai-api-key`, `pinecone-api-key`.

## GitHub Actions secrets

After the first deploy, add these to the repo's Actions secrets:

| Secret | Source |
| --- | --- |
| `AWS_ROLE_ARN` | Output `GithubActionsRoleArn` from `tellar-{env}-iam` stack |
| `AWS_REGION` | Your chosen region |
| `ECR_REGISTRY` | `<account>.dkr.ecr.<region>.amazonaws.com` |
| `ECR_REPOSITORY` | Output `RepositoryUri` from `tellar-{env}-ecr` stack |
| `ECS_CLUSTER` | Output `ClusterName` from `tellar-{env}-ecs` stack |
| `ECS_SERVICE_API` / `ECS_SERVICE_WEB` | Per-service names |
| `ECS_CONTAINER_NAME_API` / `ECS_CONTAINER_NAME_WEB` | Container names from task defs |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook |

## Rollback

```bash
aws ecs update-service \
  --cluster tellar-production \
  --service tellar-production-svc \
  --task-definition $PREVIOUS_TASK_DEF_ARN
```

## Tests

`infra/test/stacks.test.ts` asserts the security-critical properties:
- ECR has `imageScanOnPush: true`
- Secrets are RETAIN
- ECS has Container Insights
- Task SG does not allow 0.0.0.0/0 on 3000
- S3 assets bucket blocks all public access
- IAM GitHub Actions role trust policy is scoped to `refs/heads/main`
- Fargate service has circuit breaker with rollback

These run in CI on every push.
