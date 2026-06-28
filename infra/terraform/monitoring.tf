# ============================ Alerting (Beta Readiness — Phase 5) ============================
# Critical CloudWatch alarms → encrypted SNS topic. STARTER set (DB + Redis); validate with
# `terraform plan`. ALB 5xx / ECS CPU-mem / app-level (queue depth, DLQ, stuck exports, audit-chain
# verify) alarms are documented in docs/runbooks/observability.md and wired once the /metrics
# scrape (managed Prometheus or CloudWatch agent) is in place. No application code involved.

variable "alarm_email" {
  description = "Optional email subscribed to the alerts SNS topic. Empty = topic only (wire later)."
  type        = string
  default     = ""
}

resource "aws_sns_topic" "alerts" {
  name              = "${local.name}-alerts"
  kms_master_key_id = aws_kms_key.main.id
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ---- RDS (managed path only) ----
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count               = var.use_rds ? 1 : 0
  alarm_name          = "${local.name}-rds-cpu-high"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.this[0].identifier }
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  count               = var.use_rds ? 1 : 0
  alarm_name          = "${local.name}-rds-free-storage-low"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2147483648 # 2 GiB
  comparison_operator = "LessThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.this[0].identifier }
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  count               = var.use_rds ? 1 : 0
  alarm_name          = "${local.name}-rds-connections-high"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = var.db_max_connections_alarm
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.this[0].identifier }
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

variable "db_max_connections_alarm" {
  description = "DatabaseConnections threshold for the RDS connections alarm."
  type        = number
  default     = 180
}

# ---- ElastiCache Redis (BullMQ queues) ----
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${local.name}-redis-cpu-high"
  namespace           = "AWS/ElastiCache"
  metric_name         = "EngineCPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { ReplicationGroupId = aws_elasticache_replication_group.this.id }
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}
