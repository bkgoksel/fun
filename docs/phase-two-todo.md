# Phase 2: Frontend Core - TODO List

This document outlines the tasks required to implement the frontend core functionality for the Storied Recipes project, as defined in `spec.md`.

## 1. Basic Page Layout

**Goal:** Create the HTML structure for the recipe page. This includes areas for the recipe title, the dynamically growing story, and static placeholder headers for "Ingredients" and "Directions".

**Actions & Files:**

- **Create `public/recipe.html`:**
  - **Purpose:** This file will serve as the main page for displaying a single recipe. It will contain the basic HTML skeleton.
  - **Content:**
    - A `div` for the recipe title.
    - A `div` (e.g., with id `story-content`) where the story will be dynamically inserted.
    - Static `h2` or `h3` tags for "Ingredients" and "Directions" that will be pushed down as the story grows.
    - A placeholder for including the JavaScript file (e.g., `<script src="js/recipe.js" defer></script>`).

**Testing:**

- **DONE:** Create `public`, `public/css`, and `public/js` directories. (Shell command `mkdir -p public/css public/js` will be suggested).
- **DONE:** Create the `public/recipe.html` file with the basic structure. (Linked `public/css/style.css` also created).
- **DONE:** Open `public/recipe.html` directly in a web browser.
- **DONE:** Verify that the title area, an empty story container, and the "Ingredients" / "Directions" headers are visible and laid out as expected.

## 2. Initial Data Fetch & Display

**Goal:** On page load, fetch the initial recipe data (title, initial story segment) from the backend API (`/api/recipe/{recipe_id}/initial`) and display it on the page.

**Actions & Files:**

- **Create `public/js/recipe.js`:**

  - **Purpose:** This file will contain all client-side JavaScript logic for the recipe page.
  - **Initial Content:**
    - An event listener for `DOMContentLoaded` or similar to ensure the script runs after the page is loaded.
    - A function `fetchInitialData(recipeId)` that uses the `fetch` API to call `GET /api/recipe/{recipe_id}/initial`.
      - For now, `recipeId` can be hardcoded (e.g., "grandmother-secret-cookies").
    - Logic to parse the JSON response.
    - Logic to update the DOM:
      - Set the recipe title in the designated HTML element.
      - Insert the initial story segment into the `story-content` div.

- **Modify `public/recipe.html`:**
  - **Purpose:** Ensure `recipe.js` is loaded.
  - **Change:** Add `<script src="js/recipe.js" defer></script>` (likely in the `<head>` or at the end of `<body>`).

**Testing:**

- **DONE:** Ensure a mock or actual backend endpoint `GET /api/recipe/grandmother-secret-cookies/initial` is available and returns a JSON object like:

  ```json
  {
    "title": "Grandmother's Secret Cookies",
    "initialStorySeed": "It was a dark and stormy night when Grandmother decided to bake..."
  }
  ```

- **DONE:** Create `public/js/` directory. (Handled by `mkdir -p public/css public/js` during Task 1).
- **DONE:** Create `public/js/recipe.js` with the fetching and rendering logic.
- **DONE:** Open `public/recipe.html` in a browser (after ensuring the backend server is running and the `/api/recipe/grandmother-secret-cookies/initial` endpoint is functional).
- **DONE:** Verify that the recipe title (e.g., "Grandmother's Secret Cookies") is displayed.
- **DONE:** Verify that the initial story segment (e.g., "It was a dark and stormy night...") is displayed in the story area.
- **DONE:** Check the browser's developer console for any JavaScript errors or failed network requests.

## 3. Scroll Detection

**Goal:** Implement JavaScript to detect when the user scrolls near the bottom of the currently displayed story content. This will be the trigger to fetch more story.

**Actions & Files:**

- **Modify `public/js/recipe.js`:**
  - **Purpose:** Add scroll event handling.
  - **Content:**
    - Add an event listener for the `scroll` event (likely on the `window` or the main scrolling container).
    - Inside the scroll handler, implement logic to determine if the user is "near the bottom". This typically involves comparing `window.innerHeight + window.scrollY` with `document.body.offsetHeight`. A threshold (e.g., 100-200 pixels from the bottom) should be used.
    - For now, when the condition is met, `console.log("User is near the bottom, time to fetch more story!");`

**Testing:**

- **DONE:** Scroll detection logic has been added to `public/js/recipe.js`. (Task 3 Action Item completed)
- **DONE:** The `initialStorySeed` in `data/recipes/grandmother-secret-cookies.json` has been lengthened to help ensure scrolling is necessary for testing. The `min-height` of `#story-content` in `public/css/style.css` is currently `100px` and can be adjusted if further needed.
- **DONE:** Open `public/recipe.html` in a browser (ensure backend server is running).
- **DONE:** Open the browser's developer console.
- **DONE:** Scroll down the page.
- **DONE:** Verify that the "User is near the bottom, time to fetch more story!" message is logged to the console when scrolling close to the end of the content.
- **DONE:** Test that the console message doesn't log excessively if scrolling stops/starts near the threshold without new content growth (the `isFetchingMoreStory` flag will be fully managed in later tasks).

