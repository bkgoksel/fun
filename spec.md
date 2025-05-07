# Storied Recipes: Specification and Implementation Plan

**I. Project Specification (Storied Recipes)**

*   **Concept:** A recipe website where the backstory of a recipe infinitely extends as the user scrolls, preventing them from ever reaching the actual ingredients and instructions.
*   **Core User Experience (UX):**
    1.  **Initial Load:** User sees a recipe title, an image (optional), a short introductory segment of the backstory, and the visible headers for recipe instructions (e.g., "Ingredients," "Directions").
    2.  **Scrolling:** As the user scrolls down, the backstory text dynamically extends, appearing word-by-word.
    3.  **Infinite Story:** The story generation ensures the user can never scroll past the end of the story to see the (non-existent or placeholder) recipe details.
*   **Technical Requirements:**
    1.  **LLM Integration:** Use a cheap, fast Large Language Model (LLM) to generate story continuations.
    2.  **Backend Caching:** Implement a caching layer to store generated story segments for each recipe, reducing LLM calls and improving performance for subsequent visitors.
    3.  **Word-by-Word Streaming Simulation:** New story content should appear gradually (word-by-word) to enhance the "live generation" feel.
    4.  **Pre-generation Buffer:** A small buffer of upcoming words should be available to ensure smooth streaming.

**II. Implementation Plan**

**A. Components:**

1.  **Frontend Application (Client-Side):**
    *   **Recipe Page:**
        *   Displays recipe title, (optional) image, the dynamically growing story.
        *   Shows static headers for "Ingredients" / "Directions" that are always pushed down.
        *   Manages scroll detection to trigger loading more story.
        *   Handles the word-by-word rendering of new story segments.
        *   Communicates with the backend API.
    *   **(Optional) Index Page:** Lists available recipes.

2.  **Backend Application (Server-Side):**
    *   **API Endpoints:**
        *   `GET /api/recipe/{recipe_id}/initial`: Provides the recipe title, initial story segment, and any necessary context for the frontend.
        *   `GET /api/recipe/{recipe_id}/continue?context={story_context_or_token}`: Fetches the next segment of the story.
    *   **Story Generation Module:**
        *   Interfaces with the chosen LLM.
        *   Constructs prompts for the LLM based on the current story progress.
    *   **Caching Service:**
        *   Stores and retrieves generated story segments.
        *   Keyed by recipe ID and current story state/segment number.
    *   **Recipe Data Store:**
        *   Stores basic recipe metadata: ID, title, initial story prompt/seed.

3.  **LLM Service (External or Self-Hosted):**
    *   The selected fast and cost-effective LLM.

**B. Tech Stack Suggestions:**

*   **Frontend:**
    *   Vanilla JS for dynamic content updates.
    *   Standard HTML/CSS.
    *   `fetch` API (built-in) for HTTP requests.
*   **Backend:**
    *   Language/Framework: Node.js (e.g., using Express.js) - Efficient for I/O-bound tasks, JavaScript ecosystem.
    *   Caching: Redis for high-performance caching.
    *   Database (for recipe metadata): JSON files for simple storage of recipe data.
*   **LLM:**
    *   Initial Choice: Mistral API (leveraging their free tier for development).
    *   Design: The LLM interaction module will be designed flexibly to allow for swapping out different LLM providers or models in the future.

**C. Development Phases:**

**Phase 1: Backend Core**
    1.  **Recipe Definition:** Define data structure for recipes (ID, title, initial story seed/prompt).
    2.  **Basic API Setup:**
        *   Implement the `/api/recipe/{recipe_id}/initial` endpoint to serve static initial data.
    3.  **LLM Integration:**
        *   Select and integrate an LLM. Create a function to generate a story continuation given a prompt.
    4.  **Story Continuation Endpoint:**
        *   Implement `/api/recipe/{recipe_id}/continue`.
        *   This endpoint will:
            *   Receive context (e.g., last N words of the story).
            *   Query the LLM for a continuation (e.g., next 50-100 words).
            *   Return the generated text.
    5.  **Caching Implementation:**
        *   Integrate chosen caching solution (e.g., Redis).
        *   Before LLM call, check cache for the requested segment.
        *   After LLM call, store the result in cache.
        *   Cache key strategy: e.g., `recipe:{recipe_id}:segment_hash:{hash_of_previous_words}` or `recipe:{recipe_id}:word_count:{current_word_count}`.

**Phase 2: Frontend Core**
    1.  **Basic Page Layout:** Create HTML structure for the recipe page (title, story area, placeholder for instructions headers).
    2.  **Initial Data Fetch & Display:**
        *   On page load, call `/api/recipe/{recipe_id}/initial`.
        *   Render the initial story and instruction headers.
    3.  **Scroll Detection:**
        *   Implement JavaScript to detect when the user scrolls near the bottom of the currently displayed story.
    4.  **Fetch More Story:**
        *   On scroll trigger, call `/api/recipe/{recipe_id}/continue`, passing necessary context.
    5.  **Word-by-Word Rendering:**
        *   When a new story segment is received:
            *   Split the segment into words.
            *   Append words one by one to the story display area using `setTimeout` or a similar mechanism to create a typing effect.
            *   Ensure the page scrolls or content reflows to keep the newly appearing words in view and push the instruction headers down.

