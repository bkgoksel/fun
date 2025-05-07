#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Starting deployment process..."

# 1. Package Lambda Function
echo "Packaging Lambda function..."
# Ensure node_modules are up to date for packaging if they were to be included.
# The current zip command excludes node_modules, assuming they are handled by a Lambda layer or bundled separately.
# If you need to include node_modules directly in the zip (and they are not too large):
# echo "Installing production Node.js dependencies..."
# npm install --omit=dev
# Then adjust the zip command to include node_modules and exclude .git from within node_modules.

# Remove old package if it exists
rm -f terraform/lambda_package.zip

# Create new lambda package from project root
echo "Creating lambda_package.zip..."
zip -r terraform/lambda_package.zip . -x './public/*' -x './terraform/*' -x './docs/*' -x './.git*' -x '*.md' -x 'deploy.sh'

echo "Lambda function packaged successfully."

# 2. Apply Terraform Changes
# This will update the Lambda function with the new zip and any other infra changes.
echo "Applying Terraform changes (this may take a few minutes)..."
(cd terraform && terraform apply -auto-approve)
echo "Terraform changes applied successfully."

# 3. Sync Frontend Files to S3
echo "Syncing frontend files to S3..."
S3_BUCKET_NAME=$(terraform -chdir=terraform output -raw s3_site_bucket_name)

if [ -z "$S3_BUCKET_NAME" ]; then
  echo "Error: Could not retrieve S3 bucket name from Terraform outputs."
  exit 1
fi

echo "Target S3 bucket: s3://${S3_BUCKET_NAME}"
aws s3 sync public/ "s3://${S3_BUCKET_NAME}" --delete
echo "Frontend files synced successfully."

echo "Deployment completed successfully!"

# Output API Gateway URL for convenience
API_URL=$(terraform -chdir=terraform output -raw api_gateway_invoke_url)
if [ -n "$API_URL" ]; then
  echo "API Gateway Invoke URL: ${API_URL}"
fi

# Output Website URL for convenience
WEBSITE_URL_WWW=$(terraform -chdir=terraform output -raw website_url_www)
if [ -n "$WEBSITE_URL_WWW" ]; then
  echo "Website URL (www): ${WEBSITE_URL_WWW}"
fi

WEBSITE_URL_APEX=$(terraform -chdir=terraform output -raw website_url_apex)
if [ -n "$WEBSITE_URL_APEX" ]; then
  echo "Website URL (apex): ${WEBSITE_URL_APEX}"
fi
