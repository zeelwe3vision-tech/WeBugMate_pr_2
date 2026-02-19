
import traceback,re,random,json,uuid
from datetime import datetime, timezone
from core import (
    supabase,
    get_response_metrics,
    call_llm_with_model,
    get_user_role,
    query_supabase,
    save_chat_message
    )
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

FACT_BEHAVIOR_MAP = {
    "name": {
        "category": "identity",
        "mutable": False
    },
    "role": {
        "category": "professional",
        "mutable": True
    },
    "department": {
        "category": "professional",
        "mutable": True
    },
    "skills": {
        "category": "professional",
        "mutable": True
    },
    "language": {
        "category": "preference",
        "mutable": True
    },
    "tone": {
        "category": "preference",
        "mutable": True
    },
    "location": {
        "category": "personal",
        "mutable": True
    }
}

def format_response(
    query: str,
    project_data: dict = None,
    role_data: dict = None,
    notes: list = None,
    fallback: str = None,
    llm_response: str = None
) -> str:
    """
    Adaptive formatting of chatbot responses with smart highlights, emojis, symbols, and bold.
     Adaptive formatting:
    - Full project overview format if user asks for 'all project details' or 'project info'
    - Otherwise, follow short adaptive response
    """
    # Determine query type
    query_type = "general"
    if project_data:
        query_type = "project"
    elif role_data:
        query_type = "role"
    elif notes:
        query_type = "notes"

    # Dynamic prefaces with consistent formatting
    prefaces_dict = {
        "project": [
            "PROJECT OVERVIEW\n\n",
            "PROJECT DETAILS\n\n",
            "PROJECT SUMMARY\n\n"
        ],
        "role": [
            "ROLE INFORMATION\n\n",
            "YOUR ROLE\n\n",
            "TEAM DETAILS\n\n"
        ],
        "notes": [
            "DOCUMENT REFERENCES\n\n",
            "KNOWLEDGE BASE\n\n",
            "KEY POINTS\n\n"
        ],
        "general": [
            "INFORMATION\n\n",
            "DETAILS\n\n",
            "SUMMARY\n\n"
        ]    }

    preface = random.choice(prefaces_dict.get(query_type, prefaces_dict["general"]))
    # Keywords for full project info request
    full_project_keywords = [
        "all project details",
        "project info",
        "full project details",
        "project summary",
        "give me project details"
    ]
    response_parts = []
    # Check if user wants full project info
    if any(k in query.lower() for k in full_project_keywords) and project_data:
        # Full detailed project format with spacing
        project_lines = ["PROJECT INFORMATION\n"]

        # Define fields with their display names and formatting
        field_display = {
            "project_name": "Project Name",
            "status": "Status",
            "priority": "Priority",
            "client_name": "Client",
            "end_date": "End Date",
            "start_date": "Start Date",
            "description": "Description",
            "assigned_to": "Team Members",
            "tech_stack": "Technologies"
        }

        # Add each field with proper formatting
        for field, display_name in field_display.items():
            value = project_data.get(field)
            if value:
                # Format values
                if field == "status":
                    status_emoji = "✅" if str(value).lower() == "completed" else "⏳" if "progress" in str(value).lower() else "⚠️"
                    value = f"{value} {status_emoji}"
                elif field == "priority":
                    priority_emoji = "🔥" if str(value).lower() == "high" else "⭐" if str(value).lower() == "medium" else ""
                    value = f"{value} {priority_emoji}"
                elif field in ["start_date", "end_date"]:
                    value = f"📅 {value}"
                elif field == "tech_stack" and isinstance(value, list):
                    value = ", ".join(value)
                
                project_lines.append(f"{display_name.upper()}: {value}")
        
        if project_lines:
            response_parts.append("\n".join(project_lines))

    # --- Role Data ---
    if role_data:
        role_lines = ["ROLE INFORMATION\n"]
        
        # Role information section
        if role_data.get('role'):
            role_lines.append(f"ROLE: {role_data['role'].upper()}")
        
        # Team information
        if role_data.get('assigned_to_emails'):
            role_lines.append(f"\nTEAM MEMBERS: {role_data['assigned_to_emails']}")
        
        # Assigned tasks
        if role_data.get('assigned_tasks'):
            tasks = "\n  • " + "\n  • ".join(role_data['assigned_tasks']) if isinstance(role_data['assigned_tasks'], list) else role_data['assigned_tasks']
            role_lines.append(f"\nASSIGNED TASKS:{tasks}")
        
        # Project leadership
        if role_data.get('leader_of_project'):
            role_lines.append(f"\nPROJECT LEAD: {role_data['leader_of_project']}")
        
        if role_lines:
            response_parts.append("\n".join(role_lines))

    # --- Notes / RAG Data ---
    if notes:
        notes_lines = ["NOTES\n"]
        notes_lines.extend([f"• {note}" for note in notes if note.strip()])
        if len(notes_lines) > 1:  # If we have any notes besides the header
            response_parts.append("\n".join(notes_lines))

    # --- LLM Fallback ---
    if llm_response and not response_parts:
    #     # Format LLM response with better structure
    #     formatted_response = []
    #     for line in llm_response.split('\n'):
    #         line = line.strip()
    #         if line.endswith(':'):
    #             formatted_response.append(f"\n{line.upper()}")
    #         elif line.startswith(('- ', '* ', '• ')):
    #             formatted_response.append(f"  • {line[2:].strip()}")
    #         elif line and not line.startswith('**'):  # Skip markdown bold markers
    #             formatted_response.append(line)
        
    #     response_parts.append("\n".join(formatted_response))
        response_parts.append(llm_response) #Tanmey Added

    # --- Generic Fallback ---
    if not response_parts and fallback:
        response_parts.append(fallback)
    elif not response_parts:
        response_parts.append("I couldn't find the information you're looking for. Could you please provide more details?")

    # Combine all parts with proper spacing
    final_response = f"{preface}"
    
    # Add response parts with proper spacing
    for part in response_parts:
        if part.strip():
            final_response += f"\n\n{part.strip()}"
    
    # Ensure consistent line endings and spacing
    final_response = '\n'.join(line.strip() for line in final_response.split('\n'))
    final_response = '\n\n'.join(para for para in final_response.split('\n\n') if para.strip()) #Tanmey Added
    # Sujal_Harsh_Start
    # 🔹 Apply response metrics logging
    word_count, category = get_response_metrics(final_response)
    print(f"📊 Response metrics: {word_count} words ({category} category)")
    # Sujal_Harsh_Over

    return final_response

