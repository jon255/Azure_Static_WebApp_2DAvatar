import logging
import os
import azure.functions as func
import json

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # ... (your code here) ...
        # Let's say you compute `reply`:
        reply = "Test reply"
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
