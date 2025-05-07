const express = require('express');
const fs = require('fs').promises; // Use promises version of fs
const path = require('path');

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

module.exports = router;
