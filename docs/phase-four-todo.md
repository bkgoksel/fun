# Phase 4: Deployment with Infrastructure as Code (Terraform) - TODO List

This document outlines the tasks required to deploy the Storied Recipes project using Terraform to manage AWS and Cloudflare resources, as defined in `spec.md`.

## 0. Prerequisites & Initial Terraform Setup

**Goal:** Prepare the environment for Terraform and establish foundational configurations.

**Actions & Files:**

*   **TODO: Install Terraform CLI:** Ensure Terraform CLI is installed locally.
*   **TODO: AWS Account & CLI Setup:**
    *   Ensure an AWS account is available.
    *   Configure AWS CLI with credentials and default region, or ensure Terraform can otherwise authenticate (e.g., via environment variables or instance profiles if run in CI/CD).
*   **TODO: Cloudflare Account & API Token:**
    *   Ensure a Cloudflare account is available and the domain is managed there.
    *   Generate a Cloudflare API Token with permissions to edit DNS records for the target zone.
*   **TODO: Create Terraform Project Directory:**
    *   E.g., `mkdir terraform` at the project root.
    *   All subsequent Terraform files (`.tf`) will reside here.
*   **TODO: Create `terraform/providers.tf`:**
    *   **Purpose:** Define required Terraform providers (AWS, Cloudflare).
    *   **Content:**
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
*   **TODO: Create `terraform/variables.tf`:**
    *   **Purpose:** Define input variables for the Terraform configuration.
    *   **Content (example):**
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

        variable "redis_connection_string" {
          description = "Connection string for the Redis instance (e.g., from Render/Upstash)."
          type        = string
          sensitive   = true
          # Best practice: Set via TF_VAR_redis_connection_string or store in Secrets Manager
        }
        ```
*   **TODO: Create `terraform/outputs.tf` (initially empty or with placeholders):**
    *   **Purpose:** Define outputs from the Terraform configuration (e.g., CloudFront URL, API Gateway URL).
*   **TODO: Initialize Terraform:**
    *   Run `terraform init` in the `terraform` directory.

**Testing:**

*   **TODO:** `terraform init` completes successfully.
*   **TODO:** `terraform validate` passes.
*   **TODO:** `terraform plan` (with necessary TF_VARs set) shows a plan without errors (even if it's creating no resources yet).

## 1. Frontend Deployment (AWS S3 + CloudFront)

**Goal:** Deploy static frontend assets (HTML, CSS, JS) to S3 and serve them via CloudFront with HTTPS.

**Actions & Files (Terraform - in `terraform/` directory):**

*   **TODO: Create `terraform/s3_cloudfront.tf`:**
    *   **`aws_s3_bucket`:** For static website hosting.
        *   Configure `website` block or use `aws_s3_bucket_website_configuration`.
    *   **`aws_s3_bucket_public_access_block`:** Restrict public access appropriately.
    *   **`aws_cloudfront_origin_access_identity` (OAI) or `aws_cloudfront_origin_access_control` (OAC):** To allow CloudFront to access S3 securely.
    *   **`aws_s3_bucket_policy`:** Grant OAI/OAC read access to the S3 bucket.
    *   **`aws_acm_certificate`:** For HTTPS.
        *   Must be in `us-east-1` for CloudFront.
        *   Use DNS validation. This might require manually adding CNAME records to Cloudflare initially, or using the Cloudflare provider to automate it if the certificate is for the apex domain or a subdomain managed by Cloudflare.
    *   **`aws_cloudfront_distribution`:**
        *   Configure S3 origin with OAI/OAC.
        *   Configure viewer certificate with ACM certificate ARN.
        *   Set up default root object (e.g., `index.html`).
        *   Configure behaviors (caching, allowed methods, etc.).
    *   **`cloudflare_record`:**
        *   Create CNAME record (e.g., `www` or apex if using alias) pointing to the CloudFront distribution domain name.
        *   Ensure Cloudflare proxy status is set as desired (DNS only for ACM validation CNAMEs, Proxied for the main site CNAME).
*   **TODO: Update `terraform/outputs.tf`:**
    *   Output S3 bucket name.
    *   Output CloudFront distribution ID and domain name.
*   **TODO: Manual/Scripted Step (Outside Terraform): Deploy Frontend Files:**
    *   After Terraform applies, use AWS CLI to sync `public/` directory to the S3 bucket:
        `aws s3 sync ../public/ s3://<your-s3-bucket-name-from-terraform-output>/ --delete`

