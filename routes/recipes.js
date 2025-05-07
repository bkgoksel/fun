const express = require('express');
const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
// crypto is no longer needed for the primary cache key strategy
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
            initialStorySeed: recipe.initialStorySeed,
            nextSegmentNumber: 1 // Client should request segment 1 next
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

// Asynchronously caches the next segment. Fire-and-forget.
async function proactivelyCacheNextSegment(recipeId, segmentNumberToCache, contextForProactive, cacheService) {
    const proactiveCacheKey = `recipe:${recipeId}:segment:${segmentNumberToCache}`;
    try {
        const alreadyCached = await cacheService.get(proactiveCacheKey);
        if (alreadyCached) {
            console.log(`Proactive cache: Segment ${segmentNumberToCache} for ${recipeId} already in cache. Skipping.`);
            return;
        }
        console.log(`Proactive cache: Generating segment ${segmentNumberToCache} for ${recipeId}.`);
        const proactiveContinuation = await generateStoryContinuation(contextForProactive);
        if (proactiveContinuation) {
            await cacheService.set(proactiveCacheKey, { continuation: proactiveContinuation }, 3600); // Cache for 1 hour
            console.log(`Proactive cache: Stored segment ${segmentNumberToCache} for ${recipeId}.`);
        } else {
            console.warn(`Proactive cache: LLM returned empty for segment ${segmentNumberToCache} for ${recipeId}. Not caching.`);
        }
    } catch (err) {
        console.error(`Proactive cache: Error caching segment ${segmentNumberToCache} for ${recipeId}:`, err.message);
    }
}

// GET /api/recipe/:recipeId/continue
router.get('/recipe/:recipeId/continue', async (req, res, next) => {
    const { recipeId } = req.params;
    const { context, segmentNumber } = req.query;

    if (!context) {
        return res.status(400).json({ message: "Query parameter 'context' is required." });
    }
    if (!segmentNumber || isNaN(parseInt(segmentNumber, 10))) {
        return res.status(400).json({ message: "Query parameter 'segmentNumber' is required and must be a number." });
    }

    const currentSegmentNumber = parseInt(segmentNumber, 10);
    const currentSegmentCacheKey = `recipe:${recipeId}:segment:${currentSegmentNumber}`;
    const CACHE_EXPIRATION_SECONDS = 3600; // 1 hour
    let storySegment;
    let source = 'llm'; // Assume LLM source initially

    try {
        // 1. Attempt to get current segment from cache
        const cachedData = await cache.get(currentSegmentCacheKey);
        if (cachedData && cachedData.continuation) {
            console.log(`Cache hit for current segment: ${currentSegmentCacheKey}`);
            storySegment = cachedData.continuation;
            source = 'cache';
        } else {
            console.log(`Cache miss for current segment: ${currentSegmentCacheKey}. Fetching from LLM.`);
            // 2. If cache miss, call LLM for current segment
            storySegment = await generateStoryContinuation(context);

            if (storySegment) {
                // 3. Store current LLM response in cache
                await cache.set(currentSegmentCacheKey, { continuation: storySegment }, CACHE_EXPIRATION_SECONDS);
                console.log(`Stored current LLM response in cache for key: ${currentSegmentCacheKey}`);
            } else {
                // Handle case where LLM returns nothing for the current segment
                console.warn(`LLM returned empty for current segment ${currentSegmentNumber} of recipe ${recipeId}.`);
                // Depending on desired behavior, you might return an error or an empty continuation
            }
        }

        // If we have a story segment (either from cache or LLM), attempt to proactively cache the next one.
        if (storySegment) {
            const nextSegmentNumberForProactive = currentSegmentNumber + 1;
            // Fire-and-forget proactive caching
            proactivelyCacheNextSegment(recipeId, nextSegmentNumberForProactive, storySegment, cache)
                .catch(err => console.error("Error in detached proactive caching:", err)); // Catch errors from the async func itself
        }
        
        res.json({
            recipeId: recipeId,
            continuation: storySegment || "", // Send empty string if LLM failed for current
            source: source,
            nextSegmentNumber: currentSegmentNumber + 1
        });
    } catch (error) {
        console.error(`Error in /continue endpoint for recipe ${recipeId}, segment ${currentSegmentNumber}:`, error);
        next(error);
    }
});

module.exports = router;
