import random
import traceback
#JONCY START
import re
#JONCY END
from fastapi import Request, HTTPException
from typing import Dict, Any


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
    call_openrouter,
    supabase,
    CONFUSION_RESPONSES,
    build_fact_memory_system_prompt_322,  #Tanmey Added
    handle_multi_question_self_asking,     #Tanmey Added
    generate_followup_suggestions         #Tanmey Added
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

# chirag logic start
from security.encrypt_utils import encrypt_api, decrypt_api

# chirag logic end
from services.work_service import process_ai_reply

async def handle_dual_chat(data, current_user, stream=False):
    try:
        safe_reply = None
        final_safe_reply = None
        print("📥 Incoming data:", data)    

        final_reply = ""
        is_tabular = False

        # -------------------- Extract input --------------------
        user_query = (data.query or data.message or "").strip()
        user_input = data.user_input or user_query
        raw_query = user_input.lower()

        project_id = data.project_id or "default"

        user_email = current_user.get("email")
        user_name = current_user.get("name", "")
        user_role = get_user_role(user_email)
        user_role = user_role.strip().lower().replace(" ", "_") # Sujal

        # -------------------- Facts --------------------
        extract_and_store_user_fact(user_email, user_input)
        user_facts = get_user_fact(user_email) or {}

        # -------------------- Validate input --------------------
        user_valid, user_err = validate_user_input(user_input)
        if not user_valid:
            # We still resolve chat_id before returning to maintain session
            chat_id = _resolve_chat_id(project_id, user_email, data.chat_id)
            return {"reply": user_err, "chat_id": chat_id, "is_tabular": False}

        # -------------------- Resolve project_id --------------------
        if project_id != "default" and not _is_uuid(project_id):
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
                else:
                    project_id = None
            except Exception:
                project_id = None

        chat_id = _resolve_chat_id(project_id, user_email, data.chat_id)

        encrypted_user_msg = encrypt_api(user_input, project_id)

        user_msg_id = save_chat_message(
            user_email=user_email,
            role="user",
            content=encrypted_user_msg,
            project_id=project_id,
            chat_id=chat_id,
        )

        # ================= SELF ASKING SESSION SETUP ================= #Tanmey Start
        # FastAPI doesn't have Flask sessions - using in-memory session dict attached to function
        if not hasattr(handle_dual_chat, '_sessions'):
            handle_dual_chat._sessions = {}
        
        session_key = f"{user_email}_{project_id}_{chat_id}"
        session = handle_dual_chat._sessions.setdefault(session_key, {})

        # 🔒 GUARD: random number without active clarification
        if user_input.strip().isdigit() and not session.get("multi_clarification"):
            return {
                "reply": "Please ask a question first. I need context before a number 🙂"
            }    #Tanmey End

        if not user_input:
            return {
                "reply": random.choice(CONFUSION_RESPONSES),
                "is_tabular": False,
                "chat_id": chat_id,
            }
        
        # # ========== 3.31 RISK DETECTION ==========
        # from validators import handle_risk
        # risk_action, risk_response, risk_assessment = handle_risk(
        #     user_input=user_input,
        #     user_email=user_email,
        #     user_role=user_role,
        #     project_id=project_id,
        #     chat_id=chat_id,
        # )

        # if risk_action != "allow":
        #     save_chat_message(
        #         user_email=user_email,
        #         role="user",
        #         content=user_input,
        #         project_id=project_id,
        #         chat_id=chat_id
        #     )
        #     save_chat_message(
        #         user_email=user_email,
        #         role="assistant",
        #         content=risk_response,
        #         project_id=project_id,
        #         chat_id=chat_id
        #     )
        #     return {
        #         "reply": risk_response,
        #         "is_tabular": False,
        #         "chat_id": chat_id,
        #         "risk": risk_assessment,
        #     }
        
        # # ========== END RISK DETECTION ==========

        
        # 🆕 NEW: Fetch project data if available
        project_data = None
        tech_stack = []
        
        # if project_id and project_id != "default":
        #     try:
        #         result = (
        #             supabase
        #             .table("projects")
        #             .select("*")
        #             .eq("id", project_id)
        #             .execute()
        #         )
        #         if result.data:
        #             project_data = result.data[0]
        #             tech_stack = extract_tech_stack_from_project(project_data)
        #     except Exception as e:
        #         print(f"⚠️ Failed to fetch project data: {e}")
        
        # Sujal_Start
        if project_id and project_id != "default":
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

        # Sujal_Over

        # Sujal_Start
        
        # 🆕 NEW: 3.31 Risk Detection
        risk_context = {
            "user_role": user_role,
            "project_id": project_id,
            "chat_id": chat_id,
            "tech_stack": tech_stack,
        }
        
        is_safe, risk_response = detect_and_handle_risk(
            user_input=user_input,
            user_email=user_email,
            context=risk_context,
            supabase_client=supabase
        )
        
        # Handle risk response
        if not is_safe:
            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=risk_response["reply"],
                project_id=project_id,
                chat_id=chat_id
            )
            
            return {
                "reply": risk_response["reply"],
                "is_tabular": False,
                "chat_id": chat_id,
                "risk_detected": True,
                "requires_confirmation": risk_response.get("requires_confirmation", False),
                "risk_category": risk_response.get("risk_category"),
            }
        
        # Sujal_Over

        # -------------------- Greetings --------------------
        greeting_response = handle_greetings(user_input, user_name)
        if greeting_response:
            # chirag logic start

            # save_chat_message(
            #     user_email=user_email,
            #     role="assistant",
            #     content=greeting_response,
            #     project_id=project_id,
            #     chat_id=chat_id
            # )

            encrypted_greeting = encrypt_api(greeting_response, project_id)
            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=encrypted_greeting,
                project_id=project_id,
                chat_id=chat_id,
            )
            # chirag logic end
            return {"reply": greeting_response, "is_tabular": False, "chat_id": chat_id}

        # -------------------- Table detection --------------------
        wants_table = detect_table_request(user_input)
        print(f"[DEBUG] Table request detected: {wants_table}")

        # -------------------- Load History early for context --------------------
        episodic = load_episodic_memory(user_email, project_id, chat_id) or []
        episodic_text = (
            "\nPrevious conversation summaries:\n" + "\n---\n".join(episodic)
            if episodic
            else ""
        )
         # chirag logic start
        # conv_hist = load_chat_history(user_email, project_id, chat_id, limit=15) or []
