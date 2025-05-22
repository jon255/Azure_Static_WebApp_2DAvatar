// /api/llmAgent/index.js
const axios = require('axios');
module.exports = async function (context, req) {
    const userText = req.body && req.body.text;
    if (!userText) {
        context.res = { status: 400, body: { error: "No text provided." } };
        return;
    }

    // Replace with your Azure OpenAI endpoint + key
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    const messages = [
        { role: "system", content: "You are a helpful and friendly AI assistant." },
        { role: "user", content: userText }
    ];

    try {
        const response = await axios.post(
            endpoint,
            {
                messages: messages,
                max_tokens: 1024,
                temperature: 1.0,
                top_p: 1.0,
                // model: "gpt-4o" // Add this if your deployment requires
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "api-key": apiKey
                }
            }
        );
        const reply = response.data.choices?.[0]?.message?.content || "No response from agent.";
        context.res = { status: 200, body: { reply } };
    } catch (error) {
        context.log('OpenAI API error:', error.message, error.response?.data);
        context.res = {
            status: 500,
            body: { error: error.message, details: error.response?.data || "Request failed" }
        };
    }
};
