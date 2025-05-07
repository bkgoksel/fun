document.addEventListener("DOMContentLoaded", () => {
  const recipeTitleElement = document
    .getElementById("recipe-title")
    .querySelector("h1");
  const storyContentElement = document.getElementById("story-content");
  const API_BASE_URL =
    "https://xre1rlalkd.execute-api.us-west-2.amazonaws.com/prod";

  // Determine RECIPE_ID from URL query parameter or use default
  const urlParams = new URLSearchParams(window.location.search);
  const recipeIdFromUrl = urlParams.get("id");
  const RECIPE_ID = recipeIdFromUrl || "grandmother-secret-cookies"; // Fallback to default

  if (!recipeIdFromUrl) {
    console.warn("No recipe ID found in URL, using default:", RECIPE_ID);
  }

  async function fetchInitialData(recipeId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/recipe/${recipeId}/initial`,
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

      if (data.nextSegmentNumber !== undefined) {
        nextSegmentToFetch = data.nextSegmentNumber;
        console.log(`Initial nextSegmentToFetch set to: ${nextSegmentToFetch}`);
      }

      if (data.initialStorySeed) {
        // Render initial story segment all at once
        const p = document.createElement("p");
        p.textContent = data.initialStorySeed;
        storyContentElement.appendChild(p);
        // Ensure the page is scrolled correctly after adding initial content
        window.scrollTo(0, document.body.scrollHeight);
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

  // --- Task 3, 4 & 5: Scroll Detection, Fetch More Story, Word-by-Word Rendering ---
  let nextSegmentToFetch = 1; // Initialize: Segment 0 is the initial seed, first fetch is for segment 1.
  let isFetchingMoreStory = false; // Flag to prevent multiple fetches
  const SCROLL_THRESHOLD = 200; // Pixels from bottom to trigger fetch
  const CHARS_FOR_CONTEXT = 1000; // Number of characters to send as context
  const WORD_RENDER_DELAY_MS = 10; // Delay for word-by-word rendering
  const AUTOSCROLL_BOTTOM_THRESHOLD = 250; // Min pixels from bottom for auto-scroll to be active during rendering

  async function renderStorySegmentWordByWord(segmentText, targetElement) {
    console.log(
      "[DEBUG] renderStorySegmentWordByWord called with segment:",
      JSON.stringify(segmentText),
    );
    if (!segmentText || segmentText.trim() === "") {
      console.log(
        "[DEBUG] renderStorySegmentWordByWord: segment is empty or only whitespace, returning.",
      );
      return; // Nothing to render
    }

    let paragraphElement = targetElement.querySelector("p:last-child");
    if (!paragraphElement) {
      paragraphElement = document.createElement("p");
      targetElement.appendChild(paragraphElement);
    }

    // Add a leading space if the paragraph already has content and the segment doesn't start with one,
    // and the paragraph doesn't already end with a space.
    if (
      paragraphElement.textContent.length > 0 &&
      segmentText[0] !== " " &&
      paragraphElement.textContent[paragraphElement.textContent.length - 1] !==
        " "
    ) {
      segmentText = " " + segmentText;
    }

    const parts = segmentText.split(/(\s+)/); // Split by space, keeping spaces to preserve them

    for (const part of parts) {
      if (part.length > 0) {
        console.log(
          "[DEBUG] renderStorySegmentWordByWord: appending part:",
          JSON.stringify(part),
        );
        paragraphElement.textContent += part;

        // Only auto-scroll if the user hasn't scrolled up significantly
        const isUserNearBottom =
          window.scrollY + window.innerHeight >=
          document.body.offsetHeight - AUTOSCROLL_BOTTOM_THRESHOLD;
        if (isUserNearBottom) {
          // Scroll the paragraph itself into view, aligning its bottom with the visible area's bottom.
          paragraphElement.scrollIntoView({ block: "end", behavior: "auto" });
        }

        await new Promise((resolve) =>
          setTimeout(resolve, WORD_RENDER_DELAY_MS),
        );
      }
    }
    console.log(
      "[DEBUG] renderStorySegmentWordByWord finished for segment:",
      JSON.stringify(segmentText),
    );
  }

  async function fetchMoreStory(recipeId, context) {
    console.log(
      "Attempting to fetch more story with context snippet:",
      context.substring(0, 50) + "...",
    );
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/recipe/${recipeId}/continue?context=${encodeURIComponent(context)}&segmentNumber=${nextSegmentToFetch}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.continuation) {
        await renderStorySegmentWordByWord(
          data.continuation,
          storyContentElement,
        );
        if (data.nextSegmentNumber !== undefined) {
          nextSegmentToFetch = data.nextSegmentNumber;
          console.log(`Updated nextSegmentToFetch to: ${nextSegmentToFetch}`);
        }
      } else {
        console.warn("No continuation received from API or segment was empty.");
        // If no new segment, allow fetching again sooner.
        isFetchingMoreStory = false;
        console.log("isFetchingMoreStory set to false (no new segment).");
        return; // Exit early if no segment to render
      }
    } catch (error) {
      console.error("Error fetching more story:", error);
    } finally {
      // This will now correctly run after renderStorySegmentWordByWord completes (or if an error occurs before/during it)
      // unless we returned early due to no segment.
      if (isFetchingMoreStory) {
        // Check if it wasn't already set to false
        isFetchingMoreStory = false;
        console.log("isFetchingMoreStory set to false in finally block.");
      }
    }
  }

  window.addEventListener("scroll", () => {
    if (
      !isFetchingMoreStory && // Only proceed if not already fetching
      window.innerHeight + window.scrollY >=
        document.body.offsetHeight - SCROLL_THRESHOLD
    ) {
      isFetchingMoreStory = true; // Set flag immediately to prevent multiple triggers
      console.log("isFetchingMoreStory set to true. User is near the bottom.");

      const fullText = storyContentElement.innerText;
      // Use the last CHARS_FOR_CONTEXT characters of the current story as context
      const context =
        fullText.length > CHARS_FOR_CONTEXT
          ? fullText.slice(-CHARS_FOR_CONTEXT)
          : fullText;

      fetchMoreStory(RECIPE_ID, context);
    }
  });
});
