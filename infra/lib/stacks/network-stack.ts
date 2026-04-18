import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { AppConfig } from '../config';

interface NetworkStackProps extends StackProps { cfg: AppConfig }

export class NetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    const isProd = props.cfg.environment === 'production';

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${props.cfg.appName}-${props.cfg.environment}`,
      maxAzs: 2,
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        { name: 'public',  subnetType: ec2.SubnetType.PUBLIC,           cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogs', {
      logGroupName: `/vpc/${props.cfg.appName}-${props.cfg.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    new ec2.FlowLog(this, 'FlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.REJECT,
    });
  }
}
