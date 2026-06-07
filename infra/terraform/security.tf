# ---- Customer-managed KMS key: encrypts RDS, Redis, S3, Secrets, logs (CLAUDE.md §11) ----
resource "aws_kms_key" "main" {
  description             = "${local.name} data encryption (RDS/Redis/S3/Secrets/logs)"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}

# Allow CloudWatch Logs to use the key (log groups are KMS-encrypted).
resource "aws_kms_key_policy" "main" {
  key_id = aws_kms_key.main.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableRoot"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "CloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${var.aws_region}.amazonaws.com" }
        Action    = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
      }
    ]
  })
}

# ============================ Security groups ============================
# ALB: public 80/443.
resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public ingress to the ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP (redirected to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-alb" }
}

# App tasks (api + web): only the ALB may reach them.
resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "ECS app tasks (api 3000, web 8080)"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "api"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  ingress {
    description     = "web"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-app" }
}

# Worker: no inbound; outbound only.
resource "aws_security_group" "worker" {
  name        = "${local.name}-worker"
  description = "ECS worker tasks (no inbound)"
  vpc_id      = aws_vpc.this.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-worker" }
}

# Postgres: reachable only from app + worker tasks.
resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "PostgreSQL 5432 from app/worker only"
  vpc_id      = aws_vpc.this.id
  ingress {
    description     = "postgres"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id, aws_security_group.worker.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-db" }
}

# Redis: reachable only from app + worker tasks.
resource "aws_security_group" "redis" {
  name        = "${local.name}-redis"
  description = "Redis 6379 from app/worker only"
  vpc_id      = aws_vpc.this.id
  ingress {
    description     = "redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id, aws_security_group.worker.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-redis" }
}
