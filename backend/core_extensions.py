
# -----------------------------------------------------------------------------------------------
# core_extensions.py - Tanmey_Start: Self-Asking Extensions
# -----------------------------------------------------------------------------------------------
import json
from core import build_fact_memory_system_prompt, call_openrouter

def build_fact_memory_system_prompt_322(
    user_name: str,
    user_email: str,
    user_role: str,
    user_facts: dict | None,
    episodic_summaries: list | None,
    doc_context: str | None
) -> str:
    """
    Duplicate/Variant of build_fact_memory_system_prompt for specific usage patterns.
    """
    return build_fact_memory_system_prompt(
        user_name, user_email, user_role, user_facts, episodic_summaries, doc_context
    )

def handle_multi_question_self_asking(user_input: str, session_data: dict) -> str | None:
    """
    Placeholder for self-asking logic if you have specific implementation details.
    For now, returns None to allow standard flow.
    """
    # Implement specific logic here if needed
    return None

def generate_followup_suggestions(user_input: str, system_reply: str, project_id: str = None, user_email: str = None) -> list[str]:
    """
    Generate 1-3 short follow-up questions relevant to the conversation.
    """
    try:
        if not user_input or not system_reply:
             return []

        prompt = f"""
        Given the User input: "{user_input}"
        And system reply: "{system_reply}"
        
        Generate 3 short, helpful, concise follow-up questions the user might want to ask next.
        Return strictly a valid JSON array of strings. Example: ["Details?", "Who is leading?", "Timeline?"]
        """
        
        messages = [{"role": "user", "content": prompt}]
        # Use a faster/cheaper model if possible, or standard fallback
        response = call_openrouter(messages, temperature=0.7, max_tokens=150)
        
        if response:
            clean = response.strip()
            # Try to find JSON array brackets
            start = clean.find('[')
            end = clean.rfind(']')
            if start != -1 and end != -1:
                json_str = clean[start:end+1]
                suggestions = json.loads(json_str)
                if isinstance(suggestions, list):
                    return suggestions[:3]
    except Exception as e:
        print(f"Suggestion generation error: {e}")
    
    return []
