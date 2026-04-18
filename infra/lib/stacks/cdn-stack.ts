import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { AppConfig } from '../config';

interface CdnStackProps extends StackProps {
  cfg: AppConfig;
  alb: elbv2.ApplicationLoadBalancer;
  hostedZone: route53.IHostedZone;
  certificate: acm.Certificate;
}

export class CdnStack extends Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly assetsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    this.assetsBucket = new s3.Bucket(this, 'Assets', {
      bucketName: `${props.cfg.appName}-${props.cfg.environment}-assets`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        allowedOrigins: [`https://${props.cfg.domainName}`],
        allowedHeaders: ['*'],
      }],
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.assetsBucket);
    const albOrigin = new origins.LoadBalancerV2Origin(props.alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      httpsPort: 443,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: albOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        '/assets/*': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      domainNames: [props.cfg.domainName, `www.${props.cfg.domainName}`],
      certificate: props.certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    new route53.ARecord(this, 'ApexToCdn', {
      zone: props.hostedZone,
      recordName: props.cfg.domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      deleteExisting: true,
    });
    new route53.ARecord(this, 'WwwToCdn', {
      zone: props.hostedZone,
      recordName: `www.${props.cfg.domainName}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      deleteExisting: true,
    });

    new CfnOutput(this, 'DistributionDomain', { value: this.distribution.distributionDomainName });
    new CfnOutput(this, 'AssetsBucket',       { value: this.assetsBucket.bucketName });
  }
}
