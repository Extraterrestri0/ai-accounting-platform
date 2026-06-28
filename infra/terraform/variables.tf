variable "project" {
  type        = string
  default     = "mgi-delta"
  description = "Resource name prefix."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Deployment environment label."
}

variable "aws_region" {
  type        = string
  default     = "eu-central-1"
  description = "AWS region. MUST be EU for data residency (CLAUDE.md §2.7/§3)."
  validation {
    condition     = startswith(var.aws_region, "eu-")
    error_message = "aws_region must be an EU region (eu-*) — EU data residency is a non-negotiable invariant."
  }
}

# ---- Network ----
variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "az_count" {
  type        = number
  default     = 2
  description = "Number of AZs (multi-AZ requires >= 2)."
  validation {
    condition     = var.az_count >= 2
    error_message = "az_count must be >= 2 for multi-AZ."
  }
}

variable "single_nat_gateway" {
  type        = bool
  default     = true
  description = "One NAT GW to save cost (set false for one-per-AZ HA in prod)."
}

# ---- Database (RDS path) ----
variable "use_rds" {
  type        = bool
  default     = true
  description = "true = RDS PostgreSQL; false = self-managed EC2 Postgres (needed for BYPASSRLS — see README)."
}

variable "db_engine_version" {
  type    = string
  default = "16.4"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_allocated_storage" {
  type    = number
  default = 50
}

variable "db_name" {
  type    = string
  default = "accounting"
}

variable "db_master_username" {
  type        = string
  default     = "app_owner"
  description = "RDS master = object owner + migration role. NOT the app's runtime role."
}

variable "db_multi_az" {
  type    = bool
  default = true
}

# Self-managed Postgres fallback (use_rds = false)
variable "db_ec2_instance_type" {
  type    = string
  default = "t4g.medium"
}

variable "db_ec2_volume_gb" {
  type    = number
  default = 50
}

# ---- Redis ----
variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "redis_engine_version" {
  type    = string
  default = "7.1"
}

# ---- Images / services ----
variable "image_tag" {
  type        = string
  default     = "latest"
  description = "Container image tag for api/web/worker (override per release)."
}

variable "api_cpu" {
  type    = number
  default = 512
}
variable "api_memory" {
  type    = number
  default = 1024
}
variable "api_desired_count" {
  type    = number
  default = 2
}

variable "worker_cpu" {
  type    = number
  default = 512
}
variable "worker_memory" {
  type    = number
  default = 1024
}
variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "web_cpu" {
  type    = number
  default = 256
}
variable "web_memory" {
  type    = number
  default = 512
}
variable "web_desired_count" {
  type    = number
  default = 2
}

# ---- Public ingress / TLS ----
variable "domain_name" {
  type        = string
  default     = ""
  description = "Apex domain. The SPA is served at app.<domain>, API at api.<domain>. Empty = ALB DNS only (HTTP, dev only)."
}

variable "acm_certificate_arn" {
  type        = string
  default     = ""
  description = "ACM cert (in this region) covering api.<domain> and app.<domain>. Required for HTTPS (mandatory in prod, CLAUDE.md §11)."
}

# ---- Storage / WORM ----
variable "documents_retain_days" {
  type        = number
  default     = 3650
  description = "S3 Object Lock default retention (WORM). Mirrors STORAGE_RETAIN_DAYS."
}

# ---- Non-secret app config ----
variable "google_client_id" {
  type        = string
  default     = ""
  description = "Google OAuth Client ID (public). The secret goes in Secrets Manager."
}

variable "log_retention_days" {
  type    = number
  default = 30
}
