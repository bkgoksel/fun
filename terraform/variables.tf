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

variable "redis_connection_string" {
  description = "Connection string for the Redis instance (e.g., from Render/Upstash)."
  type        = string
  sensitive   = true
  # Best practice: Set via TF_VAR_redis_connection_string or store in Secrets Manager
}
