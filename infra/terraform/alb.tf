locals {
  has_tls   = var.acm_certificate_arn != "" && var.domain_name != ""
  api_host  = var.domain_name != "" ? "api.${var.domain_name}" : ""
  app_host  = var.domain_name != "" ? "app.${var.domain_name}" : ""
}

resource "aws_lb" "this" {
  name               = "${local.name}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  drop_invalid_header_fields = true

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    enabled = true
  }
}

# ---- Target groups (ip targets for Fargate awsvpc) ----
resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/health/ready"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  deregistration_delay = 30
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name}-web"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  deregistration_delay = 30
}

# ---- HTTPS (preferred) ----
resource "aws_lb_listener" "https" {
  count             = local.has_tls ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn # app.<domain> and apex -> SPA
  }
}

resource "aws_lb_listener_rule" "https_api" {
  count        = local.has_tls ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
  condition {
    host_header {
      values = [local.api_host]
    }
  }
}

# ---- HTTP: redirect to HTTPS when TLS is configured, else serve directly (dev) ----
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = local.has_tls ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = local.has_tls ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
    target_group_arn = local.has_tls ? null : aws_lb_target_group.web.arn
  }
}

# Without TLS, still allow host-routing the API once DNS points at the ALB.
resource "aws_lb_listener_rule" "http_api" {
  count        = local.has_tls || var.domain_name == "" ? 0 : 1
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
  condition {
    host_header {
      values = [local.api_host]
    }
  }
}
