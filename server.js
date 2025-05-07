// Load environment variables from .env file only for local development
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  require('dotenv').config(); 
}

const express = require("express");
const path = require("path"); // Import path module
const fs = require('fs').promises; // Import fs promises
const recipeRoutes = require("./routes/recipes");
const cors = require('cors'); // Import CORS middleware

const app = express();

// Enable CORS for all routes
app.use(cors());
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (if you plan to accept JSON in POST/PUT requests later)
app.use(express.json());

// Serve static files from the "public" directory
// - index: 'index.html' (default) serves index.html for directory root requests (e.g., '/')
// - extensions: ['html'] allows accessing files like /recipe instead of /recipe.html
app.use(express.static(path.join(__dirname, "public"), { extensions: ['html'] }));

// Mount the recipe routes
app.use("/api", recipeRoutes);

// API endpoint to list all recipes
app.get("/api/recipes", async (req, res, next) => {
  const recipesDir = path.join(__dirname, 'data', 'recipes');
  try {
    const files = await fs.readdir(recipesDir);
    const recipePromises = files
      .filter(file => file.endsWith('.json'))
      .map(async (file) => {
        const filePath = path.join(recipesDir, file);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const recipeData = JSON.parse(fileContent);
        return {
          id: recipeData.id,
          title: recipeData.title
        };
      });
    
    const recipes = await Promise.all(recipePromises);
    res.json(recipes);
  } catch (error) {
    console.error("Error fetching recipes list:", error);
    next(error);
  }
});

// Basic error handler (optional, but good practice)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Export the handler for AWS Lambda
const serverless = require('serverless-http');
module.exports.handler = serverless(app);

// Conditional listen for local development
// AWS_LAMBDA_FUNCTION_NAME is an environment variable set by AWS Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}
