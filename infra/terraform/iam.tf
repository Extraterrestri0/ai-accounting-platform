# ============================ ECS task execution role ============================
# Used by the ECS agent to pull images, write logs, and inject secrets.
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Read the specific secrets + decrypt with the CMK (for the `secrets` block in task defs).
data "aws_iam_policy_document" "execution_extra" {
  statement {
    sid     = "ReadSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.db_app.arn,
      aws_secretsmanager_secret.db_master.arn,
      aws_secretsmanager_secret.jwt.arn,
      aws_secretsmanager_secret.google_client_secret.arn,
    ]
  }
  statement {
    sid       = "DecryptSecrets"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "execution_extra" {
  name   = "secrets-access"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_extra.json
}

# ============================ Task roles (runtime identity) ============================
# API: read/write documents bucket (presigned URLs + WORM finalize) via the role —
# no static STORAGE_ACCESS_KEY needed (s3-object-storage falls back to this chain).
resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "api_task" {
  statement {
    sid     = "DocumentsRW"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:GetObjectRetention", "s3:PutObjectRetention"]
    resources = ["${aws_s3_bucket.documents.arn}/*"]
  }
  statement {
    sid       = "DocumentsList"
    actions   = ["s3:ListBucket", "s3:GetBucketObjectLockConfiguration"]
    resources = [aws_s3_bucket.documents.arn]
  }
  statement {
    sid       = "UseKmsForS3"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "api_task" {
  name   = "documents-access"
  role   = aws_iam_role.api_task.id
  policy = data.aws_iam_policy_document.api_task.json
}

# Worker: read documents only (OCR/extraction); no privileged paths (CLAUDE.md §4/§11).
resource "aws_iam_role" "worker_task" {
  name               = "${local.name}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "worker_task" {
  statement {
    sid       = "DocumentsRead"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.documents.arn, "${aws_s3_bucket.documents.arn}/*"]
  }
  statement {
    sid       = "UseKmsForS3"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "worker_task" {
  name   = "documents-read"
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.worker_task.json
}

# Web task has no AWS-side permissions (static nginx); it reuses the execution role only.
