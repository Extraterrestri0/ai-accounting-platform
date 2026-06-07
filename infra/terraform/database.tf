# ============================ PostgreSQL ============================
# Two mutually-exclusive paths (see README "BYPASSRLS" blocker):
#   use_rds = true  -> managed RDS  (note: cannot grant BYPASSRLS — refactor or use EC2)
#   use_rds = false -> self-managed Postgres on EC2 (true superuser; keeps all invariants)

resource "aws_db_subnet_group" "this" {
  count      = var.use_rds ? 1 : 0
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "this" {
  count  = var.use_rds ? 1 : 0
  name   = "${local.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl" # TLS in transit (CLAUDE.md §11)
    value = "1"
  }
}

resource "aws_db_instance" "this" {
  count      = var.use_rds ? 1 : 0
  identifier = "${local.name}-pg"

  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 4
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.main.arn

  db_name  = var.db_name
  username = var.db_master_username
  password = random_password.db_master.result
  port     = 5432

  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.this[0].name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.this[0].name
  publicly_accessible    = false

  backup_retention_period   = 14
  copy_tags_to_snapshot     = true
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-pg-final"

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.main.arn
  enabled_cloudwatch_logs_exports       = ["postgresql"]
  auto_minor_version_upgrade            = true
}

# ---- Self-managed Postgres on EC2 (BYPASSRLS-capable fallback) ----
# Minimal single-node scaffold. For real HA use a replica + automated backups to EU S3.
data "aws_ami" "al2023" {
  count       = var.use_rds ? 0 : 1
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }
}

resource "aws_instance" "db" {
  count                  = var.use_rds ? 0 : 1
  ami                    = data.aws_ami.al2023[0].id
  instance_type          = var.db_ec2_instance_type
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.db.id]

  root_block_device {
    encrypted   = true
    kms_key_id  = aws_kms_key.main.arn
    volume_size = 20
  }

  ebs_block_device {
    device_name = "/dev/xvdf"
    encrypted   = true
    kms_key_id  = aws_kms_key.main.arn
    volume_size = var.db_ec2_volume_gb
  }

  # NOTE: bootstrap (install postgres 16, init data dir on /dev/xvdf, create the
  # `accounting` DB + master role, enable TLS) is intentionally left to user-data /
  # a config-management step in the runbook — kept out of TF to avoid drift.
  tags = { Name = "${local.name}-pg-ec2" }
}

# ============================ ElastiCache Redis ============================
resource "aws_elasticache_subnet_group" "this" {
  name       = "${local.name}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${local.name}-redis"
  description          = "${local.name} BullMQ queues + cache"

  engine         = "redis"
  engine_version = var.redis_engine_version
  node_type      = var.redis_node_type
  port           = 6379

  num_cache_clusters         = var.az_count
  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.main.arn
  transit_encryption_enabled = true # app must use rediss:// (see ecs.tf REDIS_URL)

  snapshot_retention_limit = 7
}

# Resolved Postgres host for the app, regardless of path.
locals {
  db_host = var.use_rds ? aws_db_instance.this[0].address : aws_instance.db[0].private_ip
}
