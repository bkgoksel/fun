locals {
  api_lambda_name = "${var.app_name}-api-lambda"
  api_gateway_name = "${var.app_name}-api-gateway"
  lambda_zip_path = "lambda_package.zip" # Ensure this file is in the terraform directory
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_execution_role" {
  name = "${local.api_lambda_name}-role"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
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

# Placeholder for Lambda VPC execution policy if connecting to ElastiCache in VPC
# resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
#   role       = aws_iam_role.lambda_execution_role.name
#   policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
# }

# Lambda Function
# Note: The lambda_package.zip must be created manually and placed in this terraform directory.
# See docs/phase-four-todo.md for an example zip command.
resource "aws_lambda_function" "api_lambda" {
  function_name = local.api_lambda_name
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "lambda.handler" // Assuming your entry point is lambda.js exporting a handler
  runtime       = "nodejs18.x"     // Or your preferred Node.js runtime

  filename         = local.lambda_zip_path
  source_code_hash = filebase64sha256(local.lambda_zip_path) // Re-deploy on zip change

  timeout     = 30  // seconds
  memory_size = 256 // MB

  environment {
    variables = {
      NODE_ENV                      = "production"
      MISTRAL_API_KEY               = var.mistral_api_key
      // REDIS_HOST will be set once ElastiCache is deployed
      // REDIS_PORT will be set once ElastiCache is deployed
      // REDIS_AUTH_TOKEN_SECRET_ARN = var.redis_auth_token_secret_arn // Uncomment if using Redis Auth + Secrets Manager
    }
  }

  tags = {
    Name    = local.api_lambda_name
    Project = var.app_name
  }

  // VPC configuration will be added here when ElastiCache is set up
  // vpc_config {
  //   subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id] // Example
  //   security_group_ids = [aws_security_group.lambda_sg.id] // Example
  // }
  // depends_on = [aws_iam_role_policy_attachment.lambda_vpc_execution] // If using VPC access role
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
  value   = aws_api_gateway_stage.prod.invoke_url # This gives https://id.execute-api.region.amazonaws.com/stage
                # Cloudflare CNAME needs just the hostname part.
                # We extract it using replace.
                # Example: "d342xxxx.execute-api.us-west-2.amazonaws.com"
  type    = "CNAME"
  proxied = true # Enable Cloudflare proxy
  ttl     = 1    # Auto TTL when proxied

  # Extract hostname from invoke_url
  # invoke_url is like https://<id>.execute-api.<region>.amazonaws.com/<stage>
  # We need <id>.execute-api.<region>.amazonaws.com
  # Using a more robust way to get the hostname for CNAME
  # The invoke_url from aws_api_gateway_stage includes the stage, which is not part of the CNAME target.
  # The actual hostname is part of aws_api_gateway_rest_api.id.execute-api.aws_region.amazonaws.com
  # However, API Gateway custom domain is a better practice for cleaner URLs.
  # For now, we'll use the invoke URL's hostname part.
  # A common way to get the hostname for CNAME:
  # aws_api_gateway_rest_api.api.id.execute-api.var.aws_region.amazonaws.com
  # but invoke_url is simpler if we strip https:// and /stage
  # For regional endpoints, the format is ${rest_api_id}.execute-api.${region}.amazonaws.com
  # The invoke_url is https://${rest_api_id}.execute-api.${region}.amazonaws.com/${stage_name}
  # So we need to strip "https://" and "/${stage_name}"
  # Using regex to extract the hostname part of the invoke_url
  # Example: https://abcdef123.execute-api.us-west-2.amazonaws.com/prod -> abcdef123.execute-api.us-west-2.amazonaws.com
  # This is a common pattern, but for Cloudflare CNAME, it expects just the hostname.
  # The `invoke_url` output from `aws_api_gateway_stage` is the full URL.
  # We need to parse the hostname from it.
  # A simpler way is to use the `execution_arn` to build the hostname, but that's also complex.
  # The most direct way for a regional endpoint is:
  # ${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com
  # Let's use this pattern.
  # value = "${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com"
  # The above is correct. The `invoke_url` from the stage includes the stage name.
  # The CNAME should point to the base execute-api domain.
  # For `aws_api_gateway_stage`, `invoke_url` is `https://{rest_api_id}.execute-api.{region}.amazonaws.com/{stage_name}`
  # The target for CNAME should be `{rest_api_id}.execute-api.{region}.amazonaws.com`
  # We can use `replace` to strip the protocol and stage path.
  # content = replace(replace(aws_api_gateway_stage.prod.invoke_url, "https://", ""), "/${aws_api_gateway_stage.prod.stage_name}", "")
  # This is getting complex. Let's use the direct construction.
  content = "${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com"

  depends_on = [aws_api_gateway_stage.prod]
}
