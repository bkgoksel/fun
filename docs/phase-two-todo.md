# Phase 2: Frontend Core - TODO List

This document outlines the tasks required to implement the frontend core functionality for the Storied Recipes project, as defined in `spec.md`.

## 1. Basic Page Layout

**Goal:** Create the HTML structure for the recipe page. This includes areas for the recipe title, the dynamically growing story, and static placeholder headers for "Ingredients" and "Directions".

**Actions & Files:**

*   **Create `public/recipe.html`:**
    *   **Purpose:** This file will serve as the main page for displaying a single recipe. It will contain the basic HTML skeleton.
    *   **Content:**
        *   A `div` for the recipe title.
        *   A `div` (e.g., with id `story-content`) where the story will be dynamically inserted.
        *   Static `h2` or `h3` tags for "Ingredients" and "Directions" that will be pushed down as the story grows.
        *   A placeholder for including the JavaScript file (e.g., `<script src="js/recipe.js" defer></script>`).

**Testing:**

*   **DONE:** Create `public`, `public/css`, and `public/js` directories. (Shell command `mkdir -p public/css public/js` will be suggested).
*   **DONE:** Create the `public/recipe.html` file with the basic structure. (Linked `public/css/style.css` also created).
*   **TODO:** Open `public/recipe.html` directly in a web browser.
*   **TODO:** Verify that the title area, an empty story container, and the "Ingredients" / "Directions" headers are visible and laid out as expected.

## 2. Initial Data Fetch & Display

**Goal:** On page load, fetch the initial recipe data (title, initial story segment) from the backend API (`/api/recipe/{recipe_id}/initial`) and display it on the page.

**Actions & Files:**

*   **Create `public/js/recipe.js`:**
    *   **Purpose:** This file will contain all client-side JavaScript logic for the recipe page.
    *   **Initial Content:**
        *   An event listener for `DOMContentLoaded` or similar to ensure the script runs after the page is loaded.
        *   A function `fetchInitialData(recipeId)` that uses the `fetch` API to call `GET /api/recipe/{recipe_id}/initial`.
            *   For now, `recipeId` can be hardcoded (e.g., "grandmother-secret-cookies").
        *   Logic to parse the JSON response.
        *   Logic to update the DOM:
            *   Set the recipe title in the designated HTML element.
            *   Insert the initial story segment into the `story-content` div.

*   **Modify `public/recipe.html`:**
    *   **Purpose:** Ensure `recipe.js` is loaded.
    *   **Change:** Add `<script src="js/recipe.js" defer></script>` (likely in the `<head>` or at the end of `<body>`).

**Testing:**

*   **TODO:** Ensure a mock or actual backend endpoint `GET /api/recipe/grandmother-secret-cookies/initial` is available and returns a JSON object like:
    ```json
    {
      "title": "Grandmother's Secret Cookies",
      "initialStorySegment": "It was a dark and stormy night when Grandmother decided to bake..."
    }
    ```
*   **DONE:** Create `public/js/` directory. (Handled by `mkdir -p public/css public/js` during Task 1).
*   **DONE:** Create `public/js/recipe.js` with the fetching and rendering logic.
*   **TODO:** Open `public/recipe.html` in a browser (after ensuring the backend server is running and the `/api/recipe/grandmother-secret-cookies/initial` endpoint is functional).
*   **TODO:** Verify that the recipe title (e.g., "Grandmother's Secret Cookies") is displayed.
*   **TODO:** Verify that the initial story segment (e.g., "It was a dark and stormy night...") is displayed in the story area.
*   **TODO:** Check the browser's developer console for any JavaScript errors or failed network requests.

## 3. Scroll Detection

**Goal:** Implement JavaScript to detect when the user scrolls near the bottom of the currently displayed story content. This will be the trigger to fetch more story.

**Actions & Files:**

*   **Modify `public/js/recipe.js`:**
    *   **Purpose:** Add scroll event handling.
    *   **Content:**
        *   Add an event listener for the `scroll` event (likely on the `window` or the main scrolling container).
        *   Inside the scroll handler, implement logic to determine if the user is "near the bottom". This typically involves comparing `window.innerHeight + window.scrollY` with `document.body.offsetHeight`. A threshold (e.g., 100-200 pixels from the bottom) should be used.
        *   For now, when the condition is met, `console.log("User is near the bottom, time to fetch more story!");`

**Testing:**

