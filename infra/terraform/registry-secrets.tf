# ============================ ECR repositories ============================
resource "aws_ecr_repository" "this" {
  for_each             = toset(["api", "web", "worker"])
  name                 = "${local.name}/${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }
      action       = { type = "expire" }
    }]
  })
}

# ============================ Generated secrets ============================
# DB master (RDS owner / migration role) password.
resource "random_password" "db_master" {
  length  = 32
  special = false
}

# DB app_user password — app_user is created passwordless by migration 0001;
# the runbook sets this via `ALTER ROLE app_user PASSWORD` after migrations.
resource "random_password" "db_app" {
  length  = 32
  special = false
}

# JWT signing secret.
resource "random_password" "jwt" {
  length  = 48
  special = false
}

locals {
  secret_prefix = "${local.name}/"
}

resource "aws_secretsmanager_secret" "db_master" {
  name       = "${local.secret_prefix}db/master_password"
  kms_key_id = aws_kms_key.main.arn
}
resource "aws_secretsmanager_secret_version" "db_master" {
  secret_id     = aws_secretsmanager_secret.db_master.id
  secret_string = random_password.db_master.result
}

resource "aws_secretsmanager_secret" "db_app" {
  name       = "${local.secret_prefix}db/app_user_password"
  kms_key_id = aws_kms_key.main.arn
}
resource "aws_secretsmanager_secret_version" "db_app" {
  secret_id     = aws_secretsmanager_secret.db_app.id
  secret_string = random_password.db_app.result
}

resource "aws_secretsmanager_secret" "jwt" {
  name       = "${local.secret_prefix}auth/jwt_secret"
  kms_key_id = aws_kms_key.main.arn
}
resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

# Google OAuth client secret — provided out-of-band (CLI/console), never in code.
# Terraform creates the container and ignores the value so it won't clobber it.
resource "aws_secretsmanager_secret" "google_client_secret" {
  name       = "${local.secret_prefix}auth/google_client_secret"
  kms_key_id = aws_kms_key.main.arn
}
resource "aws_secretsmanager_secret_version" "google_client_secret" {
  secret_id     = aws_secretsmanager_secret.google_client_secret.id
  secret_string = "REPLACE_ME"
  lifecycle {
    ignore_changes = [secret_string]
  }
}
