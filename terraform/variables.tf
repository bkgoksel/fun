variable "aws_region" {
  description = "AWS region for deploying resources."
  type        = string
  default     = "us-west-2" # Or your preferred region
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

variable "openai_api_key" {
  description = "OpenAI API Key for image generation."
  type        = string
  sensitive   = true
  # Best practice: Set via TF_VAR_openai_api_key environment variable or store in Secrets Manager
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
