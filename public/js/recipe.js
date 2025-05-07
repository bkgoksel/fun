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

  fetchInitialData(RECIPE_ID); // Load initial data

  // --- Task 3 & 4: Scroll Detection & Fetch More Story ---
  let isFetchingMoreStory = false; // Flag to prevent multiple fetches
  const SCROLL_THRESHOLD = 200; // Pixels from bottom to trigger fetch
  const CHARS_FOR_CONTEXT = 250; // Number of characters to send as context

  async function fetchMoreStory(recipeId, context) {
    console.log("Attempting to fetch more story with context snippet:", context.substring(0, 50) + "...");
    try {
      const response = await fetch(`/api/recipe/${recipeId}/continue?context=${encodeURIComponent(context)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.nextStorySegment) {
        console.log("Next story segment received:", data.nextStorySegment);
        // Task 5 will handle rendering this segment word-by-word.
        // For now, we just log it as per Task 4 requirements.
      } else {
        console.warn("No next story segment received from API or segment was empty.");
      }
    } catch (error) {
      console.error("Error fetching more story:", error);
    } finally {
      isFetchingMoreStory = false; // Reset flag regardless of outcome
      console.log("isFetchingMoreStory set to false");
    }
  }

  window.addEventListener('scroll', () => {
    if (
      !isFetchingMoreStory && // Only proceed if not already fetching
      (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - SCROLL_THRESHOLD)
    ) {
      isFetchingMoreStory = true; // Set flag immediately to prevent multiple triggers
      console.log("isFetchingMoreStory set to true. User is near the bottom.");

      const fullText = storyContentElement.innerText;
      // Use the last CHARS_FOR_CONTEXT characters of the current story as context
      const context = fullText.length > CHARS_FOR_CONTEXT ? fullText.slice(-CHARS_FOR_CONTEXT) : fullText;
      
      fetchMoreStory(RECIPE_ID, context);
    }
  });
});
