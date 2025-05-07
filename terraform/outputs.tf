output "s3_site_bucket_name" {
  description = "The name of the S3 bucket for static website hosting."
  value       = aws_s3_bucket.site_bucket.bucket
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution."
  value       = aws_cloudfront_distribution.s3_distribution.id
}

output "cloudfront_distribution_domain_name" {
  description = "The domain name of the CloudFront distribution (used for CNAME)."
  value       = aws_cloudfront_distribution.s3_distribution.domain_name
}

output "website_url_www" {
  description = "The primary URL for the website (WWW)."
  value       = "https://${local.www_domain_name}"
}

output "website_url_apex" {
  description = "The URL for the website (apex)."
  value       = "https://${var.domain_name}"
}

output "acm_certificate_arn_us_east_1" {
  description = "ARN of the ACM certificate in us-east-1 for CloudFront."
  value       = aws_acm_certificate.site_cert.arn
}

output "api_gateway_invoke_url" {
  description = "The invoke URL for the API Gateway stage (e.g., prod)."
  value       = aws_api_gateway_stage.prod.invoke_url
}

output "api_domain_name_cloudflare" {
  description = "The custom API domain name managed by Cloudflare."
  value       = "api.${var.domain_name}"
}
