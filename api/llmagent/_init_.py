import logging
import os
import azure.functions as func
import json

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
        user_text = body.get('text', '')

        conn_str = os.environ['AZURE_FOUNDRY_CONNECTION_STRING']  # Set this in Azure config!
        agent_id = os.environ['AZURE_FOUNDRY_AGENT_ID']
        thread_id = os.environ['AZURE_FOUNDRY_THREAD_ID']

        project_client = AIProjectClient.from_connection_string(
            credential=DefaultAzureCredential(),
            conn_str=conn_str
        )

        agent = project_client.agents.get_agent(agent_id)
        thread = project_client.agents.get_thread(thread_id)

        # Send the user's message
        message = project_client.agents.create_message(
            thread_id=thread.id,
            role="user",
            content=user_text
        )

        run = project_client.agents.create_and_process_run(
            thread_id=thread.id,
            agent_id=agent.id
        )

        messages = project_client.agents.list_messages(thread_id=thread.id)
        # Find the latest assistant reply
        reply = None
        for m in reversed(messages.text_messages):
            if m.role == "assistant":
                reply = m.content
                break

        if not reply:
            reply = "No reply from agent."

        return func.HttpResponse(
            json.dumps({"reply": reply}),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.error(f"Error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )
