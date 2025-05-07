document.addEventListener("DOMContentLoaded", async () => {
  const recipeListElement = document.getElementById("recipe-list");

  const API_BASE_URL =
    "https://xre1rlalkd.execute-api.us-west-2.amazonaws.com/prod";

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

    recipeListElement.innerHTML = ""; // Clear "Loading..." message

    if (recipes && recipes.length > 0) {
      recipes.forEach((recipe) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        // Use .html extension for recipe links to ensure S3 serves the correct file via CloudFront
        link.href = `/recipe.html?id=${encodeURIComponent(recipe.id)}`;
        link.textContent = recipe.title;
        listItem.appendChild(link);
        recipeListElement.appendChild(listItem);
      });
    } else {
      recipeListElement.innerHTML = "<li>No recipes found.</li>";
    }
  } catch (error) {
    console.error("Error fetching recipes:", error);
    recipeListElement.innerHTML =
      "<li>Could not load recipes. Please try again later.</li>";
  }
});
