# core.py
import email
import os, json, re, random, traceback, requests, uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

# Sujal_Harsh_Start
# from flask import session
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
# Sujal_Harsh_Over

# from security.rbac import apply_rbac

import chromadb
from chromadb.config import Settings
from difflib import SequenceMatcher

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------- ChromaDB ----------------
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection("company_docs")


def verify_api_key(headers):
    return headers.get("Authorization") == "Bearer webugmate123"



if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not set — please check your .env")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")


# -----------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------
CONFUSION_RESPONSES = [
    "Hmm, I'm not quite sure what you mean. Could you rephrase it?",
    "Can you please provide more details?",
    "Let's try that again — can you explain it another way?",
    "I'm here to help, but I need a bit more information from you.",
    "Please clarify your question a little so I can assist better!"
]

GENERAL_QUERIES = ["project info", "project details", "overview", "all info", "summary", "introduction", "info", "details", "describe", "about"
    ]
SPECIFIC_FIELDS = {
    "timeline": ["timeline", "deadline", "end date", "start date", "duration", "finish", "schedule"],
    "status": ["status", "progress", "phase", "current state"],
    "client": ["client", "customer"],
    "leader": ["leader", "manager", "owner", "head"],
    "members": ["members", "team", "assigned", "who is working", "employees"],
    "tech_stack": ["tech stack", "technology", "framework", "tools", "languages"],
}

# Known Supabase tables (schema)
# Known Supabase tables (schema)
TABLES = {
    "projects": ["id", "project_name", "project_description", "start_date", "end_date", "status",
                 "assigned_to_emails", "client_name", "upload_documents", "project_scope",
                 "tech_stack", "tech_stack_custom", "leader_of_project", "project_responsibility",
                 "assigned_role", "role_answers", "custom_questions", "custom_answers",
                 "assigned_to_emails", "project_field", "custom_uuid", "created_at"],
    "employee_login": ["id", "email", "login_time", "name", "logout_time", "pass"],
    "user_memorys": ["id", "user_id", "project_id", "chat_id", "role", "content", "created_at", "response_length", "response_category"],
    "episodic_memory": ["id", "user_id", "project_id", "chat_id", "summary", "message_count", "importance_score", "created_at"],
    "user_fact": ["id", "user_id", "fact_key", "fact_value", "confidence", "created_at", "updated_at"],
    "user_perms": ["id", "name", "email", "password", "role", "permission_roles"],
    "fields": {
        "project_name", "status", "tech_stack", "project_description",
        "start_date", "end_date", "assigned_to_emails", "client_name",
        "project_scope", "tech_stack_custom", "leader_of_project",
        "project_responsibility", "role_answers", "custom_questions",
        "assigned_to_emails"
    },
    "project_broadcasts": ["id", "title", "description", "type", "created_by_email", "created_at"],
    "broadcast_tasks": ["id", "broadcast_id", "project_id", "title", "description", "priority", "deadline", "created_at"],
    "task_assignments": ["id", "task_id", "user_id", "assigned_by_email", "status", "note", "assigned_at"],
    "organizations": ["id", "name", "description", "created_at"]
}

# Tables that must be access-controlled by role/email
ACCESS_CONTROLLED = {"projects", "employee_login"}

# Columns that are safe to use with ILIKE (text only; no uuid/date/json/arrays)
SEARCHABLE_COLUMNS = {
    "projects": [
        "project_name", "project_description", "status", "client_name",
        "project_scope", "tech_stack", "tech_stack_custom",
        "leader_of_project", "project_responsibility",
        "assigned_role", "role_answers", "custom_questions", "custom_answers",
        "assigned_to_emails", "project_field", "custom_uuid"
    ],
    "employee_login": ["email", "name"],
    "user_memorys": ["role", "content"],
    "episodic_memory": ["summary"],
    "user_fact": ["fact_key", "fact_value"],
    "user_perms": ["name", "email", "role", "permission_roles"],
    "organizations": ["name", "description"]
}

STM_MAX_MESSAGES = 15       # raw messages per chat
STM_SUMMARY_TRIGGER = 20   # when to summarize

EMAIL_RE = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.I)
WORD_TOKEN_RE = re.compile(r"[a-z0-9@._-]+", re.I)

USER_LLM_CACHE = {}
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
LEGACY_SETTINGS_FILE = "legacy_llm_settings.json"

def load_legacy_settings():
    if not os.path.exists(LEGACY_SETTINGS_FILE):
        return {}
    try:
        with open(LEGACY_SETTINGS_FILE, 'r') as f:
            return json.load(f)
    except:
        return {}
    
# -----------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------

def handle_greetings(user_message: str, user_name: str = None):
    """
    Return a greeting reply ONLY when the user's message is a short/pure greeting.
    If user_message contains question words or longer content, return None so the main flow proceeds.
    """
    text = (user_message or "").strip()
    if not text:
        return None

    # quick normalization
    normalized = text.lower()

    # Patterns that indicate greeting words
    greeting_words = ["hi", "hello", "hey", "gm", "ga", "ge", "good morning", "good afternoon", "good evening"]

    # Words that indicate a question/intent — if present, we should NOT treat it as pure greeting
    intent_indicators = ["?", "can", "could", "would", "please", "project", "details", "all", "give", "show", "help", "how", "what", "who", "where", "when", "why"]

    # If message contains any intent indicator, do not return greeting
    if any(ind in normalized for ind in intent_indicators):
        return None

    # If the message is longer than 4 words, assume it's not a pure greeting
    if len(normalized.split()) > 4:
        return None

    # If message contains a greeting word, return a friendly greeting
    if any(g in normalized for g in greeting_words):
        current_hour = datetime.now().hour
        tod = "day"
        if current_hour < 12:
            tod = "morning"
        elif current_hour < 18:
            tod = "afternoon"
        else:
            tod = "evening"

        if user_name:
            templates = [
                f"Good {tod}, {user_name}! How can I help you?",
                f"Hey {user_name}! What would you like help with today?",
                f"Hi {user_name}! How's your {tod} going?"
            ]
        else:
            templates = [
                f"Good {tod}! How can I help you?",
                "Hey there! What can I do for you?",
                "Hi! How can I assist?"
            ]
        return random.choice(templates)

    return None
# -----------------------------------------------------------------------------------------------

def get_user_id(email: str) -> str | None:
    """Fetch user uuid (or legacy ID) from Supabase using email."""
    try:
        # 1. Try user_profiles for UUID
        res = supabase.table("user_profiles").select("user_id").eq("email", email).execute()
        if res.data:
            uid = res.data[0].get("user_id")
            if uid and len(str(uid)) > 10:
                # print(f"   ✅ Found UUID in user_profiles: {uid}")
                return uid

        # 2. Try user_perms (check for user_id column OR id)
        try:
      
            try:
                res = supabase.table("user_perms").select("user_id, id").eq("email", email).execute()
            except:
                # If selection of 'user_id' fails (col missing), fallback to just 'id'
                 res = supabase.table("user_perms").select("id").eq("email", email).execute()
            if res.data:
                row = res.data[0]
                # Prefer UUID if present
                if row.get("user_id") and len(str(row.get("user_id"))) > 10:
                    return row.get("user_id")
                
                # Fallback to legacy integer ID if no UUID
                legacy_id = row.get("id")
                if legacy_id:
                    print(f"   ℹ Found legacy ID in user_perms: {legacy_id}")
                    return str(legacy_id)
        except Exception as ex:
            print(f"   (user_perms check failed: {ex})")

        print(f"⚠ User ID not found for email: {email}")
    except Exception as e:
        print("⚠ get_user_id error:", e)
    print("⚠ Falling back to email as user_id")
    return email

def get_user_perms_id(email: str) -> int | None:
    """Fetch numeric user id from Supabase user_perms.id (used by user_memorys in this project)."""
    try:
        res = supabase.table("user_perms").select("id").eq("email", email).limit(1).execute()
        if res.data and isinstance(res.data, list) and len(res.data) > 0:
            uid = res.data[0].get("id")
            return int(uid) if uid is not None else None
    except Exception as e:
        print("⚠ get_user_perms_id error:", e)
    return None


def _is_uuid(value: str | None) -> bool:
    if not value or not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
        return True
    except Exception:
        return False


# -----------------------------------------------------------------------------------------------


def get_user_role(email: str) -> str:
    """
    Fetch role for a user from Supabase (table: user_perms with columns: email, role).
    Defaults to 'Employee' if no row found.
    """
    try:
        res = supabase.table("user_perms").select("role").eq("email", email).limit(1).execute()
        if res.data and isinstance(res.data, list) and len(res.data) > 0:
            role = (res.data[0].get("role") or "").strip()
            return role if role else "Employee"
    except Exception as e:
        print("Supabase role fetch error:", e)
    return "Employee"



# -----------------------------------------------------------------------------------------------

