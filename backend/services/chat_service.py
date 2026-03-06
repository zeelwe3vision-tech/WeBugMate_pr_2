import random
import traceback
import json
from validators import (
    validate_user_input,
    validate_api_response,
    enforce_ethical_rules,
    is_tech_related_query,
    validate_code_response,
    process_tech_response,
    sanitize_reply,
    contains_confidential_info,
    detect_and_handle_risk,          # 🆕 3.31 Main function
    extract_tech_stack_from_project,
    # validate_query_with_rbac
)
from core import (
    TABLES,
    detect_intent,
    detect_table_request,
    get_context,
    format_data_as_table,
    safe_json_load,
    save_chat_message,
    call_openrouter,
    load_chat_history,
    load_episodic_memory,
    query_supabase,
    handle_greetings,
    CONFUSION_RESPONSES,
    supabase,
    build_fact_memory_system_prompt_322,  #Tanmey Added
    handle_multi_question_self_asking,     #Tanmey Added
    generate_followup_suggestions,         #Tanmey Added
    get_user_llm_model
)
from services.chat_core import format_response, extract_and_store_user_fact, _resolve_chat_id

async def handle_common_chat(data, current_user, stream: bool = False):
    try:
        # -------------------------
        # BASIC EXTRACTION
        # -------------------------
        print(">>> handle_common_chat CALLED <<<")
        print("DATA TYPE:", type(data))
        print("DATA REPR:", repr(data))
        user_email = current_user["email"]
        user_name = current_user.get("name", "")
        user_role = current_user.get("role") or "employee"

        user_query = (
            getattr(data, "query", None)
            or getattr(data, "message", None)
            or ""
        ).strip()
        
        # # Sujal_Start
        # is_allowed, rbac_result = validate_query_with_rbac(
        #     user_input=user_query,
        #     user_email=user_email,
        #     user_role=user_role,
        #     table_name=None,  # Will be determined by intent detection
        #     context={"project_id": getattr(data, "project_id", "default")}
        # )
        
        # if not is_allowed:
        #     # User doesn't have permission
        #     save_chat_message(
        #         user_email=user_email,
        #         role="user",
        #         content=user_query,
        #         project_id=getattr(data, "project_id", "default"),
        #         chat_id=getattr(data, "chat_id", None)
        #     )
        #     save_chat_message(
        #         user_email=user_email,
        #         role="assistant",
        #         content=rbac_result["reply"],
        #         project_id=getattr(data, "project_id", "default"),
        #         chat_id=getattr(data, "chat_id", None)
        #     )
        #     return {
        #         "reply": rbac_result["reply"],
        #         "rbac_denied": True,
        #         "reason": rbac_result.get("reason", "access_denied")
        #     }
        # # Sujal_Over

        user_input = getattr(data, "user_input", None) or user_query

        wants_table = detect_table_request(user_query)
        is_tabular = False

        project_id = getattr(data, "project_id", None) or "default"
        chat_id = _resolve_chat_id(project_id, user_email, getattr(data, "chat_id", None))

        if not user_query:
            return {"reply": random.choice(CONFUSION_RESPONSES), "chat_id": chat_id}

        # -------------------------
        # INPUT VALIDATION
        # -------------------------

        user_valid, user_err = validate_user_input(user_query)
        if not user_valid:
            return {"reply": user_err, "chat_id": chat_id}
        
        # # ========== 3.31 RISK DETECTION ==========
        # from validators import handle_risk
        # risk_action, risk_response, risk_assessment = handle_risk(
        #     user_input=user_input,
        #     user_email=user_email,
        #     user_role=user_role,
        #     project_id=project_id if project_id != "default" else None,  # convert "default" to None
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
        #         "chat_id": chat_id,
        #         "risk": risk_assessment,
        #     }
        
        # # ========== END RISK DETECTION ==========
        #     # ========== 3.31 RISK DETECTION (Updated) ========== 
        #     from validators1 import handle_risk_331
        #     risk_action, risk_response, risk_assessment = handle_risk_331(
        #         user_input=user_input,
        #         user_email=user_email,
        #         project_id=project_id if project_id != "default" else None,
        #         chat_id=chat_id,
        #     )

        #     if risk_action != "allow":
        #         save_chat_message(
        #             user_email=user_email,
        #             role="user",
        #             content=user_input,
        #             project_id=project_id,
        #             chat_id=chat_id
        #         )
        #         save_chat_message(
        #             user_email=user_email,
        #             role="assistant",
        #             content=risk_response,
        #             project_id=project_id,
        #             chat_id=chat_id
        #         )
        #         return {
        #             "reply": risk_response,
        #             "chat_id": chat_id,
        #             "risk": risk_assessment,
        #         }
        #     # ========== END RISK DETECTION ==========

        # 🆕 NEW: 3.31 Risk Detection
        # Build context for risk detection
        risk_context = {
            "user_role": user_role,
            "project_id": project_id,
            "chat_id": chat_id,
            # Note: tech_stack not relevant for common_chat (no project)
        }
        
        # Detect and handle risk
        is_safe, risk_response = detect_and_handle_risk(
            user_input=user_query,
            user_email=user_email,
            context=risk_context,
            supabase_client=supabase
        )
        
        # If risky, return immediately with risk message
        if not is_safe:
            # Save the refusal message
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

        greeting_response = handle_greetings(user_input, user_name)
        if greeting_response:
            save_chat_message(
                user_email=user_email,
                role="assistant",
                content=greeting_response,
                project_id=project_id,
                chat_id=chat_id
                )
            return {"reply": greeting_response, "chat_id": chat_id}

        # -------------------------
        # INTENT DETECTION
        # -------------------------

        # // KIRTAN START 05-03
        intent = detect_intent(user_query, user_email)
        # // KIRTAN STOP 05-03

        # if intent == "project_details" and project_id:
        #     parsed = {
        #         "operation": "select",
        #         "table": "projects",
        #         "fields": ["*"],
        #         "filters": {"id": project_id},
        #     }
        # elif intent == "all_projects":
        #     parsed = {
        #         "operation": "select",
        #         "table": "projects",
        #         "fields": ["*"],
        #         "filters": {},
        #     }
        #     raw_reply = query_supabase(
        #         parsed,
        #         user_email=user_email,
        #         user_role=user_role,
        #         project_id=project_id,
        #     )

        #     return {
        #         "reply": format_response(user_query, fallback=raw_reply),
        #         "intent": intent,
        #         "chat_id": chat_id,
        #     }

        # -------------------------
        # MEMORY + CONTEXT
        # -------------------------

        facts = extract_and_store_user_fact(user_email, user_query)
        doc_context = get_context(user_query)

        episodic = load_episodic_memory(
            user_email=user_email,
            project_id=project_id,
            chat_id=chat_id,
            limit=2,
        )

        conv_hist = load_chat_history(
            user_email, project_id, chat_id, limit=15
        ) or []

        # -------------------------
        # SYSTEM PROMPT BUILDING
        # -------------------------

        # Base system message
        system_message = (
    "You are a helpful AI assistant for our company.\n\n"
    f"Current user: {user_name} ({user_email}), Role: {user_role}.\n"
    f"Known facts: {facts if facts else 'None'}.\n"
)

        # Add episodic summaries
        if episodic:
            system_message += "\nPrevious conversation summaries:\n"
            system_message += "\n---\n".join(episodic) + "\n"

        # Add document context
        if doc_context:
            system_message += "\nRelevant documents:\n" + str(doc_context) + "\n"

        # Inject available database tables
        tables_json = json.dumps(
            {table: list(cols) for table, cols in TABLES.items()},
            indent=2
        )
        system_message += "\nAvailable database tables:\n" + tables_json + "\n"

        # Force JSON output if table requested
        if wants_table:
            system_message += """
        IMPORTANT:
        User requested output in table format.
        Return ONLY valid JSON.
        No markdown, no explanation, no HTML.
        JSON must be a list of objects (array of rows).
        Keep it short (max 50 rows).
        """

        # Final response instruction
        system_message += "Respond conversationally, clear, concise (3–4 line summaries)."

        # Final system prompt wrapper (matching old structure)
        system_prompt = (
            f"You are a helpful AI assistant for We3Vision.\n"
            f"User: {user_name} ({user_email}), Role: {user_role}.\n\n"
            f"{system_message}"
        )


        # -------------------- Normalize query with context --------------------
        active_model = get_user_llm_model(user_email)

        normalization_messages = [
            {
                "role": "system",
                "content": "Rewrite the user's latest query into a clear, standalone natural-language question based on the provided conversation history. Respond ONLY with the rewritten query.",
            },
            *conv_hist[-3:],
            {"role": "user", "content": user_query},
        ]

        normalized_query = call_openrouter(
            normalization_messages,
            model=active_model,
            temperature=0,
            max_tokens=100,
        ) or user_query

        messages = [
            {"role": "system", "content": system_prompt},
            *conv_hist,
            {"role": "user", "content": normalized_query},
        ]
        # SAVE USER MESSAGE EARLY
        user_msg_id = save_chat_message(
            user_email=user_email,
            role="user",
            content=user_query,
            project_id=project_id,
            chat_id=chat_id
        )

        # -------------------------
        # LLM CALL (Stream Support)
        # -------------------------
        print("STREAM FLAG VALUE:", stream)
        if stream and not wants_table:
            async def token_generator():
                stream_response = call_openrouter(
                    messages,
                    model=active_model,
                    temperature=0.6,
                    max_tokens=1200,
                    stream=True
                )   

                collected_reply = ""
                async for chunk in stream_response:
                    if chunk:
                        collected_reply += chunk
                        yield chunk
                
                # --- After streaming finishes: Process the final reply ---
                # Reuse the same logic as non-stream flow
                processed_reply, _ = _process_common_response(
                    collected_reply, user_query, normalized_query, user_email, project_id, chat_id, False, active_model
                )
                
                # Save assistant message
                assistant_msg_id = save_chat_message(
                    user_email=user_email,
                    role="assistant",
                    content=processed_reply,
                    project_id=project_id,
                    chat_id=chat_id
                )
                
                # Generate suggestions
                suggestions = generate_followup_suggestions(user_query, processed_reply, project_id, user_email=user_email)
                
                # Yield meta frame
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

        # Normal REST flow
        reply = call_openrouter(
            messages,
            model=active_model,
            temperature=0.6,
            max_tokens=1200
        ) or "No response."
        
        final_safe_reply, is_tabular = _process_common_response(
            reply, user_query, normalized_query, user_email, project_id, chat_id, wants_table, active_model
        )

        assistant_msg_id = save_chat_message(
            user_email=user_email,
            role="assistant",
            content=final_safe_reply,
            project_id=project_id,
            chat_id=chat_id
        )

        # Dynamic Follow-up Suggestions 
        suggestions = generate_followup_suggestions(user_query, final_safe_reply, project_id, user_email=user_email)
        
        return {
            "reply": format_response(user_query, fallback=final_safe_reply),
            "message_ids": {
                "assistant": assistant_msg_id
            },
            "chat_id": chat_id,
            "intent": intent,
            "is_tabular": is_tabular,
            "user": {
                "email": user_email,
                "name": user_name,
                "role": user_role,
            },
            "memory_facts": facts,
            "clarifications": suggestions,
            "multi_clarification": True if suggestions else False
        }

    except Exception as e:
        print("Chat error:", traceback.format_exc())
        return {
            "reply": "⚠ Something went wrong. Please try again.",
            "error": True
        }

