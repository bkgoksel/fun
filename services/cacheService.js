const redis = require('redis');

// Construct Redis URL from environment variables if available, otherwise default to localhost
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisUrl = (redisHost && redisPort)
    ? `redis://${redisHost}:${redisPort}`
    : 'redis://localhost:6379';

console.log(`Using Redis URL: ${redisUrl}`); // Log the URL being used

let client;
let connectionPromise;

async function connect() {
    if (client && client.isOpen) {
        return client;
    }

    if (!connectionPromise) {
        client = redis.createClient({ url: redisUrl });

        client.on('error', (err) => {
            console.error('Redis Client Error:', err);
            // If connection fails, reset promise to allow retries or indicate failure
            connectionPromise = null;
            // Potentially throw or handle critical connection failure
        });

        client.on('connect', () => console.log('Connected to Redis server.'));
        client.on('reconnecting', () => console.log('Reconnecting to Redis...'));
        client.on('end', () => console.log('Disconnected from Redis.'));

        connectionPromise = client.connect().catch(err => {
            console.error('Failed to connect to Redis:', err);
            connectionPromise = null; // Reset promise on failure
            client = null; // Clear client instance
            throw err; // Re-throw to indicate connection failure
        });
    }

    await connectionPromise;
    return client;
}

async function get(key) {
    try {
        const currentClient = await connect();
        if (!currentClient) throw new Error("Redis client not available.");
        const value = await currentClient.get(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error(`Error getting key '${key}' from Redis:`, error);
        return null; // Or re-throw, depending on desired error handling
    }
}

async function set(key, value, expirationInSeconds) {
    try {
        const currentClient = await connect();
        if (!currentClient) throw new Error("Redis client not available.");
        await currentClient.set(key, JSON.stringify(value), {
            EX: expirationInSeconds,
        });
    } catch (error) {
        console.error(`Error setting key '${key}' in Redis:`, error);
        // Or re-throw
    }
}

async function getRecipeData(recipeId) {
    const key = `recipe:${recipeId}`;
    return get(key);
}

async function setRecipeData(recipeId, data, expirationInSeconds = 3600 * 24) {
    const key = `recipe:${recipeId}`;
    return set(key, data, expirationInSeconds);
}

async function getRecipeStory(recipeId) {
    const key = `recipe:${recipeId}:story`;
    return get(key);
}

async function setRecipeStory(recipeId, story, expirationInSeconds = 3600 * 24) {
    const key = `recipe:${recipeId}:story`;
    return set(key, { story }, expirationInSeconds);
}

async function appendToRecipeStory(recipeId, storyAddition, expirationInSeconds = 3600 * 24) {
    const existingStoryData = await getRecipeStory(recipeId);
    let currentStory = '';

    if (existingStoryData && existingStoryData.story) {
        currentStory = existingStoryData.story;
    }

    const updatedStory = currentStory + storyAddition;
    return setRecipeStory(recipeId, updatedStory, expirationInSeconds);
}

// Image-related cache functions
async function getRecipeImageUrl(recipeId, paragraphIndex) {
    const key = `recipe:${recipeId}:image:${paragraphIndex}`;
    return get(key);
}

async function setRecipeImageUrl(recipeId, paragraphIndex, imageUrl, expirationInSeconds = 3600 * 24 * 7) {
    const key = `recipe:${recipeId}:image:${paragraphIndex}`;
    return set(key, { imageUrl }, expirationInSeconds);
}

async function getAllRecipeImageUrls(recipeId) {
    try {
        const currentClient = await connect();
        if (!currentClient) throw new Error("Redis client not available.");

        // Use pattern matching to find all image URLs for this recipe
        const pattern = `recipe:${recipeId}:image:*`;
        const keys = await currentClient.keys(pattern);

        if (!keys || keys.length === 0) {
            return {};
        }

        // Get all values for these keys
        const values = await Promise.all(keys.map(key => get(key)));

        // Create a map of paragraphIndex -> imageUrl
        const imageUrlMap = {};
        keys.forEach((key, index) => {
            // Extract the paragraph index from the key (format: recipe:recipeId:image:paragraphIndex)
            const parts = key.split(':');
            const paragraphIndex = parseInt(parts[3]);

            if (!isNaN(paragraphIndex) && values[index] && values[index].imageUrl) {
                imageUrlMap[paragraphIndex] = values[index].imageUrl;
            }
        });

        return imageUrlMap;
    } catch (error) {
        console.error(`Error getting all recipe image URLs for recipe ${recipeId}:`, error);
        return {};
    }
}

// Attempt to connect when the module is loaded, but don't block.
// Actual operations will await the connection.
connect().catch(err => {
    console.error("Initial Redis connection attempt failed:", err.message);
    // Server can still start, but caching will not work until Redis is available
    // and a subsequent cache operation triggers a successful connect.
});

module.exports = {
    get,
    set,
    getRecipeData,
    setRecipeData,
    getRecipeStory,
    setRecipeStory,
    appendToRecipeStory,
    getRecipeImageUrl,
    setRecipeImageUrl,
    getAllRecipeImageUrls,
    // Expose connect for admin operations
    connect
};
