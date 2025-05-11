document.addEventListener("DOMContentLoaded", async () => {
  const recipeListElement = document.getElementById("recipe-list");

  const API_BASE_URL =
    "https://xre1rlalkd.execute-api.us-west-2.amazonaws.com/prod";

  if (!recipeListElement) {
    console.error("Recipe list element not found in index.html");
    return;
  }

  // Setup admin functionality
  setupAdminControls();

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

// Function to setup admin controls
function setupAdminControls() {
  const flushCacheBtn = document.getElementById('flush-cache-btn');
  if (!flushCacheBtn) return;

  flushCacheBtn.addEventListener('click', async () => {
    try {
      const resultElement = document.getElementById('flush-result');
      resultElement.textContent = "Flushing cache...";
      resultElement.style.color = "";

      const response = await fetch('/api/flush-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        resultElement.textContent = "Cache flushed successfully! Refresh the page to see updated content.";
        resultElement.style.color = "green";
      } else {
        resultElement.textContent = `Error: ${data.message || 'Failed to flush cache'}`;
        resultElement.style.color = "red";
      }
    } catch (error) {
      console.error('Error flushing cache:', error);
      const resultElement = document.getElementById('flush-result');
      resultElement.textContent = `Error: ${error.message}`;
      resultElement.style.color = "red";
    }
  });
}