def save_chat_message(
    user_email: str,
    role: str,
    content: str,
    project_id: str,
    chat_id: str,
    keep_limit: int = 200
):
    """Save chat message with full privacy isolation (user + project + chat)."""
    
    
    user_id = get_user_perms_id(user_email)
    if not user_id:
        print("⚠ Cannot save chat — user not found:", user_email)
        return
    
    if not content:
        print("⚠ Skipping save_chat_message — empty content")
        return

    # project_id = project_id or session.get("project_id") or "default"
    # chat_id = chat_id or session.get("chat_id")

    # user_memorys.chat_id is UUID in Supabase. Never write "default" or email-based strings.
    if not _is_uuid(chat_id):
        chat_id = str(uuid.uuid4())
        # session["chat_id"] = chat_id
        
    #fastapi safe version
    # session.setdefault("chat_history", [])
    # session["chat_history"].append({"role": role, "content": content})
    # # do NOT trim session history (we use Supabase history instead)
    # session["chat_history"] = session["chat_history"]
    # if session is not None:
    #     session.setdefault("chat_history", [])
    #     session["chat_history"].append({
    #         "role": role,
    #         "content": content
    #     })
        # do NOT trim session history (we use Supabase history instead)
        # session["chat_history"] = session["chat_history"]


    
    #updated - Krishi   20/1/26
    response_length = None
    response_category = None

    if role == "assistant":
        response_length, response_category = get_response_metrics(content)

    try:
        # Insert new message with all isolation keys
        insert_res = supabase.table("user_memorys").insert({
            "user_id": user_id,
            "project_id": project_id,
            "chat_id": chat_id,
            "role": role,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "response_length": response_length,          # NEW  - Krishi
            "response_category": response_category            
            
        }).execute()

        inserted_id = None
        try:
            if insert_res.data and isinstance(insert_res.data, list) and len(insert_res.data) > 0:
                inserted_id = insert_res.data[0].get("id")
        except Exception:
            inserted_id = None

        # Auto-trim oldest messages per chat
        res = (
            supabase.table("user_memorys")
            .select("id")
            .eq("user_id", user_id)
            .eq("project_id", project_id)
            .eq("chat_id", chat_id)
            .order("created_at", desc=True)
            .execute()
        )
        ids = [r["id"] for r in res.data] if res.data else []
        if len(ids) > keep_limit:
            old_ids = ids[keep_limit:]
            for oid in old_ids:
                supabase.table("user_memorys").delete().eq("id", oid).execute()
    # ---------------- EPISODIC MEMORY TRIGGER ----------------

        history = load_chat_history(user_email, project_id, chat_id, limit=50)

        if len(history) >= STM_SUMMARY_TRIGGER:
            raw_text = [
                f"{m['role'].upper()}: {m['content']}"
                for m in history
            ]

            summary = generate_episodic_summary(raw_text)

            if summary:
                store_episodic_memory(
                    user_email=user_email,
                    project_id=project_id,
                    chat_id=chat_id,
                    summary=summary,
                    msg_count=len(history)
                )

                # 🔥 Trim raw STM safely
                keep_last = history[-STM_MAX_MESSAGES:]
                supabase.table("user_memorys") \
                    .delete() \
                    .eq("user_id", get_user_perms_id(user_email)) \
                    .eq("project_id", project_id) \
                    .eq("chat_id", chat_id) \
                    .execute()

                for m in keep_last:
                    supabase.table("user_memorys").insert({
                        "user_id": get_user_perms_id(user_email),
                        "project_id": project_id,
                        "chat_id": chat_id,
                        "role": m["role"],
                        "content": m["content"],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }).execute()

        return inserted_id

    except Exception as e:
        print("⚠ save_chat_message error:", repr(e))
        return None

# -----------------------------------------------------------------------------------------------