#JONCY START
        encrypted_hist = (
            load_chat_history(user_email, project_id, chat_id, limit=5) or []
        )
#JONCY END
        # Decrypt history for LLM context
        #JONCY START
        conv_hist = []
        #JONCY END
        # conv_hist = []
        for msg in encrypted_hist[-5:]:
            decrypted_content = decrypt_api(msg["content"], project_id)
            conv_hist.append({"role": msg["role"], "content": decrypted_content})
        # chirag logic end

        # -------------------- Normalize query --------------------
        #JONCY COMMENTED
        # For RAG/DB we need a standalone query. We include history to resolve pronouns.
        # normalization_messages = [
        #     {
        #         "role": "system",
        #         "content": "Rewrite the user's latest query into a clear, standalone natural-language question based on the provided conversation history. If it's already clear, just return it. Respond ONLY with the rewritten query.",
        #     },
        #     *conv_hist[-3:], # last 3 messages are usually enough for context resolution
        #     {"role": "user", "content": user_input},
        # ]

        # // KIRTAN START 05-03
        active_model = get_user_llm_model(user_email)
        #JONCY START
        # active_model = "meta-llama/llama-3.1-8b-instruct"
        #JONCY OVER

        #JONCY START
        normalized_query = user_input
        print("USER INPUT:", user_input)
        print("NORMALIZED QUERY:", normalized_query)
        #JONCY END

        # normalized_query = call_openrouter(
        #     normalization_messages,
        #     model=active_model,
        #     temperature=0,
        #     max_tokens=100,
        # ) or user_input
        # // KIRTAN STOP 05-03

        ql = normalized_query.lower()

        # -------------------- User facts trigger --------------------
        if any(
            p in raw_query
            for p in [
                "facts about me",
                "my facts",
                "about me",
                "tell me about me",
                "my profile",
            ]
        ):
            if not user_facts:
                resp = "No personal facts saved yet."
            else:
                resp = "Here are your saved facts:\n" + "\n".join(
                    [f"- {k}: {v}" for k, v in user_facts.items()]
                )
            encrypted_resp = encrypt_api(resp, project_id)

             # chirag logic start

            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=encrypted_resp,
                project_id=project_id,
                chat_id=chat_id,
            )

            encrypted_user_msg = encrypt_api(user_query, project_id)

            save_chat_message(
                user_email=user_email,
                role="user",
                content=encrypted_user_msg,
                project_id=project_id,
                chat_id=chat_id,
            )
            # chirag logic end
            return {"reply": resp, "is_tabular": False, "chat_id": chat_id}

        # -------------------- Intent --------------------
        # // KIRTAN START 05-03
        query_type = detect_intent(normalized_query, user_email)
        # // KIRTAN STOP 05-03
        print(f"🧭 Detected intent: {query_type}")

        db_answer = None
        db_raw_data = None

        # -------------------- DB lookup --------------------
        if "project" in ql or query_type in ["project_details", "all_projects"]:
            try:
                filters = {"id": project_id}

                # Sujal_Start
                # if user_role.lower() == "employee":
                #     filters["assigned_to_emails"] = {"contains": user_email}

                # Sujal_Over
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

        # -------------------- RAG --------------------
        try:
            doc_context = get_context(normalized_query)
        except Exception:
            doc_context = None
        #JONCY COMMENTED
        # synth_prompt = f"""
        #     User asked: {normalized_query}
        #     Database facts: {db_answer or "N/A"}
        #     Document context: {doc_context or "N/A"}
        #     Task:
        #     - Always give a human-like, professional, natural reply.
        #     - Never dump raw DB rows or raw doc chunks.
        #     """
        # -------------------- TABLE RESPONSE --------------------
        if wants_table and db_raw_data:
            rows = db_raw_data if isinstance(db_raw_data, list) else [db_raw_data]
            final_reply = format_data_as_table(rows, query_type)
            is_tabular = True

        elif wants_table:
            # // KIRTAN START 05-03
            llm_rows = llm_force_json_table(
                user_input, context=str(db_answer or ""), user_email=user_email
            )
            # // KIRTAN STOP 05-03
            if llm_rows:
                final_reply = format_data_as_table(llm_rows, query_type)
                is_tabular = True
            else:
                final_reply = "⚠️ I couldn't generate tabular data."
                is_tabular = False

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
            #JONCY START
            suggestions = You_Might_Also_Ask
            #JONCY END
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
        # -------------------- TEXT RESPONSE --------------------
        else:
            # messages = [
            #     {
            #         "role": "system",
            #         "content": (
            #             f"You are a helpful AI assistant.\n"
            #             f"User: {user_name} ({user_email}), Role: {user_role}.\n"
            #             f"{episodic_text}"
            #         ),
            #     },
            #     *conv_hist,
            #     {"role": "user", "content": synth_prompt},
            # ]

            #JONCY START
            # messages = [
            #     {
            #         "role": "system",
            #         "content": (
            #             f"You are a helpful AI assistant.\n"
            #             f"User: {user_name} ({user_email}), Role: {user_role}.\n"
            #             f"{episodic_text}\n"
            #             "Use provided project or document context if relevant."
            #         ),
            #     }
            # ]
            messages = [
                    {
                    "role": "system",
                    "content": (
                    f"You are a helpful AI assistant.\n"
                    f"User: {user_name} ({user_email}), Role: {user_role}.\n"
                    f"{episodic_text}\n"
                    "Use provided project or document context if relevant.\n\n"
                    "Respond clearly and professionally.\n"
                    "At the end of your answer generate 2 short follow-up questions.\n\n"
                    "Format EXACTLY like this:\n\n"
                    "Answer:\n"
                    "<your answer>\n\n"
                    "You Might Also Ask:\n"
                    "- question\n"
                    "- question"
                    ),
                }
            ]

            # Add project/database context
            if db_answer:
                messages.append({
                    "role": "system",
                    "content": f"Project database information:\n{db_answer}"
                })

            # Add RAG/document context
            if doc_context:
                messages.append({
                    "role": "system",
                    "content": f"Relevant documentation:\n{doc_context}"
                })

            # Add conversation history
            messages.extend(conv_hist)

            # Add the actual user question
            messages.append({
                "role": "user",
                "content": user_input
            })
            #JONCY END

            # reply = call_llm_with_model(
            #     messages, temperature=0.5, max_tokens=1200
            # )
            # final_reply = format_response(user_input, fallback=reply)
            # is_tabular = False
            if stream:
                async def token_generator():

                    response_stream = call_llm_with_model(
                        messages,
                        model=active_model,
                        temperature=0.5,
                        max_tokens=1200,
                        stream=True
                    )

                    collected_reply = ""

                    async for token in response_stream:
                        if token:
                            collected_reply += token
                            yield token

                    # After stream finishes
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
            # ---------- NORMAL (REST) MODE ----------
                reply = call_llm_with_model(
                        messages,
                        model=active_model,
                        temperature=0.5,
                        max_tokens=1200,
                        stream=False
                    )

                final_reply = format_response(user_input, fallback=reply)
