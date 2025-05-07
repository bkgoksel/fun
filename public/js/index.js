document.addEventListener('DOMContentLoaded', async () => {
    const recipeListElement = document.getElementById('recipe-list');

    // TODO: Replace with your actual API base URL from Terraform outputs.
    // For example:
    // const API_BASE_URL = "https://api.yourdomain.com"; // If using custom domain like 'api_domain_name_cloudflare'
    // const API_BASE_URL = "https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod"; // If using API Gateway 'invoke_url'
    const API_BASE_URL = "SET_YOUR_API_BASE_URL_HERE";

    if (!recipeListElement) {
        console.error("Recipe list element not found in index.html");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/recipes`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();

        recipeListElement.innerHTML = ''; // Clear "Loading..." message

        if (recipes && recipes.length > 0) {
            recipes.forEach(recipe => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                // Use extensionless URL for recipe links
                link.href = `/recipe?id=${encodeURIComponent(recipe.id)}`;
                link.textContent = recipe.title;
                listItem.appendChild(link);
                recipeListElement.appendChild(listItem);
            });
        } else {
            recipeListElement.innerHTML = '<li>No recipes found.</li>';
        }
    } catch (error) {
        console.error("Error fetching recipes:", error);
        recipeListElement.innerHTML = '<li>Could not load recipes. Please try again later.</li>';
    }
});
