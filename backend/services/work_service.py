import random
#JONCY START
import re
#JONCY END
import traceback
from fastapi import Request, HTTPException
from typing import Dict, Any, AsyncGenerator

from core import (
    is_technical_prompt,
    detect_intent,
    detect_table_request,
    query_supabase,
    query_supabase_for_table,
    format_data_as_table,
    get_user_role,
    call_llm_with_model,
    llm_force_json_table,
    get_user_llm_model,
    get_context,
    load_chat_history,
    load_episodic_memory,
    save_chat_message,
    handle_greetings,
    verify_response_final,
    supabase,
    CONFUSION_RESPONSES,
    build_fact_memory_system_prompt_322,  #Tanmey Added 
    handle_multi_question_self_asking,     #Tanmey Added
    generate_followup_suggestions,        #Tanmey Added
    get_user_preference_summary,
    get_response_metrics,
    get_user_perms_id
)

from validators import (
    validate_user_input,
    validate_api_response,
    enforce_ethical_rules,
    sanitize_reply,
    contains_confidential_info,
    normalize_query as normalize_query_validator,
    is_tech_related_query,
    validate_code_response,
    format_code_response,
    handle_response_by_intent,
    detect_and_handle_risk,          # 🆕 3.31 Main function
    extract_tech_stack_from_project
    # validate_query_with_rbac
)

from services.chat_core import (
    format_response,
    extract_and_store_user_fact,
    store_user_fact,
    get_user_fact,
    _resolve_chat_id,
    _is_uuid,
    FACT_BEHAVIOR_MAP
)


# ============================================================
# ===================== WORK CHAT SERVICE ====================
# ============================================================

# chirag logic start
from security.encrypt_utils import encrypt_api, decrypt_api
# chirag logic end


def process_ai_reply(
        user_input,
        normalized_query,
        raw_reply,
        project_id,
        chat_id,
        user_email,
        is_tabular,
        project_data=None 
    ):
        """
        Centralized reply processing pipeline.
        This replaces duplicated stream + normal logic.
        """

        # 🔹 Ensure reply exists
        if not raw_reply:
            raw_reply = "⚠ AI service temporarily unavailable."

        # 🔹 If table, skip LLM validation
        if is_tabular:
            safe_reply = raw_reply
        else:
            valid, safe_reply = validate_api_response(raw_reply)
            if not valid:
                safe_reply = safe_reply or "⚠ Response blocked."

        # 🔹 Tech safety
        if is_tech_related_query(normalized_query):
            if not validate_code_response(safe_reply):
                safe_reply = "⚠️ The generated code contains unsafe patterns and has been blocked."
            else:
                language = (
                    "python" if "python" in normalized_query.lower()
                    else "javascript" if "javascript" in normalized_query.lower() or "js" in normalized_query.lower()
                    else "sql" if "sql" in normalized_query.lower()
                    else "python"
                )
                safe_reply = format_code_response(safe_reply, language)

        # 🔹 Ethical rules
        is_ethical, ethical_reply = enforce_ethical_rules(user_input, safe_reply)
        if not is_ethical:
            safe_reply = ethical_reply

        # 🔹 Sanitize
        session_key = f"{user_email}_{project_id}_{chat_id}"

        if is_tabular:
            final_safe_reply = safe_reply
        else:
            final_safe_reply = sanitize_reply(
                session_key,
                user_input,
                safe_reply,
                chat_type="work",
            )

        # 🔹 Confidential check
        if contains_confidential_info(final_safe_reply):
            final_safe_reply = "⚠ Questions related to hacking or unauthorized access are not allowed."

        # 🔹 Intent-based response handling (Flask parity)
        # try:
            # project_data = (
            #     supabase
            #     .table("projects")
            #     .select("*")
            #     .eq("id", project_id)
            #     .execute()
            #     .data
            # )

            if project_data:
                try:
                    handled_reply, accuracy_info, intent_type = handle_response_by_intent(
                        user_input,
                        final_safe_reply,
                        project_data,
                        debug=False
                    )
                    final_safe_reply = handled_reply

                except Exception as e:
                    print(f"⚠️ Intent-based handling failed: {e}")

        # 🔹 Final alignment verification (Flask parity)
        # try:
            # project_data = (
            #     supabase
            #     .table("projects")
            #     .select("*")
            #     .eq("id", project_id)
            #     .execute()
            #     .data
            # )
            if project_data:
                try:
                    if is_technical_prompt(user_input, project_data):
                        verify_response_final(
                            user_input,
                            final_safe_reply,
                            project_data,
                            debug=False
                        )

                except Exception as e:
                    print(f"⚠️ Alignment system failed: {e}")

        # 🔹 Apply response metrics logging
        word_count, category = get_response_metrics(final_safe_reply)
        print(f"📊 Response metrics: {word_count} words ({category} category)")
        # 🔹 Save assistant message
        encrypted_reply = encrypt_api(final_safe_reply, project_id)

        assistant_msg_id = save_chat_message(
            user_email=user_email,
            role="assistant",
            content=encrypted_reply,
            project_id=project_id,
            chat_id=chat_id,
            response_length=word_count,
            response_category=category
        )

        # 🔹 Suggestions
        #JONCY START
        suggestions = []
        answer_part = final_safe_reply

        match = re.split(r"You Might Also Ask\s*[:\-]\s*", final_safe_reply, flags=re.IGNORECASE)

        if len(match) > 1:
            answer_part = match[0].replace("Answer:", "").strip()
            suggestion_lines = match[1].split("\n")

            for line in suggestion_lines:
                line = line.strip()

                if line.startswith("-"):
                    suggestions.append(line[1:].strip())

                elif line.startswith("•"):
                    suggestions.append(line[1:].strip())

                elif line and not line.lower().startswith("you might"):
                    suggestions.append(line.strip())

        final_safe_reply = answer_part
        #JONCY OVER
        # generate_followup_suggestions(
        #     user_input,
        #     final_safe_reply,
        #     project_id,
        #     user_email
        # )

        return final_safe_reply, assistant_msg_id, suggestions