## 4. Fetch More Story

**Goal:** When the scroll detection triggers, call the backend API (`GET /api/recipe/{recipe_id}/continue?context={story_context}`) to fetch the next segment of the story.

**Actions & Files:**

- **DONE: Modify `public/js/recipe.js`:**
  - **Purpose:** Integrate API call for story continuation.
  - **Content:**
    - Created an `async` function `fetchMoreStory(recipeId, context)`.
      - This function uses the `fetch` API to call `GET /api/recipe/{recipe_id}/continue`.
      - The `context` parameter is approximately the last 250 characters of the current story from `story-content.innerText`, URL-encoded.
      - `recipeId` is hardcoded (as `RECIPE_ID`).
    - Modified the scroll detection logic:
      - When triggered and not already fetching, it gathers the current story context.
      - Calls `fetchMoreStory` with the `recipeId` and the extracted context.
      - The `fetchMoreStory` function logs the `nextStorySegment` from the API response to the console.
      - Implemented and manages the `isFetchingMoreStory` flag to prevent multiple concurrent requests. The flag is set to `true` before the fetch and reset to `false` in a `finally` block within `fetchMoreStory`.

**Testing:**

- **DONE:** Ensure a mock or actual backend endpoint `GET /api/recipe/grandmother-secret-cookies/continue` is available. It should accept a `context` query parameter and return a JSON object like:

  ```json
  {
    "nextStorySegment": "The wind howled, rattling the old window panes..."
  }
  ```

- **DONE:** Open `public/recipe.html` in a browser.
- **DONE:** Open the browser's developer console.
- **DONE:** Scroll down to trigger the "fetch more" logic.
- **DONE:** Verify that a network request is made to the `/continue` endpoint with the correct `recipeId` and a `context` parameter.
- **DONE:** Verify that the response from the API (the `nextStorySegment`) is logged to the console.
- **DONE:** Verify the loading state flag prevents rapid-fire requests if scrolling continues while a fetch is in progress.

## 5. Word-by-Word Rendering

**Goal:** When a new story segment is received from the `/continue` endpoint, append it to the story display area word-by-word to create a typing effect. Ensure the page adjusts to keep new words in view and push instruction headers down.

**Actions & Files:**

- **DONE: Modify `public/js/recipe.js`:**
  - **Purpose:** Implement the animated text rendering for both initial and continued story segments.
  - **Content:**
    - Defined a constant `WORD_RENDER_DELAY_MS` (e.g., 100ms).
    - Created an `async` function `renderStorySegmentWordByWord(segmentText, targetElement)`:
      - Takes the story segment string and the target HTML element.
      - Appends text to the last `<p>` child of `targetElement`, or creates a new `<p>` if none exists.
      - Splits `segmentText` into an array of words and spaces (preserving spaces).
      - Uses an `async` loop with `await new Promise(resolve => setTimeout(resolve, WORD_RENDER_DELAY_MS))` to append each part (word/space) to the paragraph's `textContent`.
      - After each part is appended, calls `window.scrollTo(0, document.body.scrollHeight)` to keep the new text in view.
    - Modified `fetchInitialData(recipeId)`:
      - Calls `await renderStorySegmentWordByWord(data.initialStorySeed, storyContentElement)` to render the initial story.
    - Modified `fetchMoreStory(recipeId, context)`:
      - On successful fetch, calls `await renderStorySegmentWordByWord(data.nextStorySegment, storyContentElement)` to render the continued story.
      - The `isFetchingMoreStory` flag is reset to `false` in the `finally` block, which now executes *after* the `await renderStorySegmentWordByWord` completes, or if an error occurs, or if no new segment is received.

**Testing:**

- **TODO:** Open `public/recipe.html` in a browser.
- **TODO:** Scroll down to trigger fetching and rendering a new story segment.
- **TODO:** Verify that the new story segment appears in the `story-content` div, with words appearing one at a time.
- **TODO:** Verify that the "Ingredients" and "Directions" headers are pushed further down the page as new content is added.
- **TODO:** Verify that the page scrolls smoothly to keep the newly appearing words in view.
- **TODO:** Adjust timing of word-by-word rendering for a pleasant effect.
- **TODO:** Ensure that if a user scrolls up during word-by-word rendering, the rendering continues correctly without forcing the scroll position back down until the user stops scrolling up. (This might be a refinement for Phase 3, but good to note).

---

This completes the plan for Phase 2. Each step should be tested thoroughly before moving to the next.
