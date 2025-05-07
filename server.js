const express = require('express');
const path = require('path'); // Import path module
const recipeRoutes = require('./routes/recipes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (if you plan to accept JSON in POST/PUT requests later)
app.use(express.json());

// Mount the recipe routes
app.use('/api', recipeRoutes);

// Basic error handler (optional, but good practice)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