async def handle_work_chat(
    data,
    current_user,
    stream: bool = False
):
    try:
        print("🚀 ENTER handle_work_chat | stream =", stream)
        safe_reply = None
        final_safe_reply = None
        print("📥 Incoming data:", data)

        user_query = (data.query or data.message or "").strip()
        user_input = data.user_input or user_query
        # project_id = data.get("project_id")
        project_id = data.project_id
        
        # Krishi_Start (New)
        user_email = current_user.get("email")

        # update krishi
        extract_and_store_user_fact(user_email, user_input)
        user_fact = get_user_fact(user_email) or {}
        # update krishi over
        # Krishi_End (New)

        # Sujal_Harsh_Start
        user_valid, user_err = validate_user_input(user_input)
        if not user_valid:
            return {"reply": user_err}
        
        # 🔹 RESOLVE PROJECT ID IF CUSTOM STRING
        if project_id and not _is_uuid(project_id):
            print(f"🔄 Resolving custom project ID (work_chat): {project_id}")
            try:
                res = (
                    supabase.table("projects")
                    .select("id")
                    .eq("custom_uuid", project_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    project_id = res.data[0]["id"]
                    print(f"✅ Resolved project_id -> {project_id}")
                else:
                    print(f"⚠️ Could not resolve project_id: {project_id}")
                    project_id = None
            except Exception as e:
                print(f"❌ Error resolving project ID: {e}")
                project_id = None
        # Sujal_Harsh_Over

        user_name = current_user.get("name", "")
        user_role = get_user_role(user_email)
        user_role = user_role.strip().lower().replace(" ", "_") # Sujal

        if not project_id:
            return {"reply": "⚠ No project selected.", "is_tabular": False}
        if not user_email:
            return {"reply": "❌ Please login first.", "is_tabular": False}
        if not user_input:
            return {
                "reply": random.choice(CONFUSION_RESPONSES),
                "is_tabular": False,
            }

        # Initialize/Resolve chat_id early
        chat_id = _resolve_chat_id(project_id, user_email, data.chat_id)

        encrypted_user_msg = encrypt_api(user_input, project_id)

        user_msg_id = save_chat_message(
            user_email=user_email,
            role="user",
            content=encrypted_user_msg,
            project_id=project_id,
            chat_id=chat_id,
        )

        # Sujal_Start
        # 🆕 RBAC-PROTECTED: Fetch project data for tech stack
        project_data = None
        tech_stack = []
        
        if project_id:
            try:
                # Import RBAC function
                from core import _apply_access_controls
                
                # Build query
                query = (
                    supabase
                    .table("projects")
                    .select("*")
                    .eq("id", project_id)
                )
                
                # ✅ Apply RBAC filtering - checks assigned_to_emails
                query = _apply_access_controls(
                    table="projects",
                    query=query,
                    role=user_role,
                    user_email=user_email
                )
                
                # Execute filtered query
                result = query.execute()
                
                if result.data:
                    project_data = result.data[0]
                    tech_stack = extract_tech_stack_from_project(project_data)
                    print(f"✅ Project data loaded for authorized user")
                else:
                    # User not authorized for this project
                    print(f"⚠️ User {user_email} not authorized for project {project_id}")
                    project_data = None
                    tech_stack = []
                    
            except Exception as e:
                print(f"⚠️ Failed to fetch project data: {e}")
                project_data = None
                tech_stack = []
        
        # 🆕 NEW: 3.31 Risk Detection with tech stack
        risk_context = {
            "user_role": user_role,
            "project_id": project_id,
            "chat_id": chat_id,
            "tech_stack": tech_stack,  # ← Important for tech stack mismatch detection
        }
        
        is_safe, risk_response = detect_and_handle_risk(
            user_input=user_input,
            user_email=user_email,
            context=risk_context,
            supabase_client=supabase
        )
        
        # If risky, handle based on action required
        if not is_safe:
            # Check if it requires confirmation
            if risk_response.get("requires_confirmation"):
                # For tech stack mismatch - you might want to add a confirmation flow
                # For now, we'll return the message asking for confirmation
                save_chat_message(
                    user_email=user_email,
                    role="assistant",
                    content=risk_response["reply"],
                    project_id=project_id,
                    chat_id=chat_id
                )
                
                return {
                    "reply": risk_response["reply"],
                    "chat_id": chat_id,
                    "requires_confirmation": True,
                    "risk_category": risk_response.get("risk_category"),
                }
            else:
                # High risk - immediate block
                save_chat_message(
                    user_email=user_email,
                    role="assistant",
                    content=risk_response["reply"],
                    project_id=project_id,
                    chat_id=chat_id
                )
                
                return {
                    "reply": risk_response["reply"],
                    "chat_id": chat_id,
                    "risk_detected": True,
                    "risk_category": risk_response.get("risk_category"),
                    "severity": risk_response.get("severity"),
                }
        # Sujal_Over

        # ================= SELF ASKING SESSION SETUP ================= #Tanmey Start
        # FastAPI doesn't have Flask sessions - using a simple in-memory session dict
        # TODO: Replace with Redis or proper session management for production
        if not hasattr(handle_work_chat, '_sessions'):
            handle_work_chat._sessions = {}
        
        session_key = f"{user_email}_{project_id}_{chat_id}"
        session = handle_work_chat._sessions.setdefault(session_key, {})
        
        # 🔒 GUARD: random number without active clarification
        if user_input.strip().isdigit() and not session.get("multi_clarification"):
            return {
                "reply": "Please ask a question first. I need context before a number 🙂"
            }
        
        greeting_response = handle_greetings(user_input, user_name)
        if greeting_response:
            # chirag logic start
            encrypted_response = encrypt_api(greeting_response, project_id)
            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=encrypted_response,
                project_id=project_id,
                chat_id=chat_id,
            )
            # chirag logic end
            return {"reply": greeting_response, "is_tabular": False, "chat_id": chat_id}

        normalized_query = normalize_query_validator(user_input)
        ql = normalized_query.lower()

        if any(p in ql for p in ["facts about me", "my facts", "about me", "tell me about me"]):
            if not user_fact:
                resp = "No personal facts saved yet."
            else:
                resp = "Here are your saved facts:\n" + "\n".join(
                    [f"- {k}: {v}" for k, v in user_fact.items()]
                )
            # chirag logic start
            encrypted_response = encrypt_api(resp, project_id) # Sujal
            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=encrypted_response,
                project_id=project_id,
                chat_id=chat_id,
            )
            # chirag logic end
            return {"reply": resp, "is_tabular": False, "chat_id": chat_id}

        if any(
            p in ql
            for p in [
                "facts about company",
                "company facts",
                "about the company",
                "company info",
                "company information",
            ]
        ):
            company_ctx = (
                get_context("company information")
                or get_context("about the company")
                or "No company information found."
            )
            # chirag logic start
            encrypted_response = encrypt_api(company_ctx, project_id) # Sujal
            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=encrypted_response,
                project_id=project_id,
                chat_id=chat_id,
            )
            # chirag logic end
            return {"reply": company_ctx, "is_tabular": False, "chat_id": chat_id}

        # -------------------- Intent Detection --------------------
        query_type = detect_intent(normalized_query)
        print(f"🧭 Detected intent: {query_type}")

        db_answer = None
        db_raw_data = None

        # -------------------- STRICT TABLE CHECK --------------------
        wants_table = detect_table_request(user_input)
        print(f"[DEBUG] Table request detected: {wants_table}")

        # if "project" in ql or query_type in ["project_details", "all_projects"]:
        #JONCY START
        if query_type in ["project_details", "all_projects"]:
        #JONCY END
            try:
                filters = {"id": project_id}
                
                parsed = {
                    "operation": "select",
                    "table": "projects",
                    "fields": ["*"],
                    "filters": filters,
                }

                if wants_table:
                    db_raw_data = query_supabase_for_table(
                        parsed,
                        user_email=user_email,
                        user_role=user_role,
                        project_id=project_id,
                    )

                db_answer = query_supabase(
                    parsed,
                    user_email=user_email,
                    user_role=user_role,
                    project_id=project_id,
                )

            except Exception as e:
                print("❌ DB query error:", e)

            #JONCY START
            try:
                if query_type in ["documentation", "knowledge"]:
                    doc_context = get_context(normalized_query)
                else:
                    doc_context = None
            except Exception as e:
                print("❌ Document lookup error:", e)
                doc_context = None

            synth_prompt = f"""
            User Question:
            {normalized_query}

            Database Information:
            {db_answer if db_answer else "No database information available."}

            Document Context:
            {doc_context if doc_context else "No documentation context available."}

            Instructions:
            - Use database or documentation data if available.
            - Do NOT invent project details.
            - If information is missing, clearly say so.
            - Provide a helpful answer.
            """
            #JONCY END

        # chirag logic start
        encrypted_hist = (
            load_chat_history(user_email, project_id, chat_id, limit=10) or []
        )

        # Decrypt history for LLM context
        conv_hist = []
        for msg in encrypted_hist:
            decrypted_content = decrypt_api(msg["content"], project_id)
            conv_hist.append({"role": msg["role"], "content": decrypted_content})
        # chirag logic end
            # synth_prompt = f"""
            # User asked: {normalized_query}
            # Database facts: {db_answer or "N/A"}
            # Document context: {doc_context or "N/A"}
            # Task:
            # - Always give a human-like, professional, natural reply.
            # - Never dump raw DB rows or raw doc chunks.
            # """

            #JONCY START
            synth_prompt = f"""
            User Question:
            {normalized_query}

            Database Information:
            {db_answer if db_answer else "No database information available."}

            Document Context:
            {doc_context if doc_context else "No documentation context available."}

            Instructions:
            - Use the database or documentation information when available.
            - Do NOT invent project details.
            - If the data is missing, clearly say you do not have that information.
            - Provide a clear and helpful answer.
            """
            #JONCY END
        
        # Sujal_Start - Enhanced prompt with project data
        # Build comprehensive data context
