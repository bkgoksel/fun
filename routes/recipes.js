const express = require('express');
const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
const crypto = require('crypto'); // For hashing context for cache key
const { generateStoryContinuation } = require('../services/llmService');
const cache = require('../services/cacheService'); // Import the cache service

const router = express.Router();

// GET /api/recipe/:recipeId/initial
router.get('/recipe/:recipeId/initial', async (req, res, next) => {
    const { recipeId } = req.params;
    const recipeFilePath = path.join(__dirname, '..', 'data', 'recipes', `${recipeId}.json`);

    try {
        const data = await fs.readFile(recipeFilePath, 'utf8');
        const recipe = JSON.parse(data);
        res.json({
            title: recipe.title,
            initialStorySeed: recipe.initialStorySeed
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File not found
            res.status(404).json({ message: `Recipe with ID '${recipeId}' not found.` });
        } else {
            // Other errors (e.g., JSON parsing error, file system error)
            console.error(`Error processing recipe ${recipeId}:`, error);
            // Pass error to the next error-handling middleware
            next(error); 
        }
    }
});

// GET /api/recipe/:recipeId/continue
router.get('/recipe/:recipeId/continue', async (req, res, next) => {
    const { recipeId } = req.params;
    const { context } = req.query;

    if (!context) {
        return res.status(400).json({ message: "Query parameter 'context' is required." });
    }

    // Generate a cache key based on recipeId and a hash of the context
    const contextHash = crypto.createHash('sha256').update(context).digest('hex');
    const cacheKey = `recipe:${recipeId}:contextHash:${contextHash}`;
    const CACHE_EXPIRATION_SECONDS = 3600; // 1 hour

    try {
        // 1. Attempt to get data from cache
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
            console.log(`Cache hit for key: ${cacheKey}`);
            return res.json({
                recipeId: recipeId,
                continuation: cachedData.continuation,
                source: 'cache'
            });
        }

        console.log(`Cache miss for key: ${cacheKey}. Fetching from LLM.`);
        // 2. If cache miss, call LLM
        const promptText = context;
        const storySegment = await generateStoryContinuation(promptText);

        // 3. Store LLM response in cache
        await cache.set(cacheKey, { continuation: storySegment }, CACHE_EXPIRATION_SECONDS);
        console.log(`Stored LLM response in cache for key: ${cacheKey}`);

        res.json({
            recipeId: recipeId,
            continuation: storySegment,
            source: 'llm'
        });
    } catch (error) {
        console.error(`Error in /continue endpoint for recipe ${recipeId}:`, error);
        next(error);
    }
});

module.exports = router;
