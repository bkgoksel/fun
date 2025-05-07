document.addEventListener('DOMContentLoaded', () => {
    const recipeTitleElement = document.getElementById('recipe-title').querySelector('h1');
    const storyContentElement = document.getElementById('story-content');

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

            if (data.initialStorySegment) {
                // For now, just set the text. Word-by-word rendering is Task 5.
                const p = document.createElement('p');
                p.textContent = data.initialStorySegment;
                storyContentElement.appendChild(p);
            } else {
                console.warn("No initial story segment received from API.");
                storyContentElement.textContent = "Once upon a time, the story was supposed to start here, but something went wrong...";
            }

        } catch (error) {
            console.error("Error fetching initial recipe data:", error);
            recipeTitleElement.textContent = "Error Loading Recipe";
            storyContentElement.textContent = "Could not load the story. Please check the console for errors and ensure the backend server is running and the API endpoint is correct.";
        }
    }

    fetchInitialData(RECIPE_ID);
});
