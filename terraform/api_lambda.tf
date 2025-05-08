locals {
  api_lambda_name  = "${var.app_name}-api-lambda"
  api_gateway_name = "${var.app_name}-api-gateway"
  lambda_zip_path  = "lambda_package.zip" # Ensure this file is in the terraform directory
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_execution_role" {
  name = "${local.api_lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Name    = "${local.api_lambda_name}-role"
    Project = var.app_name
  }
}

# Basic Lambda execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Attach VPC access policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Optional: Attach policy to allow reading Redis AUTH token from Secrets Manager
# resource "aws_iam_policy" "lambda_read_redis_secret" {
#   name        = "${local.api_lambda_name}-read-redis-secret-policy"
#   description = "Allow Lambda to read Redis AUTH token from Secrets Manager"
#
#   policy = jsonencode({
#     Version = "2012-10-17",
#     Statement = [
#       {
#         Action = [
#           "secretsmanager:GetSecretValue"
#         ],
#         Effect   = "Allow",
#         Resource = var.redis_auth_token_secret_arn # Use the variable holding the secret ARN
#       }
#     ]
#   })
# }
#
# resource "aws_iam_role_policy_attachment" "lambda_read_redis_secret_attach" {
#   role       = aws_iam_role.lambda_execution_role.name
#   policy_arn = aws_iam_policy.lambda_read_redis_secret.arn
# }


# Lambda Function
# Note: The lambda_package.zip must be created manually and placed in this terraform directory.
# See docs/phase-four-todo.md for an example zip command.
resource "aws_lambda_function" "api_lambda" {
  function_name = local.api_lambda_name
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "server.handler" // Assuming your entry point is server.js exporting a handler
  runtime       = "nodejs18.x"     // Or your preferred Node.js runtime

  filename = local.lambda_zip_path
  # The source_code_hash uses try() to allow `terraform plan` to succeed even if
  # lambda_package.zip doesn't exist yet.
  # However, lambda_package.zip MUST exist in the terraform/ directory when running `terraform apply`
  # for the Lambda function to be deployed correctly.
  # The fallback hash is the base64sha256 of an empty file: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  source_code_hash = try(filebase64sha256(local.lambda_zip_path), "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=") // Re-deploy on zip change

  timeout     = 30  // seconds
  memory_size = 256 // MB

  environment {
    variables = {
      NODE_ENV        = "production"
      MISTRAL_API_KEY = var.mistral_api_key
      REDIS_HOST      = aws_elasticache_cluster.redis_cluster.cache_nodes[0].address
      REDIS_PORT      = aws_elasticache_cluster.redis_cluster.cache_nodes[0].port
      # REDIS_AUTH_TOKEN_SECRET_ARN = var.redis_auth_token_secret_arn # Uncomment if using Redis Auth + Secrets Manager
    }
  }

  # VPC configuration to allow access to ElastiCache
  vpc_config {
    # Lambda will now reside in the new private subnets
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  tags = {
    Name    = local.api_lambda_name
    Project = var.app_name
  }

  // VPC configuration will be added here when ElastiCache is set up
  // vpc_config {
  //   subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id] // Example
  //   security_group_ids = [aws_security_group.lambda_sg.id]
  // }
  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    # aws_iam_role_policy_attachment.lambda_read_redis_secret_attach # Uncomment if using Redis Auth + Secrets Manager
    aws_elasticache_cluster.redis_cluster # Ensure ElastiCache is ready before Lambda uses its details
  ]
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "api" {
  name        = local.api_gateway_name
  description = "API Gateway for ${var.app_name}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name    = local.api_gateway_name
    Project = var.app_name
  }
}

# API Gateway Resource for proxying all requests
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "{proxy+}" // Catch-all path
}

# API Gateway Method for the proxy resource
resource "aws_api_gateway_method" "proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration with Lambda
resource "aws_api_gateway_integration" "lambda_proxy_integration" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_method.proxy_any.resource_id
  http_method = aws_api_gateway_method.proxy_any.http_method

  integration_http_method = "POST" // For AWS_PROXY integration with Lambda
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api_lambda.invoke_arn
}

# API Gateway Deployment
# Changes to methods or integrations require a new deployment.
# Using a trigger based on the configuration of relevant resources.
resource "aws_api_gateway_deployment" "api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.proxy.id,
      aws_api_gateway_method.proxy_any.id,
      aws_api_gateway_integration.lambda_proxy_integration.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"

  tags = {
    Name    = "${local.api_gateway_name}-prod-stage"
    Project = var.app_name
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      ip                      = "$context.identity.sourceIp"
      caller                  = "$context.identity.caller"
      user                    = "$context.identity.user"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      resourcePath            = "$context.resourcePath"
      status                  = "$context.status"
      protocol                = "$context.protocol"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
      errorMessage            = "$context.error.message"
      errorResponseType       = "$context.error.responseType"
      integrationLatency      = "$context.integration.latency"
      responseLatency         = "$context.responseLatency"
      wafResponseCode         = "$context.wafResponseCode" # If using WAF
      wafError                = "$context.wafError"        # If using WAF
      extendedRequestId       = "$context.extendedRequestId"
      path                    = "$context.path"
    })
  }

  depends_on = [aws_api_gateway_account.api_gateway_cloudwatch_role]
}

# --- CloudWatch Logging for API Gateway ---

# IAM Role for API Gateway to write to CloudWatch Logs
resource "aws_iam_role" "api_gateway_cloudwatch_logs_role" {
  name = "${local.api_gateway_name}-cloudwatch-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })

  tags = {
    Name    = "${local.api_gateway_name}-cloudwatch-logs-role"
    Project = var.app_name
  }
}

# IAM Policy for API Gateway to write to CloudWatch Logs
resource "aws_iam_policy" "api_gateway_cloudwatch_logs_policy" {
  name        = "${local.api_gateway_name}-cloudwatch-logs-policy"
  description = "Allows API Gateway to write logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents",
          "logs:GetLogEvents",
          "logs:FilterLogEvents"
        ],
        Effect   = "Allow",
        Resource = "*" # Consider restricting this to the specific log group ARN if preferred
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch_logs_attach" {
  role       = aws_iam_role.api_gateway_cloudwatch_logs_role.name
  policy_arn = aws_iam_policy.api_gateway_cloudwatch_logs_policy.arn
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/api-gateway/${local.api_gateway_name}"
  retention_in_days = 30 # Adjust as needed

  tags = {
    Name    = "${local.api_gateway_name}-logs"
    Project = var.app_name
  }
}

# Associate the IAM role with API Gateway for CloudWatch logging
resource "aws_api_gateway_account" "api_gateway_cloudwatch_role" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch_logs_role.arn

  depends_on = [aws_iam_role.api_gateway_cloudwatch_logs_role]
}


# Lambda Permission for API Gateway invocation
resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* part allows invocation from any stage, method on this API
  source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Cloudflare DNS Record for the API
resource "cloudflare_record" "api_dns" {
  zone_id = var.cloudflare_zone_id
  name    = "api" # api.yourdomain.com
  # The `content` attribute should point to the API Gateway regional endpoint hostname.
  # Format: {rest_api_id}.execute-api.{region}.amazonaws.com
  content = "${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com"
  type    = "CNAME"
  proxied = true # Enable Cloudflare proxy
  ttl     = 1    # Auto TTL when proxied

  depends_on = [aws_api_gateway_stage.prod]
}
