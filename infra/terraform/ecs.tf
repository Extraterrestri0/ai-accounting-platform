locals {
  ecr = { for k, v in aws_ecr_repository.this : k => v.repository_url }

  # transit_encryption_enabled on Redis => clients must use rediss://
  redis_url = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"

  # Public origins (used for CORS, OAuth redirect, SPA<->API link).
  api_origin = local.has_tls ? "https://${local.api_host}" : "http://${aws_lb.this.dns_name}"
  app_origin = local.has_tls ? "https://${local.app_host}" : "http://${aws_lb.this.dns_name}"

  # Non-secret env shared by api + worker (DB/Redis/storage).
  data_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "PGHOST", value = local.db_host },
    { name = "PGPORT", value = "5432" },
    { name = "PGUSER", value = "app_user" }, # RLS subject; NEVER the owner
    { name = "PGDATABASE", value = var.db_name },
    { name = "REDIS_URL", value = local.redis_url },
    { name = "STORAGE_DRIVER", value = "s3" },
    { name = "STORAGE_BUCKET", value = aws_s3_bucket.documents.id },
    { name = "STORAGE_REGION", value = var.aws_region },
    { name = "STORAGE_RETAIN_DAYS", value = tostring(var.documents_retain_days) },
    # No STORAGE_ENDPOINT / STORAGE_ACCESS_KEY => SDK uses the task IAM role.
  ]

  app_secret = { name = "PGPASSWORD", valueFrom = aws_secretsmanager_secret.db_app.arn }
}

resource "aws_ecs_cluster" "this" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "svc" {
  for_each          = toset(["api", "web", "worker", "migrate"])
  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

# ============================ API ============================
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${local.ecr["api"]}:${var.image_tag}"
    essential = true
    portMappings = [{ containerPort = 3000 }]
    environment = concat(local.data_env, [
      { name = "PORT", value = "3000" },
      { name = "CORS_ORIGINS", value = local.app_origin },
      { name = "WEB_APP_URL", value = local.app_origin },
      { name = "GOOGLE_REDIRECT_URI", value = "${local.api_origin}/auth/google/callback" },
      { name = "GOOGLE_CLIENT_ID", value = var.google_client_id },
    ])
    secrets = [
      local.app_secret,
      { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
      { name = "AUTH_JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
      { name = "GOOGLE_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.google_client_secret.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.svc["api"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.app.id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }
  depends_on = [aws_lb_listener.http]
}

# ============================ Worker ============================
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  container_definitions = jsonencode([{
    name        = "worker"
    image       = "${local.ecr["worker"]}:${var.image_tag}"
    essential   = true
    environment = local.data_env
    secrets     = [local.app_secret]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.svc["worker"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.worker.id]
  }
}

# ============================ Web (static SPA via nginx) ============================
# NOTE: NEXT_PUBLIC_API_URL is baked into the image at BUILD time (Dockerfile.web ARG),
# so it must be built with =${local.api_origin}. There is no runtime API env here.
resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${local.ecr["web"]}:${var.image_tag}"
    essential = true
    portMappings = [{ containerPort = 8080 }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.svc["web"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "web"
      }
    }
  }])
}

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.app.id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 8080
  }
  depends_on = [aws_lb_listener.http]
}

# ============================ Migrate (one-off task, not a service) ============================
# Run with: aws ecs run-task ... (see runbook). Connects as the MASTER/owner role.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name      = "migrate"
    image     = "${local.ecr["api"]}:${var.image_tag}"
    essential = true
    command   = ["node", "scripts/migrate.js"]
    environment = [
      { name = "PGHOST", value = local.db_host },
      { name = "PGPORT", value = "5432" },
      { name = "PGDATABASE", value = var.db_name },
      { name = "MIGRATION_USER", value = var.db_master_username },
    ]
    secrets = [
      { name = "MIGRATION_PASSWORD", valueFrom = aws_secretsmanager_secret.db_master.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.svc["migrate"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "migrate"
      }
    }
  }])
}