# -----------------------------------------------------------------------------------------------
# ---------------- Document Processing ----------------------------------------------------------
# -----------------------------------------------------------------------------------------------
def build_messages(
    user_input: str,
    context: str | None = None,
    user_name: str | None = None,
    chat_history: list | None = None,
    max_history: int = 5
) -> list:
    """
    Build OpenAI-style messages for LLM calls.

    Migration notes:
    - Flask session REMOVED
    - Stateless and explicit
    - Output format preserved
    - Safe for FastAPI and future session stores
    """

    # ---------------- System prompt ----------------
    if context:
        system_prompt = (
            "You are a helpful assistant. Your job is to answer the user question first, clearly and directly.\n"
            "Context may contain facts from company documents. Do not ignore the question. "
            "Do not apologize unless wrong."
        )
        user_message = f"Context:\n{context}\n\n{user_input}"
    else:
        system_prompt = (
            "You are a helpful assistant. Always answer the user's question clearly. "
            "Do not make fake information or fake data."
        )
        user_message = user_input

    messages = [{"role": "system", "content": system_prompt}]

    # ---------------- User identity (NO mutation) ----------------
    if user_name:
        messages.append({
            "role": "system",
            "content": f"The user's name is {user_name}."
        })

    # ---------------- Chat history ----------------
    if chat_history:
        messages.extend(chat_history[-max_history:])

    # ---------------- Current user input ----------------
    messages.append({"role": "user", "content": user_message})

    return messages

