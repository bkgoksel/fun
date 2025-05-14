document.addEventListener("DOMContentLoaded", () => {
  const recipeTitleElement = document
    .getElementById("recipe-title")
    .querySelector("h1");
  const storyContentElement = document.getElementById("story-content");
  const ingredientsListElement = document.getElementById("ingredients-list");
  const instructionsListElement = document.getElementById("instructions-list");
  const API_BASE_URL =
    "https://xre1rlalkd.execute-api.us-west-2.amazonaws.com/prod";

  // Determine RECIPE_ID from URL query parameter or use default
  const urlParams = new URLSearchParams(window.location.search);
  const recipeIdFromUrl = urlParams.get("id");
  const RECIPE_ID = recipeIdFromUrl || "grandmother-secret-cookies"; // Fallback to default

  if (!recipeIdFromUrl) {
    console.warn("No recipe ID found in URL, using default:", RECIPE_ID);
  }

  // Constants for story rendering and fetching
  const SCROLL_THRESHOLD = 200; // Pixels from bottom to trigger rendering more
  const WORD_RENDER_DELAY_MS = 10; // Delay for word-by-word rendering
  const AUTOSCROLL_BOTTOM_THRESHOLD = 250; // Min pixels from bottom for auto-scroll to be active during rendering
  const PERCENT_RENDERED_BEFORE_EXPAND = 80; // When to request more story from backend (80%)

  // State variables
  let fullStoryText = ""; // The complete story as received from the backend
  let renderedParagraphs = 0; // How many paragraphs have been rendered
  let isRenderingStory = false; // Flag to prevent multiple render processes
  let isRequestingExpansion = false; // Flag to prevent multiple expansion requests

  async function fetchRecipeData(recipeId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/recipe/${recipeId}`,
      );
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

      if (data.story) {
        // Store the full story but don't render it all at once
        fullStoryText = data.story;

        // Start rendering the story paragraph by paragraph
        renderNextParagraph();
      } else {
        console.warn("No story received from API.");
        storyContentElement.textContent =
          "Once upon a time, the story was supposed to start here, but something went wrong...";
      }

      // Render ingredients if available
      if (data.ingredients && Array.isArray(data.ingredients)) {
        renderIngredients(data.ingredients);
      } else {
        console.warn("No ingredients received from API or invalid format.");
      }

      // Render instructions if available
      if (data.instructions && Array.isArray(data.instructions)) {
        renderInstructions(data.instructions);
      } else {
        console.warn("No instructions received from API or invalid format.");
      }
    } catch (error) {
      console.error("Error fetching recipe data:", error);
      recipeTitleElement.textContent = "Error Loading Recipe";
      storyContentElement.textContent =
        "Could not load the story. Please check the console for errors and ensure the backend server is running and the API endpoint is correct.";
    }
  }

  function parseStoryIntoParagraphs(story) {
    // Split the story into paragraphs by newlines or multiple spaces
    return story.split(/\n+/).flatMap(p => 
      p.trim() ? p.split(/(?<=\.)\s{2,}/).filter(s => s.trim().length > 0) : []
    );
  }

  async function requestStoryExpansion() {
    if (isRequestingExpansion) return;
    
    isRequestingExpansion = true;
    console.log("Requesting story expansion from the backend...");
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/recipe/${RECIPE_ID}/expand`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.story) {
        // Update our full story with the expanded version
        fullStoryText = data.story;
        console.log("Story expanded successfully. New length:", fullStoryText.length);
      } else {
        console.warn("No expanded story received from API.");
      }
    } catch (error) {
      console.error("Error expanding story:", error);
    } finally {
      isRequestingExpansion = false;
    }
  }

  async function renderStoryWordByWord(text, paragraphElement) {
    if (!text || text.trim() === "") {
      return; // Nothing to render
    }

    // Add a leading space if needed
    if (
      paragraphElement.textContent.length > 0 &&
      text[0] !== " " &&
      paragraphElement.textContent[paragraphElement.textContent.length - 1] !== " "
    ) {
      text = " " + text;
    }

    const parts = text.split(/(\s+)/); // Split by space, keeping spaces to preserve them

    for (const part of parts) {
      if (part.length > 0) {
        paragraphElement.textContent += part;

        // Check if the viewport is below the bottom of the story content
        const storyRect = storyContentElement.getBoundingClientRect();
        const isViewportBelowStory = storyRect.bottom < 0;

        // Only auto-scroll if the user hasn't scrolled up significantly or 
        // if the viewport is below the bottom of the story
        const isUserNearBottom =
          window.scrollY + window.innerHeight >=
          document.body.offsetHeight - AUTOSCROLL_BOTTOM_THRESHOLD;
          
        if (isUserNearBottom || isViewportBelowStory) {
          // Scroll the paragraph into view
          paragraphElement.scrollIntoView({ block: "end", behavior: "auto" });
        }

        await new Promise((resolve) =>
          setTimeout(resolve, WORD_RENDER_DELAY_MS),
        );
      }
    }
  }

  async function renderNextParagraph() {
    if (isRenderingStory) return;
    
    const paragraphs = parseStoryIntoParagraphs(fullStoryText);
    
    if (renderedParagraphs >= paragraphs.length) {
      // All paragraphs rendered, check if we need to request more
      const percentRendered = 100;
      if (percentRendered >= PERCENT_RENDERED_BEFORE_EXPAND && !isRequestingExpansion) {
        requestStoryExpansion();
      }
      return;
    }
    
    isRenderingStory = true;
    
    try {
      const paragraphText = paragraphs[renderedParagraphs];
      const p = document.createElement("p");
      storyContentElement.appendChild(p);
      
      await renderStoryWordByWord(paragraphText, p);
      
      renderedParagraphs++;
      
      // Check if we need to request more content from the backend
      const percentRendered = Math.floor((renderedParagraphs / paragraphs.length) * 100);
      if (percentRendered >= PERCENT_RENDERED_BEFORE_EXPAND && !isRequestingExpansion) {
        requestStoryExpansion();
      }
      
      // Check if viewport is still below story section after rendering
      // and trigger another paragraph render if so
      checkViewportPositionAndRender();
    } catch (error) {
      console.error("Error rendering paragraph:", error);
    } finally {
      isRenderingStory = false;
    }
  }

  // Load initial data
  fetchRecipeData(RECIPE_ID);

  // Functions to render ingredients and instructions
  function renderIngredients(ingredients) {
    // Clear any existing content
    ingredientsListElement.innerHTML = '';

    // Add each ingredient as a list item
    ingredients.forEach(ingredient => {
      const li = document.createElement('li');
      li.textContent = ingredient;
      ingredientsListElement.appendChild(li);
    });
  }

  function renderInstructions(instructions) {
    // Clear any existing content
    instructionsListElement.innerHTML = '';

    // Add each instruction as a list item
    instructions.forEach(instruction => {
      const li = document.createElement('li');
      li.textContent = instruction;
      instructionsListElement.appendChild(li);
    });
  }

  // Function to check viewport position relative to story section and render if needed
  function checkViewportPositionAndRender() {
    if (isRenderingStory) return; // Don't check if already rendering
    
    // Get the position of the story content section
    const storyRect = storyContentElement.getBoundingClientRect();

    // Find the personal-note element which comes after the story content
    const personalNote = document.querySelector('.personal-note');
    const recipeDetails = document.getElementById('recipe-details');

    // Check if elements below the story are visible in the viewport
    let shouldRender = false;
    
    if (personalNote) {
      const personalNoteRect = personalNote.getBoundingClientRect();
      // If any part of the elements below the story is visible in the viewport
      // or if we've scrolled past the story section, render more paragraphs
      if (personalNoteRect.top < window.innerHeight ||
          (recipeDetails && recipeDetails.getBoundingClientRect().top < window.innerHeight)) {
        shouldRender = true;
      }
    } else {
      // Fallback if we can't find the personal note section
      // Use the original condition as a safety net
      const storyBottom = storyRect.bottom;
      if (storyBottom <= window.innerHeight + SCROLL_THRESHOLD) {
        shouldRender = true;
      }
    }
    
    if (shouldRender) {
      // Use setTimeout to avoid rendering in the current execution stack
      // This gives the browser time to update the DOM and render the current paragraph
      setTimeout(() => renderNextParagraph(), 0);
    }
  }

  // Add scroll event listener to render more story as user scrolls
  window.addEventListener("scroll", () => {
    checkViewportPositionAndRender();
  });
});
