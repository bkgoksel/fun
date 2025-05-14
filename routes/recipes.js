const express = require("express");
const fs = require("fs").promises; // Use promises version of fs
const path = require("path");
const {
  generateStoryContinuation,
  expandStory,
} = require("../services/llmService");
const {
  generateImage,
  createImagePrompt,
} = require("../services/imageService");
const cache = require("../services/cacheService"); // Import the cache service

const router = express.Router();

// GET /api/recipe/:recipeId
router.get("/recipe/:recipeId", async (req, res, next) => {
  const { recipeId } = req.params;
  const recipeFilePath = path.join(
    __dirname,
    "..",
    "data",
    "recipes",
    `${recipeId}.json`,
  );

  try {
    // First check if we have the recipe data in Redis
    let recipe = await cache.getRecipeData(recipeId);
    let source = "cache";

    // If not in cache, load from file
    if (!recipe) {
      try {
        const data = await fs.readFile(recipeFilePath, "utf8");
        recipe = JSON.parse(data);
        source = "file";

        // Store in Redis for future requests
        await cache.setRecipeData(recipeId, recipe);
      } catch (fileError) {
        if (fileError.code === "ENOENT") {
          return res
            .status(404)
            .json({ message: `Recipe with ID '${recipeId}' not found.` });
        }
        throw fileError;
      }
    }

    // Check if we have a story in Redis
    let storyData = await cache.getRecipeStory(recipeId);
    let story = "";

    // If no story in Redis, initialize with the story from recipe file
    if (!storyData || !storyData.story) {
      story = recipe.story || "";
      await cache.setRecipeStory(recipeId, story);
    } else {
      story = storyData.story;
    }

    // Get all existing image URLs for this recipe
    const recipeImageUrls = await cache.getAllRecipeImageUrls(recipeId);

    // If we need to refresh the cached image URLs, we could do it here
    // But for simplicity, we'll return the cached URLs and let the client handle any broken URLs

    res.json({
      id: recipe.id,
      title: recipe.title,
      story: story,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      imageUrls: recipeImageUrls,
      source: source,
    });
  } catch (error) {
    console.error(`Error processing recipe ${recipeId}:`, error);
    next(error);
  }
});

// POST /api/recipe/:recipeId/expand
router.post("/recipe/:recipeId/expand", async (req, res, next) => {
  const { recipeId } = req.params;

  try {
    // Get the current story from Redis
    const storyData = await cache.getRecipeStory(recipeId);

    if (!storyData || !storyData.story) {
      return res.status(404).json({
        message:
          "No story found for this recipe. First load the recipe to initialize the story.",
      });
    }

    // Expand the story
    const currentStory = storyData.story;
    const expansion = await expandStory(currentStory);

    if (!expansion) {
      return res
        .status(500)
        .json({ message: "Failed to generate story expansion." });
    }

    // Append the expansion to the existing story
    await cache.appendToRecipeStory(recipeId, expansion);

    // Get the updated story
    const updatedStoryData = await cache.getRecipeStory(recipeId);

    // Get all existing image URLs for this recipe
    const recipeImageUrls = await cache.getAllRecipeImageUrls(recipeId);

    res.json({
      id: recipeId,
      expansion: expansion,
      story: updatedStoryData.story,
      imageUrls: recipeImageUrls,
    });
  } catch (error) {
    console.error(`Error expanding story for recipe ${recipeId}:`, error);
    next(error);
  }
});

// GET /api/recipe/:recipeId/image/:paragraphIndex
router.get(
  "/recipe/:recipeId/image/:paragraphIndex",
  async (req, res, next) => {
    const { recipeId, paragraphIndex } = req.params;
    const parsedIndex = parseInt(paragraphIndex);

    if (isNaN(parsedIndex) || parsedIndex < 0) {
      return res.status(400).json({ message: "Invalid paragraph index" });
    }

    try {
      // Get recipe data and story
      const recipe = await cache.getRecipeData(recipeId);
      if (!recipe) {
        return res
          .status(404)
          .json({ message: `Recipe with ID '${recipeId}' not found.` });
      }

      const storyData = await cache.getRecipeStory(recipeId);
      if (!storyData || !storyData.story) {
        return res
          .status(404)
          .json({ message: "No story found for this recipe." });
      }

      // Parse the story into paragraphs
      const paragraphs = storyData.story
        .split(/\n+/)
        .flatMap((p) =>
          p.trim()
            ? p.split(/(?<=\.)\s{2,}/).filter((s) => s.trim().length > 0)
            : [],
        );

      if (parsedIndex >= paragraphs.length) {
        return res.status(404).json({
          message: `Paragraph index ${parsedIndex} not found in story.`,
        });
      }

      // Generate an image for this paragraph
      const paragraph = paragraphs[parsedIndex];
      const prompt = createImagePrompt(paragraph, recipe.title);
      const imageUrl = await generateImage(prompt);

      // Cache the image URL
      await cache.setRecipeImageUrl(recipeId, parsedIndex, imageUrl);

      res.json({ imageUrl });
    } catch (error) {
      console.error(
        `Error generating image for recipe ${recipeId}, paragraph ${paragraphIndex}:`,
        error,
      );
      next(error);
    }
  },
);

// POST /api/recipe/:recipeId/generate-images
router.post("/recipe/:recipeId/generate-images", async (req, res, next) => {
  const { recipeId } = req.params;

  try {
    // Get recipe data and story
    const recipe = await cache.getRecipeData(recipeId);
    if (!recipe) {
      return res
        .status(404)
        .json({ message: `Recipe with ID '${recipeId}' not found.` });
    }

    const storyData = await cache.getRecipeStory(recipeId);
    if (!storyData || !storyData.story) {
      return res
        .status(404)
        .json({ message: "No story found for this recipe." });
    }

    // Parse the story into paragraphs
    const paragraphs = storyData.story
      .split(/\n+/)
      .flatMap((p) =>
        p.trim()
          ? p.split(/(?<=\.)\s{2,}/).filter((s) => s.trim().length > 0)
          : [],
      );

    // Generate images for every 3rd paragraph
    const imageGenPromises = [];
    for (let i = 2; i < paragraphs.length; i += 3) {
      const paragraph = paragraphs[i];
      const prompt = createImagePrompt(paragraph, recipe.title);

      // Always generate a new URL using our updated direct URL method
      const imagePromise = generateImage(prompt).then((imageUrl) => {
        cache.setRecipeImageUrl(recipeId, i, imageUrl);
        return { paragraphIndex: i, imageUrl, regenerated: true };
      });

      imageGenPromises.push(imagePromise);
    }

    // Wait for all image generation to complete
    const results = await Promise.all(imageGenPromises);

    // Get all image URLs including the newly generated ones
    const allImageUrls = await cache.getAllRecipeImageUrls(recipeId);

    res.json({
      id: recipeId,
      generatedImages: results,
      allImageUrls: allImageUrls,
    });
  } catch (error) {
    console.error(`Error generating images for recipe ${recipeId}:`, error);
    next(error);
  }
});

module.exports = router;