def _process_common_response(
    reply, user_query, normalized_query, user_email, project_id, chat_id, wants_table, active_model
):
    # -------------------------
    # SAFETY LAYERS
    # -------------------------
    valid, safe_reply = validate_api_response(reply)
    if not valid:
        return safe_reply, False

    is_ethical, ethical_reply = enforce_ethical_rules(user_query, safe_reply)
    if not is_ethical:
        return ethical_reply, False

    if is_tech_related_query(user_query):
        if not validate_code_response(ethical_reply):
            ethical_reply = "⚠️ Unsafe code blocked."
        else:
            ethical_reply = process_tech_response(ethical_reply, user_query)

    final_safe_reply = sanitize_reply(
        f"{user_email}_{project_id}_{chat_id}",
        user_query,
        ethical_reply,
        chat_type="common",
    )

    if contains_confidential_info(final_safe_reply):
        final_safe_reply = "⚠️ Response contains confidential information."

    # -------------------- TABLE PARSING --------------------
    is_tabular = False
    if wants_table:
        parsed_json = safe_json_load(reply)

        # Retry if invalid JSON
        if not (
            isinstance(parsed_json, list)
            and parsed_json
            and isinstance(parsed_json[0], dict)
        ):
            retry_messages = [
                {
                    "role": "system",
                    "content": "Return ONLY valid JSON array of objects. No text."
                },
                {"role": "user", "content": normalized_query}
            ]

            retry_reply = call_openrouter(
                retry_messages,
                model=active_model,
                temperature=0,
                max_tokens=1200
            ) or ""

            parsed_json = safe_json_load(retry_reply)

        if (
            isinstance(parsed_json, list)
            and parsed_json
            and isinstance(parsed_json[0], dict)
        ):
            final_safe_reply = format_data_as_table(parsed_json, "general")
            is_tabular = True
        else:
            final_safe_reply = format_data_as_table(
                "⚠️ Could not generate table (invalid JSON from AI).",
                "general"
            )
            is_tabular = True

    return final_safe_reply, is_tabular