#         data_context = []
        
#         # Add database answer if available
#         if db_answer and db_answer != "N/A":
#             data_context.append(f"**Database Query Result:**\n{db_answer}")
        
#         # Add project data if available
#         if project_data:
#             project_info = f"""
# **Current Project Information:**
# - Project Name: {project_data.get('name', 'N/A')}
# - Description: {project_data.get('description', 'N/A')}
# - Status: {project_data.get('status', 'N/A')}
# - Start Date: {project_data.get('start_date', 'N/A')}
# - End Date: {project_data.get('end_date', 'N/A')}
# - Tech Stack: {', '.join(tech_stack) if tech_stack else 'N/A'}
# - Team Members: {project_data.get('assigned_to_emails', 'N/A')}
# - Client: {project_data.get('client', 'N/A')}
# """
#             data_context.append(project_info)
        
#         # Add document context if available
#         if doc_context and doc_context != "N/A":
#             data_context.append(f"**Relevant Documentation:**\n{doc_context}")
        
#         # Combine all data
#         full_data_context = "\n\n".join(data_context) if data_context else "No specific data available."
        
        # Build improved prompt
#         synth_prompt = f"""
# User Query: {normalized_query}

# Available Data:
# {full_data_context}

# CRITICAL INSTRUCTIONS:
# 1. **YOU MUST use the actual data provided above** - do NOT make up or hallucinate information
# 2. If project information is shown above, **present those EXACT details** to the user
# 3. If database results are shown, **use those EXACT values** in your response
# 4. **Be specific and factual** - cite actual values, dates, names from the data
# 5. If no data is available, clearly state "I don't have that information" - do NOT guess
# 6. Present the information in a clear, organized way
# 7. Use bullet points or structured format for better readability

