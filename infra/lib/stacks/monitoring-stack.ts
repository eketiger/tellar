import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AppConfig } from '../config';

interface MonitoringStackProps extends StackProps {
  cfg: AppConfig;
  cluster: ecs.Cluster;
  service: ecs.FargateService;
  alb: elbv2.ApplicationLoadBalancer;
}

export class MonitoringStack extends Stack {
  public readonly topic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    const name = `${props.cfg.appName}-${props.cfg.environment}`;

    this.topic = new sns.Topic(this, 'AlarmTopic', { topicName: `${name}-alarms` });
    this.topic.addSubscription(new sns_subs.EmailSubscription(props.cfg.alarmEmail));

    const action = new cw_actions.SnsAction(this.topic);

    const cpu = props.service.metricCpuUtilization();
    const memory = props.service.metricMemoryUtilization();

    new cloudwatch.Alarm(this, 'HighCpu', {
      metric: cpu, threshold: 80, evaluationPeriods: 5, datapointsToAlarm: 5,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS service CPU > 80% for 5 minutes',
    }).addAlarmAction(action);

    new cloudwatch.Alarm(this, 'HighMemory', {
      metric: memory, threshold: 85, evaluationPeriods: 5, datapointsToAlarm: 5,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(action);

    const runningTasks = new cloudwatch.Metric({
      namespace: 'ECS/ContainerInsights',
      metricName: 'RunningTaskCount',
      dimensionsMap: { ClusterName: props.cluster.clusterName, ServiceName: props.service.serviceName },
      period: Duration.minutes(1),
      statistic: 'Average',
    });
    new cloudwatch.Alarm(this, 'TaskCountLow', {
      metric: runningTasks,
      threshold: props.cfg.desiredCount,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    }).addAlarmAction(action);

    new cloudwatch.Alarm(this, 'High5xx', {
      metric: props.alb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT),
      threshold: 10, evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(action);

    new cloudwatch.Alarm(this, 'HighResponseTime', {
      metric: props.alb.metrics.targetResponseTime({ statistic: 'p99' }),
      threshold: 3,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(action);

    new cloudwatch.Alarm(this, 'UnhealthyHosts', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: { LoadBalancer: props.alb.loadBalancerFullName },
        statistic: 'Maximum',
      }),
      threshold: 0,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(action);

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: name,
    });
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({ title: 'CPU %', left: [cpu] }),
      new cloudwatch.GraphWidget({ title: 'Memory %', left: [memory] }),
      new cloudwatch.GraphWidget({ title: 'ALB requests', left: [props.alb.metrics.requestCount()] }),
      new cloudwatch.GraphWidget({ title: '5xx count', left: [props.alb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT)] }),
      new cloudwatch.GraphWidget({ title: 'P99 latency', left: [props.alb.metrics.targetResponseTime({ statistic: 'p99' })] }),
      new cloudwatch.SingleValueWidget({ title: 'Running tasks', metrics: [runningTasks] }),
    );
  }
}
