const axios = require('axios');

module.exports = async function (context, req) {
    const userText = req.body && req.body.text;
    if (!userText) {
        context.res = { status: 400, body: { error: "No text provided." } };
        return;
    }

    // Get from environment for security
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    // Prepare the messages array for the conversation
    const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userText }
        // Optionally add chat history here!
    ];

    try {
        const response = await axios.post(
            endpoint,
            {
                messages: messages,
                max_tokens: 1024,         // Adjust as needed
                temperature: 1.0,
                top_p: 1.0
                // "model": "gpt-4o",     // Optional: not always needed with Azure deployments
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "api-key": apiKey
                }
            }
        );

        // Extract the assistant's reply
        const reply = response.data.choices?.[0]?.message?.content || "No response from agent.";

        context.res = {
            status: 200,
            body: { reply }
        };

    } catch (error) {
        // Improved error logging: logs both error and full API response
        context.log('OpenAI API error:', error.message);
        if (error.response) {
            context.log('OpenAI API error response data:', error.response.data);
        }
        context.res = {
            status: 500,
            body: {
                error: error.message,
                details: error.response?.data || "Request failed"
            }
        };
    }
};