#JONCY START
                You_Might_Also_Ask = []
                answer_part = final_reply

                match = re.split(r"You Might Also Ask\s*[:\-]\s*", final_reply, flags=re.IGNORECASE)

                if len(match) > 1:
                    answer_part = match[0].replace("Answer:", "").strip()
                    suggestion_lines = match[1].split("\n")

                    for line in suggestion_lines:
                        line = line.strip()
                        if line.startswith("-"):
                            You_Might_Also_Ask.append(line[1:].strip())

                final_reply = answer_part
#JONCY END
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
#                 # Add database answer if available
#                 if db_answer and db_answer != "N/A":
#                     data_context.append(f"**Database Query Result:**\n{db_answer}")
                
#                 # Add project data if available
#                 if project_data:
#                     project_info = f"""
# **Current Project Information:**
# - Project Name: {project_data.get('project_name', 'N/A')}
# - Description: {project_data.get('project_description', 'N/A')}
# - Status: {project_data.get('status', 'N/A')}
# - Start Date: {project_data.get('start_date', 'N/A')}
# - End Date: {project_data.get('end_date', 'N/A')}
# - Tech Stack: {', '.join(tech_stack) if tech_stack else 'N/A'}
# - Team Members: {project_data.get('assigned_to_emails', 'N/A')}
# - Client: {project_data.get('client_name', 'N/A')}
# """
#                     data_context.append(project_info)
                
