const { Mistral } = require('@mistralai/mistralai'); // Corrected import

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
    console.warn('MISTRAL_API_KEY is not set. LLM service will not function unless the key is provided via environment variables.');
}

// Initialize client in the function to allow server to start even if key is initially missing.
// Calls will fail if the key is not properly set when the function is invoked.

async function generateStoryContinuation(promptText) {
    if (!apiKey) {
        const errorMessage = 'Mistral API key is not configured. Please set the MISTRAL_API_KEY environment variable.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const client = new Mistral({apiKey: apiKey}); // Corrected instantiation

    try {
        // Using a model suitable for free tier or general use.
        // Check Mistral's documentation for the most current and appropriate model identifiers.
        const chatResponse = await client.chat.complete({ // Corrected method call
            model: 'mistral-tiny', // Example model, adjust as needed. 'open-mistral-7b' is another common one.
            messages: [
                { role: 'system', content: "You are a master storyteller. Your task is to seamlessly continue the story provided by the user. Do not add any introductory phrases, conversational filler, or remarks like 'Here's the continuation:'. Directly output the next part of the story, picking up exactly where the user's text left off. Ensure the continuation flows naturally from the provided context." },
                { role: 'user', content: promptText }
            ],
        });

        if (chatResponse && chatResponse.choices && chatResponse.choices.length > 0 && chatResponse.choices[0].message && chatResponse.choices[0].message.content) {
            return chatResponse.choices[0].message.content;
        } else {
            console.error('Invalid or unexpected response structure from Mistral API:', JSON.stringify(chatResponse, null, 2));
            throw new Error('Failed to get a valid continuation from LLM due to unexpected API response structure.');
        }
    } catch (error) {
        console.error('Error calling Mistral API:', error.message);
        // It might be useful to log error.response.data if the error object contains it for more details from the API
        if (error.response && error.response.data) {
            console.error('Mistral API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
        throw new Error(`Mistral API call failed: ${error.message}`);
    }
}

module.exports = {
    generateStoryContinuation,
};
