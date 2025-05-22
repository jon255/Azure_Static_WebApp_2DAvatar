const { AIProjectsClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");

// You may also use connection string and credentials from environment variables for security.
const CONNECTION_STRING = process.env.FOUNDRY_AGENT_CONNECTION_STRING; // or hardcode for test (not prod)
const AGENT_ID = process.env.FOUNDRY_AGENT_ID; // e.g., "asst_Un5qsYnlY019JXSr8gU3tOFV"
const THREAD_ID = process.env.FOUNDRY_THREAD_ID; // e.g., "thread_m50FN9lWkz30TKf8QHlMzLzz"

module.exports = async function (context, req) {
  try {
    const userText = req.body && req.body.text;
    if (!userText) {
      context.res = { status: 400, body: { error: "No text provided." } };
      return;
    }

    const client = AIProjectsClient.fromConnectionString(
      CONNECTION_STRING,
      new DefaultAzureCredential()
    );

    // Get agent and thread
    const agent = await client.agents.getAgent(AGENT_ID);
    const thread = await client.agents.getThread(THREAD_ID);

    // Post the user message to the thread
    const message = await client.agents.createMessage(thread.id, {
      role: "user",
      content: userText,
    });

    // Create run
    let run = await client.agents.createRun(thread.id, agent.id);

    // Poll for run completion
    while (run.status === "queued" || run.status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await client.agents.getRun(thread.id, run.id);
    }

    // Retrieve messages
    const messages = await client.agents.listMessages(thread.id);

    // Find the latest message from the agent
    let agentReply = "";
    for (const dataPoint of messages.data.reverse()) {
      if (dataPoint.role === "assistant") {
        for (const contentItem of dataPoint.content) {
          if (contentItem.type === "text") {
            agentReply = contentItem.text.value;
            break;
          }
        }
        if (agentReply) break;
      }
    }

    context.res = {
      status: 200,
      body: { reply: agentReply || "No reply from agent." },
    };
  } catch (error) {
    context.log("Agent error:", error);
    context.res = {
      status: 500,
      body: { error: error.message || "Unknown error." },
    };
  }
};
