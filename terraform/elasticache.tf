# --- Networking for ElastiCache ---
# Using default VPC and subnets for simplicity.
# For production, consider creating a dedicated VPC and private subnets.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security Group for Lambda Function (allows outbound to ElastiCache SG)
resource "aws_security_group" "lambda_sg" {
  name        = "${var.app_name}-lambda-sg"
  description = "Security group for Lambda function to access ElastiCache"
  vpc_id      = data.aws_vpc.default.id

  # Allow all outbound traffic (adjust if stricter rules are needed)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.app_name}-lambda-sg"
    Project = var.app_name
  }
}

# Security Group for ElastiCache Cluster (allows inbound from Lambda SG)
resource "aws_security_group" "elasticache_sg" {
  name        = "${var.app_name}-elasticache-sg"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = data.aws_vpc.default.id

  # Allow inbound Redis traffic from the Lambda security group
  ingress {
    from_port       = 6379 # Default Redis port
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda_sg.id]
  }

  # Allow all outbound traffic (needed for cluster communication, updates, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.app_name}-elasticache-sg"
    Project = var.app_name
  }
}

# --- ElastiCache Resources ---

# ElastiCache Subnet Group (using default VPC subnets)
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "${var.app_name}-redis-subnet-group"
  subnet_ids = data.aws_subnets.default.ids # Use subnets from the default VPC

  tags = {
    Name    = "${var.app_name}-redis-subnet-group"
    Project = var.app_name
  }
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis_cluster" {
  cluster_id           = "${var.app_name}-redis-cluster"
  engine               = "redis"
  node_type            = var.elasticache_node_type
  num_cache_nodes      = var.elasticache_num_nodes
  parameter_group_name = "default.redis7" # Adjust based on desired Redis version/family
  port                 = 6379

  subnet_group_name = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids = [aws_security_group.elasticache_sg.id]

  # Consider setting apply_immediately = true during development for faster updates
  # apply_immediately = true

  # Consider enabling AUTH token for security
  # transit_encryption_enabled = true # Recommended for production
  # auth_token = random_password.redis_auth_token.result # If using random password stored in Secrets Manager

  tags = {
    Name    = "${var.app_name}-redis-cluster"
    Project = var.app_name
  }

  depends_on = [aws_security_group.elasticache_sg]
}

# Optional: Resource for generating and storing Redis AUTH token in Secrets Manager
# resource "random_password" "redis_auth_token" {
#   length           = 32
#   special          = true
#   override_special = "_%@"
# }

# resource "aws_secretsmanager_secret" "redis_auth_token" {
#   name = "${var.app_name}/redis-auth-token"
# }

# resource "aws_secretsmanager_secret_version" "redis_auth_token_value" {
#   secret_id     = aws_secretsmanager_secret.redis_auth_token.id
#   secret_string = random_password.redis_auth_token.result
# }
