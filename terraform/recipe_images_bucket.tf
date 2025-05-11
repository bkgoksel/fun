locals {
  images_bucket_name = "${var.app_name}-images-${local.bucket_name_suffix}"
}

# S3 Bucket for recipe generated images
resource "aws_s3_bucket" "recipe_images_bucket" {
  bucket = local.images_bucket_name

  tags = {
    Name        = "${var.app_name}-images-bucket"
    Environment = "production"
    Project     = var.app_name
  }
}

# S3 Bucket Public Access Block - Allow public read for images
resource "aws_s3_bucket_public_access_block" "images_bucket_pab" {
  bucket = aws_s3_bucket.recipe_images_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 Bucket CORS configuration
resource "aws_s3_bucket_cors_configuration" "images_bucket_cors" {
  bucket = aws_s3_bucket.recipe_images_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["*"] # In production, restrict to your specific domains
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 Bucket Ownership Controls - Required for ACLs to work
resource "aws_s3_bucket_ownership_controls" "images_bucket_ownership" {
  bucket = aws_s3_bucket.recipe_images_bucket.id

  rule {
    object_ownership = "ObjectWriter"
  }
}

# S3 Bucket ACL configuration - Explicitly set as public-read
resource "aws_s3_bucket_acl" "images_bucket_acl" {
  bucket = aws_s3_bucket.recipe_images_bucket.id
  acl    = "public-read"

  depends_on = [
    aws_s3_bucket_public_access_block.images_bucket_pab,
    aws_s3_bucket_ownership_controls.images_bucket_ownership
  ]
}

# S3 Bucket Policy to allow public read access to objects
resource "aws_s3_bucket_policy" "images_bucket_policy" {
  bucket = aws_s3_bucket.recipe_images_bucket.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "PublicReadGetObject",
        Effect    = "Allow",
        Principal = "*",
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.recipe_images_bucket.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.images_bucket_pab]
}

# Add output for the images bucket name
output "recipe_images_bucket_name" {
  description = "The name of the S3 bucket for recipe generated images"
  value       = aws_s3_bucket.recipe_images_bucket.id
}

output "recipe_images_bucket_domain_name" {
  description = "The domain name of the S3 bucket for recipe generated images"
  value       = aws_s3_bucket.recipe_images_bucket.bucket_regional_domain_name
}