**Phase 3: UX Refinements & Polish**
    1.  **Pre-generation/Buffering Strategy:**
        *   **Backend:** The `/continue` endpoint could return a slightly larger chunk of text than immediately needed, or proactively generate the *next* chunk after a request.
        *   **Frontend:** The frontend requests a moderate chunk (e.g., 2-3 sentences). This chunk is then displayed word-by-word. This client-side buffer helps smooth out the animation.
    2.  **Story Coherence:**
        *   Experiment with the amount of context (previous text) sent to the LLM to balance coherence with LLM input limits and cost.
    3.  **Loading/Error States:**
        *   Display subtle loading indicators while fetching new story segments.
        *   Handle API or LLM errors gracefully (e.g., "The storyteller seems to be taking a nap... trying again.").
    4.  **Smooth Scrolling:** Fine-tune scrolling behavior as new content is added to avoid jarring jumps.
    5.  **(Optional) Recipe Index Page:** Develop a simple page to list and link to different recipes.

**Phase 4: Deployment**
    1.  **Frontend Deployment (AWS S3 + CloudFront):**
        *   Set up an S3 bucket for static website hosting.
        *   Configure CloudFront distribution to serve content from the S3 bucket, including HTTPS.
        *   Deploy frontend HTML, CSS, and JS files to S3.
    2.  **Backend API Deployment (AWS Lambda):**
        *   Package the Node.js application (Express.js API) for Lambda.
        *   Create Lambda functions for each API endpoint (or a single function handling routing).
        *   Configure API Gateway to trigger Lambda functions.
    3.  **Redis Deployment (Render/Upstash):**
        *   Set up a free tier Redis instance on Render or Upstash.
        *   Configure the backend Lambda functions with connection details for Redis (using environment variables).
    4.  **Recipe Data Deployment:**
        *   Include JSON recipe files in the Lambda deployment package or store them in S3 accessible by Lambda.
    5.  **Configuration & Testing:**
        *   Update frontend API call URLs to point to the deployed API Gateway endpoint.
        *   Thoroughly test the end-to-end deployed application.
        *   Securely manage all API keys and credentials using environment variables in Lambda and connection strings.

**D. Key Considerations:**

*   **LLM Prompt Engineering:** The initial prompt for each recipe is critical for setting the story's tone, style, and theme.
*   **Cost Management:** Aggressive caching is paramount. Monitor LLM usage and costs.
*   **"Never Reach the End" Mechanic:** The frontend must request new content *before* the user physically reaches the absolute end of the loaded text. The threshold for triggering a new fetch should be tuned.
*   **Content Moderation (if applicable):** Depending on the LLM, consider if any output filtering is needed, though for a joke site, this might be less critical unless the LLM produces undesirable content.

**E. Deployment Strategy (Recommended):**

Focus on lightweight, simple, and cost-effective solutions, leveraging AWS familiarity where practical.

1.  **Frontend (Static Assets - HTML, CSS, Vanilla JS):**
    *   **AWS S3 + AWS CloudFront:**
        *   Host static files in an S3 bucket configured for website hosting.
        *   Use CloudFront as a CDN for improved performance, HTTPS, and caching. This leverages AWS free tiers effectively.

2.  **Backend API (Node.js - Express.js):**
    *   **AWS Lambda + API Gateway:**
        *   Deploy the Node.js application as AWS Lambda functions.
        *   Use API Gateway to create HTTP endpoints that trigger these Lambda functions.
        *   This is highly cost-effective (pay-per-use, generous free tier) and scalable.

3.  **Caching (Redis):**
    *   **Render (Free Tier) or Upstash (Free Tier):**
        *   Utilize a free tier offering from a specialized Redis provider like Render or Upstash.
        *   These services are simple to set up and integrate with AWS Lambda, offering a no-cost or very low-cost solution for caching.
        *   AWS ElastiCache can be considered if free tier eligibility is met and preferred, but external services are often simpler for this scale.

4.  **Recipe Data (JSON files):**
    *   Include JSON recipe files within the AWS Lambda deployment package.
    *   Alternatively, store them in an S3 bucket that the Lambda function has read access to.

5.  **Key Deployment Considerations:**
    *   **Simplicity:** Prioritize solutions that are easy to set up and manage, especially given the AWS components.
    *   **Cost:** Maximize use of AWS free tiers and free tiers from other services (like Redis providers).
    *   **LLM API Keys & Credentials:** Securely manage all API keys (Mistral, etc.) and AWS credentials using AWS Secrets Manager or Lambda environment variables encrypted at rest.
    *   **IAM Roles:** Use appropriate IAM roles for Lambda functions to grant least-privilege access to other AWS services (e.g., S3 if recipe data is stored there).
