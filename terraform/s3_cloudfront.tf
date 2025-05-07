locals {
  www_domain_name    = "www.${var.domain_name}"
  bucket_name_suffix = replace(var.domain_name, ".", "-") # Sanitize domain name for bucket naming
  s3_bucket_name     = "${var.app_name}-site-${local.bucket_name_suffix}"
}

# 1. S3 Bucket for static website content
resource "aws_s3_bucket" "site_bucket" {
  bucket = local.s3_bucket_name

  tags = {
    Name        = "${var.app_name}-site-bucket"
    Environment = "production"
    Project     = var.app_name
  }
}

# 2. S3 Bucket Public Access Block - Restrict direct public access
resource "aws_s3_bucket_public_access_block" "site_bucket_pab" {
  bucket = aws_s3_bucket.site_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 3. CloudFront Origin Access Control (OAC) for S3
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.app_name}-s3-oac-${local.bucket_name_suffix}"
  description                       = "OAC for S3 bucket ${aws_s3_bucket.site_bucket.bucket}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 4. S3 Bucket Policy to allow CloudFront OAC
resource "aws_s3_bucket_policy" "site_bucket_policy" {
  bucket = aws_s3_bucket.site_bucket.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = { Service = "cloudfront.amazonaws.com" },
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.site_bucket.arn}/*",
        Condition = {
          StringEquals = {
            # Condition to ensure only this CloudFront distribution can access
            "AWS:SourceArn" = aws_cloudfront_distribution.s3_distribution.arn
          }
        }
      }
    ]
  })
}

# 5. ACM Certificate for HTTPS (must be in us-east-1 for CloudFront)
resource "aws_acm_certificate" "site_cert" {
  provider                  = aws.us_east_1 # Specify the aliased provider for us-east-1
  domain_name               = local.www_domain_name
  subject_alternative_names = [var.domain_name] # Cover apex domain as well
  validation_method         = "DNS"

  tags = {
    Name    = "${var.app_name}-site-certificate"
    Project = var.app_name
  }

  lifecycle {
    create_before_destroy = true # Important for certificate updates
  }
}

# 6. Cloudflare DNS records for ACM certificate validation
resource "cloudflare_record" "cert_validation_records" {
  for_each = {
    for dvo in aws_acm_certificate.site_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  content = each.value.record # Changed 'value' to 'content'
  type    = each.value.type
  proxied = false # DNS-only for validation records
  ttl     = 1     # Suggested by AWS for validation (can be low, e.g., 60)
}

# 7. Wait for ACM certificate validation using the DNS records created above
resource "aws_acm_certificate_validation" "site_cert_validation" {
  provider                = aws.us_east_1 # Must be in the same region as the certificate
  certificate_arn         = aws_acm_certificate.site_cert.arn
  validation_record_fqdns = [for record in cloudflare_record.cert_validation_records : record.hostname]

  depends_on = [cloudflare_record.cert_validation_records]
}

# 8. CloudFront Distribution
resource "aws_cloudfront_distribution" "s3_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.app_name} CloudFront distribution for ${var.domain_name}"
  default_root_object = "index.html"

  aliases = [local.www_domain_name, var.domain_name] # Serve from www and apex

  origin {
    domain_name              = aws_s3_bucket.site_bucket.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.site_bucket.id}" # Unique origin ID
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.site_bucket.id}"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 1
    max_ttl                = 1

    forwarded_values {
      query_string = true # Cache based on all query strings
      cookies {
        forward = "none" # Do not forward cookies
      }
      headers = [] # Do not forward any headers
    }
    # Using a managed cache policy for S3 static hosting.
    # This policy is "Managed-CachingOptimized" (ID: 658327ea-f89d-4fab-a63d-7e88639e58f6)
    # It handles forwarding of headers, cookies, and query strings appropriately for caching.
    # cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Removed for development TTLs
    # min_ttl, default_ttl, max_ttl are overridden by the cache policy.
    # If you need custom TTLs, you might need to create a custom cache policy.
  }

  # SPA-friendly error handling: serve index.html for 403/404 errors from S3 origin
  custom_error_response {
    error_code            = 403
    response_page_path    = "/index.html"
    response_code         = 200 # Return 200 to let client-side router handle the path
    error_caching_min_ttl = 10  # Cache for a short time
  }
  custom_error_response {
    error_code            = 404
    response_page_path    = "/index.html"
    response_code         = 200 # Return 200 to let client-side router handle the path
    error_caching_min_ttl = 10  # Cache for a short time
  }

  price_class = "PriceClass_100" # Use "PriceClass_All" for best performance, "PriceClass_100" for lowest cost in NA/EU

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site_cert_validation.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${var.app_name}-cloudfront"
    Environment = "production"
    Project     = var.app_name
  }

  # Ensure S3 bucket policy is applied before CloudFront tries to use it.
  # Terraform should infer this from the reference in the S3 bucket policy,
  # but explicit dependency can be added if issues arise.
  # depends_on = [aws_s3_bucket_policy.site_bucket_policy]
}

# 9. Cloudflare DNS Record for www.yourdomain.com pointing to CloudFront
resource "cloudflare_record" "www_site_dns" {
  zone_id = var.cloudflare_zone_id
  name    = "www" # For www.yourdomain.com
  content = aws_cloudfront_distribution.s3_distribution.domain_name # Changed 'value' to 'content'
  type    = "CNAME"
  proxied = true # Enable Cloudflare proxy
  ttl     = 1    # Auto TTL when proxied
}

# 10. Cloudflare DNS Record for apex domain (yourdomain.com) pointing to CloudFront
# Cloudflare supports CNAME flattening for apex records.
resource "cloudflare_record" "apex_site_dns" {
  zone_id = var.cloudflare_zone_id
  name    = "@" # For the apex domain (e.g., yourdomain.com)
  content = aws_cloudfront_distribution.s3_distribution.domain_name # Changed 'value' to 'content'
  type    = "CNAME"
  proxied = true # Enable Cloudflare proxy
  ttl     = 1    # Auto TTL when proxied
}
