const axios = require('axios');

module.exports = async function (context, req) {
    const userText = req.body && req.body.text;
    if (!userText) {
        context.res = { status: 400, body: { error: "No text provided." } };
        return;
    }

    // Replace with your Foundry/LLM agent API endpoint and key
    const foundryUrl = process.env.FOUNDRY_AGENT_URL;
    const foundryApiKey = process.env.FOUNDRY_AGENT_KEY;

    try {
        // Example POST to Foundry agent, update as needed for your API
        const resp = await axios.post(
            foundryUrl,
            { input: userText },
            { headers: { 'Authorization': `Bearer ${foundryApiKey}` } }
        );
        const reply = resp.data.reply || resp.data.choices?.[0]?.text || resp.data.text || "No response.";

        context.res = {
            status: 200,
            body: { reply }
        };
    } catch (err) {
        context.log('LLM agent error:', err.message);
        context.res = {
            status: 500,
            body: { error: err.message }
        };
    }
};