*   **TODO:** Add enough initial content (or set a small height for the story container) in `public/recipe.html` or `public/js/recipe.js` so that scrolling is possible.
*   **TODO:** Open `public/recipe.html` in a browser.
*   **TODO:** Open the browser's developer console.
*   **TODO:** Scroll down the page.
*   **TODO:** Verify that the "User is near the bottom..." message is logged to the console when scrolling close to the end of the content.
*   **TODO:** Test that the message doesn't log excessively (e.g., use a flag to prevent multiple triggers while content is loading).

## 4. Fetch More Story

**Goal:** When the scroll detection triggers, call the backend API (`GET /api/recipe/{recipe_id}/continue?context={story_context}`) to fetch the next segment of the story.

**Actions & Files:**

*   **Modify `public/js/recipe.js`:**
    *   **Purpose:** Integrate API call for story continuation.
    *   **Content:**
        *   Create a function `fetchMoreStory(recipeId, context)`.
            *   This function will use the `fetch` API to call `GET /api/recipe/{recipe_id}/continue`.
            *   The `context` parameter will be the last N words/characters of the current story, URL-encoded. (Define N, e.g., last 50 words).
            *   For now, `recipeId` can be hardcoded.
        *   Modify the scroll detection logic:
            *   When triggered, gather the current story context (e.g., `document.getElementById('story-content').innerText`).
            *   Call `fetchMoreStory` with the `recipeId` and the extracted context.
            *   Log the response (the next story segment) to the console.
            *   Implement a loading state flag (e.g., `isLoadingMoreStory = true`) to prevent multiple concurrent requests. Reset it after the fetch completes (success or error).

**Testing:**

*   **TODO:** Ensure a mock or actual backend endpoint `GET /api/recipe/grandmother-secret-cookies/continue` is available. It should accept a `context` query parameter and return a JSON object like:
    ```json
    {
      "nextStorySegment": "The wind howled, rattling the old window panes..."
    }
    ```
*   **TODO:** Open `public/recipe.html` in a browser.
*   **TODO:** Open the browser's developer console.
*   **TODO:** Scroll down to trigger the "fetch more" logic.
*   **TODO:** Verify that a network request is made to the `/continue` endpoint with the correct `recipeId` and a `context` parameter.
*   **TODO:** Verify that the response from the API (the `nextStorySegment`) is logged to the console.
*   **TODO:** Verify the loading state flag prevents rapid-fire requests if scrolling continues while a fetch is in progress.

## 5. Word-by-Word Rendering

**Goal:** When a new story segment is received from the `/continue` endpoint, append it to the story display area word-by-word to create a typing effect. Ensure the page adjusts to keep new words in view and push instruction headers down.

**Actions & Files:**

*   **Modify `public/js/recipe.js`:**
    *   **Purpose:** Implement the animated text rendering.
    *   **Content:**
        *   Create a function `renderStorySegmentWordByWord(segmentText)`.
            *   This function will take the `nextStorySegment` string as input.
            *   Split the `segmentText` into an array of words (and spaces).
            *   Use `setInterval` or a series of chained `setTimeout` calls to append each word (plus a space) to the `story-content` div one by one.
            *   A short delay (e.g., 50-150ms) between words will create the typing effect.
            *   After each word is added, ensure the view scrolls if necessary to keep the new text visible (e.g., `newWordElement.scrollIntoView({ behavior: 'smooth', block: 'end' });` or `window.scrollTo(0, document.body.scrollHeight);`).
        *   Modify the `fetchMoreStory` function:
            *   On successful fetch, instead of just logging, pass the `nextStorySegment` to `renderStorySegmentWordByWord`.
            *   Reset the `isLoadingMoreStory` flag *after* the word-by-word rendering is complete, or manage it so new fetches can queue if desired (though simpler to wait for now).

**Testing:**

*   **TODO:** Open `public/recipe.html` in a browser.
*   **TODO:** Scroll down to trigger fetching and rendering a new story segment.
*   **TODO:** Verify that the new story segment appears in the `story-content` div, with words appearing one at a time.
*   **TODO:** Verify that the "Ingredients" and "Directions" headers are pushed further down the page as new content is added.
*   **TODO:** Verify that the page scrolls smoothly to keep the newly appearing words in view.
*   **TODO:** Adjust timing of word-by-word rendering for a pleasant effect.
*   **TODO:** Ensure that if a user scrolls up during word-by-word rendering, the rendering continues correctly without forcing the scroll position back down until the user stops scrolling up. (This might be a refinement for Phase 3, but good to note).

---

This completes the plan for Phase 2. Each step should be tested thoroughly before moving to the next.
