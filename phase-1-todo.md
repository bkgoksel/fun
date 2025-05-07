# Phase 1: Backend Core - TODO

This document outlines the tasks for implementing the backend core of Storied Recipes as per Phase 1 of `spec.md`.

## 1. Recipe Definition

*   **Goal:** Define the data structure for recipes and create an initial sample recipe.
*   **Actions:**
    1.  Create a directory for recipe data: `data/recipes/`.
    2.  Create a sample recipe JSON file: `data/recipes/grandmother-secret-cookies.json`.
        *   **Content:** This file will contain the recipe's `id`, `title`, and an `initialStorySeed` (a short paragraph or a few sentences to start the story).
        ```json
        {
          "id": "grandmother-secret-cookies",
          "title": "Grandmother's Secret Cookie Recipe",
          "initialStorySeed": "The year was 1923, a crisp autumn afternoon, and young Elara was in her grandmother's kitchen. The air was thick with the scent of cinnamon and a secret that had been passed down for generations. 'Today, my dear,' her grandmother whispered, her eyes twinkling, 'I will share with you the beginning of our family's most cherished cookie recipe. It all started with a journey to a faraway land...'"
        }
        ```
*   **Testing:**
    *   Manually inspect `data/recipes/grandmother-secret-cookies.json` to ensure it's valid JSON and contains the required fields.

## 2. Basic API Setup (Node.js with Express.js)

*   **Goal:** Set up the Node.js server using Express.js and implement the `/api/recipe/{recipe_id}/initial` endpoint.
*   **Actions:**
    1.  **Initialize Node.js Project:**
        *   Run `npm init -y` to create `package.json`.
        *   Install Express: `npm install express`.
    2.  **Create Server File:**
        *   Create `server.js` in the project root.
        *   **Content:** Basic Express server setup, listening on a port (e.g., 3000). Include a basic `console.log` to confirm it's running.
    3.  **Create Initial Recipe Route:**
        *   Create `routes/recipes.js`.
        *   **Content:**
            *   Implement an Express router.
            *   Define a GET route for `/api/recipe/:recipeId/initial`.
            *   This handler will:
                *   Read the `recipeId` from path parameters.
                *   Construct the path to the corresponding JSON file in `data/recipes/`.
                *   Read and parse the JSON file.
                *   Respond with the `title` and `initialStorySeed` from the JSON file.
                *   Include error handling (e.g., if the recipe file is not found).
        *   Mount this router in `server.js` under the `/api` path.
*   **Testing:**
    *   Run `npm install` to ensure dependencies are installed.
    *   Start the server: `node server.js`. Verify the console log shows it's listening.
    *   Use `curl` or a tool like Postman to make a GET request to `http://localhost:3000/api/recipe/grandmother-secret-cookies/initial`.
    *   Verify the response is a JSON object containing the correct `title` and `initialStorySeed`.
    *   Test with a non-existent recipe ID to ensure proper error handling (e.g., a 404 response).

## 3. LLM Integration (Mistral API)

*   **Goal:** Create a module to interact with the Mistral API for story generation.
*   **Actions:**
    1.  **Install Mistral Client:**
        *   Install the official Mistral AI client library: `npm install @mistralai/mistralai`.
    2.  **Create LLM Service:**
        *   Create `services/llmService.js`.
        *   **Content:**
            *   Import the Mistral AI client.
            *   Implement a function `generateStoryContinuation(promptText)`:
                *   Initializes the Mistral client (API key should be read from an environment variable, e.g., `MISTRAL_API_KEY`).
                *   Makes a call to the Mistral API (e.g., chat completions endpoint) using the `promptText`.
                *   Returns the generated text content.
                *   Include basic error handling for API calls.
    3.  **Environment Variable Setup:**
        *   Create a `.env` file in the project root (add `.env` to `.gitignore`).
        *   Add `MISTRAL_API_KEY=your_actual_mistral_api_key` to the `.env` file.
        *   Install `dotenv` package: `npm install dotenv`.
        *   Require and configure `dotenv` at the beginning of `server.js` (or `llmService.js` if used standalone for testing).
*   **Testing:**
    *   Ensure `MISTRAL_API_KEY` is correctly set in `.env`.
    *   Create a temporary test script (e.g., `test-llm.js`) or a temporary test route in `server.js` that calls `llmService.generateStoryContinuation` with a sample prompt.
    *   Run the script/hit the route and verify that a coherent text continuation is logged or returned.

## 4. Story Continuation Endpoint

*   **Goal:** Implement the `/api/recipe/{recipe_id}/continue` endpoint to get subsequent story parts.
*   **Actions:**
    1.  **Add Continuation Route:**
        *   Modify `routes/recipes.js`.
        *   **Content:**
            *   Define a GET route for `/api/recipe/:recipeId/continue`.
            *   This handler will:
                *   Accept a `context` query parameter (this will be the current story text).
                *   Call `llmService.generateStoryContinuation` with the provided `context` (or a prompt constructed from it).
                *   Respond with the new story segment generated by the LLM.
                *   Include error handling.
*   **Testing:**
    *   Restart the server.
    *   Use `curl` or Postman to make a GET request to `http://localhost:3000/api/recipe/grandmother-secret-cookies/continue?context=The old clock ticked loudly.`.
    *   Verify the response is a JSON object containing the LLM-generated story continuation.

## 5. Caching Implementation (Redis)

*   **Goal:** Integrate Redis to cache LLM responses for the story continuation endpoint.
*   **Actions:**
    1.  **Install Redis Client:**
        *   Install a Redis client library: `npm install redis`.
    2.  **Create Cache Service:**
        *   Create `services/cacheService.js`.
        *   **Content:**
            *   Import the Redis client.
            *   Implement functions:
                *   `connect()`: Connects to the Redis server (connection details from environment variables, e.g., `REDIS_URL`).
                *   `get(key)`: Retrieves data from Redis for a given key.
                *   `set(key, value, expirationInSeconds)`: Stores data in Redis with an optional expiration.
            *   Export an instance of the cache service or the functions.
            *   Handle Redis connection errors.
    3.  **Environment Variable for Redis:**
        *   Add `REDIS_URL=redis://localhost:6379` (or your Redis instance URL) to the `.env` file.
    4.  **Integrate Caching into Continuation Endpoint:**
        *   Modify the `/api/recipe/:recipeId/continue` handler in `routes/recipes.js`.
        *   **Logic:**
            *   Generate a cache key (e.g., based on `recipeId` and a hash of the `context` to keep keys manageable).
            *   Attempt to `get` data from `cacheService` using the key.
            *   **If cache hit:** Return the cached story segment.
            *   **If cache miss:**
                *   Call `llmService.generateStoryContinuation`.
                *   `set` the LLM's response in `cacheService` with an appropriate expiration time (e.g., 1 hour).
                *   Return the LLM's response.
*   **Testing:**
    *   Ensure a Redis server is running and accessible.
    *   Set `REDIS_URL` in `.env`.
    *   Restart the server.
    *   Call the `/api/recipe/:recipeId/continue` endpoint with the same `context` twice:
        *   **First call:** Should result in an LLM call (verify with logs if possible). The response should be stored in Redis.
        *   **Second call:** Should be faster and return the cached response (verify with logs that it's a cache hit).
    *   Use `redis-cli` (or another Redis inspection tool) to check if the key was created in Redis and if it has an expiration set.
    *   Test cache expiration by waiting for the TTL to pass and making another call.

---
**Next Steps:** Proceed with implementing each item. After completing Phase 1, we will move to Phase 2: Frontend Core.
