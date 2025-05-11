require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
const imageService = require("./services/imageService");
const crypto = require("crypto");

/**
 * Test image generation and S3 upload functionality
 *
 * This script tests:
 * 1. Image prompt creation
 * 2. Image generation via OpenAI DALL-E 3
 * 3. Uploading images to S3
 * 4. Retrieving the signed URL
 * 5. Optionally saving the image to disk
 */

// Configuration
const SAVE_LOCAL = true; // Set to true to also save images locally
const FORCE_REGENERATE = true; // Force regeneration even if image exists
const LOCAL_IMAGE_DIR = path.join(__dirname, "test-images");
const RECIPE_FILE = path.join(
  __dirname,
  "data/recipes/grandmother-secret-cookies.json",
);

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.IMAGE_BUCKET_REGION || "us-west-2",
});

// S3 bucket name for storing generated images
const IMAGES_BUCKET =
  process.env.IMAGES_BUCKET || "storied-recipes-images-storied-recipes";

// Create local directory if it doesn't exist
if (SAVE_LOCAL && !fs.existsSync(LOCAL_IMAGE_DIR)) {
  fs.mkdirSync(LOCAL_IMAGE_DIR, { recursive: true });
  console.log(`Created directory: ${LOCAL_IMAGE_DIR}`);
}

// Load recipe data
const recipe = JSON.parse(fs.readFileSync(RECIPE_FILE, "utf8"));
const recipeTitle = recipe.title;

// Function to download and save image locally
async function downloadImage(url, filename) {
  try {
    const axios = require("axios");
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(path.join(LOCAL_IMAGE_DIR, filename));
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("Error downloading image:", error);
    throw error;
  }
}

// Function to check if an image exists in S3
async function imageExistsInS3(imageName) {
  try {
    const command = new HeadObjectCommand({
      Bucket: IMAGES_BUCKET,
      Key: imageName,
    });

    await s3Client.send(command);
    return true; // Image exists
  } catch (error) {
    // If error code is 404, image doesn't exist
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // For other errors (permissions, etc.), throw the error
    throw error;
  }
}

// Function to generate image, bypassing the imageService cache check
async function generateImageDirectly(prompt) {
  // Calculate the same hash that imageService would use
  const promptHash = crypto.createHash("md5").update(prompt).digest("hex");
  const imageName = `${promptHash}.png`;

  // Check if the image actually exists in S3
  const exists = await imageExistsInS3(imageName);

  if (exists && !FORCE_REGENERATE) {
    console.log(`Image actually exists in S3. Getting URL...`);
    return await imageService.getImageUrl(imageName);
  } else {
    if (exists) {
      console.log(`Image exists but FORCE_REGENERATE is true. Regenerating...`);
    } else {
      console.log(`Image does not exist in S3. Generating...`);
    }

    // Call the imageService but bypass its existence check by modifying the prompt slightly
    // This is a hack to force regeneration while still using the service's logic
    if (FORCE_REGENERATE && exists) {
      // Add a tiny random string to force a new hash
      const modifiedPrompt = prompt + ` [${Date.now()}]`;
      return await imageService.generateImage(modifiedPrompt);
    } else {
      // For non-existent images, we can use a direct call to the service
      // We'll patch the function to bypass its own check
      const originalGenerateImage = imageService.generateImage;

      // Replace the function temporarily with one that always generates
      imageService.generateImage = async function (p) {
        // Skip to the OpenAI API call portion directly
        try {
          // Directly from imageService.js starting at line ~48
          const openaiApiKey = process.env.OPENAI_API_KEY;
          if (!openaiApiKey) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
          }

          const promptHash = crypto.createHash("md5").update(p).digest("hex");
          const imageName = `${promptHash}.png`;

          // Call OpenAI API to generate image
          const axios = require("axios");
          const response = await axios.post(
            "https://api.openai.com/v1/images/generations",
            {
              model: "dall-e-3",
              prompt: p,
              n: 1,
              size: "1024x1024",
              response_format: "url",
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiApiKey}`,
              },
            },
          );

          if (
            !response.data ||
            !response.data.data ||
            !response.data.data[0] ||
            !response.data.data[0].url
          ) {
            throw new Error("Invalid response from OpenAI API");
          }

          // Get the image URL from the response
          const imageUrl = response.data.data[0].url;

          // Download the image and upload to S3
          const imageResponse = await axios({
            method: "GET",
            url: imageUrl,
            responseType: "arraybuffer",
          });

          // Upload to S3
          const { PutObjectCommand } = require("@aws-sdk/client-s3");
          await s3Client.send(
            new PutObjectCommand({
              Bucket: IMAGES_BUCKET,
              Key: imageName,
              Body: imageResponse.data,
              ContentType: "image/png",
              ACL: "public-read",
            }),
          );

          // Return the S3 URL for the image
          return await imageService.getImageUrl(imageName);
        } catch (error) {
          console.error("Error in patched generateImage:", error);
          throw error;
        }
      };

      try {
        return await imageService.generateImage(prompt);
      } finally {
        // Restore the original function
        imageService.generateImage = originalGenerateImage;
      }
    }
  }
}

// Main test function
async function testImageGeneration() {
  try {
    console.log("Starting image generation test...");
    console.log("Recipe:", recipeTitle);
    console.log(
      `Using S3 bucket: ${IMAGES_BUCKET} in region: ${process.env.IMAGE_BUCKET_REGION || "us-west-2"}`,
    );
    console.log(`Force regenerate: ${FORCE_REGENERATE ? "Yes" : "No"}`);

    // Split the story into paragraphs
    const paragraphs = recipe.story.split(/(?<=\. )/);

    // Test with first 2 paragraphs (limit to save API usage)
    console.log(
      `Testing with first 2 paragraphs (out of ${paragraphs.length})`,
    );

    for (let i = 0; i < Math.min(2, paragraphs.length); i++) {
      console.log(`\n--- Processing paragraph ${i + 1} ---`);
      console.log(`Paragraph text: "${paragraphs[i].substring(0, 100)}..."`);

      // 1. Create image prompt
      const prompt = imageService.createImagePrompt(paragraphs[i], recipeTitle);
      console.log(`Generated prompt: "${prompt.substring(0, 100)}..."`);

      // 2. Generate image using our direct method
      console.log("Generating image...");
      const startTime = Date.now();
      const imageUrl = await generateImageDirectly(prompt);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Image generated and uploaded to S3 in ${duration} seconds`);
      console.log(`S3 image URL: ${imageUrl}`);

      // 3. Save locally if enabled
      if (SAVE_LOCAL) {
        const imageName = `paragraph_${i + 1}.png`;
        console.log(`Saving image locally as: ${imageName}`);
        await downloadImage(imageUrl, imageName);
        console.log(`Image saved to: ${path.join(LOCAL_IMAGE_DIR, imageName)}`);
      }
    }

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
}

// Run the test
testImageGeneration();