def load_chat_history(user_email: str, project_id: str = None,
                      chat_id: str = None, limit: int = 15):
    """Fetch private chat history for one user, project, and chat_id."""
    try:
        if not user_email:
            print("⚠ No email found — skipping history load.")
            # return session.get("chat_history", [])
            return []

        # Get user_id
        user_info = (
            supabase
            .table("user_perms")
            .select("id")
            .eq("email", user_email)
            .limit(1)
            .execute()
        )

        if not user_info.data:
            print(f"⚠ No user found for email: {user_email}")
            return []

        user_id = user_info.data[0]["id"]
        project_id = project_id or "default"
        #   chat_id = chat_id or session.get("chat_id")
        
        if not chat_id:
            print("⚠ No chat_id provided — skipping history load.")
            return []
        
        # user_memorys.chat_id is UUID; if invalid, skip DB query to avoid 22P02 errors.
        if not _is_uuid(chat_id):
            print(f"⚠ load_chat_history skipped — invalid chat_id UUID: {chat_id}")
            return []

        # Query isolated chat messages
        res = (
            supabase.table("user_memorys")
            .select("role, content, created_at")
            .eq("user_id", user_id)
            .eq("project_id", project_id)
            .eq("chat_id", chat_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )

        if not res.data:
            # print(f"📭 No previous messages for {user_email} | {project_id} | {chat_id}")
            print(f"📭 may be some data is not there!{chat_id}")
            return []
        
        print(f"[DEBUG] Loading chat history for {user_email} | project_id={project_id} | chat_id={chat_id}")
        return [{"role": m["role"], "content": m["content"]} for m in res.data]
        

    except Exception as e:
        print("⚠ load_chat_history error:", e)
        return []

# -----------------------------------------------------------------------------------------------

def generate_episodic_summary(messages: list[str]) -> str:
    """
    Convert raw chat messages into a compact episodic summary.
    """
    if not messages:
        return ""

    prompt = f"""
You are a conversation summarization engine.

Summarize the following conversation into:
- Key user intents
- Decisions made
- Tasks or goals
- Important facts mentioned

Rules:
- 5–7 bullet points max
- No greetings
- No filler
- No speculation

Conversation:
{chr(10).join(messages)}

Summary:
"""

    summary = call_openrouter(
        [
            {"role": "system", "content": "You summarize conversations."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_tokens=250
    )

    return summary.strip() if summary else ""

# -----------------------------------------------------------------------------------------------

def store_episodic_memory(user_email, project_id, chat_id, summary, msg_count):
    try:
        if not user_email or not summary:
            return

        # Prefer auth UUID if available; episodic_memory.user_id is typically UUID.
        episodic_user_id = get_user_id(user_email) or user_email

        if not _is_uuid(episodic_user_id):
            print("⚠ Skipping episodic store — no valid UUID for user:", user_email)
            return

        if not _is_uuid(chat_id):
            print("⚠ Skipping episodic store — invalid chat_id UUID:", chat_id)
            return

        supabase.table("episodic_memory").insert({
            "user_id": episodic_user_id,
            "project_id": project_id,
            "chat_id": chat_id,
            "summary": summary,
            "message_count": msg_count,
            "importance_score": min(1.0, 0.4 + msg_count / 50)
        }).execute()

    except Exception as e:
        print("⚠ Episodic memory store error:", e)

# -----------------------------------------------------------------------------------------------


def load_episodic_memory(user_email, project_id, chat_id, limit=2):
    try:
        episodic_user_id = get_user_id(user_email) or user_email
        if not _is_uuid(episodic_user_id):
            print("⚠ Invalid UUID for episodic fetch:", user_email)
            return []

        if not _is_uuid(chat_id):
            print("⚠ Invalid UUID for episodic fetch chat_id:", chat_id)
            return []


        res = (
            supabase.table("episodic_memory")
            .select("summary")
            .eq("user_id", episodic_user_id)
            .eq("project_id", project_id)
            .eq("chat_id", chat_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        return [r["summary"] for r in res.data] if res.data else []

    except Exception as e:
        print("⚠ Episodic fetch error:", e)
        return []


# -----------------------------------------------------------------------------------------------


def detect_intent(user_query: str) -> str:
    """
    Unified intent detector for chatbot.
    Handles:
      - Project queries (details, all_projects, timeline, etc.)
      - Developer queries (coding, debugging, math)
      - General queries
      - LLM fallback for ambiguous cases
    """

    if not user_query:
        return "general"

    q = user_query.lower().strip()

    # ---------- QUICK PROJECT-RELATED INTENTS ----------
    if any(word in q for word in [
        "all project", "all projects", "list projects", "every project", "badha project", "badha"
    ]):
        return "all_projects"

    if any(word in q for word in [
        "project details", "project info", "give me project", "all details", "project", "details of project"
    ]):
        return "project_details"

    # ---------- CODING / DEBUGGING / MATH ----------
    if any(word in q for word in ["code", "function", "script", "program", "sql", "api", "class", "loop", "```"]):
        if any(word in q for word in ["error", "traceback", "exception", "bug", "fix", "issue"]):
            return "debugging"
        return "coding"

    if any(word in q for word in ["solve", "integral", "derivative", "equation", "calculate", "sum", "matrix", "theorem"]):
        return "math"

    for field, keywords in SPECIFIC_FIELDS.items():
        for k in keywords:
            if k in q:
                return field


    for g in GENERAL_QUERIES:
        if g in q:
            return "general"

    # ---------- FALLBACK TO LLM CLASSIFICATION ----------
    try:
        intent_prompt = f"""
        Classify the user query into one of these categories:
        - "general" → asking for overview or summary.
        - "timeline" → about dates or schedule.
        - "client" → about client or customer.
        - "leader" → about project leader/manager.
        - "members" → about team members.
        - "status" → about progress or completion.
        - "tech_stack" → about technology/tools used.
        - "project_details" → asking for project details or info.
        - "all_projects" → asking for list of all projects.
        - "coding" → about writing or explaining code.
        - "debugging" → about fixing or analyzing code errors.
        - "math" → about mathematical problems.
        - "other" → if none apply.
        User query: "{user_query}"
        Reply ONLY with one category name.
        """

        result = call_openrouter([
            {"role": "system", "content": "You are an intent classification engine."},
            {"role": "user", "content": intent_prompt},
           { "role": "system",
            "content": "Never repeat the exact same answer from history. Always generate a fresh response using updated info."
           }
        ], temperature=0)

        if result:
            return result.strip().lower()
    except Exception as e:
        print(f"[⚠️ detect_intent fallback] {e}")

    # ---------- FINAL FALLBACK ----------
    return "general"


# -----------------------------------------------------------------------------------------------


def is_technical_prompt(user_input: str, project_data: list | None = None) -> bool:
    """
    Returns True ONLY when the user's query is technical or project-related.
    Filters out greetings, personal, company info, or general knowledge queries.
    """

    # ---------- STEP 1: Basic validation ----------
    if not user_input or not user_input.strip():
        return False

    text = user_input.lower().strip()

    # ---------- STEP 2: Hard non-technical filters ----------
    non_tech_patterns = [
        r"\bhello\b", r"\bhi\b", r"\bhey\b", r"\bthanks\b", r"\bbye\b",
        r"\bgood (morning|afternoon|evening)\b",
        r"\bhow are you\b",
        r"\bwhat('?s| is) your name\b",
        r"\bwho is\b", r"\bprime minister\b",
        r"\bweather\b", r"\btime\b",
        r"\bcompany name\b", r"\babout company\b", r"\bwe3vision\b"
    ]

    for pattern in non_tech_patterns:
        if re.search(pattern, text):
            return False

    # ---------- STEP 3: Tokenization ----------
    tokens = re.findall(r"[a-z0-9_@]+", text)

    # Very short or meaningless input → skip
    if len(tokens) < 2:
        return False

    # ---------- STEP 4: Technical keyword detection ----------
    tech_keywords = {
        "api", "flask", "backend", "frontend", "database", "sql", "supabase",
        "bug", "error", "debug", "react", "node", "python", "javascript",
        "deployment", "auth", "token", "jwt", "docker", "kubernetes",
        "langchain", "chroma",
        "project", "timeline", "leader", "team", "client",
        "scope", "stack", "tech", "framework",
        "deadline", "responsibility"
    }

    if any(keyword in text for keyword in tech_keywords):
        return True

    # ---------- STEP 5: Project-data semantic matching ----------
    project_keywords = set()

    for proj in project_data or []:
        if not isinstance(proj, dict):
            continue

        for key in (
            "project_name",
            "project_description",
            "project_scope",
            "tech_stack",
            "tech_stack_custom",
            "project_field",
            "leader_of_project"
        ):
            value = proj.get(key)
            if value:
                project_keywords.update(
                    re.findall(r"[a-z0-9_@]+", str(value).lower())
                )

    if not project_keywords:
        return False

    # ---------- STEP 6: Token overlap check ----------
    overlap_count = sum(1 for t in tokens if t in project_keywords)
    return overlap_count >= 1


# -----------------------------------------------------------------------------------------------

def _is_int_like(val):
    """Return True if value represents an integer (so we should use eq instead of ilike)."""
    try:
        if isinstance(val, int):
            return True
        s = str(val).strip()
        return re.fullmatch(r"-?\d+", s) is not None
    except:
        return False

# -----------------------------------------------------------------------------------------------


def _apply_filter(query, field, value):
    """
    Apply type-aware filter to a supabase query builder:
      - arrays (list or dict{'contains':...}) -> .contains
      - ints -> .eq
      - small tokens (<=4 chars) -> prefix ilike
      - longer strings -> fuzzy ilike
      - dict with start/end -> date range handling via gte/lte
    """
    # arrays / contains
    if isinstance(value, dict) and "contains" in value:
        contains_val = value["contains"]
        if isinstance(contains_val, list):
            for v in contains_val:
                query = query.contains(field, [v])
        else:
            query = query.contains(field, [contains_val])
        return query

    # date range
    if isinstance(value, dict) and ("start" in value or "end" in value):
        if "start" in value and value["start"]:
            query = query.gte(field, value["start"])
        if "end" in value and value["end"]:
            query = query.lte(field, value["end"])
        return query

    # numeric exact match
    if _is_int_like(value):
        try:
            return query.eq(field, int(str(value).strip()))
        except:
            pass

    # string fuzzy/prefix
    if isinstance(value, str):
        v = value.strip()
        if len(v) <= 4:
            return query.ilike(field, f"{v}%")
        else:
            return query.ilike(field, f"%{v}%")

    # fallback equality
    return query.eq(field, value)

# -----------------------------------------------------------------------------------------------


def _apply_access_controls(table: str, query, role: str, user_email: str):
    """
    Enforce RBAC/IBAC ONLY on Supabase data fetching.
    Rules:
      - Admin: unrestricted across all tables.
      - HR: unrestricted for 'projects' and 'employee_login'.
      - Manager: 'projects' restricted to those they manage (leader_of_project contains user_email).
      - Employee/Other: 'projects' where assigned_to_emails contains user_email;
                        'employee_login' only their own record.
      - Other tables: no additional restrictions (unless specified above).
    """
    r = (role or "Employee").strip().lower()
    t = (table or "").strip().lower()

    # Admin: no restriction
    if r == "admin":
        return query

    # HR: unrestricted on projects and employee_login
    if r == "hr":
        return query

    # Manager: restrict projects to those they lead
    if r == "manager":
        if t == "projects":
            # return query.contains("leader_of_project", [user_email])
            
            # Sujal_Start
            print(f"   ✅ Manager - Full access")
            return query
            # Sujal_Over

        if t == "employee_login":
            # Not specified: default to self only
            return query.eq("email", user_email)
        return query

    # Sujal_Start
    # Employee/ Project Manager/ Other: strict
    if r in ["Project Manager", "project manager", "projectmanager", "project_manager", "employee", "other", "pm"]:
        if t == "projects":
            return query.contains("assigned_to_emails", [user_email])
            # return query.ilike("team_members", f'%{user_email}%') # Sujal
            # return query.cs("team_members", f'{{{user_email}}}') # Sujal
        if t == "employee_login":
            return query.eq("email", user_email)
        return query
        
    # Sujal_Over

    # Fallback: treat as Employee
    if t == "projects":
        # return query.contains("assigned_to_emails", [user_email])
        return query.cs("assigned_to_emails", f'{{{user_email}}}') # Sujal

    if t == "employee_login":
        return query.eq("email", user_email)
    return query
# -----------------------------------------------------------------------------------------------
def _text_cols(table: str) -> list:
    """Return only the columns safe for ILIKE in this table."""
    return SEARCHABLE_COLUMNS.get(table, [])

# -----------------------------------------------------------------------------------------------
def query_supabase(parsed, user_email, user_role, project_id):
    """
    Run a structured query against Supabase with proper projectId and user handling.
    - 'projects' table: use incoming project_id or filter override.
    - Other tables: apply filters and role-based access controls.
    """
    try:
        table = parsed.get("table")
        filters = parsed.get("filters", {}) or {}
        limit = parsed.get("limit", 10)
        fields = parsed.get("fields", ["*"])

        # # Sujal_Start
        # from validators import validate_rbac_access_for_query
        
        # is_allowed, filter_params, error_msg = validate_rbac_access_for_query(
        #     user_email=user_email,
        #     user_role=user_role,
        #     table_name=table,
        #     query_type="read"
        # )
        
        # if not is_allowed:
        #     print(f"🚫 RBAC DENIED: {error_msg}")
        #     return f"⚠ {error_msg}"
        
        # print(f"✅ RBAC ALLOWED: filter_type={filter_params.get('filter_type')}")
        # # Sujal_Over

        # Ensure user_email is provided
        if not user_email:
            return "⚠ No user specified."
        # Ensure user_role is set (fallback if needed)
        if not user_role:
            user_role = get_user_role(user_email)
        # Clean up email string
        user_email = user_email.strip()

        # --- Sync project_id from filters or parameters ---
        incoming_project_id = filters.pop("id", None)
        if incoming_project_id:
            project_id = incoming_project_id

        # If a 'uuid' filter is present, it takes priority over the parameter
        uuid_filter = filters.pop("uuid", None)
        if uuid_filter:
            project_id = uuid_filter

        # Debug print
        print(f"🔍 Query request: table={table}, filters={filters}, role={user_role}, "
              f"email={user_email}, project_id={project_id}")

        # Build base query
        select_clause = ",".join(fields) if fields != [""] else ""
        query = supabase.table(table).select(select_clause)

        # Special handling for the 'projects' table
        if table == "projects":
            if not project_id:
                return "⚠ No project selected."
            # Clean up project_id string
            if isinstance(project_id, str):
                project_id = project_id.strip()
            print(f"🧾 Using project_id: '{project_id}'")
            if _is_uuid(project_id):
                query = query.eq("id", project_id)
            
            else:
                # If not a UUID, searching by id will fail. 
                # For 'default' or other strings, we might want to skip the filter 
                # or handle it appropriately. 
                # For now, let's just not apply the filter to avoid the crash.
                print(f"⚠️ project_id '{project_id}' is not a valid UUID, skipping 'id' filter.")

            # # Sujal_Start
            # from validators import apply_rbac_to_supabase_query
            
            # try:
            #     query = apply_rbac_to_supabase_query(
            #         query_object=query,
            #         user_email=user_email,
            #         user_role=user_role,
            #         table_name=table
            #     )
            #     print(f"✅ RBAC filter applied successfully")
            # except PermissionError as e:
            #     return f"⚠ {str(e)}"
            # # Sujal_Over

            # Sujal_Start
            # ✅ CRITICAL FIX: Apply RBAC
            print(f"🔐 Applying RBAC: role={user_role}, email={user_email}")
            query = _apply_access_controls(table, query, user_role, user_email) #Sujal_15/2
            # Sujal_Over

        else:
            # Apply each user-specified filter to the query
            free_text = None
            if "free_text" in filters:
                free_text = str(filters.pop("free_text")).strip()
            for field, value in filters.items():
                if value in [None, ""]:
                    continue
                query = _apply_filter(query, field, value)

            # Apply role-based access control for restricted tables
            if table in ACCESS_CONTROLLED: # and table != "projects": #Sujal_15/2
                query = _apply_access_controls(table, query, user_role, user_email)

            # Free-text search across text columns if provided
            if free_text:
                cols = _text_cols(table)
                if cols:
                    or_parts = [f"{c}.ilike.%{free_text}%" for c in cols]
                    or_clause = ",".join(or_parts)
                    query = query.or_(or_clause)

        # Execute the query with limit
        result = query.limit(limit).execute()
        print("📊 Supabase raw fetching........")
        data = result.data or []

        if not data:
            return "⚠ No matching records found."

        # Format the results as bullet points
        formatted = []
        for row in data:
            details = []
            for k, v in row.items():
                if v in [None, "", [], {}]:
                    continue
                if isinstance(v, (list, dict)):
                    try:
                        v = json.dumps(v, ensure_ascii=False)
                    except:
                        v = str(v)
                details.append(f"{k.replace('_', ' ').title()}: {v}")
            formatted.append("• " + "\n  ".join(details))

        return "\n\n---\n\n".join(formatted)

    except Exception as e:
        print("❌ Supabase error:", e)
        traceback.print_exc()
        return f"❌ Supabase error: {str(e)}"

# def query_supabase(parsed, user_email, user_role, project_id):
#     """
#     Run a structured query against Supabase with proper projectId and user handling.
#     - 'projects' table: use incoming project_id or filter override.
#     - Other tables: apply filters and role-based access controls.
#     """
#     try:
#         table = parsed.get("table")
#         filters = parsed.get("filters", {}) or {}
#         limit = parsed.get("limit", 10)
#         fields = parsed.get("fields", ["*"])

#         # Ensure user_email is provided
#         if not user_email:
#             return "⚠ No user specified."

#         # Ensure user_role is set (fallback if needed)
#         if not user_role:
#             user_role = get_user_role(user_email)

#         # Clean up email string
#         # user_email = user_email.strip()

#         user_email = user_email.strip().lower()
#         user_role = (user_role or "employee").replace(" ", "_").lower()


#         # --- Sync project_id from filters or parameters ---
#         incoming_project_id = filters.pop("id", None)
#         if incoming_project_id:
#             project_id = incoming_project_id

#         # If a 'uuid' filter is present, it takes priority over the parameter
#         uuid_filter = filters.pop("uuid", None)
#         if uuid_filter:
#             project_id = uuid_filter

#         # Debug print
#         print(
#             f"🔍 Query request: table={table}, filters={filters}, role={user_role}, "
#             f"email={user_email}, project_id={project_id}"
#         )

#         # Build base query
#         select_clause = ",".join(fields) if fields != [""] else ""
#         query = supabase.table(table).select(select_clause)

#         # Special handling for the 'projects' table
#         if table == "projects":
#             if not project_id:
#                 return "⚠ No project selected."

#             if isinstance(project_id, str):
#                 project_id = project_id.strip()

#             print(f"🧾 Using project_id: '{project_id}'")

#             if _is_uuid(project_id):
#                 query = query.eq("id", project_id)
#             else:
#                 print(
#                     f"⚠️ project_id '{project_id}' is not a valid UUID, skipping 'id' filter."
#                 )

#         else:
#             # Apply each user-specified filter to the query
#             free_text = None

#             if "free_text" in filters:
#                 free_text = str(filters.pop("free_text")).strip()

#             for field, value in filters.items():
#                 if value in [None, ""]:
#                     continue
#                 query = _apply_filter(query, field, value)

#             # Free-text search across text columns if provided
#             if free_text:
#                 cols = _text_cols(table)
#                 if cols:
#                     or_parts = [f"{c}.ilike.%{free_text}%" for c in cols]
#                     or_clause = ",".join(or_parts)
#                     query = query.or_(or_clause)

#         # 🔐 APPLY RBAC FOR ALL TABLES (INCLUDING PROJECTS)
#         query = apply_rbac(query, table, user_role, user_email)

#         # Execute the query with limit
#         result = query.limit(limit).execute()

#         print("📊 Supabase raw fetching........")

#         data = result.data or []

#         if not data:
#             return "⚠ No matching records found."

#         # Format the results as bullet poinmts
#         formatted = []
#         for row in data:
#             details = []
#             for k, v in row.items():
#                 if v in [None, "", [], {}]:
#                     continue
#                 if isinstance(v, (list, dict)):
#                     try:
#                         v = json.dumps(v, ensure_ascii=False)
#                     except:
#                         v = str(v)
#                 details.append(f"{k.replace('_', ' ').title()}: {v}")

#             formatted.append("• " + "\n  ".join(details))

#         return "\n\n---\n\n".join(formatted)

#     except Exception as e:
#         print("❌ Supabase error:", e)
#         traceback.print_exc()
#         return f"❌ Supabase error: {str(e)}"

# ----------------------------------------------------------------------------------------------

def call_llm_with_model(messages, model="openai/gpt-4o-mini", temperature=0.5, max_tokens=350):
    if not model: model = "openai/gpt-4o-mini"
    print(f"🤖 Calling LLM with model: {model}")
    try:
        res = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            timeout=20
        )
        if res.status_code != 200:
            print(f"⚠ OpenRouter API error {res.status_code}: {res.text}")
            return None
        data = res.json()
        if "choices" not in data:
            print("⚠ Missing 'choices' in API response:", data)
            return None
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print("❌ Exception calling OpenRouter:", e)
        traceback.print_exc()
        return model
# -----------------------------------------------------------------------------------------------
# -------------------------------------table response--------------------------------------------------
# -----------------------------------------------------------------------------------------------
    
    
def detect_table_request(query: str) -> bool:
    """Check if user is requesting table format"""
    table_keywords = [
        "in table format", "as a table", "tabular", "show in table",
        "display in table", "format as table", "in tabular form",
        "in table", "table", "table format", "in a table"
    ]
    query_lower = query.lower()
    return any(keyword in query_lower for keyword in table_keywords)

# -----------------------------------------------------------------------------------------------

def format_results_as_table(data: list[dict]) -> str:
    """
    Convert list of dicts into HTML UI table.
    IMPORTANT: No <style> is included here.
    """
    if not data:
        return '<div class="ai-ui-table-wrap"><div style="padding:12px;">No records found.</div></div>'

    headers = list(data[0].keys())

    html = []
    html.append('<div class="ai-ui-table-wrap">')
    html.append('<table class="ai-ui-table">')

    # header
    html.append("<thead><tr>")
    for h in headers:
        html.append(f"<th>{str(h).replace('_', ' ').title()}</th>")
    html.append("</tr></thead>")

    # body
    html.append("<tbody>")
    for row in data:
        html.append("<tr>")
        for h in headers:
            v = row.get(h, "")

            if isinstance(v, (list, dict)):
                try:
                    v = json.dumps(v, ensure_ascii=False)
                except:
                    v = str(v)

            cell_value = v if v not in [None, ""] else "—"
            html.append(f"<td>{cell_value}</td>")
        html.append("</tr>")
    html.append("</tbody>")

    html.append("</table></div>")
    return "".join(html)

# -----------------------------------------------------------------------------------------------
# tanmey sir
# def format_data_as_table(data, query_type: str = "general") -> str:
#     """
#     Convert data (list of dicts / dict / string) into an HTML UI table.
#     NOTE: No <style> tag is returned from backend. CSS should be in frontend only.
#     """
#     try:
#         # If data is already a string containing HTML table — return as-is
#         if isinstance(data, str):
#             if "<table" in data.lower():
#                 return data
#             return f'<div class="ai-ui-table-wrap"><div style="padding:12px;">{data}</div></div>'

#         # List of dicts → build table
#         if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
#             return format_results_as_table(data)

#         # Single dict → key/value table (NO STYLE)
#         if isinstance(data, dict):
#             html = ['<div class="ai-kv-table"><table><tbody>']
#             for k, v in data.items():
#                 if isinstance(v, (list, dict)):
#                     try:
#                         v = json.dumps(v, ensure_ascii=False)
#                     except:
#                         v = str(v)

#                 cell_value = v if v not in [None, ""] else "—"
#                 html.append(
#                     f'<tr><th>{str(k).replace("_", " ").title()}</th><td>{cell_value}</td></tr>'
#                 )

#             html.append("</tbody></table></div>")
#             return "".join(html)

#         # Fallback
#         return f'<div class="ai-ui-table-wrap"><div style="padding:12px;">{str(data)}</div></div>'

#     except Exception as e:
#         print("format_data_as_table error:", e)
#         return '<div class="ai-table-empty">⚠ Error formatting table.</div>'
import json

def format_data_as_table(rows, intent="general"):
    """
    rows: List[Dict[str, Any]]
    Returns: HTML table string
    """

    if not rows or not isinstance(rows, list):
        return "⚠️ No data available."

    # Ensure first element is a dict
    if not isinstance(rows[0], dict):
        return "⚠️ Invalid tabular data."

    headers = list(rows[0].keys())

    html = []
    html.append("<table class='ai-ui-table' border='1' cellspacing='0' cellpadding='6'>")

    # Header row
    html.append("<thead><tr>")
    for h in headers:
        label = h.replace("_", " ").title()
        html.append(f"<th>{label}</th>")
    html.append("</tr></thead>")

    # Body rows
    html.append("<tbody>")
    for row in rows:
        html.append("<tr>")
        for h in headers:
            val = row.get(h, "")
            if isinstance(val, (dict, list)):
                val = json.dumps(val, ensure_ascii=False)
            html.append(f"<td>{val}</td>")
        html.append("</tr>")
    html.append("</tbody></table>")

    return "".join(html)

# -----------------------------------------------------------------------------------------------

def query_supabase_for_table(parsed: dict, user_email: str, user_role: str, project_id: str) -> list:
    """
    Safer supabase query helper that returns list[dict].
    Adds validation, logging of response.error, and tolerant access to response data.
    """
    try:
        table = parsed.get("table")
        if not table:
            print("query_supabase_for_table: missing 'table' in parsed")
            return []

        filters = parsed.get("filters", {}) or {}
        limit = parsed.get("limit", 50) or 50
        try:
            limit = int(limit)
        except Exception:
            limit = 50

        fields = parsed.get("fields", ["*"]) or ["*"]
        # If user passes [""] or empty list, treat as all fields
        if fields == [""] or len(fields) == 0:
            select_clause = "*"
        else:
            # ensure fields are strings and safe
            select_clause = ",".join(str(f).strip() for f in fields)

        query = supabase.table(table).select(select_clause)

        # Apply filters: ensure _apply_filter returns the query object
        for field, value in filters.items():
            if value in [None, ""]:
                continue
            # _apply_filter should return the modified query; if not, we try to not break
            try:
                # FIX: Remap 'uuid' to 'id' for projects table if it sneaks in Siddharth
                if table == "projects" and field == "uuid":
                    field = "id"

                # Check for UUID validity if filtering by 'id' in 'projects' table
                if table == "projects" and field == "id" and not _is_uuid(value):
                    print(f"⚠️ Skipping 'id' filter in projects table because value '{value}' is not a valid UUID.")
                    continue

                res_q = _apply_filter(query, field, value)
                if res_q is not None:
                    query = res_q
            except Exception as ef:
                print(f"_apply_filter error for {field}={value}: {ef}")
                # skip this filter and continue

        # Execute
        result = query.limit(limit).execute()

        # Inspect result thoroughly for debugging
        # Some clients: result.data, others: result.get('data') or result['data']
        data = None
        if hasattr(result, "data"):
            data = result.data
        elif isinstance(result, dict) and "data" in result:
            data = result["data"]
        elif hasattr(result, "get") and callable(result.get):
            data = result.get("data")
        else:
            print("query_supabase_for_table: unknown result shape:", type(result))

        # Log error if exists
        err = None
        if hasattr(result, "error"):
            err = result.error
        elif isinstance(result, dict) and "error" in result:
            err = result["error"]

        if err:
            print("Supabase returned error:", err)

        if not data:
            return []

        # Ensure returned is list of dicts
        if isinstance(data, list):
            return data
        else:
            # sometimes single dict returned
            return [data]

    except Exception as e:
        print(f"Table query error: {e}")
        return []

# def query_supabase_for_table(parsed: dict,user_email:str,user_role:str,project_id:str) -> list:
#     """
#     Query Supabase and return raw data (list of dicts) for table formatting
#     """
#     try:
#         table = parsed.get("table")
#         filters = parsed.get("filters", {})
#         limit = parsed.get("limit", 50)
#         fields = parsed.get("fields", ["*"])

#         # Build query
#         select_clause = ",".join(fields) if fields != [""] else "*"
#         query = supabase.table(table).select(select_clause)

#         # Apply filters
#         for field, value in filters.items():
#             if value in [None, ""]:
#                 continue
#             query = _apply_filter(query, field, value)

#         # Execute query
#         result = query.limit(limit).execute()
#         return result.data or []

#     except Exception as e:
#         print(f"Table query error: {e}")
#         return []

# -----------------------------------------------------------------------------------------------

def get_requested_fields(query: str):
    q = (query or "").lower()

    # ------------------------------
    # 1) Column keyword mapping
    # ------------------------------
    field_map = {
        "uuid": ["id"],
        "id": ["id"],

        "project name": ["project_name"],
        "name": ["project_name"],

        "project description": ["project_description"],
        "description": ["project_description"],

        "start date": ["start_date"],
        "end date": ["end_date"],

        "timeline": ["start_date", "end_date"],
        "duration": ["start_date", "end_date"],

        "status": ["status"],

        "client": ["client_name"],
        "client name": ["client_name"],

        "upload": ["upload_documents"],
        "document": ["upload_documents"],
        "documents": ["upload_documents"],

        "scope": ["project_scope"],
        "project scope": ["project_scope"],

        "tech stack": ["tech_stack", "tech_stack_custom"],
        "stack": ["tech_stack", "tech_stack_custom"],
        "custom tech stack": ["tech_stack_custom"],

        "leader": ["leader_of_project"],
        "leader of project": ["leader_of_project"],

        "responsibility": ["project_responsibility"],
        "project responsibility": ["project_responsibility"],

        "role": ["role"],
        "assigned role": ["role"],

        "role answers": ["role_answers"],
        "answers": ["role_answers"],

        "custom questions": ["custom_questions"],
        "questions": ["custom_questions"],

        "custom answers": ["custom_answers"],

        "priority": ["priority"],

        "assigned": ["assigned_to_emails"],
        "assigned to": ["assigned_to_emails"],
        "assigned emails": ["assigned_to_emails"],
        "emails": ["assigned_to_emails"],
    }

    # ------------------------------
    # 2) If user says "all details"
    # ------------------------------
    if any(x in q for x in ["all details", "full details", "everything", "all info", "complete info"]):
        return ["*"]

    # ------------------------------
    # 3) Detect "only/just" mode
    # ------------------------------
    wants_only = any(x in q for x in [" only", " just ", "only ", "just "])

    # ------------------------------
    # 4) Collect requested fields
    # ------------------------------
    requested = []

    for key_phrase, cols in field_map.items():
        if key_phrase in q:
            for c in cols:
                if c not in requested:
                    requested.append(c)

    # ------------------------------
    # 5) If user asked for specific columns, return them
    # ------------------------------
    if requested:
        return requested

    # ------------------------------
    # 6) Default safe minimal fields
    # ------------------------------
    default_fields = [
        "id",
        "project_name",
        "status",
        "start_date",
        "end_date",
        "client_name",
    ]

    if wants_only:
        return default_fields

    return default_fields

# -----------------------------------------------------------------------------------------------

def llm_force_json_table(user_input: str, context: str = "") -> list: # Siddharth
    """
    If intent=other and user wants table, force LLM to return ONLY JSON array of objects.
    Then we will convert it into HTML table using existing format_data_as_table().
    """
    try:
        prompt = f"""
You must respond ONLY in valid JSON.
No markdown.
No explanation.
No text outside JSON.

Return an array of objects (list of dicts).
Keys must be short and clear.

User request: {user_input}
Context: {context} 

Example output:
[
  {{"Column1":"Value1","Column2":"Value2"}},
  {{"Column1":"Value3","Column2":"Value4"}}
]
"""
# Context: {context} Siddharth

        raw = call_openrouter(
            [
                {"role": "system", "content": "You are a strict JSON generator. Output ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            max_tokens=1200
        )

        if not raw:
            return []

        cleaned = raw.strip()
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        parsed = json.loads(cleaned)

        if isinstance(parsed, dict):
            return [parsed]
        if isinstance(parsed, list):
            return parsed

        return []

    except Exception as e:
        print("❌ llm_force_json_table error:", e)
        return []

# -----------------------------------------------------------------------------------------------
#tanmey -29/01
def safe_json_load(text: str):
    """
    Parse JSON safely even if LLM adds extra text or output is truncated.
    - Supports extracting JSON array/object from inside response
    - Removes markdown fences ```json ... ```
    - Auto-fixes missing closing brackets if truncated
    """
    if not text:
        return None

    raw = text.strip()

    # Remove markdown fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)

    # 1) Direct parse
    try:
        return json.loads(raw)
    except:
        pass

    # 2) Extract JSON array/object from inside response
    try:
        match = re.search(r"(\[\s*\{.*\}\s*\]|\{.*\})", raw, re.DOTALL)
        if match:
            candidate = match.group(1).strip()
            try:
                return json.loads(candidate)
            except:
                pass
    except:
        pass

    # 3) If response starts like JSON but is truncated → try to auto-close
    try:
        candidate = raw

        # if it starts with [ but doesn't end with ] -> close it
        if candidate.startswith("[") and not candidate.endswith("]"):
            candidate = candidate.rstrip()
            # remove trailing comma if exists
            candidate = re.sub(r",\s*$", "", candidate)
            candidate = candidate + "]"

        # if it starts with { but doesn't end with } -> close it
        if candidate.startswith("{") and not candidate.endswith("}"):
            candidate = candidate.rstrip()
            candidate = re.sub(r",\s*$", "", candidate)
            candidate = candidate + "}"

        return json.loads(candidate)
    except:
        return None

#tanmey over -29/01

def call_openrouter(messages, model="openai/gpt-4o-mini", temperature=0.5, max_tokens=400):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": float(temperature),
        "max_tokens": int(max_tokens)
    }
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if resp.status_code != 200:
            print(f"⚠ OpenRouter API error {resp.status_code}: {resp.text}")
            return None
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print("OpenRouter exception:", e)
        traceback.print_exc()
        return None

        # -----------------------------------------------------------------------------------------------
# --- Tanmey Added Functions ---
def handle_multi_question_self_asking(session, user_input, selected_index=None): #Tanmey Added
    """
    Handles self-asking workflow for vague queries (Tanmey Implementation).
    If a clarification is active, it resolves it.
    If not, it checks if the query is vague and returns clarifying questions if so.
    """
    # 1. Check if we are already in a clarification flow
    clarification_data = session.get("multi_clarification")
    
    if clarification_data and selected_index is not None:
        try:
            index = int(selected_index)
            questions = clarification_data.get("questions", [])
            if 0 <= index < len(questions):
                resolved_query = questions[index].get("resolved_query", user_input)
                # Clear session state
                session.pop("multi_clarification", None)
                print(f"✅ Resolved vague query: {resolved_query}")
                return False, resolved_query
        except (ValueError, TypeError, IndexError):
            pass

    # 2. Check if the query is vague/ambiguous and could benefit from clarification
    # Heuristic: Avoid self-asking for very long or very specific queries
    if len(user_input) > 80 or any(word in user_input.lower() for word in ["#", "@", "project-"]):
         return False, user_input

    prompt = f"""
    The user asked: "{user_input}"
    
    Task:
    - If this query is vague or could refer to multiple specific project details (e.g. "tell me about status", "what are the tasks"), 
      identify 2-3 specific clarifying options that would help the user.
    - For each option, provide:
      1. A short button label (the "text").
      2. The full specific query that would be executed (the "resolved_query").
    
    Return ONLY a JSON object:
    {{
      "is_vague": true,
      "questions": [
        {{ "text": "Label 1", "resolved_query": "Full query 1" }},
        {{ "text": "Label 2", "resolved_query": "Full query 2" }}
      ]
    }}
    If the query is clear enough to answer directly, set is_vague to false.
    """
    
    try:
        response = call_openrouter([
            {"role": "system", "content": "You are a query clarification assistant. Reply ONLY with JSON."},
            {"role": "user", "content": prompt}
        ], temperature=0, max_tokens=300)
        
        if response:
            # Basic JSON extraction
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                if data.get("is_vague") and data.get("questions"):
                    # Store in session for next turn
                    session["multi_clarification"] = data
                    return True, {
                        "reply": "I have multiple ways to answer that. Which one are you looking for?",
                        "clarifications": [q["text"] for q in data["questions"]],
                        "multi_clarification": True
                    }
    except Exception as e:
        print(f"⚠️ handle_multi_question_self_asking error: {e}")

    return False, user_input

# -----------------------------------------------------------------------------------------------
# --- Tanmey Added Functions ---

def generate_followup_suggestions(user_input, assistant_response, project_id=None, user_email=None): #Tanmey Added
    """
    Generates 2-3 dynamic, project-aware follow-up questions based on the current interaction.
    Enhanced to fetch real project data and generate contextually relevant suggestions.
    """
    project_context = ""
    
    # Fetch actual project data if project_id is provided
    if project_id:
        try:
            res = supabase.table("projects").select(
                "project_name, status, tech_stack, tech_stack_custom, "
                "start_date, end_date, leader_of_project, team_members, "
                "project_description, client_name"
            ).eq("id", project_id).limit(1).execute()
            
            if res.data and len(res.data) > 0:
                proj = res.data[0]
                tech = []
                if proj.get("tech_stack"):
                    tech.extend(proj["tech_stack"] if isinstance(proj["tech_stack"], list) else [proj["tech_stack"]])
                if proj.get("tech_stack_custom"):
                    tech.append(proj["tech_stack_custom"])
                
                project_context = f"""
Project Context:
- Name: {proj.get('project_name', 'N/A')}
- Status: {proj.get('status', 'N/A')}
- Tech Stack: {', '.join(tech) if tech else 'N/A'}
- Timeline: {proj.get('start_date', 'N/A')} to {proj.get('end_date', 'N/A')}
- Leader: {proj.get('leader_of_project', 'N/A')}
- Client: {proj.get('client_name', 'N/A')}
"""
        except Exception as e:
            print(f"⚠️ Could not fetch project context: {e}")
    
    prompt = f"""
    User asked: "{user_input}"
    Assistant responded: "{assistant_response}"
    
    {project_context}
    
    Task:
    - Generate 2-3 highly relevant follow-up questions the user might want to ask next.
    - Questions should be natural, conversational, and directly related to the conversation.
    - If project context is available, make questions specific to:
      * Project status, timeline, or deadlines
      * Team members, roles, or responsibilities
      * Tech stack, tools, or implementation details
      * Tasks, milestones, or deliverables
      * Client requirements or project scope
    - Keep questions short (under 10 words each).
    - Make them actionable and useful.
    
    Return ONLY a valid JSON array of strings (no markdown, no extra text):
    ["Question 1?", "Question 2?", "Question 3?"]
    """
    
    try:
        response = call_openrouter([
            {"role": "system", "content": "You are a helpful assistant that suggests contextual follow-up questions. Reply ONLY with a valid JSON array of strings."},
            {"role": "user", "content": prompt}
        ], temperature=0.7, max_tokens=250) #Tanmey Added
        
        if response:
            # Extract JSON array from response
            match = re.search(r'\[.*\]', response, re.DOTALL)
            if match:
                suggestions = json.loads(match.group(0))
                if isinstance(suggestions, list) and len(suggestions) > 0:
                    # Clean and validate suggestions
                    clean_suggestions = []
                    for s in suggestions[:3]:
                        if isinstance(s, str) and len(s.strip()) > 5:
                            clean_suggestions.append(s.strip())
                    
                    if clean_suggestions:
                        return clean_suggestions
    except Exception as e:
        print(f"⚠️ generate_followup_suggestions error: {e}")
    
    # Fallback: Generate basic contextual questions
    fallback_questions = []
    user_lower = user_input.lower()
    
    if "status" in user_lower:
        fallback_questions = ["What's the project timeline?", "Who are the team members?", "What's the tech stack?"]
    elif "timeline" in user_lower or "deadline" in user_lower:
        fallback_questions = ["What's the current status?", "Are there any blockers?", "Who's the project leader?"]
    elif "team" in user_lower or "member" in user_lower:
        fallback_questions = ["What are their roles?", "What's the project status?", "What tasks are assigned?"]
    elif "tech" in user_lower or "stack" in user_lower:
        fallback_questions = ["What's the project architecture?", "Any technical challenges?", "What's the deployment plan?"]
    else:
        fallback_questions = ["What's the project status?", "Who's working on this?", "What's the timeline?"]
    
    return fallback_questions[:3]

# -----------------------------------------------------------------------------------------------
# --- Helper Functions for User LLM Settings ---
def get_user_llm_model(email: str) -> str:
    """Helper to fetch model name by email."""
    uid = get_user_id(email)
    if not uid: return "openai/gpt-4o-mini"
    settings = get_active_llm(uid)
    return settings.get("llm_model", "openai/gpt-4o-mini")

def update_user_llm_model(email: str, model: str, target_email: str = None) -> bool:
    """Helper to update model by email."""
    effective_email = target_email if target_email else email
    uid = get_user_id(effective_email)
    if not uid: return False
    return set_active_llm(uid, model)

# -----------------------------------------------------------------------------------------------

def set_active_llm(user_id: str, model: str, provider: str = None) -> bool:
    """Set active LLM. Updates DB if UUID, else updates Legacy JSON."""
    user_id = str(user_id)
    if not provider:
        if "gpt" in model.lower(): provider = "openai"
        elif "claude" in model.lower(): provider = "openrouter"
        elif "gemini" in model.lower(): provider = "gemini"
        else: provider = "openrouter"

    data = {
        "user_id": user_id,
        "llm_model": model,
        "provider": provider,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    success = False
    
    # Try DB upsert
    try:
        supabase.table("user_llm_settings").upsert(data, on_conflict="user_id").execute()
        success = True
    except Exception as e:
        print(f"⚠ DB Upsert failed: {e}")
    
    # If not success (or not UUID), try Legacy JSON
    if not success:
        print(f"ℹ Saving to legacy settings file for user {user_id}")
        save_legacy_settings({user_id: data})
        success = True

    # Update Cache and return
    USER_LLM_CACHE[user_id] = data
    return success

# -----------------------------------------------------------------------------------------------

def save_legacy_settings(data):
    try:
        existing = load_legacy_settings()
        existing.update(data)
        with open(LEGACY_SETTINGS_FILE, 'w') as f:
            json.dump(existing, f, indent=2)
    except Exception as e:
        print(f"❌ Failed to save legacy settings: {e}")

def get_active_llm(user_id: str) -> dict:
    """Fetch active LLM settings. Checks cache -> DB -> Fallback JSON."""
    user_id = str(user_id)
    if user_id in USER_LLM_CACHE:
        return USER_LLM_CACHE[user_id]

    # Try DB if UUID
    if UUID_PATTERN.match(user_id):
        try:
            res = supabase.table("user_llm_settings").select("*").eq("user_id", user_id).execute()
            if res.data:
                settings = res.data[0]
                USER_LLM_CACHE[user_id] = settings
                return settings
        except Exception as e:
            print(f"⚠ Error fetching LLM settings: {e}")

    # Fallback to Legacy JSON
    legacy = load_legacy_settings()
    if user_id in legacy:
        settings = legacy[user_id]
        USER_LLM_CACHE[user_id] = settings
        return settings
    
    # Default fallback
    settings = {
        "user_id": user_id,
        "llm_model": "openai/gpt-4o-mini",
        "provider": "openai"
    }
    USER_LLM_CACHE[user_id] = settings
    return settings


# ------------------------------------------------------------------------------------------------------------
# ------------------response filters--------------------------------------------------------------------------
# ------------------------------------------------------------------------------------------------------------

def _token_set(s: str):
    return set([t.lower() for t in WORD_TOKEN_RE.findall(s or "")])

# -----------------------------------------------------------------------------------------------
def _normalize_for_compare(s: str) -> str:
    """Lowercase and remove punctuation except alphanumerics and spaces."""
    if not s:
        return ""
    s = s.lower()
    # remove punctuation but keep @ . - _ for emails/tokens
    s = re.sub(r"[^\w\s@._-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s
# -----------------------------------------------------------------------------------------------
def _extract_project_agg(project_data: list):
    """
    Return aggregated field strings and email sets:
    {name, status, timeline, leader, leader_emails(set), team_text, team_emails(set), tech_text}
    """
    agg = {
        "name": "",
        "status": "",
        "timeline": "",
        "leader": "",
        "leader_emails": set(),
        "team": "",
        "team_emails": set(),
        "tech": "",
        "client": "",
        "description": "",
    }
    for p in project_data or []:
        if not isinstance(p, dict):
            continue
        # name
        for k in ("project_name","project_title","name"):
            if p.get(k):
                agg["name"] += " " + str(p.get(k))
        # status
        if p.get("status"):
            agg["status"] += " " + str(p.get("status"))
        # timeline
        for k in ("start_date","end_date"):
            if p.get(k):
                agg["timeline"] += " " + str(p.get(k))
        # leader fields
        for k in ("leader_of_project","leader","project_lead","leader_name"):
            if p.get(k):
                agg["leader"] += " " + str(p.get(k))
        # leader emails (common custom names)
        for ek in ("leader_email","leader_of_project_email","lead_email"):
            if p.get(ek):
                agg["leader_emails"].add(str(p.get(ek)).lower())
        # team members and assigned emails
        members = p.get("assigned_to_emails") or []
        if isinstance(members, list):
            for m in members:
                if isinstance(m, dict):
                    # try email then name/role
                    email = m.get("email") or m.get("mail")
                    if email:
                        agg["team_emails"].add(str(email).lower())
                    # join human tokens
                    agg["team"] += " " + " ".join([str(v) for v in m.values() if v])
                else:
                    agg["team"] += " " + str(m)
        # assigned_to_emails
        for k in ("assigned_to_emails","assigned_to","assigned"):
            val = p.get(k)
            if isinstance(val, (list,tuple)):
                for e in val:
                    if e:
                        agg["team_emails"].add(str(e).lower())
            elif val:
                agg["team_emails"].add(str(val).lower())
        # tech
        for tk in ("tech_stack","tech_stack_custom","technology"):
            tval = p.get(tk)
            if tval:
                if isinstance(tval, list):
                    agg["tech"] += " " + " ".join([str(x) for x in tval])
                else:
                    agg["tech"] += " " + str(tval)
        # client and description
        if p.get("client_name"):
            agg["client"] += " " + str(p.get("client_name"))
        if p.get("project_description"):
            agg["description"] += " " + str(p.get("project_description"))
        if p.get("project_scope"):
            agg["description"] += " " + str(p.get("project_scope"))
    # normalize strings
    for k in ("name","status","timeline","leader","team","tech","client","description"):
        agg[k] = _normalize_for_compare(agg[k])
    agg["leader_emails"] = set(e for e in agg["leader_emails"] if e)
    agg["team_emails"] = set(e for e in agg["team_emails"] if e)
    return agg

# -----------------------------------------------------------------------------------------------

# Sujal_Harsh_Start
# synonyms for status canonicalization
_STATUS_CANONICAL = {
    "in progress": ["in progress","in-progress","ongoing","started","active"],
    "not started": ["not started","pending","planned","yet to start"],
    "completed": ["completed","done","finished","delivered"],
    "on hold": ["on hold","paused","blocked"]
}
# Sujal_Harsh_Over

def _match_status(reply_clean: str, proj_status_clean: str) -> float:
    """
    Return score 0..100 for status matching.
    Exact canonical match -> 100, synonym -> 95, token overlap -> ratio*100 fallback.
    """
    if not reply_clean or not proj_status_clean:
        return 0.0
    # canonicalize both into tokens
    r = reply_clean.lower()
    p = proj_status_clean.lower()
    # direct substring
    if r in p or p in r:
        return 100.0
    # check synonyms
    for can, syns in _STATUS_CANONICAL.items():
        if any(s in p for s in syns) and any(s in r for s in syns):
            return 95.0
    # token overlap fallback
    rtoks = _token_set(r)
    ptoks = _token_set(p)
    if not ptoks:
        return 0.0
    overlap = len(rtoks & ptoks) / max(1, len(ptoks))
    return round(overlap * 100, 2)
# -----------------------------------------------------------------------------------------------
def _clean_reply_text(text: str) -> str:
    """
    Remove headings, markdown bullets, repeated whitespace, punctuation noise.
    Returns a lowercase cleaned string suitable for substring/token matching.
    """
    if not text:
        return ""
    s = text
    # remove common section headings words on their own lines
    s = re.sub(r"(?mi)^(summary|details|information|info|result|solution|overview|response)\s*$", "", s, flags=re.MULTILINE)
    # remove lines that are short all-caps headings
    s = re.sub(r"(?m)^[A-Z\s]{2,60}\n", "", s)
    # remove bullets and markdown characters
    s = re.sub(r"[-•*]{1,2}\s+", " ", s)
    # remove parentheses content (often email after name)
    s = re.sub(r"\([^)]*\)", " ", s)
    # replace newlines with spaces and collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s.lower()
# -----------------------------------------------------------------------------------------------

def verify_response_final(query: str, reply: str, project_data: list, debug: bool=False) -> dict:
    """
    Field-prioritised strict verifier that returns realistic scores for short correct replies.
    Returns {"alignment_score": float or None, "trust_level": str, "recommendation": str}
    """
    try:
        if not project_data or not isinstance(project_data, list) or len(project_data) == 0:
            return {"alignment_score": None, "trust_level": "No Data", "recommendation": "No project data available."}

        q = (query or "").strip().lower()
        # Use cleaned reply for comparisons
        reply_clean = _clean_reply_text(reply)
        reply_norm = _normalize_for_compare(reply_clean)

        agg = _extract_project_agg(project_data)
        if debug:
            print("verify debug agg:", {k:(v[:120]+"..." if isinstance(v,str) and len(v)>120 else v) for k,v in agg.items()})

        # Determine field intent (priority)
        detected = []
        if any(kw in q for kw in ["project name","project title","name of the project","what is the project name","project name"]):
            detected.append("name")
        if any(kw in q for kw in ["status","what is the status","project status","is the project completed","progress","phase"]):
            detected.append("status")
        if any(kw in q for kw in ["start date","end date","timeline","when does","when will","start","end","deadline"]):
            detected.append("timeline")
        if any(kw in q for kw in ["who is the leader","project leader","who is the lead","project lead","leader"]):
            detected.append("leader")
        if any(kw in q for kw in ["team members","team","members","who are the team","give my team"]):
            detected.append("team")
        if any(kw in q for kw in ["tech stack","tech","technology","framework","tools","languages"]):
            detected.append("tech")
        # fallback: if query contains 'project' treat as description/name check
        if not detected:
            if "project" in q:
                detected.append("description")
            else:
                detected.append("description")

        scores = []
        for fld in detected:
            proj_field_text = agg.get(fld, "")
            if fld == "name":
                # exact or substring
                if reply_norm and proj_field_text and (reply_norm == proj_field_text or reply_norm in proj_field_text or proj_field_text in reply_norm):
                    scores.append(99.0)
                    continue
                # token overlap strong boost for short replies
                rts = _token_set(reply_norm)
                pts = _token_set(proj_field_text)
                if rts and pts:
                    overlap = len(rts & pts)
                    if len(rts) <= 6 and overlap >= 1:
                        scores.append(min(99.0, 85.0 + overlap*5.0))
                        continue
                # fallback similarity
                sim = SequenceMatcher(None, reply_norm, proj_field_text).ratio()
                scores.append(round(sim * 70, 2))

            elif fld == "status":
                # compare cleaned reply to proj status
                score = _match_status(reply_norm, agg.get("status",""))
                scores.append(score)

            elif fld == "leader":
                # email exact or name overlap
                reply_emails = set(e.lower() for e in EMAIL_RE.findall(reply))
                if reply_emails and agg.get("leader_emails"):
                    if reply_emails & agg["leader_emails"]:
                        scores.append(99.0); continue
                # token overlap with leader name
                rts = _token_set(reply_norm)
                pts = _token_set(agg.get("leader",""))
                if rts and pts and len(rts & pts) >= 1:
                    # short reply strong
                    scores.append(min(98.0, 85.0 + len(rts & pts)*5.0)); continue
                # fallback similarity
                sim = SequenceMatcher(None, reply_norm, agg.get("leader","")).ratio()
                scores.append(round(sim * 70, 2))

            elif fld == "team":
                # check for team_emails present
                reply_emails = set(e.lower() for e in EMAIL_RE.findall(reply))
                if reply_emails and agg.get("team_emails"):
                    if reply_emails & agg["team_emails"]:
                        scores.append(98.0); continue
                # token coverage of team members names
                pts = _token_set(agg.get("team",""))
                rts = _token_set(reply_norm)
                if pts:
                    coverage = len(rts & pts) / max(1, len(pts))
                    scores.append(round(min(1.0, coverage) * 100, 2)); continue
                scores.append(0.0)

            elif fld == "tech":
                pts = _token_set(agg.get("tech",""))
                rts = _token_set(reply_norm)
                if pts:
                    coverage = len(rts & pts) / max(1, len(pts))
                    scores.append(round(min(1.0, coverage) * 100, 2)); continue
                scores.append(0.0)

            elif fld == "timeline":
                # check year or date tokens
                def find_year(s):
                    m = re.search(r"\b(20\d{2}|\d{4})\b", s)
                    return m.group(0) if m else None
                proj_year = find_year(agg.get("timeline",""))
                rep_year = find_year(reply)
                if proj_year and rep_year and proj_year == rep_year:
                    scores.append(95.0); continue
                # if reply contains the proj start date substring
                if agg.get("timeline","") and reply_norm and reply_norm in agg.get("timeline",""):
                    scores.append(98.0); continue
                # fallback token ratio
                pts = _token_set(agg.get("timeline",""))
                rts = _token_set(reply_norm)
                if pts:
                    coverage = len(rts & pts) / max(1, len(pts))
                    scores.append(round(coverage * 100, 2)); continue
                scores.append(0.0)

            else:  # description fallback
                sim = SequenceMatcher(None, reply_norm, agg.get("description","")).ratio()
                pts = _token_set(agg.get("description",""))
                rts = _token_set(reply_norm)
                token_ratio = len(rts & pts) / max(1, len(pts)) if pts else 0.0
                scores.append(round(min(1.0, (0.65*sim + 0.35*token_ratio))*100, 2))

        # aggregate: prefer highest (field-priority)
        valid = [s for s in scores if s is not None]
        if not valid:
            return {"alignment_score": None, "trust_level": "No Data", "recommendation": "No relevant project fields."}
        final_score = round(max(valid), 2)

        if final_score >= 90:
            trust = "Trusted ✅"
            rec = "Accurate and consistent with project data."
        elif final_score >= 70:
            trust = "Moderate ⚠️"
            rec = "Partially aligned; verify minor details."
        else:
            trust = "Low ❌"
            rec = "May not align — please verify."

        return {"alignment_score": final_score, "trust_level": trust, "recommendation": rec}

    except Exception as e:
        print("⚠ verify_response_strict error:", e)
        return {"alignment_score": None, "trust_level": "Error", "recommendation": "Verification error."}

# -----------------------------------------------------------------------------------------------
def load_documents():
    documents = []
    if not os.path.exists("company_docs"):
        return
    for file in os.listdir("company_docs"):
        path = os.path.join("company_docs", file)
        if file.endswith(".pdf"):
            loader = PyPDFLoader(path)
        elif file.endswith(".txt"):
            loader = TextLoader(path, encoding="utf-8")
        else:
            continue
        documents.extend(loader.load())
    if documents:
        splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=100)
        texts = splitter.split_documents(documents)
        for i, text in enumerate(texts):
            collection.add(
                documents=[text.page_content],
                metadatas=[{"source": text.metadata.get("source", "company_docs")}],
                ids=[f"doc_{i}"]
            )
# -----------------------------------------------------------------------------------------------
def get_context(query, k=3):
    if len(query.split()) <= 2:
        return ""
    try:
        results = collection.query(query_texts=[query], n_results=k)
        if results and results.get('documents'):
            return "\n".join(results['documents'][0])
    except:
        return ""
    return ""

# -----------------------------------------------------------------------------------------------
def needs_database_query(llm_response):
    """Determine if we need to query the database (LLM hints only)."""
    triggers = [
        "check the database",
        "look up in the system",
        "query the records",
        "i don't have that information",
        "data shows",
        "fetch from database",
        "from db",
        "from database",
    ]
    return any(trigger in llm_response.lower() for trigger in triggers)
# -----------------------------------------------------------------------------------------------
def explain_database_results(user_input, db_results, user_context):
    """Convert raw DB results to natural language (LLM not restricted)."""
    prompt = (
    f"""Convert these database results into a friendly response:
        User asked: "{user_input}"
        User context: {user_context}
        Database results:
        {db_results}
        Respond in 1-4 paragraphs using natural language, focusing on the key information.
        respond in summary not in too long responce
        if user ask for all project details give all project details alocated to that user"""
    )
    return call_llm_with_model([
        {"role": "system", "content": "You are a helpful assistant that explains data."},
        {"role": "user", "content": prompt}
    ])
    
# -----------------------------------------------------------------------------------------------
def get_response_metrics(text: str):
    word_count = len(text.split())

    if word_count < 100:
        category = "short"
    elif word_count <= 300:
        category = "medium"
    else:
        category = "long"

    return word_count, category
# -----------------------------------------------------------------------------------------------
def get_user_preference_summary(user_id):
    res = supabase.table("user_memorys") \
        .select("response_category, context_feedback") \
        .eq("user_id", user_id) \
        .not_.is_("context_feedback", None) \
        .execute()

    data = res.data or []

    stats = {"short": 0, "medium": 0, "long": 0}

    for row in data:
        category = row.get("response_category")
        feedback = row.get("context_feedback")

        # 🔹 Skip old/invalid rows
        if category not in stats:
            continue

        if feedback is True:
            stats[category] += 1
        elif feedback is False:
            stats[category] -= 1

    print("\n📊 USER PREFERENCE SUMMARY")
    print("--------------------------")
    print(f"Short  : {stats['short']}")
    print(f"Medium : {stats['medium']}")
    print(f"Long   : {stats['long']}")

    preferred = max(stats, key=stats.get)
    print("\n⭐ Preferred Response Style:", preferred.upper())

    return stats

# =====================================================================
# ✅ Start of Task 3.22 + Task 3.23 Implementation --> Bhakti mam, Daksh Sir
# =====================================================================

FINAL_FALLBACK_RESPONSE = (
    "Sorry — I couldn't find an exact answer in the database or documents right now.\n"
    "Please share a little more context (project name, field, or module), and I’ll help you with an accurate response."
)

def _is_meaningful_db_answer(db_answer: str) -> bool:
    """
    Detect if DB answer is useful or just a fallback/no-data string.
    """
    if not db_answer or not isinstance(db_answer, str):
        return False

    low = db_answer.strip().lower()
    bad_markers = [
        "⚠ no matching records found",
        "no matching records found",
        "⚠ no project selected",
        "⚠ no user specified",
        "no response",
        "supabase error",
        "❌ supabase error",
        "error in",
        "traceback"
    ]
    if any(b in low for b in bad_markers):
        return False

    return len(low) >= 25


# Sujal_Start
def build_fact_memory_system_prompt(
    user_name: str,
    user_email: str,
    user_role: str,
    user_facts: dict | None,
    episodic_summaries: list | None,
    doc_context: str | None
) -> str:
    """
    Combine User Facts + Memory + Docs in one system prompt.
    ✅ ENHANCED: Role-based tone adaptation
    """
    try:
        facts_text = json.dumps(user_facts or {}, indent=2, ensure_ascii=False)
    except Exception:
        facts_text = str(user_facts or {})

    episodic_text = ""
    if episodic_summaries:
        episodic_text = "\nPrevious conversation summaries:\n" + "\n---\n".join(episodic_summaries)

    rag_text = ""
    if doc_context and isinstance(doc_context, str) and doc_context.strip():
        rag_text = f"\nRelevant document context:\n{doc_context}\n"

    # ======================================================
    # 🔐 ROLE-BASED TONE ADAPTATION
    # ======================================================
    
    # Normalize role
    role_normalized = (user_role or "employee").lower().strip()
    
    # Define tone instructions based on role
    if role_normalized == "admin":
        tone_instruction = (
            "📋 **Tone for Admin:** Professional and comprehensive.\n"
            "- Use formal business language\n"
            "- Provide detailed, technical explanations\n"
            "- Include data-driven insights and metrics\n"
            "- Use industry terminology appropriately\n"
            "- Structure responses with clear sections and bullet points\n"
            "- Maintain executive-level professionalism\n"
        )
    
    elif role_normalized == "manager":
        tone_instruction = (
            "📊 **Tone for Manager:** Minimal professional - balanced and efficient.\n"
            "- Use clear, direct business language\n"
            "- Focus on actionable information\n"
            "- Provide concise explanations without excessive detail\n"
            "- Balance professionalism with readability\n"
            "- Use bullet points for quick scanning\n"
            "- Avoid overly technical jargon unless necessary\n"
        )
    
    elif role_normalized in ["project manager", "projectmanager", "project_manager"]:
        tone_instruction = (
            "📊 **Tone for Project Manager:** Clear and task-focused.\n"
            "- Use straightforward, practical language\n"
            "- Focus on project-relevant information\n"
            "- Keep explanations clear and concise\n"
            "- Use simple structures for easy understanding\n"
            "- Prioritize actionable steps and next actions\n"
        )
    
    elif role_normalized == "hr":
        tone_instruction = (
            "👥 **Tone for HR:** Professional and people-focused.\n"
            "- Use professional but approachable language\n"
            "- Focus on people-related insights\n"
            "- Provide clear, policy-aware explanations\n"
            "- Balance formality with accessibility\n"
        )
    
    else:  # Employee, Other
        tone_instruction = (
            "💬 **Tone for Employee:** Simple and easy to understand.\n"
            "- Use plain, everyday language\n"
            "- Avoid technical jargon and complex terms\n"
            "- Explain concepts in simple, clear terms\n"
            "- Use friendly, approachable tone\n"
            "- Break down complex information into easy steps\n"
            "- Focus on practical, actionable guidance\n"
            "- Keep responses concise and to-the-point\n"
        )
    
    # ======================================================
    # BUILD COMPLETE SYSTEM PROMPT
    # ======================================================
    
    return (
        "You are a helpful AI assistant for We3Vision.\n"
        "You must follow strict reliability:\n"
        "- Prefer DB facts first.\n"
        "- Use document context only if relevant.\n"
        "- Do not hallucinate.\n\n"
        f"User: {user_name} ({user_email})\n"
        f"Role: {user_role}\n\n"
        f"{tone_instruction}\n"  # ✅ ADDED: Role-based tone
        f"User Facts (stored):\n{facts_text}\n"
        f"{episodic_text}\n"
        f"{rag_text}\n"
        "Response rules:\n"
        "- Keep response short, structured, professional.\n"
        "- Be role-aware and adapt tone accordingly.\n"  # ✅ UPDATED
        "- If uncertain, say so clearly.\n"
    )
# Sujal_Over

def _safe_model_name(model: str | None) -> str:
    """
    Ensure model name is valid and safe.
    Prevents blank/invalid model causing OpenRouter failures.
    """
    if model and isinstance(model, str) and len(model.strip()) > 5:
        return model.strip()
    return "openai/gpt-4o-mini"


def strict_fallback_answer_323(
    user_input: str,
    normalized_query: str,
    user_name: str,
    user_email: str,
    user_role: str,
    project_id: str,
    chat_id: str,
    conv_hist: list,
    db_answer: str | None,
    doc_context: str | None,
    user_facts: dict | None = None,
    episodic_summaries: list | None = None,
    model: str = "openai/gpt-4o-mini"
):
    """
    ✅ Task 3.23 strict fallback pipeline:
    1) DB
    2) RAG
    3) LLM
    4) FINAL_FALLBACK_RESPONSE
    Returns: (final_reply, source)
    """

    # ✅ Always normalize model
    safe_model = _safe_model_name(model)

    # 1) DB First (most reliable)
    if _is_meaningful_db_answer(db_answer):
        return str(db_answer).strip(), "DB"

    # Sujal_Start
    # 2) RAG (Documents)
    if doc_context and isinstance(doc_context, str) and len(doc_context.strip()) > 50:
        system_prompt = build_fact_memory_system_prompt(
            user_name=user_name,
            user_email=user_email,
            user_role=user_role,
            user_facts=user_facts,
            episodic_summaries=episodic_summaries,
            doc_context=doc_context
        )
    # Sujal_Over

        rag_prompt = f"""
User asked: {normalized_query}

Answer strictly using the document context provided above.
If the context does not contain the answer, say:
"I couldn't find this in the provided documents."
Keep response concise.
"""
        messages = [
            {"role": "system", "content": system_prompt},
            *(conv_hist or []),
            {"role": "user", "content": rag_prompt}
        ]

        rag_reply = call_llm_with_model(messages, model=safe_model, temperature=0.3, max_tokens=450)

        # ⚠ Some errors return model string; block it
        if rag_reply and isinstance(rag_reply, str) and rag_reply.strip() == safe_model:
            rag_reply = None

        if rag_reply and str(rag_reply).strip():
            return str(rag_reply).strip(), "RAG"

    # Sujal_Start
    # 3) LLM general fallback
    system_prompt = build_fact_memory_system_prompt(
        user_name=user_name,
        user_email=user_email,
        user_role=user_role,
        user_facts=user_facts,
        episodic_summaries=episodic_summaries,
        doc_context=None
    )
    # Sujal_Over

    llm_prompt = f"""
User asked: {normalized_query}

Task:
- Answer clearly in 3–6 lines.
- If internal project/company info is unknown, be honest.
- Do NOT invent data.
"""
    messages = [
        {"role": "system", "content": system_prompt},
        *(conv_hist or []),
        {"role": "user", "content": llm_prompt}
    ]

    llm_reply = call_llm_with_model(messages, model=safe_model, temperature=0.5, max_tokens=450)

    # ⚠ Some errors return model string; block it
    if llm_reply and isinstance(llm_reply, str) and llm_reply.strip() == safe_model:
        llm_reply = None

    # 4) FINAL professional fallback
    if not llm_reply or not str(llm_reply).strip():
        return FINAL_FALLBACK_RESPONSE, "FALLBACK"

    return str(llm_reply).strip(), "LLM"

# =====================================================================
# ✅ End of Task 3.22 + Task 3.23 Implementation --> Bhakti mam, Daksh Sir
# =====================================================================

# INTENT_TOKEN_LIMITS = {             # Tanmey Start
#     "greeting": 40,
#     "general": 300,
#     "project_details": 300,
#     "status": 120,
#     "timeline": 150,
#     "members": 150,
#     "tech_stack": 180,
#     "coding": 400,
#     "debugging": 600,
#     "math": 300,
# }

# DEFAULT_MAX_TOKENS = 200
# SYSTEM_MAX_CAP = 800               # Tanmey End

# -----------------------------------------------------------------------------------------------
# Tanmey_Start: Self-Asking Extensions
from core_extensions import (
    build_fact_memory_system_prompt_322,
    handle_multi_question_self_asking,
    generate_followup_suggestions
)
# Tanmey_End