def parse_user_query(llm_output: str, project_id: str = None):
    try:
        if project_id and llm_output and "project detail" in llm_output.lower():
            return {
                "operation": "select",
                "table": "projects",
                "filters": {"id": project_id},
                "fields": ["*"],
                "limit": 1
            }

        if not llm_output or "{" not in llm_output:
            raise ValueError("No JSON object found in output")

        match = re.search(r"\{.*\}", llm_output, re.DOTALL)
        if not match:
            raise ValueError("No JSON object found in output")

        json_str = match.group(0)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            fixed = json_str.replace("'", '"')
            fixed = re.sub(r",\s*}", "}", fixed)
            fixed = re.sub(r",\s*]", "]", fixed)
            return json.loads(fixed)

    except Exception as e:
        print(f"❌ parse_user_query error: {e}")
        print(f"Raw output:\n{llm_output}")
        return None
    
def llm_response(
    user_input: str,
    user_email: str,
    project_id: str | None = None,
    chat_id: str | None = None
):
    """
    FastAPI-compatible llm_response.

    Migration notes:
    - Flask session REMOVED
    - User identity passed explicitly
    - Chat history handled via DB helpers
    - Behavior preserved
    """

    # --- Resolve user role ---
    user_role = get_user_role(user_email)

    # --- Parse user intent / query ---
    parsed = parse_user_query(user_input or "", project_id=project_id)
    if not parsed or parsed.get("operation") == "none":
        return {"reply": "🤖 I couldn't understand that request. Can you rephrase it?"}

    # --- Query Supabase ---
    reply = query_supabase(
        parsed,
        user_email=user_email,
        user_role=user_role,
        project_id=project_id
    )

    # --- Persist assistant reply (explicit memory, no session) ---
    try:
        # If project_id is "default" or not a valid UUID, set it to None (assuming nullable column)
        if project_id == "default" or not _is_uuid(project_id):
            project_id = None

        # user_memorys.chat_id is UUID in Supabase. Never write "default" or email-based strings.
        save_chat_message(
            user_email=user_email,
            role="assistant",
            content=reply,
            project_id=project_id,
            chat_id=chat_id
        )
    except Exception as e:
        print("⚠ Failed to save assistant message:", e)

    return {"reply": reply}

# -----------------------------------------------------------------------------------------------
# --------------------------fact-storing logic---------------------------------------------------------
# -----------------------------------------------------------------------------------------------
def get_user_fact(user_email, required_categories=None, min_confidence=0.7):
    """
    Fetch user facts from Supabase with confidence & category filtering.
    """
    try:
        print(f"🔍 Fetching facts for: {user_email}")
        

        response = (
            supabase
            .table("user_fact")
            .select("facts, confidence_1")
            .eq("user_id", user_email)
            .execute() )

        if not response.data:
            print("⚠ No data found in user_fact table for this user.")
            return {}

        all_facts = response.data[0].get("facts") or {}
        confidence_map = response.data[0].get("confidence_1") or {}

        filtered = {}

        for key, value in all_facts.items():
            conf = float(confidence_map.get(key, 1.0))
            config = FACT_BEHAVIOR_MAP.get(key, {})

            print(f"  - Checking fact '{key}': value={value}, confidence={conf}")

            if conf < min_confidence:
                print(f"    ❌ Skipped '{key}' (low confidence)")
                continue

            if required_categories:
                if not config or config.get("category") not in required_categories:
                    print(f"    ❌ Skipped '{key}' (category mismatch)")
                    continue

            filtered[key] = value

        return filtered

    except Exception as e:
        print("⚠ Error fetching user facts:", e)
        traceback.print_exc()
        return {}
    
