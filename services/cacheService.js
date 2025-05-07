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
    // Expose connect if explicit connection management from server.js is desired
    // connectRedis: connect 
};
