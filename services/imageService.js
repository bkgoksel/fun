const axios = require("axios");
const fs = require("fs");
const path = require("path");
const util = require("util");
const stream = require("stream");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

// Convert streams to promises
const pipeline = util.promisify(stream.pipeline);

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.IMAGE_BUCKET_REGION || "us-west-2",
});

// S3 bucket name for storing generated images
const IMAGES_BUCKET =
  process.env.IMAGES_BUCKET || "storied-recipes-images-storied-recipes";

/**
 * Generate an image using OpenAI's API based on text prompt
 * @param {string} prompt - The text prompt to generate the image from
 * @returns {Promise<string>} - The URL to the generated image
 */
async function generateImage(prompt) {
  try {
    // Ensure we have the OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // Generate a hash of the prompt to use as the image name
    const promptHash = crypto.createHash("md5").update(prompt).digest("hex");
    const imageName = `${promptHash}.png`;

    // Image name is based on prompt hash, so if it exists in S3 it will have the same URL
    // Calculate the final S3 URL we'll use
    console.log(`Using URL for image: ${promptHash.substring(0, 30)}...`);

    // Call OpenAI API to generate image
    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "dall-e-3",
        prompt: prompt,
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
    const openaiImageUrl = response.data.data[0].url;

    // Download the image and upload to S3
    const imageResponse = await axios({
      method: "GET",
      url: openaiImageUrl,
      responseType: "arraybuffer",
    });

    // Upload to S3
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
    return getImageUrl(imageName);
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

/**
 * Get a direct public URL for an image in S3
 * @param {string} imageName - The name of the image file in S3
 * @returns {string} - The direct public URL for the image
 */
function getImageUrl(imageName) {
  // Construct a direct S3 URL (no signing needed since bucket is public)
  const region = process.env.IMAGE_BUCKET_REGION || "us-west-2";
  const url = `https://${IMAGES_BUCKET}.s3.${region}.amazonaws.com/${imageName}`;
  return url;
}

/**
 * Create a prompt for image generation based on a recipe paragraph and title
 * @param {string} paragraph - The recipe paragraph to base the image on
 * @param {string} recipeTitle - The title of the recipe
 * @returns {string} - The prompt for image generation
 */
function createImagePrompt(paragraph, recipeTitle) {
  return `Create a nostalgic, homemade-looking food photography image for a recipe called "${recipeTitle}". The image should illustrate this paragraph from the recipe story: "${paragraph}". Include rustic kitchenware, natural lighting, and vintage styling that evokes warm family memories of homemade food.`;
}

module.exports = {
  generateImage,
  getImageUrl,
  createImagePrompt,
};
