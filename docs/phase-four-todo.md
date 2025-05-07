# Phase 4: Deployment with Infrastructure as Code (Terraform) - TODO List

This document outlines the tasks required to deploy the Storied Recipes project using Terraform to manage AWS and Cloudflare resources, as defined in `spec.md`.

## 0. Prerequisites & Initial Terraform Setup

**Goal:** Prepare the environment for Terraform and establish foundational configurations.

**Actions & Files:**

- **DONE: Install Terraform CLI:** Ensure Terraform CLI is installed locally.
- **DONE: AWS Account & CLI Setup:**
  - Ensure an AWS account is available.
  - Configure AWS CLI with credentials and default region, or ensure Terraform can otherwise authenticate (e.g., via environment variables or instance profiles if run in CI/CD).
- **DONE: Cloudflare Account & API Token:**
  - Ensure a Cloudflare account is available and the domain is managed there.
  - Generate a Cloudflare API Token with permissions to edit DNS records for the target zone.
- **DONE: Create Terraform Project Directory:**
  - E.g., `mkdir terraform` at the project root.
  - All subsequent Terraform files (`.tf`) will reside here.
- **DONE: Create `terraform/providers.tf`:**

  - **Purpose:** Define required Terraform providers (AWS, Cloudflare).
  - **Content:**

    ```terraform
    terraform {
      required_providers {
        aws = {
          source  = "hashicorp/aws"
          version = "~> 5.0" # Or latest
        }
        cloudflare = {
          source  = "cloudflare/cloudflare"
          version = "~> 4.0" # Or latest
        }
      }
      # Optional: Configure Terraform backend (e.g., S3 for remote state)
      # backend "s3" {
      #   bucket         = "your-terraform-state-bucket-name"
      #   key            = "storied-recipes/terraform.tfstate"
      #   region         = "your-aws-region"
      #   encrypt        = true
      #   dynamodb_table = "your-terraform-state-lock-table" # For state locking
      # }
    }

    provider "aws" {
      region = var.aws_region
      # Credentials configured via AWS CLI, environment variables, or instance profile
    }

    provider "cloudflare" {
      api_token = var.cloudflare_api_token
      # Or use CLOUDFLARE_API_TOKEN environment variable
    }
    ```

- **DONE: Create `terraform/variables.tf`:**

  - **Purpose:** Define input variables for the Terraform configuration.
  - **Content (example):**

    ```terraform
    variable "aws_region" {
      description = "AWS region for deploying resources."
      type        = string
      default     = "us-east-1" # Or your preferred region
    }

    variable "cloudflare_api_token" {
      description = "Cloudflare API Token."
      type        = string
      sensitive   = true
      # Best practice: Set via TF_VAR_cloudflare_api_token environment variable
    }

    variable "cloudflare_zone_id" {
      description = "Cloudflare Zone ID for your domain."
      type        = string
      # Best practice: Set via TF_VAR_cloudflare_zone_id environment variable
    }

    variable "domain_name" {
      description = "The primary domain name for the application (e.g., storied.recipes)."
      type        = string
    }

    variable "app_name" {
      description = "Application name prefix for resources."
      type        = string
      default     = "storied-recipes"
    }

    variable "mistral_api_key" {
      description = "Mistral API Key for the LLM service."
      type        = string
      sensitive   = true
      # Best practice: Set via TF_VAR_mistral_api_key environment variable or store in Secrets Manager
    }

    variable "elasticache_node_type" {
      description = "Node type for the ElastiCache Redis cluster (e.g., cache.t3.micro)."
      type        = string
      default     = "cache.t3.micro"
    }

    variable "elasticache_num_nodes" {
      description = "Number of cache nodes in the ElastiCache Redis cluster."
      type        = number
      default     = 1
    }

    # Optional: If you plan to use Redis AUTH token stored in AWS Secrets Manager
    # variable "redis_auth_token_secret_arn" {
    #   description = "ARN of the AWS Secrets Manager secret storing the Redis AUTH token."
    #   type        = string
    #   default     = "" # Set to actual ARN if used
    #   sensitive   = true
    # }
    ```

- **DONE: Create `terraform/outputs.tf` (initially empty or with placeholders):**
  - **Purpose:** Define outputs from the Terraform configuration (e.g., CloudFront URL, API Gateway URL).
- **DONE: Initialize Terraform:**
  - Run `terraform init` in the `terraform` directory.

**Testing:**

