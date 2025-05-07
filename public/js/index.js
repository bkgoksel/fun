document.addEventListener('DOMContentLoaded', async () => {
    const recipeListElement = document.getElementById('recipe-list');

    if (!recipeListElement) {
        console.error("Recipe list element not found in index.html");
        return;
    }

    try {
        const response = await fetch('/api/recipes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipes = await response.json();

        recipeListElement.innerHTML = ''; // Clear "Loading..." message

        if (recipes && recipes.length > 0) {
            recipes.forEach(recipe => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = `recipe.html?id=${encodeURIComponent(recipe.id)}`;
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