**Testing:**

*   **TODO:** `terraform plan` and `terraform apply` complete successfully.
*   **TODO:** S3 bucket and CloudFront distribution are created in AWS.
*   **TODO:** ACM certificate is issued and validated.
*   **TODO:** Cloudflare DNS record is created/updated.
*   **TODO:** Frontend files are synced to S3.
*   **TODO:** Accessing the domain via HTTPS (e.g., `https://your.domain.com`) serves `index.html`.
*   **TODO:** Navigation to `/recipe` (extensionless) works.

## 2. Backend API Deployment (AWS Lambda + API Gateway)

**Goal:** Deploy the Node.js Express API as AWS Lambda functions, fronted by API Gateway.

**Actions & Files (Terraform - in `terraform/` directory):**

*   **TODO: Create `terraform/api_lambda.tf`:**
    *   **`aws_iam_role` (lambda_execution_role):** For Lambda functions.
    *   **`aws_iam_policy` or `aws_iam_role_policy_attachment`:**
        *   Basic Lambda execution policy (CloudWatch Logs).
        *   Permissions to access S3 if recipe data is stored there.
        *   Permissions to access Secrets Manager if API keys/Redis connection strings are stored there.
    *   **Packaging Lambda Code (Manual/Scripted Step):**
        *   Create a zip file of the Node.js application (e.g., `cd .. && zip -r terraform/lambda_package.zip . -x './public/*' -x './data/*' -x './terraform/*' -x './docs/*' -x '.git*' -x '*.md'`). Adjust exclusion patterns as needed.
        *   Alternatively, if recipe data is included in the package, adjust zip command.
    *   **`aws_lambda_function`:**
        *   Reference the created IAM role.
        *   Specify runtime (e.g., `nodejs18.x` or newer).
        *   Specify handler (e.g., `lambda.handler` if using a wrapper like `aws-serverless-express`, or specific file/handler).
        *   Upload the `lambda_package.zip`.
        *   Configure environment variables:
            *   `REDIS_URL` (from `var.redis_connection_string` or Secrets Manager).
            *   `MISTRAL_API_KEY` (from `var.mistral_api_key` or Secrets Manager).
            *   `NODE_ENV = "production"`.
    *   **`aws_api_gateway_rest_api`:** Create the REST API.
    *   **`aws_api_gateway_resource`:** Define resources (e.g., `/api`, `/recipes`, `/recipe/{recipeId}/initial`, `/recipe/{recipeId}/continue`).
    *   **`aws_api_gateway_method`:** Define methods for each resource (e.g., GET).
    *   **`aws_api_gateway_integration`:** Integrate API Gateway methods with the Lambda function.
        *   Type: `AWS_PROXY`.
    *   **`aws_api_gateway_deployment`:** Deploy the API. Depends on methods and integrations.
    *   **`aws_api_gateway_stage`:** Define a stage (e.g., `prod`).
    *   **`aws_lambda_permission`:** Grant API Gateway permission to invoke the Lambda function.
    *   **`cloudflare_record`:**
        *   Create CNAME record for the API (e.g., `api.your.domain.com`) pointing to the API Gateway invoke URL.
*   **TODO: Update `terraform/outputs.tf`:**
    *   Output API Gateway invoke URL.

**Testing:**

*   **TODO:** `terraform plan` and `terraform apply` complete successfully.
*   **TODO:** Lambda function, API Gateway, and IAM roles are created in AWS.
*   **TODO:** Cloudflare DNS record for the API is created/updated.
*   **TODO:** Test API endpoints (e.g., `/api/recipes`, `/api/recipe/some-id/initial`) using `curl` or Postman, pointing to the API Gateway URL or custom API domain.
*   **TODO:** Check Lambda logs in CloudWatch for any errors.

## 3. Redis Deployment (External Service - Render/Upstash)

**Goal:** Set up a Redis instance and configure the backend to use it.

**Actions & Files:**