def store_user_fact(user_email: str, facts: dict, confidence: dict = None):
    if not user_email or not isinstance(facts, dict) or not facts:
        return
    try:
        existing = (
            supabase
            .table("user_fact")
            .select("facts, confidence_1")
            .eq("user_id", user_email)
            .execute())

        old_facts = existing.data[0]["facts"] if existing.data else {}
        old_confidence = existing.data[0].get("confidence_1", {}) if existing.data else {}

        cleaned_facts = {}
        cleaned_confidence = {}

        for k, v in facts.items():
            value = str(v).strip()

            if not value or value.lower() in ["null", "none", "unknown", "n/a"]:
                continue

            if old_facts.get(k) == value:
                continue

            cleaned_facts[k] = value
            if confidence and k in confidence:
                cleaned_confidence[k] = confidence[k]

        if not cleaned_facts:
            print("⚠ No valid new facts to store.")
            return

        merged_facts = {**old_facts, **cleaned_facts}
        merged_confidence = {**old_confidence, **cleaned_confidence}

        supabase.table("user_fact").upsert({
            "user_id": user_email,
            "facts": merged_facts,
            "confidence_1": merged_confidence,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        print(f"✅ User facts stored for {user_email}: {list(cleaned_facts.keys())}")

    except Exception as e:
        print(f"❌ [UserFacts] Upsert failed:", e)   
        
def extract_and_store_user_fact(user_email: str, text: str):
    if not user_email or not text:
        return

    prompt = f"""
            You are an intelligent user-profile extraction system.

            Extract ANY useful personal or professional facts about the user
            from the message below.

            For EACH fact:
            - Assign a confidence score between 0.5 and 1.0
            - Higher confidence if the user states it clearly
            - Lower confidence if inferred indirectly

            Rules:
            - Only include real, meaningful facts
            - Ignore greetings and filler text
            - Use clear, short field names
            - Return ONLY valid JSON
            - Do NOT invent information

            Return in this format:
            {{
            "facts": {{ "key": "value" }},
            "confidence": {{"key": 0.0 }}
            }}

            Message:
            "{text}"
            JSON:
            """

    messages = [
        {"role": "system", "content": "You extract user profile facts and return only JSON."},
        {"role": "user", "content": prompt}
    ]

    response = call_llm_with_model(messages)

    if isinstance(response, dict):
        print("❌ LLM Error:", response)
        return

    try:
        data = json.loads(response)
    except Exception as e:
        print("❌ JSON parse failed:", e)
        print("LLM raw response:", response)
        return

    facts = data.get("facts", {})
    confidence = data.get("confidence", {})

    if not facts:
        print("⚠ No facts extracted.")
        return

    store_user_fact(user_email, facts, confidence)
    
def _is_uuid(value: str | None) -> bool:
    if not value or not isinstance(value, str):
        return False
    return bool(UUID_PATTERN.match(value.strip()))

def _resolve_chat_id(project_id: str | None, email: str, candidate_chat_id: str | None = None) -> str:
    """Return a UUID chat_id for (project_id, email). Uses chat_id_counters as source of truth."""
    try:
        # Fallback for non-project specific chat or non-UUID project_id
        if project_id == "general" or project_id == "default" or not project_id:
            # We use a stable project string for global chat, but we still need a UUID for chat_id.
            # If the candidate_chat_id from client is a valid UUID, keep it.
            if _is_uuid(candidate_chat_id):
                return str(candidate_chat_id)
            
            # Otherwise, use a stable 'general' identifier in chat_id_counters to find the user's last general chat.
            project_lookup_id = "00000000-0000-0000-0000-000000000000" # Null/Default UUID
        else:
            project_lookup_id = project_id

        user = supabase.table("user_perms").select("id").eq("email", email).limit(1).execute()
        user_id = user.data[0]["id"] if user.data else None
        
        # If user_id is not available, we can't do a stable lookup.
        if not user_id:
            return str(candidate_chat_id) if _is_uuid(candidate_chat_id) else str(uuid.uuid4())

        # If project_id is not a UUID, use the Null UUID for lookup
        if not _is_uuid(str(project_lookup_id)):
             project_lookup_id = "00000000-0000-0000-0000-000000000000"

        existing = (
            supabase.table("chat_id_counters")
            .select("chat_id")
            .eq("project_id", project_lookup_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            cid = existing.data[0].get("chat_id")
            if _is_uuid(str(cid)):
                return str(cid)

        new_chat_id = str(uuid.uuid4())
        supabase.table("chat_id_counters").insert({
            "project_id": project_lookup_id,
            "chat_id": new_chat_id,
            "user_id": user_id
        }).execute()
        return new_chat_id

    except Exception as e:
        print("⚠ _resolve_chat_id error:", repr(e))
        return str(uuid.uuid4())

LEGACY_SETTINGS_FILE = "legacy_llm_settings.json"