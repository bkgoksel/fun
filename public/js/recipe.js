document.addEventListener("DOMContentLoaded", () => {
  const recipeTitleElement = document
    .getElementById("recipe-title")
    .querySelector("h1");
  const storyContentElement = document.getElementById("story-content");

  // Hardcoded recipe ID for now, as per phase-two-todo.md
  const RECIPE_ID = "grandmother-secret-cookies";

  async function fetchInitialData(recipeId) {
    try {
      const response = await fetch(`/api/recipe/${recipeId}/initial`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.title) {
        recipeTitleElement.textContent = data.title;
      } else {
        console.warn("No title received from API.");
        recipeTitleElement.textContent = "Recipe Title Not Found";
      }

      if (data.initialStorySeed) {
        // For now, just set the text. Word-by-word rendering is Task 5.
        const p = document.createElement("p");
        p.textContent = data.initialStorySeed;
        storyContentElement.appendChild(p);
      } else {
        console.warn("No initial story segment received from API.");
        storyContentElement.textContent =
          "Once upon a time, the story was supposed to start here, but something went wrong...";
      }
    } catch (error) {
      console.error("Error fetching initial recipe data:", error);
      recipeTitleElement.textContent = "Error Loading Recipe";
      storyContentElement.textContent =
        "Could not load the story. Please check the console for errors and ensure the backend server is running and the API endpoint is correct.";
    }
  }

  fetchInitialData(RECIPE_ID);

  // --- Task 3: Scroll Detection ---
  let isFetchingMoreStory = false; // Flag to prevent multiple fetches
  const SCROLL_THRESHOLD = 200; // Pixels from bottom to trigger fetch

  window.addEventListener('scroll', () => {
    // Check if we're near the bottom and not already fetching
    if (
      !isFetchingMoreStory &&
      (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - SCROLL_THRESHOLD)
    ) {
      console.log("User is near the bottom, time to fetch more story!");
      // For now, just log. In Task 4, this will call fetchMoreStory().
      // To prevent rapid logging if content doesn't grow, we'd set isFetchingMoreStory here.
      // isFetchingMoreStory = true; // Will be properly managed in Task 4 & 5
    }
  });
});
