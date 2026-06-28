output "alb_dns_name" {
  value       = aws_lb.this.dns_name
  description = "Point DNS records app.<domain> and api.<domain> (CNAME/alias) here."
}

output "ecr_repository_urls" {
  value       = { for k, v in aws_ecr_repository.this : k => v.repository_url }
  description = "Push images here before starting services."
}

output "db_host" {
  value       = local.db_host
  description = "PostgreSQL host (RDS endpoint or EC2 private IP)."
}

output "redis_url" {
  value       = local.redis_url
  description = "Redis connection string (TLS)."
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.id
}

output "ecs_cluster" {
  value = aws_ecs_cluster.this.name
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "For `aws ecs run-task` networkConfiguration."
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "secret_arns" {
  value = {
    db_master            = aws_secretsmanager_secret.db_master.arn
    db_app_user          = aws_secretsmanager_secret.db_app.arn
    jwt                  = aws_secretsmanager_secret.jwt.arn
    google_client_secret = aws_secretsmanager_secret.google_client_secret.arn
  }
  description = "Set google_client_secret out-of-band; app_user password is applied to the DB post-migrate."
}

output "public_origins" {
  value = {
    app = local.app_origin
    api = local.api_origin
  }
}