# Your response should:
# - Show ACTUAL project details if asking about projects
# - Show ACTUAL database results if available
# - Be professional but factual
# - Never invent or assume information not in the data
# """

        episodic = load_episodic_memory(user_email, project_id, chat_id) or []
        episodic_text = (
            "\nPrevious conversation summaries:\n" + "\n---\n".join(episodic)
            if episodic
            else ""
        )
        # Sujal_Over

        # -------------------- TABLE RESPONSE --------------------
        if wants_table and db_raw_data:
            # ✅ Ensure list of rows
            rows = db_raw_data if isinstance(db_raw_data, list) else [db_raw_data]
            final_reply = format_data_as_table(rows, query_type)
            is_tabular = True

        elif wants_table:
            llm_rows = llm_force_json_table(
                user_input, context=str(db_answer or "")
            )
            if llm_rows:
                final_reply = format_data_as_table(llm_rows, query_type)
                is_tabular = True
            else:
                final_reply = "⚠️ I couldn't generate tabular data for this request."
                is_tabular = False
        
                # 🔥 EARLY RETURN FOR TABLE
        if wants_table:
            final_safe_reply, assistant_msg_id, suggestions = process_ai_reply(
                user_input=user_input,
                normalized_query=normalized_query,
                raw_reply=final_reply,
                project_id=project_id,
                chat_id=chat_id,
                user_email=user_email,
                is_tabular=is_tabular,
                project_data=project_data
            )

            return {
                "reply": final_safe_reply,
                "is_tabular": is_tabular,
                "chat_id": chat_id,
                "message_ids": {
                    "user": user_msg_id,
                    "assistant": assistant_msg_id,
                },
                "clarifications": suggestions,
                "multi_clarification": True if suggestions else False
            }
        # ================= ENSURE safe_reply EXISTS FOR TABLE FLOW =================
        # if wants_table:
        #     safe_reply = final_reply

        # -------------------- TEXT RESPONSE --------------------
        else:
            user_id = get_user_perms_id(user_email)
            # user_pref = get_user_preference_summary(user_id) or {}
            #JONCY START
            if user_id:
                user_pref = get_user_preference_summary(user_id) or {}
            else:
                print("⚠ No user_id found for:", user_email)
                user_pref = {}
            #JONCY END
            preferred_style = user_pref.get("preferred_style", "medium").lower()
          
            if preferred_style == "short":
                max_tokens_value = 200
            elif preferred_style == "medium":
                max_tokens_value = 500
            else:
                max_tokens_value = 900

            print("⭐ Preferred Style:", preferred_style)
            print("🧠 Max Tokens Used:", max_tokens_value)

            # 🔥 2. Build style instruction
            if preferred_style == "short":
                style_instruction = """
            CRITICAL RESPONSE RULE:
                - Keep answer concise (3–5 lines max)
                - Avoid long explanations
                - Be direct and clear
                """
            elif preferred_style == "long":
                style_instruction = """
            CRITICAL RESPONSE RULE:
                - Provide detailed explanation
                - Include examples if helpful
                - Expand reasoning clearly
                """
            else:
                style_instruction = """
            CRITICAL RESPONSE RULE:
                - Provide balanced explanation
                - Moderate detail
                - Clear and structured
                """
            # messages = [
            #     {
            #         "role": "system",
            #         "content": (
            #             f"You are a helpful AI assistant.\n"
            #             f"User: {user_name} ({user_email}), Role: {user_role}.\n"
            #             f"{episodic_text}\n"
            #             f"{style_instruction}"
            #         ),
            #     },
            #     *conv_hist,
            #     {"role": "user", "content": synth_prompt},
            # ]

            #JONCY START
            recent_history = conv_hist[-5:]

            # messages = [
            #     {
            #         "role": "system",
            #         "content": (
            #             f"You are a helpful AI assistant.\n"
            #             f"User: {user_name} ({user_email}), Role: {user_role}.\n"
            #             f"{episodic_text}\n"
            #             f"{style_instruction}"
            #         ),
            #     },
            #     *recent_history,
            #     {"role": "user", "content": synth_prompt},
            # ]

            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are a helpful AI assistant.\n"
                        f"User: {user_name} ({user_email}), Role: {user_role}.\n"
                        f"{episodic_text}\n"
                        f"{style_instruction}\n\n"
                        "At the end of every answer generate 2 helpful follow-up questions.\n"
                        "Use this exact format:\n\n"
                        "Answer:\n"
                        "<main answer>\n\n"
                        "You Might Also Ask:\n"
                        "- question\n"
                        "- question\n"
                    ),
                },
                *recent_history,
                {"role": "user", "content": synth_prompt},
            ]
            #JONCY END

            is_tabular = False

            # ================= STREAM MODE =================
            if stream:
                async def token_generator():

                    print("🧠 Token control applied:", max_tokens_value)
                    #  # 🔎 DEBUG PRINTS
                    # print("⭐ Preferred Style:", preferred_style)
                    # print("🧠 Max Tokens Used:", max_tokens_value)

                    response_stream = call_llm_with_model(
                        messages,
                        temperature=0.5,
                        max_tokens=max_tokens_value,
                        stream=True
                    )

                    collected_reply = ""

                    async for token in response_stream:
                        if token:
                            collected_reply += token
                            yield token

                    # After streaming ends
                    final_reply = format_response(
                        user_input,
                        fallback=collected_reply
                    )

                    final_safe_reply, assistant_msg_id, suggestions = process_ai_reply(
                        user_input=user_input,
                        normalized_query=normalized_query,
                        raw_reply=final_reply,
                        project_id=project_id,
                        chat_id=chat_id,
                        user_email=user_email,
                        is_tabular=False,
                        project_data=project_data
                    )

                    yield {
                        "type": "meta",
                        "chat_id": chat_id,
                        "message_ids": {
                            "user": user_msg_id,
                            "assistant": assistant_msg_id,
                        },
                        "clarifications": suggestions,
                        "multi_clarification": True if suggestions else False
                    }

                return token_generator()

            else: 
                # ================= NORMAL MODE =================
                reply = call_llm_with_model(
                    messages,
                    temperature=0.5,
                    max_tokens=max_tokens_value,
                    stream=False
                )

                final_reply = format_response(user_input, fallback=reply)

                final_safe_reply, assistant_msg_id, suggestions = process_ai_reply(
                    user_input=user_input,
                    normalized_query=normalized_query,
                    raw_reply=final_reply,
                    project_id=project_id,
                    chat_id=chat_id,
                    user_email=user_email,
                    is_tabular=False,
                    project_data=project_data
                )

                return {
                    "reply": final_safe_reply,
                    "is_tabular": False,
                    "chat_id": chat_id,
                    "message_ids": {
                        "user": user_msg_id,
                        "assistant": assistant_msg_id,
                    },
                    "clarifications": suggestions,
                    "multi_clarification": True if suggestions else False
                }

    except HTTPException:
        raise
    except Exception:
        import traceback
        print("❌ WORK CHAT ERROR TRACEBACK:")
        print(traceback.format_exc())
        raise