*   **TODO: Manual Setup (Render/Upstash):**
    *   Create a free-tier Redis instance on Render, Upstash, or similar.
    *   Obtain the connection string/URL, host, port, and password.
*   **TODO: Securely Store Redis Credentials:**
    *   **Option A (Terraform Variable):** Pass as `TF_VAR_redis_connection_string` during `terraform apply`. (Less secure for sensitive data if state is not properly secured or plan output is logged).
    *   **Option B (AWS Secrets Manager - Recommended for production):**
        *   Manually create a secret in AWS Secrets Manager to store the Redis connection string.
        *   **Terraform (`terraform/secrets.tf` or `api_lambda.tf`):**
            *   Use `aws_secretsmanager_secret_version` data source to retrieve the secret.
            *   Pass this to the Lambda function's environment variables.
            *   Ensure Lambda IAM role has permission to read this specific secret.
*   **TODO: Update `terraform/variables.tf` (if not already done):**
    *   Ensure `redis_connection_string` variable is defined.

**Testing:**

*   **TODO:** Backend API successfully connects to Redis (check Lambda logs after API calls that involve caching).
*   **TODO:** Data is being cached and retrieved from Redis (can be verified by checking Redis directly or observing API response times and `source` field if implemented).

## 4. Recipe Data Deployment

**Goal:** Make recipe JSON files accessible to the backend Lambda function.

**Actions & Files:**

*   **Option A: Include in Lambda Deployment Package:**
    *   **TODO: Modify Lambda Packaging Script:** Ensure `data/recipes/` directory is included in the `lambda_package.zip`.
    *   **TODO: Backend Code (`server.js`, `routes/recipes.js`):** Ensure file paths to `data/recipes/` are correct relative to the Lambda execution environment (e.g., `path.join(__dirname, 'data', 'recipes')` might need adjustment if the zip structure changes).
*   **Option B: Store in a Separate S3 Bucket (More flexible for updates):**
    *   **TODO: Terraform (`terraform/s3_recipe_data.tf`):**
        *   Create a new private `aws_s3_bucket` for recipe data.
        *   Use `aws_s3_object` to upload each recipe JSON file, or use `aws s3 sync` post-apply.
    *   **TODO: Terraform (`terraform/api_lambda.tf`):**
        *   Grant Lambda execution role read access to this S3 bucket.
        *   Pass bucket name as an environment variable to Lambda.
    *   **TODO: Backend Code:** Modify to read recipe files from S3 using AWS SDK.

**Testing:**

*   **TODO:** `/api/recipe/{recipe_id}/initial` and `/api/recipes` endpoints correctly serve recipe data.
*   **TODO:** If using S3, verify Lambda can access and read files from the S3 bucket.

## 5. Configuration & Final Testing

**Goal:** Update frontend to use deployed API, test end-to-end, and ensure secure configuration.

**Actions & Files:**

*   **TODO: Update Frontend Configuration (Manual or CI/CD):**
    *   Modify `public/js/recipe.js` (and `public/js/index.js`) to use the deployed API Gateway URL (from Terraform output `api_gateway_invoke_url` or custom API domain). This might involve changing base URLs for API calls.
    *   Re-deploy frontend (sync to S3) if changes are made.
*   **TODO: Secure API Keys and Credentials:**
    *   Verify Mistral API key and Redis connection string are not hardcoded in Lambda code but are passed via environment variables (sourced from Terraform variables or Secrets Manager).
    *   Ensure Cloudflare API token is handled securely (e.g., as an environment variable for Terraform execution, not committed to Git).
*   **TODO: End-to-End Testing:**
    *   Access the main domain (CloudFront).
    *   Navigate from the index page (if implemented) to a recipe page.
    *   Verify initial story loads.
    *   Verify story continues on scroll.
    *   Verify proactive caching is working (check Lambda logs, Redis, API response times).
    *   Test on different browsers and devices.
*   **TODO: Review IAM Permissions:** Ensure all IAM roles (Lambda, etc.) follow the principle of least privilege.
*   **TODO: Review Costs:** Check AWS cost explorer and LLM/Redis provider dashboards after some usage.

---

This completes the plan for Phase 4. Each step should be tested thoroughly. Remember to run `terraform plan` before `terraform apply` and review the planned changes.
