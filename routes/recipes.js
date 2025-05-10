const express = require('express');
const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
const { generateStoryContinuation, expandStory } = require('../services/llmService');
const cache = require('../services/cacheService'); // Import the cache service

const router = express.Router();

// GET /api/recipe/:recipeId
router.get('/recipe/:recipeId', async (req, res, next) => {
    const { recipeId } = req.params;
    const recipeFilePath = path.join(__dirname, '..', 'data', 'recipes', `${recipeId}.json`);

    try {
        // First check if we have the recipe data in Redis
        let recipe = await cache.getRecipeData(recipeId);
        let source = 'cache';

        // If not in cache, load from file
        if (!recipe) {
            try {
                const data = await fs.readFile(recipeFilePath, 'utf8');
                recipe = JSON.parse(data);
                source = 'file';
                
                // Store in Redis for future requests
                await cache.setRecipeData(recipeId, recipe);
            } catch (fileError) {
                if (fileError.code === 'ENOENT') {
                    return res.status(404).json({ message: `Recipe with ID '${recipeId}' not found.` });
                }
                throw fileError;
            }
        }

        // Check if we have a story in Redis
        let storyData = await cache.getRecipeStory(recipeId);
        let story = '';
        
        // If no story in Redis, initialize with the story from recipe file
        if (!storyData || !storyData.story) {
            story = recipe.story || '';
            await cache.setRecipeStory(recipeId, story);
        } else {
            story = storyData.story;
        }

        res.json({
            id: recipe.id,
            title: recipe.title,
            story: story,
            ingredients: recipe.ingredients || [],
            instructions: recipe.instructions || [],
            source: source
        });
    } catch (error) {
        console.error(`Error processing recipe ${recipeId}:`, error);
        next(error);
    }
});

// POST /api/recipe/:recipeId/expand
router.post('/recipe/:recipeId/expand', async (req, res, next) => {
    const { recipeId } = req.params;
    
    try {
        // Get the current story from Redis
        const storyData = await cache.getRecipeStory(recipeId);
        
        if (!storyData || !storyData.story) {
            return res.status(404).json({ message: 'No story found for this recipe. First load the recipe to initialize the story.' });
        }
        
        // Expand the story
        const currentStory = storyData.story;
        const expansion = await expandStory(currentStory);
        
        if (!expansion) {
            return res.status(500).json({ message: 'Failed to generate story expansion.' });
        }
        
        // Append the expansion to the existing story
        await cache.appendToRecipeStory(recipeId, expansion);
        
        // Get the updated story
        const updatedStoryData = await cache.getRecipeStory(recipeId);
        
        res.json({
            id: recipeId,
            expansion: expansion,
            story: updatedStoryData.story
        });
    } catch (error) {
        console.error(`Error expanding story for recipe ${recipeId}:`, error);
        next(error);
    }
});

module.exports = router;
