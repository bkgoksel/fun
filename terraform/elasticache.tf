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

# --- NAT Gateway for Lambda Internet Access ---

data "aws_availability_zones" "available" {}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  domain   = "vpc"
  tags = {
    Name = "${var.app_name}-nat-eip"
  }
}

# New Private Subnets for Lambda
# IMPORTANT: Adjust the cidr_block values below to be unique and valid within your VPC.
# These are example CIDRs.
resource "aws_subnet" "private_a" {
  vpc_id            = data.aws_vpc.default.id
  # Using CIDR 172.31.80.0/24 based on VPC CIDR 172.31.0.0/16
  # Ensure this is not overlapping with existing subnets.
  cidr_block        = "172.31.80.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name    = "${var.app_name}-private-subnet-a"
    Project = var.app_name
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = data.aws_vpc.default.id
  # Using CIDR 172.31.81.0/24 based on VPC CIDR 172.31.0.0/16
  # Ensure this is not overlapping with existing subnets.
  cidr_block        = "172.31.81.0/24"
  availability_zone = data.aws_availability_zones.available.names[1] # Assumes at least 2 AZs

  tags = {
    Name    = "${var.app_name}-private-subnet-b"
    Project = var.app_name
  }
}

# NAT Gateway
# Placed in the first default subnet, assuming it's public and has an IGW route.
# If not, you'll need to specify a known public subnet_id.
resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = data.aws_subnets.default.ids[0] 

  tags = {
    Name    = "${var.app_name}-nat-gateway"
    Project = var.app_name
  }
  depends_on = [aws_eip.nat] # Explicit dependency, though allocation_id implies it
}

# Route Table for Private Subnets
resource "aws_route_table" "private" {
  vpc_id = data.aws_vpc.default.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }

  tags = {
    Name    = "${var.app_name}-private-route-table"
    Project = var.app_name
  }
}

# Associate Private Subnets with the Private Route Table
resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private.id
}

# --- End NAT Gateway Section ---

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

  subnet_group_name  = aws_elasticache_subnet_group.redis_subnet_group.name
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
