// Load environment variables from .env file
require('dotenv').config();

const { generateStoryContinuation } = require('./services/llmService');

async function runTest() {
    const samplePrompt = "Tell me a very short story about a curious cat who found a mysterious map.";
    console.log(`Testing LLM with prompt: "${samplePrompt}"`);

    try {
        const continuation = await generateStoryContinuation(samplePrompt);
        console.log("\nLLM Response:");
        console.log(continuation);
    } catch (error) {
        console.error("\nError during LLM test:", error.message);
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    }
}

runTest();
