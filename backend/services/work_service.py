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
    extract_tech_stack_from_project,
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

async def handle_work_chat(
    data,
    current_user
):
    try:
        print("📥 Incoming data:", data)

        # user_input = (data.get("query") or data.get("message") or "").strip()
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
        # if not user_valid:
        #     raise HTTPException(status_code=400, detail=user_err)
        #krishi 10/2
        # if not user_valid:
        #     final_safe_reply = user_err
        if not user_valid:
            return {"reply": user_err}
        #krishi over 10/2
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

        # # Sujal_Start
        # is_allowed, rbac_result = validate_query_with_rbac(
        #     user_input=user_query,
        #     user_email=user_email,
        #     user_role=user_role,
        #     context={"project_id": data.get("project_id")}
        # )
        # # Sujal_Over
        
        # if not is_allowed:
        #     return {"reply": rbac_result["reply"], "rbac_denied": True}

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

        # # ========== 3.31 RISK DETECTION ==========
        # from validators import handle_risk  # ensure import at top, or place here
        # risk_action, risk_response, risk_assessment = handle_risk(
        #     user_input=user_input,
        #     user_email=user_email,
        #     user_role=user_role,
        #     project_id=project_id,
        #     chat_id=chat_id,
        # )

        # if risk_action != "allow":
        #     # Save user message for audit
        #     save_chat_message(
        #         user_email=user_email,
        #         role="user",
        #         content=user_input,
        #         project_id=project_id,
        #         chat_id=chat_id
        #     )
        #     # Save assistant's refusal/confirmation
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
        
        # # Save user message for normal flow
        # user_msg_id = save_chat_message(
        #     user_email=user_email,
        #     role="user",
        #     content=user_input,
        #     project_id=project_id,
        #     chat_id=chat_id
        # )
        # # ========== END RISK DETECTION ==========

        # 🆕 NEW: Fetch project data for tech stack
        project_data = None
        tech_stack = []
        
        if project_id:
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

            # save_chat_message(
            #     user_email=user_email,
            #     role="assistant",
            #     content=greeting_response,
            #     project_id=project_id,
            #     chat_id=chat_id
            # )

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
            # save_chat_message(
            #     user_email=user_email,
            #     role="assistant",
            #     content=resp,
            #     project_id=project_id,
            #     chat_id=chat_id,
            # )

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

            # save_chat_message(
            #     user_email=user_email,
            #     role="assistant",
            #     content=company_ctx,
            #     project_id=project_id,
            #     chat_id=chat_id,
            # )
            # chirag logic end

            encrypted_response = encrypt_api(company_ctx, project_id) # Sujal
            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=encrypted_response,
                project_id=project_id,
                chat_id=chat_id,
            )
            return {"reply": company_ctx, "is_tabular": False, "chat_id": chat_id}

        # -------------------- Intent Detection --------------------
        query_type = detect_intent(normalized_query)
        print(f"🧭 Detected intent: {query_type}")

        db_answer = None
        db_raw_data = None

        # -------------------- STRICT TABLE CHECK --------------------
        wants_table = detect_table_request(user_input)
        print(f"[DEBUG] Table request detected: {wants_table}")

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

        try:
            doc_context = get_context(normalized_query)
        except Exception as e:
            print("❌ Document lookup error:", e)
            doc_context = None


        # chirag logic start
        # conv_hist = load_chat_history(
        #     user_email, project_id, chat_id, limit=15
        # ) or []

        encrypted_hist = (
            load_chat_history(user_email, project_id, chat_id, limit=15) or []
        )

        # Decrypt history for LLM context
        conv_hist = []
        for msg in encrypted_hist:
            decrypted_content = decrypt_api(msg["content"], project_id)
            conv_hist.append({"role": msg["role"], "content": decrypted_content})
        # chirag logic end

        synth_prompt = f"""
        User asked: {normalized_query}
        Database facts: {db_answer or "N/A"}
        Document context: {doc_context or "N/A"}
        Task:
        - Always give a human-like, professional, natural reply.
        - Never dump raw DB rows or raw doc chunks.
        """

        episodic = load_episodic_memory(user_email, project_id, chat_id) or []
        episodic_text = (
            "\nPrevious conversation summaries:\n" + "\n---\n".join(episodic)
            if episodic
            else ""
        )

        # -------------------- TABLE RESPONSE --------------------
        # if wants_table and db_raw_data:
        #     final_reply = format_data_as_table(db_raw_data, query_type)
        #     is_tabular = True
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
                {"role": "user", "content": synth_prompt},
            ]

            reply = call_llm_with_model(
                messages, temperature=0.5, max_tokens=350
            )
            final_reply = format_response(user_input, fallback=reply)
            is_tabular = False

        # 🔹 Validate AI response using safety layer
        valid, safe_reply = validate_api_response(final_reply)
        if not valid:
            return {"reply": safe_reply, "is_tabular": False}

        #krishi 10/2
        # 🔹 Tech / Code safety validation (Flask parity)
        if is_tech_related_query(normalized_query):
            if not validate_code_response(safe_reply):
                safe_reply = (
                    "⚠️ The generated code contains unsafe patterns and has been blocked for security reasons."
                )
            else:
                 # 🔹 Format code response using format_code_response
                language = "python" if "python" in normalized_query.lower() else \
                        "javascript" if "javascript" in normalized_query.lower() or "js" in normalized_query.lower() else \
                        "sql" if "sql" in normalized_query.lower() else "python"
                safe_reply = format_code_response(safe_reply, language)
        #krishi over 10/2


        # 🔹 Ethical rules
        is_ethical, ethical_reply = enforce_ethical_rules(user_input, safe_reply)
        # if not is_ethical:
        #     raise HTTPException(status_code=400, detail=ethical_reply)
        if not is_ethical:
            safe_reply = ethical_reply
        #old version
        # final_safe_reply = sanitize_reply(
        #     f"{user_email}_{project_id}_{chat_id}",
        #     user_input,
        #     ethical_reply,
        #     chat_type="work",
        # ) #new fastapi version
        session_key = f"{user_email}_{project_id}_{chat_id}"
        #krishi 10/2
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
        #krishi over 10/2

        if is_tabular:
            # ✅ DO NOT sanitize HTML tables
            final_safe_reply = final_reply
        else:
            final_safe_reply = sanitize_reply(
                session_key,
                user_input,
                safe_reply,
                chat_type="work",
            )
        #new fastapi version ended
        if contains_confidential_info(final_safe_reply):
            final_safe_reply = (
                "⚠ Questions related to hacking or unauthorized access are not allowed."
            )

        # chirag logic start

        # user_msg_id = save_chat_message(
        #     user_email=user_email,
        #     role="user",
        #     content=user_input,
        #     project_id=project_id,
        #     chat_id=chat_id,
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
        #     chat_id=chat_id,
        # )

        encrypted_reply = encrypt_api(final_safe_reply, project_id)
        assistant_msg_id = save_chat_message(
            user_email=user_email,
            role="assistant",
            content=encrypted_reply,  
            project_id=project_id,
            chat_id=chat_id
        )
        # chirag logic end
        # Dynamic Follow-up Suggestions     #Tanmey Start
        suggestions = generate_followup_suggestions(user_input, final_safe_reply, project_id, user_email)
        #Tanmey End
        #krishi 10/2
        # 🔹 Final alignment verification (Flask parity)
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
        #krishi over 10/2

        return {
            "reply": final_safe_reply,
            "is_tabular": is_tabular,
            "chat_id": chat_id,
            "message_ids": {
                "user": user_msg_id,
                "assistant": assistant_msg_id,
            },
            "clarifications": suggestions,  #Tanmey Start
            "multi_clarification": True if suggestions else False
            }  #Tanmey End
        

    except HTTPException:
        raise
    # except Exception as e:
    #     print(f"❌ Error in work chat service: {e}")
    #     raise HTTPException(
    #         status_code=500,
    #         detail="⚠ Something went wrong while processing your request.",
    #     )
    except Exception:
        import traceback
        print("❌ WORK CHAT ERROR TRACEBACK:")
        print(traceback.format_exc())
        raise