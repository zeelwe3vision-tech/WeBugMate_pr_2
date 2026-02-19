import random
import traceback
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


async def handle_dual_chat(data, current_user):
    try:
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
        
        if project_id and project_id != "default":
            try:
                result = (
                    supabase
                    .table("projects")
                    .select("*")
                    .eq("id", project_id)
                    .execute()
                )
                if result.data:
                    project_data = result.data[0]
                    tech_stack = extract_tech_stack_from_project(project_data)
            except Exception as e:
                print(f"⚠️ Failed to fetch project data: {e}")
        
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

        encrypted_hist = (
            load_chat_history(user_email, project_id, chat_id, limit=15) or []
        )

        # Decrypt history for LLM context
        conv_hist = []
        for msg in encrypted_hist:
            decrypted_content = decrypt_api(msg["content"], project_id)
            conv_hist.append({"role": msg["role"], "content": decrypted_content})
        # chirag logic end

        # -------------------- Normalize query --------------------
        # For RAG/DB we need a standalone query. We include history to resolve pronouns.
        normalization_messages = [
            {
                "role": "system",
                "content": "Rewrite the user's latest query into a clear, standalone natural-language question based on the provided conversation history. If it's already clear, just return it. Respond ONLY with the rewritten query.",
            },
            *conv_hist[-3:], # last 3 messages are usually enough for context resolution
            {"role": "user", "content": user_input},
        ]

        normalized_query = call_openrouter(
            normalization_messages,
            temperature=0,
            max_tokens=100,
        ) or user_input

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
        query_type = detect_intent(normalized_query)
        print(f"🧭 Detected intent: {query_type}")

        db_answer = None
        db_raw_data = None

        # -------------------- DB lookup --------------------
        if "project" in ql or query_type in ["project_details", "all_projects"]:
            try:
                filters = {"id": project_id}
                if user_role.lower() == "employee":
                    filters["assigned_to_emails"] = {"contains": user_email}

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


        # -------------------- TABLE RESPONSE --------------------
        if wants_table and db_raw_data:
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
                final_reply = "⚠️ I couldn't generate tabular data."
                is_tabular = False

        # -------------------- TEXT RESPONSE --------------------
        else:
            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are a helpful AI assistant.\n"
                        f"User: {user_name} ({user_email}), Role: {user_role}.\n"
                        f"{episodic_text}"
                    ),
                },
                *conv_hist,
                {
                    "role": "user",
                    "content": f"""
                    User asked: {normalized_query}
                    Database facts: {db_answer or "N/A"}
                    Document context: {doc_context or "N/A"}
                    """,
                },
            ]

            reply = call_llm_with_model(
                messages, temperature=0.5, max_tokens=1200
            )
            final_reply = format_response(user_input, fallback=reply)
            is_tabular = False

        # -------------------- Safety --------------------
        valid, safe_reply = validate_api_response(final_reply)
        if not valid:
            return {"reply": safe_reply, "is_tabular": False, "chat_id": chat_id}

        is_ethical, ethical_reply = enforce_ethical_rules(user_input, safe_reply)
        if not is_ethical:
            # raise HTTPException(status_code=400, detail=ethical_reply)
            safe_reply = ethical_reply

        session_key = f"{user_email}_{project_id}_{chat_id}"

        # 🔹 Intent-based response handling (Flask parity)
        try:
            project_data = (
                supabase
                .table("projects")
                .select("*")
                .eq("id", project_id)
                .execute()
                .data
            )

            handled_reply, accuracy_info, intent_type = handle_response_by_intent(
                user_input,
                safe_reply,   
                project_data,
                debug=False
            )

            safe_reply = handled_reply

        except Exception as e:
            print(f"⚠️ Intent-based handling failed: {e}")

        if is_tabular:
            final_safe_reply = final_reply
        else:
            final_safe_reply = sanitize_reply(
                session_key, user_input, safe_reply, chat_type="dual"
            )

        if contains_confidential_info(final_safe_reply):
            final_safe_reply = "⚠ Questions related to hacking or unauthorized access are not allowed."

        # -------------------- Save --------------------
        # chirag logic start
        # user_msg_id = save_chat_message(
        #     user_email=user_email,
        #     role="user",
        #     content=user_input,
        #     project_id=project_id,
        #     chat_id=chat_id
        # )

        # encrypted_user_msg = encrypt_api(user_input, project_id)

        # user_msg_id = save_chat_message(
        #     user_email=user_email,
        #     role="user",
        #     content=encrypted_user_msg,
        #     project_id=project_id,
        #     chat_id=chat_id,
        # )

        # chirag logic end

        # chirag logic start

        # assistant_msg_id = save_chat_message(
        #     user_email=user_email,
        #     role="assistant",
        #     content=final_safe_reply,
        #     project_id=project_id,
        #     chat_id=chat_id
        # )

        encrypted_assistant_reply = encrypt_api(final_safe_reply, project_id)

        assistant_msg_id = save_chat_message(
            user_email=user_email,
            role="assistant",
            content=encrypted_assistant_reply,
            project_id=project_id,
            chat_id=chat_id,
        )
        # chirag logic end

 # Self-asking handled at beginning of route

        # Dynamic Follow-up Suggestions     #Tanmey Start
        # suggestions = generate_followup_suggestions(user_input, final_safe_reply, project_id, user_email)
        # suggestions = []
        suggestions = generate_followup_suggestions(user_input, final_safe_reply, project_id, user_email)
        #Tanmey End

        try:
            project_data = (
                supabase
                .table("projects")
                .select("*")
                .eq("id", project_id)
                .execute()
                .data
            )

            if is_technical_prompt(user_input, project_data):
                verify_response_final(
                    user_input,
                    final_safe_reply,
                    project_data,
                    debug=False
                )

        except Exception as e:
            print(f"⚠️ Alignment system failed: {e}")

        return {
            "reply": final_safe_reply,
            "is_tabular": is_tabular,
            "chat_id": chat_id,
            "message_ids": {
                "user": user_msg_id,
                "assistant": assistant_msg_id,
            },
             "access_verified": True, #Tanmey Start
            "clarifications": suggestions,
            "multi_clarification": True if suggestions else False #Tanmey End
        }

    except HTTPException:
        raise
    except Exception:
        print("❌ DUAL CHAT ERROR TRACEBACK:")
        print(traceback.format_exc())
        raise