#                 # Add document context if available
#                 if doc_context and doc_context != "N/A":
#                     data_context.append(f"**Relevant Documentation:**\n{doc_context}")
                
#                 # Combine all data
#                 full_data_context = "\n\n".join(data_context) if data_context else "No specific data available."
                
#                 # ✅ IMPROVED: System prompt with strong instructions
#                 system_prompt = f"""You are a factual AI assistant for We3Vision.

# User: {user_name} ({user_email})
# Role: {user_role}

# {episodic_text}

# CORE RULES:
# 1. **ALWAYS use actual data when provided** - never hallucinate or invent information
# 2. When asked about projects, show ACTUAL project details from the data
# 3. When asked about database information, use EXACT values from query results
# 4. If you don't have specific data, say "I don't have that information"
# 5. Be professional, clear, and factual
# 6. Present information in an organized, readable format

# Remember: You have access to real project data and database results. USE THEM!
# """
                
#                 # Build user message with data
#                 user_prompt = f"""
# User Query: {normalized_query}

# Available Data:
# {full_data_context}

# CRITICAL INSTRUCTIONS:
# 1. **YOU MUST use the actual data provided above** - do NOT make up information
# 2. If project information is shown above, **present those EXACT details**
# 3. If database results are shown, **use those EXACT values**
# 4. **Be specific and factual** - cite actual values from the data
# 5. If no data available, clearly state "I don't have that information"
# 6. Present information in a clear, organized way

# Your response should show ACTUAL data, not generic descriptions.
# """
                
#                 messages = [
#                     {"role": "system", "content": system_prompt},
#                     *conv_hist,
#                     {"role": "user", "content": user_prompt},
#                 ]

#                 reply = call_llm_with_model(
#                     messages, temperature=0.2, max_tokens=1200  # ✅ Lower temp for factual responses
#                 )
#                 final_reply = format_response(user_input, fallback=reply)
#                 is_tabular = False

                # Sujal_Over

    except HTTPException:
        raise
    except Exception:
        print("❌ DUAL CHAT ERROR TRACEBACK:")
        print(traceback.format_exc())
        raise