- **DONE:** `terraform init` completes successfully.
- **DONE:** `terraform validate` passes.
- **DONE:** `terraform plan` (with necessary TF_VARs set) shows a plan without errors (even if it's creating no resources yet).

## 1. Frontend Deployment (AWS S3 + CloudFront)

**Goal:** Deploy static frontend assets (HTML, CSS, JS) to S3 and serve them via CloudFront with HTTPS.

**Actions & Files (Terraform - in `terraform/` directory):**

- **DONE: Create `terraform/s3_cloudfront.tf`:**
  - **DONE: `aws_s3_bucket`:** For static website hosting.
  - **DONE: `aws_s3_bucket_public_access_block`:** Restrict public access appropriately.
  - **DONE: `aws_cloudfront_origin_access_control` (OAC):** To allow CloudFront to access S3 securely.
  - **DONE: `aws_s3_bucket_policy`:** Grant OAC read access to the S3 bucket.
  - **DONE: `aws_acm_certificate`:** For HTTPS.
    - Must be in `us-east-1` for CloudFront.
    - Uses DNS validation with Cloudflare provider automation.
  - **DONE: `aws_cloudfront_distribution`:**
    - Configured S3 origin with OAC.
    - Configured viewer certificate with ACM certificate ARN.
    - Set up default root object (`index.html`).
    - Configured behaviors (caching, redirect-to-https, SPA error handling).
  - **DONE: `cloudflare_record`:**
    - Created CNAME records for `www` and apex pointing to the CloudFront distribution domain name.
    - Created CNAME records for ACM validation (DNS only).
    - Ensured Cloudflare proxy status is set as desired.
- **DONE: Update `terraform/outputs.tf`:**
  - Output S3 bucket name.
  - Output CloudFront distribution ID and domain name.
  - Output website URLs and ACM certificate ARN.
- **DONE: Manual/Scripted Step (Outside Terraform): Deploy Frontend Files:**
  - After Terraform applies, use AWS CLI to sync `public/` directory (from project root) to the S3 bucket:
    `aws s3 sync public/ "s3://$(terraform -chdir=terraform output -raw s3_site_bucket_name)" --delete`

**Testing:**

- **DONE:** `terraform plan` and `terraform apply` complete successfully.
- **DONE:** S3 bucket and CloudFront distribution are created in AWS.
- **DONE:** ACM certificate is issued and validated.
- **DONE:** Cloudflare DNS record is created/updated.
- **DONE:** Frontend files are synced to S3.
- **DONE:** Accessing the domain via HTTPS (e.g., `https://your.domain.com`) serves `index.html`.
- **DONE:** Navigation to `/recipe` (extensionless) works.

## 2. Backend API Deployment (AWS Lambda + API Gateway)

**Goal:** Deploy the Node.js Express API as AWS Lambda functions, fronted by API Gateway.

**Actions & Files (Terraform - in `terraform/` directory):**

- **DONE: Create `terraform/api_lambda.tf`:**
  - **DONE: `aws_iam_role` (lambda_execution_role):** For Lambda functions.
  - **DONE: `aws_iam_role_policy_attachment`:**
    - Basic Lambda execution policy (CloudWatch Logs).
    - TODO: Add permissions for S3 if recipe data is stored there (Phase 4, Step 4).
    - TODO: Add permissions for Secrets Manager if API keys/Redis AUTH token are stored there (Phase 4, Step 3).
    - TODO: Add `AWSLambdaVPCAccessExecutionRole` if Lambda needs VPC access for ElastiCache (Phase 4, Step 3).
  - **TODO: Packaging Lambda Code (Manual/Scripted Step):**
    - Create a zip file of the Node.js application (e.g., `cd .. && zip -r terraform/lambda_package.zip . -x './public/*' -x './data/*' -x './terraform/*' -x './docs/*' -x '.git*' -x '*.md' -x 'node_modules/*'`). Adjust exclusion patterns as needed. Ensure `lambda.js` (or your handler entry point) is at the root of the zip. Run `npm install --omit=dev` before zipping if `node_modules` are included.
    - Place `lambda_package.zip` in the `terraform/` directory.
  - **DONE: `aws_lambda_function`:**
    - References the created IAM role.
    - Specifies runtime and handler (e.g., `lambda.handler`).
    - Uploads `lambda_package.zip`.
    - Configures environment variables:
      - `MISTRAL_API_KEY` (from `var.mistral_api_key`).
      - `NODE_ENV = "production"`.
      - `REDIS_HOST = ""` (placeholder - to be updated in Phase 4, Step 3).
      - `REDIS_PORT = ""` (placeholder - to be updated in Phase 4, Step 3).
      - `REDIS_AUTH_TOKEN_SECRET_ARN = ""` (placeholder - to be updated in Phase 4, Step 3 if using Secrets Manager for token).
    - TODO: Add VPC configuration for ElastiCache access (Phase 4, Step 3).
  - **DONE: `aws_api_gateway_rest_api`:** Creates the REST API.
  - **DONE: `aws_api_gateway_resource`:** Defines `/{proxy+}` resource.
  - **DONE: `aws_api_gateway_method`:** Defines `ANY` method for `/{proxy+}`.
  - **DONE: `aws_api_gateway_integration`:** Integrates `ANY` method with the Lambda function (AWS_PROXY).
  - **DONE: `aws_api_gateway_deployment`:** Deploys the API.
  - **DONE: `aws_api_gateway_stage`:** Defines a `prod` stage.
  - **DONE: `aws_lambda_permission`:** Grants API Gateway permission to invoke the Lambda function.
  - **DONE: `cloudflare_record`:**
    - Creates CNAME record for `api.your.domain.com` pointing to the API Gateway regional endpoint.
- **DONE: Update `terraform/outputs.tf`:**
  - Output API Gateway invoke URL (`aws_api_gateway_stage.prod.invoke_url`).
  - Output custom API domain name (`api.yourdomain.com`).

**Testing:**

- **TODO:** `terraform plan` and `terraform apply` complete successfully.
- **TODO:** Lambda function, API Gateway, and IAM roles are created in AWS.
- **TODO:** Cloudflare DNS record for the API is created/updated.
- **TODO:** After packaging and deploying Lambda code, test API endpoints (e.g., `https://api.yourdomain.com/api/recipes`, `https://api.yourdomain.com/api/recipe/some-id/initial`) using `curl` or Postman.
- **TODO:** Check Lambda logs in CloudWatch for any errors.

## 3. Redis Deployment (AWS ElastiCache for Redis)

**Goal:** Deploy a managed Redis instance using AWS ElastiCache within your VPC and configure the backend Lambda to use it.

**Actions & Files (Terraform - in `terraform/` directory):**

- **TODO: Define VPC Network Resources (if not already existing and suitable):**
  - ElastiCache clusters are VPC-bound. You'll need a VPC and subnets.
  - **`aws_vpc`:** If creating a new VPC. Often, a default VPC might be used for simplicity in smaller projects, but dedicated VPCs are best practice for production.
  - **`aws_subnet`:** Create private subnets for ElastiCache. It's recommended to place ElastiCache in private subnets for security. These subnets must be in different Availability Zones for high availability.
  - **`aws_internet_gateway` & `aws_nat_gateway`:** If your Lambda functions in private subnets need outbound internet access (e.g., to call external APIs like Mistral) and your ElastiCache is also in private subnets.
  - **`aws_route_table` & `aws_route_table_association`:** To configure routing for your subnets.
- **TODO: Create `terraform/elasticache.tf`:**
  - **`aws_security_group` (for ElastiCache):**
    - Create a security group for the ElastiCache cluster.
    - Ingress rule: Allow TCP traffic on the Redis port (default 6379) from the Lambda function's security group.
    - Egress rule: Allow all outbound traffic (or restrict as needed).
  - **`aws_security_group` (for Lambda - if not already defined and suitable):**
    - Ensure the Lambda function's security group allows outbound traffic to the ElastiCache security group on the Redis port.
  - **`aws_elasticache_subnet_group`:**
    - Create a subnet group for ElastiCache, referencing the private subnets created above.
  - **`aws_elasticache_cluster` (for Redis):**
    - Specify `engine = "redis"`.
    - Choose `node_type` (e.g., `var.elasticache_node_type`).
    - Set `num_cache_nodes` (e.g., `var.elasticache_num_nodes`).
    - Reference the `aws_elasticache_subnet_group`.
    - Reference the ElastiCache `aws_security_group` (via `security_group_ids`).
    - Configure parameters like `port`, `parameter_group_name` (can use default).
    - Consider `auth_token` for Redis authentication (recommended). If used, store the token securely (e.g., generate randomly and store in AWS Secrets Manager).
    - Set `apply_immediately = true` for changes during development if desired, or manage maintenance windows.
- **TODO: Update Lambda Configuration (`terraform/api_lambda.tf`):**
  - **VPC Configuration:**
    - Configure the `aws_lambda_function` to run within your VPC.
    - Assign it to appropriate private subnets (typically the same ones as, or ones that can route to, the ElastiCache subnets).
    - Assign it the Lambda security group that has access to ElastiCache.
  - **Environment Variables:**
    - `REDIS_HOST`: Set to `aws_elasticache_cluster.your_cluster_name.cache_nodes[0].address` or `aws_elasticache_cluster.your_cluster_name.primary_endpoint_address` (for cluster mode disabled or enabled respectively).
    - `REDIS_PORT`: Set to `aws_elasticache_cluster.your_cluster_name.port`.
    - `REDIS_AUTH_TOKEN_SECRET_ARN` (if using AUTH token via Secrets Manager): Set to `var.redis_auth_token_secret_arn` (Lambda will fetch it).
- **TODO: Securely Store Redis AUTH Token (if used):**
  - **AWS Secrets Manager (Recommended):**
    - Manually create a secret or have Terraform generate a random string and store it.
    - **Terraform (`terraform/secrets.tf` or `elasticache.tf`):**
      - `random_password` resource to generate a token if not providing one.
      - `aws_secretsmanager_secret` to store the token.
      - `aws_secretsmanager_secret_version` to populate it.
    - Update Lambda IAM role to allow reading this specific secret.
    - The Lambda function will use the `REDIS_AUTH_TOKEN_SECRET_ARN` environment variable to fetch the token at runtime.
- **TODO: Update `terraform/variables.tf`:**
  - Ensure `elasticache_node_type`, `elasticache_num_nodes` are defined.
  - Uncomment and use `redis_auth_token_secret_arn` if implementing AUTH token with Secrets Manager.
- **TODO: Update `terraform/outputs.tf`:**
  - Output ElastiCache primary endpoint address and port.

**Testing:**

- **TODO:** `terraform plan` and `terraform apply` complete successfully, creating VPC (if new), subnets, security groups, and ElastiCache resources.
- **TODO:** Lambda function is configured to run in the VPC and can connect to ElastiCache.
- **TODO:** Backend API successfully connects to ElastiCache Redis (check Lambda logs after API calls that involve caching, ensure no timeout errors).
- **TODO:** Data is being cached and retrieved from ElastiCache (can be verified by observing API response times, `source` field if implemented, or connecting to Redis via an EC2 instance in the same VPC for debugging).

## 4. Recipe Data Deployment

**Goal:** Make recipe JSON files accessible to the backend Lambda function.

**Actions & Files:**

- **Option A: Include in Lambda Deployment Package:**
  - **TODO: Modify Lambda Packaging Script:** Ensure `data/recipes/` directory is included in the `lambda_package.zip`.
  - **TODO: Backend Code (`server.js`, `routes/recipes.js`):** Ensure file paths to `data/recipes/` are correct relative to the Lambda execution environment (e.g., `path.join(__dirname, 'data', 'recipes')` might need adjustment if the zip structure changes).
- **Option B: Store in a Separate S3 Bucket (More flexible for updates):**
  - **TODO: Terraform (`terraform/s3_recipe_data.tf`):**
    - Create a new private `aws_s3_bucket` for recipe data.
    - Use `aws_s3_object` to upload each recipe JSON file, or use `aws s3 sync` post-apply.
  - **TODO: Terraform (`terraform/api_lambda.tf`):**
    - Grant Lambda execution role read access to this S3 bucket.
    - Pass bucket name as an environment variable to Lambda.
  - **TODO: Backend Code:** Modify to read recipe files from S3 using AWS SDK.

**Testing:**

- **TODO:** `/api/recipe/{recipe_id}/initial` and `/api/recipes` endpoints correctly serve recipe data.
- **TODO:** If using S3, verify Lambda can access and read files from the S3 bucket.

## 5. Configuration & Final Testing

**Goal:** Update frontend to use deployed API, test end-to-end, and ensure secure configuration.

**Actions & Files:**

- **TODO: Update Frontend Configuration (Manual or CI/CD):**
  - Modify `public/js/recipe.js` (and `public/js/index.js`) to use the deployed API Gateway URL (from Terraform output `api_gateway_invoke_url` or custom API domain). This might involve changing base URLs for API calls.
  - Re-deploy frontend (sync to S3) if changes are made.
- **TODO: Secure API Keys and Credentials:**
  - Verify Mistral API key and Redis connection string are not hardcoded in Lambda code but are passed via environment variables (sourced from Terraform variables or Secrets Manager).
  - Ensure Cloudflare API token is handled securely (e.g., as an environment variable for Terraform execution, not committed to Git).
- **TODO: End-to-End Testing:**
  - Access the main domain (CloudFront).
  - Navigate from the index page (if implemented) to a recipe page.
  - Verify initial story loads.
  - Verify story continues on scroll.
  - Verify proactive caching is working (check Lambda logs, Redis, API response times).
  - Test on different browsers and devices.
- **TODO: Review IAM Permissions:** Ensure all IAM roles (Lambda, etc.) follow the principle of least privilege.
- **TODO: Review Costs:** Check AWS cost explorer and LLM/Redis provider dashboards after some usage.

---

This completes the plan for Phase 4. Each step should be tested thoroughly. Remember to run `terraform plan` before `terraform apply` and review the planned changes.
