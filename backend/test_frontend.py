from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import requests
import json
import html

app = FastAPI()

# Templates folder (you already added template.html here)
templates = Jinja2Templates(directory="templates")


@app.api_route("/", methods=["GET", "POST"], response_class=HTMLResponse)
async def chat_frontend(
    request: Request,
    mode: str = Form(default="dual"),              # dual | common
    message: str = Form(default="Show me my projects in a table"),
    project_id: str = Form(default="123"),
):
    # ---------------- CONFIG ----------------
    python_api_url = f"http://127.0.0.1:8000/chat/{mode}"

    # Simulated session email (same behavior as Flask/PHP)
    # If later needed → replace with proper session middleware
    email = "test@example.com"

    payload = {
        "message": message,
        "project_id": project_id,
        "email": email
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer debugmate123"
    }

    # ---------------- API CALL ----------------
    response = requests.post(
        python_api_url,
        headers=headers,
        data=json.dumps(payload)
    )

    if response.status_code != 200:
        return HTMLResponse(
            content=f"Error: API returned status code {response.status_code}",
            status_code=500
        )

    data = response.json()

    if not data or "reply" not in data:
        return HTMLResponse(
            content="Invalid response from server",
            status_code=500
        )

    reply = data.get("reply", "No response from AI")
    is_tabular = data.get("is_tabular", False)

    # ---------------- TABLE PARSER (IDENTICAL LOGIC) ----------------
    table_html = ""

    # 1. Trust HTML table if already present
    if "<table" in reply.lower():
        table_html = reply

    # 2. JSON projects[] → table
    elif isinstance(data.get("projects"), list) and data["projects"]:
        rows = data["projects"]
        headers_row = rows[0].keys()

        table_html += """
        <div class="table-responsive">
        <table class="ai-ui-table" style="width:100%;border-collapse:collapse;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;
        font-size:13px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,0.06);
        border-radius:8px;overflow:hidden;">
        <thead style="background:#f7fafc;color:#111827;font-weight:600;">
        <tr>
        """

        for h in headers_row:
            label = h.replace("_", " ").title()
            table_html += (
                f"<th style='padding:12px 14px;border-bottom:1px solid #e6e9ee;'>"
                f"{html.escape(label)}</th>"
            )

        table_html += "</tr></thead><tbody>"

        for row in rows:
            table_html += "<tr>"
            for h in headers_row:
                cell = row.get(h, "")
                if isinstance(cell, (dict, list)):
                    cell = json.dumps(cell, ensure_ascii=False)
                cell_html = (
                    html.escape(str(cell))
                    if cell else "<small style='color:#6b7280'>—</small>"
                )
                table_html += (
                    f"<td style='padding:12px 14px;border-bottom:1px solid #f1f5f9;'>"
                    f"{cell_html}</td>"
                )
            table_html += "</tr>"

        table_html += "</tbody></table></div>"

    # 3. Markdown table fallback
    elif is_tabular and "|" in reply:
        lines = reply.strip().split("\n")
        headers_row, rows = [], []
        in_table = False

        for line in lines:
            t = line.strip()
            if "|" in t and "---" not in t and not in_table:
                in_table = True
                headers_row = [c.strip() for c in t.split("|") if c.strip()]
                continue
            if in_table and "---" in t:
                continue
            if in_table and "|" in t:
                cells = [c.strip() for c in t.split("|") if c.strip()]
                if len(cells) == len(headers_row):
                    rows.append(cells)
            if in_table and not t:
                break

        if headers_row and rows:
            table_html += "<div class='table-responsive'><table class='ai-ui-table'>"
            table_html += "<thead><tr>"
            for h in headers_row:
                table_html += f"<th>{html.escape(h.replace('_',' ').title())}</th>"
            table_html += "</tr></thead><tbody>"

            for r in rows:
                table_html += "<tr>"
                for c in r:
                    table_html += f"<td>{html.escape(c)}</td>"
                table_html += "</tr>"

            table_html += "</tbody></table></div>"

    # 4. Final fallback
    if not table_html:
        table_html = f"""
        <div class="alert alert-secondary" style="background:#fff;border:1px solid #eef2f6;color:#0f172a;">
            <strong>Response:</strong>
            <div style="margin-top:8px;">{html.escape(reply).replace("\n","<br>")}</div>
        </div>
        """

    # ---------------- HTML OUTPUT ----------------
    return templates.TemplateResponse(
        "template.html",
        {
            "request": request,
            "user_input": message,
            "project_id": project_id,
            "is_tabular": is_tabular,
            "reply": reply,
            "table_html": table_html,
        },
    )
