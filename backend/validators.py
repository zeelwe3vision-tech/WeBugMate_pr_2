"""
SAFETY VALIDATION LAYER - Task 3.26 Implementation
Implements content checking, unsafe text filtering, hallucination detection,
length control, HTML sanitization, confidence checks, and fail-safe switching.
"""

import re
import json
import html
from difflib import SequenceMatcher
import random

# ======================================================
# 3.26.1 CONTENT VALIDATION STRATEGY
# ======================================================

# UNSAFE WORDS (User + AI Output Check) - 3.26.2
UNSAFE_WORDS = [
    "fuck", "shit", "bitch", "asshole", "bastard", "motherfucker", "mf", "jerk",
    "retard", "idiot", "moron", "loser", "scumbag", "porn", "sex", "nude",
    "naked", "dick", "cock", "pussy", "vagina", "tits", "boobs", "slut", "whore",
    "rape", "rapist", "terrorist", "nazi", "pedophile", "racist", "kill", "murder",
    "stab", "shoot", "hang", "suicide", "cut myself", "self harm", "cutting",
    "bomb", "grenade", "explosive", "terror", "hijack", "kidnap", "abduct", "weapon", "gun"
]

# Confidential patterns that should get LOW accuracy
CONFIDENTIAL_PATTERNS = [
    "password", "passwd", "pwd", "secret", "token", "auth",
    "credential", "login", "ssh", "private key", "api key",
    "database password", "admin password", "root password"
]

SENSITIVE_CONCEPTS = [
    "auth", "authentication", "login", "ssh", "token", "api key"
]

SECRET_KEYWORDS = [
    "password", "passwd", "pwd", "private key",
    "database password", "admin password", "root password",
    "secret key"
]

SECRET_VALUE_PATTERNS = [
    r"sk-[a-zA-Z0-9]{20,}",           # OpenAI
    r"AKIA[0-9A-Z]{16}",              # AWS
    r"AIza[0-9A-Za-z-_]{35}",         # Google
    r"-----BEGIN PRIVATE KEY-----",
    r"[A-Za-z0-9+/]{32,}={0,2}",      # Base64-ish secrets
]


# ======================================================
# 3.26.5 HTML / CODE SANITIZATION
# ======================================================
DANGEROUS_HTML = [
    "<script", "</script", "javascript:", "onload=", "onclick=",
    "onerror=", "<iframe", "<object", "<embed"
]

def is_dangerous_html(text: str):
    """3.26.5: Check for dangerous HTML/script tags."""
    t = text.lower()
    for bad in DANGEROUS_HTML:
        if bad in t:
            return True
    return False

# ======================================================
# 3.26.3 HALLUCINATION DETECTION (Basic)
# ======================================================
HALLUCINATION_PATTERNS = [
    r"as an ai", r"i am an ai", r"language model",
    r"openai", r"chatgpt", r"my knowledge cutoff",
    r"i cannot assist", r"i cannot do that"
]

EMPTY_OUTPUTS = ["", " ", "null", "none", "undefined"]

# ======================================================
# 3.26.6 CONFIDENCE CHECK
# ======================================================
WEAK_TONE = ["maybe", "might", "possibly", "i think", "not sure", "probably", "i guess"]

# ======================================================
# 3.26.4 LENGTH & VERBOSITY CONTROL
# ======================================================
MIN_RESPONSE_LENGTH = 10  # Minimum characters for valid response
MAX_RESPONSE_LENGTH = 3500  # Maximum characters to prevent overly long responses

# ======================================================
# FALLBACK MESSAGES (3.26.7 Fail-Safe Switch)
# ======================================================
SAFE_FALLBACK_MESSAGES = [
    "I understand you're asking about something, but I need to ensure my response is accurate and safe.",
    "Let me provide you with a helpful response that meets our safety guidelines.",
    "I'd be happy to help with that in a way that ensures information security.",
    "For your safety and data security, I'll provide a general response to your query."
]

# ======================================================
# TECHNOLOGY-RELATED KEYWORDS
# ======================================================
TECH_KEYWORDS = [
    "code", "program", "script", "function", "class", "api", "endpoint",
    "html", "css", "javascript", "python", "flask", "django", "node", "express",
    "database", "sql", "backend", "frontend", "full stack", "tech stack",
    "implement", "build", "create", "develop", "write", "debug", "fix",
    "error", "bug", "issue", "exception", "traceback", "algorithm", "data structure",
    "framework", "library", "package", "module", "component", "service"
]

# ======================================================
# HACKING/UNETHICAL KEYWORDS WITH CONTEXT PATTERNS
# ======================================================
HACKING_KEYWORDS = {
    "hack": ["hack", "hacking", "hacker", "hacked"],
    "exploit": ["exploit", "exploiting", "exploitation"],
    "bypass": ["bypass", "bypassing", "circumvent"],
    "crack": ["crack", "cracking", "cracker"],
    "phishing": ["phishing", "phish", "spear phishing"],
    "sql injection": ["sql injection", "sql-injection", "sql-inject"],
    "ddos": ["ddos", "dos", "denial of service"],
    "malware": ["malware", "virus", "trojan", "worm", "ransomware"],
    "brute force": ["brute force", "bruteforce", "brute-force"],
    "unauthorized": ["unauthorized access", "unauthorized entry", "unauthorized login"]
}

# Instruction patterns that indicate someone is asking HOW to do something
# INSTRUCTION_PATTERNS = [
#     r"how (?:to|do|can) (?:i|we|you|one)",
#     r"steps? (?:to|for)",
#     r"ways? (?:to|of)",
#     r"method(?:s|ology)? (?:to|for)",
#     r"technique(?:s)? (?:to|for)",
#     r"procedure(?:s)? (?:to|for)",
#     r"process (?:to|for)",
#     r"guide (?:to|for)",
#     r"tutorial (?:on|for)",
#     r"learn (?:how|to)",
#     r"teach (?:me|us)",
#     r"show (?:me|us)",
#     r"explain (?:how|to)",
#     r"demonstrate (?:how|to)"
# ]

# Prevention/defense keywords - if these are present, it's likely educational
PREVENTION_KEYWORDS = [
    "prevent", "protect", "secure", "defend", "guard", "safeguard",
    "avoid", "stop", "block", "detect", "mitigate", "counter",
    "security", "safety", "ethical", "legal", "authorized", "permission",
    "defense", "protection", "against", "from", "safe", "legitimate"
]

# ======================================================
# MAIN VALIDATION FUNCTIONS
# ======================================================

def validate_user_input(user_text: str):
    """
    3.26.1 & 3.26.2: Validate user input for unsafe content.
    Returns (is_valid, error_message or None)
    """
    if not user_text:
        return False, "Empty input provided."
    
    cleaned = user_text.lower()
    
    # Check for unsafe words - only block if they appear as standalone words
    for bad in UNSAFE_WORDS:
        # Use regex to match whole words only (not substrings)
        pattern = r'\b' + re.escape(bad) + r'\b'
        if re.search(pattern, cleaned):
            return False, f"⚠ This question contains unsafe or harmful content ('{bad}'). Please rephrase your question appropriately."
    
    if is_dangerous_html(cleaned):
        return False, "⚠ Your input contains unsafe HTML or script tags."
    
    for pattern in HALLUCINATION_PATTERNS:
        if re.search(pattern, cleaned):
            return False, "⚠ Your input contains unreliable or misleading phrases. Please rephrase."
        
    for w in WEAK_TONE:
        if re.search(rf"\b{w}\b", cleaned):
            return False, "⚠ Please avoid uncertain or weak language in your input."

    for bad in CONFIDENTIAL_PATTERNS:
        if bad in cleaned:
            return False, "⚠ Please avoid asking confidential or sensitive information in your input."

    # for pattern in INSTRUCTION_PATTERNS:
    #     if re.search(pattern, cleaned):
    #         return False, "⚠ Please avoid asking for instructions on potentially harmful activities."
        
    for keyword in HACKING_KEYWORDS.get("hack", []):
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, cleaned):
            return False, "⚠ Questions related to hacking or unauthorized access are not allowed."
        
    for keyword in PREVENTION_KEYWORDS:
        if keyword in cleaned:
            return False, "⚠ Please avoid asking for information related to security breaches or exploits."
    
    for discriminatory_term in ["hate", "racist", "sexist", "homophobic", "transphobic", "discriminate"]:
        if discriminatory_term in cleaned:
            return False, "⚠ Discriminatory or hateful content is not allowed."
        
    for harmful_intent in ["how to kill", "how to murder", "how to hurt", "make a bomb", "build a weapon", "how to commit suicide"]:
        if harmful_intent in cleaned:
            return False, "⚠ Content promoting harm or violence is not allowed."

    return True, None

def validate_api_response(text: str):
    """
    3.26.7: Validate AI response for safety and quality.
    Returns (is_valid, response_text or error_message)
    """
    if text is None:
        return False, "⚠ Empty response from AI."
    
    cleaned = text.strip().lower() 
    print("DEBUG RESPONSE LENGTH:", len(text))

    
    # # 3.26.3: Check for empty outputs
    # if cleaned in EMPTY_OUTPUTS or len(cleaned) < MIN_RESPONSE_LENGTH:
    #     return False, "⚠ AI response seems incomplete."
    
    # 3.26.2: Check for unsafe words in AI response
    for word in UNSAFE_WORDS:
        pattern = r'\b' + re.escape(word) + r'\b'
        if re.search(pattern, cleaned):
            return False, "⚠ Unsafe content blocked from AI response."
    
    # 3.26.5: Check for dangerous HTML
    if is_dangerous_html(cleaned):
        return False, "⚠ Dangerous HTML/script detected from AI."
    
    # 3.26.3: Check for hallucination patterns - ONLY FOR EMPTY/NONSENSE RESPONSES
    for pattern in HALLUCINATION_PATTERNS:
        if re.search(pattern, cleaned):
            return False, "⚠ Unreliable AI response detected."
    
    # Check for broken JSON
    if text.count("{") != text.count("}") or text.count("[") != text.count("]"):
        if "{" in text and "}" in text and text.count("{") > 1:  # Only for complex JSON
            return False, "⚠ AI returned broken JSON format."
    
    # 3.26.6: Remove weak tone words but don't fail
    cleaned_text = text
    for w in WEAK_TONE:
        cleaned_text = re.sub(rf"\b{w}\b", "", cleaned_text, flags=re.IGNORECASE)
    
    # 3.26.4: Length control
    if len(text) > MAX_RESPONSE_LENGTH:
        text = text[:MAX_RESPONSE_LENGTH] + "\n\n⚠ Response trimmed for safety."

    return True, cleaned_text

def sanitize_reply(session_key: str, user_input: str, reply_text: str, chat_type: str = "work"):
    """
    3.26.7: Main sanitizer with fail-safe switch.
    Applies all validation layers and returns safe response.
    """
    # First validate user input
    user_valid, user_err = validate_user_input(user_input)
    if not user_valid:
        return user_err
    
    # Validate API response
    api_valid, api_response = validate_api_response(reply_text)
    if not api_valid:
        return api_response
    
    # Apply additional safety checks based on chat type
    if chat_type in ["work", "dual", "common"]:
        # Check for confidential information in project chats
        if contains_confidential_info(api_response):
            return random.choice(SAFE_FALLBACK_MESSAGES)
    
    # Remove any remaining HTML tags for safety
    final_response = re.sub(r'<[^>]+>', '', api_response)
    
    return final_response

def normalize_query(q: str):
    """Normalize query for processing."""
    if not q:
        return "empty"
    q = q.strip().replace("\n", " ").replace("\t", " ")
    return " ".join(q.split())

# ======================================================
# ADDITIONAL SAFETY FUNCTIONS
# ======================================================

# def contains_confidential_info(text: str) -> bool:
#     """Check if response contains confidential patterns."""
#     text_lower = text.lower()
#     for pattern in CONFIDENTIAL_PATTERNS:
#         if pattern in text_lower:
#             return True
#     return False

def contains_confidential_info(text: str) -> bool:
    text_lower = text.lower()

    # Step 1: must mention real secret concept
    keyword_hit = any(k in text_lower for k in SECRET_KEYWORDS)
    if not keyword_hit:
        return False

    # Step 2: must look like an actual secret
    for pattern in SECRET_VALUE_PATTERNS:
        if re.search(pattern, text):
            return True

    return False

def get_response_metrics(text: str):
    """Get metrics about response for logging."""
    word_count = len(text.split())

    if word_count < 100:
        category = "short"
    elif word_count <= 300:
        category = "medium"
    else:
        category = "long"

    return word_count, category

# ======================================================
# DYNAMIC ETHICAL RULE CHECKING
# ======================================================

def _contains_hacking_keyword(text: str) -> tuple:
    """Check if text contains hacking-related keywords and return details."""
    text_lower = text.lower()
    
    for category, keywords in HACKING_KEYWORDS.items():
        for keyword in keywords:
            # Use word boundaries to avoid false positives
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, text_lower):
                return True, category, keyword
    return False, None, None

def _is_instruction_query(text: str) -> bool:
    """Check if the query is asking for instructions/methods."""
    text_lower = text.lower()
    
    # # Check for instruction patterns
    # for pattern in INSTRUCTION_PATTERNS:
    #     if re.search(pattern, text_lower):
    #         return True
    
    # Also check for common instruction words without specific patterns
    instruction_words = ["steps", "ways", "method", "technique", "procedure", "process", "guide", "tutorial"]
    for word in instruction_words:
        if word in text_lower:
            return True
    
    return False

def _has_prevention_context(text: str) -> bool:
    """Check if the query has prevention/defense context."""
    text_lower = text.lower()
    
    # Check for prevention keywords
    for keyword in PREVENTION_KEYWORDS:
        if keyword in text_lower:
            return True
    
    # Check for educational/defensive phrases
    defensive_phrases = [
        "how to prevent", "how to protect", "how to secure",
        "defense against", "protection from", "security measures",
        "ethical hacking", "authorized testing", "with permission"
    ]
    
    for phrase in defensive_phrases:
        if phrase in text_lower:
            return True
    
    return False

def enforce_ethical_rules(user_input: str, response: str) -> tuple:
    """
    Enforce ethical rules on responses with dynamic detection.
    Returns (is_ethical, response_or_error)
    """
    user_input_lower = user_input.lower()
    response_lower = response.lower()
    
    # Step 1: Check if query contains hacking keywords
    has_hacking, category, keyword = _contains_hacking_keyword(user_input)
    
    if has_hacking:
        # Step 2: Check if it's asking for instructions
        is_instruction = _is_instruction_query(user_input)
        
        # Step 3: Check if it has prevention context (educational/defensive)
        has_prevention = _has_prevention_context(user_input)
        
        # Step 4: Determine if it's unethical
        if is_instruction and not has_prevention:
            # This is asking HOW TO do hacking without defensive context
            return False, "⚠ Content related to hacking or security exploits is not allowed."
    
    # Check for other unethical content
    
    # Personal data leakage in response
    personal_data_patterns = [
        r'\b\d{16}\b',  # Credit card numbers
        r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
        r'\b\d{10}\b',  # Phone numbers
    ]
    
    for pattern in personal_data_patterns:
        if re.search(pattern, response):
            return False, "⚠ Response contains potentially sensitive personal data. Redacted for privacy."
    
    # Direct harmful intent in user input (not educational)
    harmful_intents = [
        "how to kill", "how to murder", "how to hurt", "how to harm",
        "make a bomb", "build a weapon", "how to commit suicide",
        "how to make poison", "how to attack", "how to injure"
    ]
    
    for intent in harmful_intents:
        if intent in user_input_lower and "prevent" not in user_input_lower:
            return False, "⚠ Content promoting harm or violence is not allowed."
    
    # Non-discrimination check
    discriminatory_terms = [
        "hate", "racist", "sexist", "homophobic", "transphobic", "discriminate"
    ]
    
    for term in discriminatory_terms:
        if term in user_input_lower or term in response_lower:
            # Allow if it's educational context
            if not any(ctx in user_input_lower for ctx in ["about", "discuss", "explain", "understand"]):
                return False, "⚠ Discriminatory or hateful content is not allowed."
    
    # Add disclaimer for uncertain responses (but don't block)
    if "i don't know" in response_lower or "i'm not sure" in response_lower:
        response = response + "\n\n⚠ **Note**: This information may not be fully accurate. Please verify with reliable sources."
    
    return True, response

# ======================================================
# CODE GENERATION SAFETY FUNCTIONS
# ======================================================

def enhance_code_generation_prompt(user_input: str) -> str:
    """Enhance code generation prompts with safety guidelines."""
    q = user_input.lower().strip()
    
    enhancement = """
IMPORTANT CODE GENERATION GUIDELINES:
1. Always provide secure, ethical code
2. Do not generate code for hacking, cracking, or unauthorized access
3. Include proper error handling
4. Add security considerations
5. Follow language-specific best practices
"""
    
    # Add language-specific guidelines
    if "python" in q or "py " in q:
        enhancement += "\nPYTHON SECURITY GUIDELINES:\n- Avoid eval() and exec()\n- Use parameterized queries for databases\n- Validate all inputs\n"
    elif "javascript" in q or "js " in q or "node" in q:
        enhancement += "\nJAVASCRIPT SECURITY GUIDELINES:\n- Avoid innerHTML with user input\n- Use Content Security Policy\n- Sanitize user inputs\n"
    elif "sql" in q or "database" in q:
        enhancement += "\nSQL SECURITY GUIDELINES:\n- Always use parameterized queries\n- Implement proper access controls\n- Avoid dynamic SQL generation\n"
    
    return enhancement

def validate_code_response(code_text: str) -> bool:
    """Validate that code response is safe and appropriate."""
    if not code_text:
        return False
    
    # Check for dangerous patterns in code - ONLY BLOCK EXPLICITLY DANGEROUS CODE
    dangerous_patterns = [
        "eval(\"", "exec(\"", "system(\"", "subprocess.call(\"",
        "shell=True", "document.write(", "DROP TABLE", "DELETE FROM"
    ]
    
    code_lower = code_text.lower()
    for pattern in dangerous_patterns:
        if pattern in code_lower:
            # Check if it's in a comment or string literal
            lines = code_text.split('\n')
            for line in lines:
                if pattern in line.lower():
                    # Check if it's in a comment
                    if line.strip().startswith('#') or line.strip().startswith('//'):
                        continue
                    # Check if it's in a string
                    if '"' + pattern + '"' in line or "'" + pattern + "'" in line:
                        continue
                    return False
    
    return True

def format_code_response(code_text: str, language: str = "python") -> str:
    """Format code response safely."""
    if not code_text:
        return code_text
    
    # Remove dangerous characters
    code_text = re.sub(r'[^\x20-\x7E\n\t]', '', code_text)
    
    # Add language-specific formatting
    if language == "python":
        if not code_text.startswith("```python"):
            code_text = f"```python\n{code_text}\n```"
    elif language in ["javascript", "js"]:
        if not code_text.startswith("```javascript"):
            code_text = f"```javascript\n{code_text}\n```"
    elif language == "sql":
        if not code_text.startswith("```sql"):
            code_text = f"```sql\n{code_text}\n```"
    elif language in ["html", "css"]:
        if not code_text.startswith("```html"):
            code_text = f"```html\n{code_text}\n```"
    else:
        if not code_text.startswith("```"):
            code_text = f"```\n{code_text}\n```"
    
    return code_text

# ======================================================
# TECH-RELATED QUERY DETECTION
# ======================================================

def is_tech_related_query(query: str) -> bool:
    """Check if query is technology/coding related."""
    if not query:
        return False
    
    q = query.lower()
    return any(keyword in q for keyword in TECH_KEYWORDS)

# ======================================================
# COMPREHENSIVE RESPONSE HANDLER
# ======================================================

def handle_response_by_intent(user_input: str, reply: str, project_data: list = None, debug: bool = False) -> tuple:
    """
    Main function to handle responses based on intent detection.
    Returns (response_text, validation_info_dict, intent)
    """
    # First validate user input
    user_valid, user_err = validate_user_input(user_input)
    if not user_valid:
        return user_err, {"status": "invalid_input"}, "invalid"

    # Validate AI response
    api_valid, api_response = validate_api_response(reply)
    if not api_valid:
        return api_response, {"status": "invalid_response"}, "invalid"

    # Apply ethical rules
    is_ethical, ethical_response = enforce_ethical_rules(user_input, api_response)
    if not is_ethical:
        return ethical_response, {"status": "ethical_violation"}, "unethical"

    return ethical_response, {"status": "safe"}, "safe"

# ======================================================
# RESPONSE PROCESSING FUNCTIONS
# ======================================================

def process_tech_response(response: str, user_input: str) -> str:
    """
    Process and enhance technical/code responses.
    """
    if not response:
        return response
    
    q = user_input.lower().strip()
    
    if "python" in q or "py " in q:
        response = format_code_response(response, "python")
    elif "javascript" in q or "js " in q:
        response = format_code_response(response, "javascript")
    elif "sql" in q:
        response = format_code_response(response, "sql")
    elif "html" in q or "css" in q:
        response = format_code_response(response, "html")
    
    return response


# ======================================================
# =============== 3.31 RISK DETECTION LAYER ============
# ======================================================
"""
Task 3.31: Behavioral Risk Control Layer
This is NOT content moderation (3.26).
This is BEHAVIORAL risk detection - detecting dangerous ACTIONS/REQUESTS.

Core Logic Pipeline:
INPUT → Intent Detection → Risk Classification → Severity Decision → Response Override → Log Event

Risk Categories:
1. PII Risk (Medium/High) - Clarify or Refuse
2. Destructive Risk (HIGH) - Immediate Fallback
3. Privilege Escalation (HIGH) - Immediate Fallback  
4. Prompt Injection (Medium) - Clarify/Override
5. Technology Stack Mismatch (Medium) - Ask Confirmation

System flows:
User Input → 3.26 (Content Safety) → 3.31 (Behavioral Risk) → RBAC → Execution
"""

# ======================================================
# 3.31.1 RISK PATTERN DEFINITIONS
# ======================================================

# 🔴 DESTRUCTIVE RISK PATTERNS (HIGH RISK - IMMEDIATE BLOCK)
DESTRUCTIVE_PATTERNS = {
    "delete_all": [
        r"\bdelete\s+(all|everything|entire)",
        r"\bremove\s+(all|everything|entire)",
        r"\bclear\s+(all|everything|entire)",
        r"\bwipe\s+(all|everything|entire)",
        r"\berase\s+(all|everything)",
    ],
    "drop_database": [
        r"\bdrop\s+(table|database|schema)",
        r"\btruncate\s+table",
        r"\bdelete\s+from\s+\w+\s+(where\s+)?.*",
    ],
    "permanent_deletion": [
        r"\bpermanently\s+delete",
        r"\bdelete\s+permanently",
        r"\birreversible",
        r"\bno\s+backup",
    ],
    "bulk_destruction": [
        r"\bdelete\s+\d+\s+(projects|users|records)",
        r"\bremove\s+\d+\s+(projects|users|records)",
        r"\bbulk\s+delete",
        r"\bmass\s+delete",
    ],
}

# 🔴 PRIVILEGE ESCALATION PATTERNS (HIGH RISK - IMMEDIATE BLOCK)
PRIVILEGE_ESCALATION_PATTERNS = {
    "role_change": [
        r"\bgive\s+me\s+(admin|hr|manager)\s+(access|role|permission)",
        r"\bchange\s+my\s+role\s+to\s+(admin|hr|manager)",
        r"\bmake\s+me\s+(an?\s+)?(admin|hr|manager)",
        r"\bpromote\s+me\s+to\s+(admin|hr|manager)",
        r"\belevate\s+(my\s+)?(privilege|permission|access)",
    ],
    "bypass_rbac": [
        r"\bbypass\s+(role|permission|access\s+control|rbac)",
        r"\bignore\s+(role|permission|access\s+control)",
        r"\boverride\s+(role|permission|access\s+control)",
        r"\bcircumvent\s+(security|access\s+control)",
    ],
    "unauthorized_access": [
        r"\baccess\s+(other\s+)?(user|employee|admin).*?(data|project|file)",
        r"\bview\s+all\s+(user|employee)\s+(salaries|data|information)",
        r"\bshow\s+all\s+(passwords|credentials|secrets)",
        r"\blist\s+all\s+(user|admin)\s+(passwords|credentials)",
    ],
}

# 🟡 PII RISK PATTERNS (MEDIUM/HIGH RISK - CLARIFY OR REFUSE)
PII_RISK_PATTERNS = {
    "salary_exposure": [
        r"\bsalary\s+of\s+\w+",
        r"\bhow\s+much\s+does\s+\w+\s+earn",
        r"\bpay\s+scale",
        r"\bcompensation\s+details",
        r"\ball\s+(employee\s+)?salaries",
    ],
    "personal_info_request": [
        r"\bphone\s+number\s+of",
        r"\bemail\s+(address\s+)?of\s+\w+",
        r"\baddress\s+of\s+\w+",
        r"\bpersonal\s+(info|information|details)\s+of",
        r"\bcontact\s+(info|information|details)\s+of",
    ],
    "credential_exposure": [
        r"\bpassword\s+for",
        r"\bcredentials\s+for",
        r"\bapi\s+key\s+for",
        r"\btoken\s+for",
        r"\baccess\s+key",
    ],
}

# 🟡 PROMPT INJECTION PATTERNS (MEDIUM RISK - OVERRIDE)
PROMPT_INJECTION_PATTERNS = {
    "system_override": [
        r"\bignore\s+(previous|all|your)\s+(instructions|rules|prompts)",
        r"\bforget\s+(everything|all|previous)",
        r"\bdisregard\s+(your|all|previous)",
        r"\boverride\s+(system|your)\s+(prompt|instructions)",
    ],
    "role_manipulation": [
        r"\byou\s+are\s+now\s+(a\s+)?\w+",
        r"\bact\s+as\s+(a\s+)?\w+",
        r"\bpretend\s+to\s+be",
        r"\bfrom\s+now\s+on,?\s+you",
    ],
    "secret_extraction": [
        r"\bshow\s+(me\s+)?(your\s+)?(system\s+)?prompt",
        r"\breveal\s+(your\s+)?(system\s+)?prompt",
        r"\bwhat\s+(are\s+)?your\s+instructions",
        r"\bshow\s+(me\s+)?your\s+(internal\s+)?rules",
    ],
}

# 🟡 TECHNOLOGY STACK MISMATCH (MEDIUM RISK - ASK CONFIRMATION)
# This is context-aware and checked against project tech stack
TECHNOLOGY_KEYWORDS = {
    "java": ["java", "spring boot", "spring", "maven", "gradle", "jvm"],
    "dotnet": [".net", "c#", "csharp", "asp.net", "blazor"],
    "php": ["php", "laravel", "symfony", "wordpress"],
    "ruby": ["ruby", "rails", "ruby on rails"],
    "go": ["golang", "go lang", "go "],
    "rust": ["rust", "cargo"],
    "swift": ["swift", "swiftui"],
    "kotlin": ["kotlin", "android kotlin"],
    "scala": ["scala", "akka"],
}


# ======================================================
# 3.31.2 RISK CLASSIFICATION ENGINE
# ======================================================

# def detect_risk_category(user_input: str, context: dict = None) -> dict:
#     """
#     Detect risk category and severity for a user query.
    
#     Args:
#         user_input: User's query text
#         context: Optional context containing:
#             - user_role: User's role (admin/employee/hr)
#             - project_id: Current project
#             - tech_stack: Project's technology stack
            
#     Returns:
#         dict: {
#             "category": str,  # Risk category name
#             "severity": str,  # "low", "medium", "high"
#             "matched_pattern": str,  # What pattern triggered
#             "action": str,  # "allow", "confirm", "refuse"
#             "message": str  # User-facing message
#         }
#     """
#     if not user_input:
#         return {"category": "none", "severity": "low", "action": "allow"}
    
#     query = user_input.lower().strip()
#     context = context or {}
#     user_role = context.get("user_role", "employee").lower()
    
#     # 🔴 PRIORITY 1: DESTRUCTIVE RISK (IMMEDIATE BLOCK)
#     for pattern_name, patterns in DESTRUCTIVE_PATTERNS.items():
#         for pattern in patterns:
#             if re.search(pattern, query, re.IGNORECASE):
#                 return {
#                     "category": "destructive",
#                     "severity": "high",
#                     "matched_pattern": pattern_name,
#                     "action": "refuse",
#                     "message": "⚠ This action involves permanent deletion and cannot be executed. For data safety, destructive operations require manual administrative approval."
#                 }
    
#     # 🔴 PRIORITY 2: PRIVILEGE ESCALATION (IMMEDIATE BLOCK)
#     for pattern_name, patterns in PRIVILEGE_ESCALATION_PATTERNS.items():
#         for pattern in patterns:
#             if re.search(pattern, query, re.IGNORECASE):
#                 return {
#                     "category": "privilege_escalation",
#                     "severity": "high",
#                     "matched_pattern": pattern_name,
#                     "action": "refuse",
#                     "message": "⚠ Access control modifications require administrative approval. Your current permissions do not allow role or privilege changes."
#                 }
    
#     # 🟡 PRIORITY 3: PII RISK (CONTEXT-AWARE)
#     for pattern_name, patterns in PII_RISK_PATTERNS.items():
#         for pattern in patterns:
#             if re.search(pattern, query, re.IGNORECASE):
#                 # Allow if admin/hr requesting aggregated data
#                 if user_role in ["admin", "hr"] and "all" not in query:
#                     continue
                    
#                 return {
#                     "category": "pii_risk",
#                     "severity": "high" if user_role == "employee" else "medium",
#                     "matched_pattern": pattern_name,
#                     "action": "refuse" if user_role == "employee" else "confirm",
#                     "message": "⚠ This request involves personally identifiable information (PII). Access to such data is restricted based on your role." if user_role == "employee" else "⚠ This request involves PII. Please confirm you have authorization to access this information."
#                 }
    
#     # 🟡 PRIORITY 4: PROMPT INJECTION (OVERRIDE)
#     for pattern_name, patterns in PROMPT_INJECTION_PATTERNS.items():
#         for pattern in patterns:
#             if re.search(pattern, query, re.IGNORECASE):
#                 return {
#                     "category": "prompt_injection",
#                     "severity": "medium",
#                     "matched_pattern": pattern_name,
#                     "action": "refuse",
#                     "message": "⚠ I cannot modify my core instructions or reveal system prompts. How can I help you with legitimate work tasks?"
#                 }
    
#     # # 🟡 PRIORITY 5: TECHNOLOGY STACK MISMATCH (CONTEXT-AWARE)
#     # tech_stack = context.get("tech_stack", [])
#     # if tech_stack and isinstance(tech_stack, list):
#     #     # Convert tech stack to lowercase for comparison
#     #     tech_stack_lower = [t.lower() for t in tech_stack]
        
#     #     # Check if query mentions technology not in stack
#     #     for tech_name, tech_keywords in TECHNOLOGY_KEYWORDS.items():
#     #         for keyword in tech_keywords:
#     #             if keyword in query:
#     #                 # Check if this tech is in the project stack
#     #                 is_in_stack = any(stack_item in keyword or keyword in stack_item 
#     #                                  for stack_item in tech_stack_lower)
                    
#     #                 if not is_in_stack:
#     #                     # Get the actual tech mentioned
#     #                     tech_mentioned = tech_name.upper()
#     #                     stack_list = ", ".join(tech_stack)
                        
#     #                     return {
#     #                         "category": "tech_stack_mismatch",
#     #                         "severity": "medium",
#     #                         "matched_pattern": f"technology_{tech_name}",
#     #                         "action": "confirm",
#     #                         "message": f"⚠ **Technology Stack Mismatch Detected**\n\nYou requested help with **{tech_mentioned}**, which is not part of the current project's technology stack.\n\n**Current project stack:** {stack_list}\n\nThis may not be compatible with your project architecture. Do you want to continue?"
#     #                     }

#     # 🟡 PRIORITY 5: TECHNOLOGY STACK MISMATCH (CONTEXT-AWARE)

#     tech_stack = context.get("tech_stack", [])

#     if tech_stack and isinstance(tech_stack, list):
#         query_lower = query.lower()
#         tech_stack_lower = [t.lower() for t in tech_stack]

#         for tech_name, tech_keywords in TECHNOLOGY_KEYWORDS.items():
#             for keyword in tech_keywords:
#                 if keyword in query_lower:
#                     # 🔥 Exact logic from your original function
#                     if not any(keyword in stack_item or stack_item in keyword 
#                             for stack_item in tech_stack_lower):

#                         stack_list = ", ".join(tech_stack)

#                         return {
#                             "category": "tech_stack_mismatch",
#                             "severity": "medium",
#                             "matched_pattern": f"technology_{tech_name}",
#                             "action": "confirm",
#                             "message": (
#                                 f"⚠ **Technology Stack Mismatch Detected**\n\n"
#                                 f"You requested help with **{tech_name.upper()}**, "
#                                 f"which is not part of the current project's technology stack.\n\n"
#                                 f"**Current project stack:** {stack_list}\n\n"
#                             )
#                         }

#     # ✅ NO RISK DETECTED
#     return {
#         "category": "none",
#         "severity": "low",
#         "matched_pattern": "none",
#         "action": "allow",
#         "message": ""
#     }

def detect_risk_category(user_input: str, context: dict = None) -> dict:
    """
    Detect risk category and severity for a user query.
    
    ✅ RBAC-ENHANCED: Checks user role FIRST, then applies role-based risk detection
    - Admin & Manager: Full chatbot access, fewer restrictions
    - Employee: More restricted access, more safety checks
    
    Args:
        user_input: User's query text
        context: Optional context containing:
            - user_role: User's role (admin/manager/employee)
            - project_id: Current project
            - tech_stack: Project's technology stack
            
    Returns:
        dict: {
            "category": str,  # Risk category name
            "severity": str,  # "low", "medium", "high"
            "matched_pattern": str,  # What pattern triggered
            "action": str,  # "allow", "confirm", "refuse"
            "message": str  # User-facing message
        }
    """
    if not user_input:
        return {"category": "none", "severity": "low", "action": "allow", "message": ""}
    
    query = user_input.lower().strip()
    context = context or {}
    user_role = context.get("user_role", "employee").lower().strip()
    
    # ======================================================
    # 🔐 RBAC LAYER - CHECK ROLE FIRST (Before risk detection)
    # ======================================================
    
    # Normalize role (handle variations)
    if user_role in ["project manager", "projectmanager", "project_manager"]:
        user_role = "employee"  # PM treated same as Employee for risk
    
    # Define role privileges (matching core.py RBAC logic)
    is_admin = user_role == "admin"
    is_manager = user_role == "manager"
    is_hr = user_role == "hr"
    is_privileged = is_admin or is_manager or is_hr  # Full access roles
    is_employee = user_role in ["employee", "other"]
    
    print(f"🔐 RBAC Risk Check: role={user_role}, privileged={is_privileged}")
    
    # ======================================================
    # 🔴 PRIORITY 1: DESTRUCTIVE RISK
    # Admin/Manager: Confirmation only
    # Employee: Block immediately
    # ======================================================
    
    for pattern_name, patterns in DESTRUCTIVE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, query, re.IGNORECASE):
                if is_privileged:
                    # Admin/Manager: Allow with confirmation
                    print(f"   ⚠ {user_role.title()} - Destructive operation needs confirmation")
                    return {
                        "category": "destructive",
                        "severity": "medium",
                        "matched_pattern": pattern_name,
                        "action": "confirm",
                        "message": (
                            f"⚠ **Destructive Operation Detected**\n\n"
                            f"As {user_role.title()}, you have permission for this operation.\n\n"
                            f"⚠ **WARNING:** This involves permanent deletion.\n\n"
                            f"Please confirm to proceed."
                        )
                    }
                else:
                    # Employee: Block
                    print(f"   ❌ {user_role.title()} - Destructive operation blocked")
                    return {
                        "category": "destructive",
                        "severity": "high",
                        "matched_pattern": pattern_name,
                        "action": "refuse",
                        "message": (
                            "⚠ **Access Denied**\n\n"
                            "This action involves permanent deletion and requires administrative privileges.\n\n"
                            "Your role (Employee) does not have permission for destructive operations.\n\n"
                            "Please contact your Manager or Admin."
                        )
                    }
    
    # ======================================================
    # 🔴 PRIORITY 2: PRIVILEGE ESCALATION
    # Admin/Manager: Allow (they can modify permissions)
    # Employee: Block
    # ======================================================
    
    for pattern_name, patterns in PRIVILEGE_ESCALATION_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, query, re.IGNORECASE):
                if is_privileged:
                    # Admin/Manager: Allow
                    print(f"   ✅ {user_role.title()} - Privilege operation allowed")
                    continue  # Skip check for privileged users
                else:
                    # Employee: Block
                    print(f"   ❌ {user_role.title()} - Privilege escalation blocked")
                    return {
                        "category": "privilege_escalation",
                        "severity": "high",
                        "matched_pattern": pattern_name,
                        "action": "refuse",
                        "message": (
                            "⚠ **Access Denied**\n\n"
                            "Access control modifications require administrative privileges.\n\n"
                            "Your role (Employee) does not have permission to modify permissions or roles.\n\n"
                            "Please contact your Manager or Admin."
                        )
                    }
    
    # ======================================================
    # 🟡 PRIORITY 3: PII RISK (CONTEXT-AWARE)
    # Admin/HR: Full access
    # Manager: Confirmation for bulk data
    # Employee: Restricted
    # ======================================================
    
    for pattern_name, patterns in PII_RISK_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, query, re.IGNORECASE):
                if is_admin or is_hr:
                    # Admin/HR: Full PII access
                    print(f"   ✅ {user_role.title()} - PII access allowed")
                    continue
                
                elif is_manager:
                    # Manager: Confirmation for bulk requests
                    if "all" in query or "everyone" in query:
                        print(f"   ⚠ {user_role.title()} - PII bulk access needs confirmation")
                        return {
                            "category": "pii_risk",
                            "severity": "medium",
                            "matched_pattern": pattern_name,
                            "action": "confirm",
                            "message": (
                                f"⚠ **PII Access Confirmation**\n\n"
                                f"As Manager, you have access to PII data.\n\n"
                                f"This request involves personally identifiable information.\n\n"
                                f"Please confirm you have authorization."
                            )
                        }
                    else:
                        # Manager specific PII: allow
                        continue
                
                else:
                    # Employee: Block PII
                    print(f"   ❌ {user_role.title()} - PII access blocked")
                    return {
                        "category": "pii_risk",
                        "severity": "high",
                        "matched_pattern": pattern_name,
                        "action": "refuse",
                        "message": (
                            "⚠ **Access Denied**\n\n"
                            "This request involves personally identifiable information (PII).\n\n"
                            "Your role (Employee) does not have permission to access PII data.\n\n"
                            "Please contact your Manager or HR."
                        )
                    }
    
    # ======================================================
    # 🟡 PRIORITY 4: PROMPT INJECTION (OVERRIDE)
    # Block for ALL roles (security)
    # ======================================================
    
    for pattern_name, patterns in PROMPT_INJECTION_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, query, re.IGNORECASE):
                print(f"   ❌ Prompt injection blocked for all roles")
                return {
                    "category": "prompt_injection",
                    "severity": "high",
                    "matched_pattern": pattern_name,
                    "action": "refuse",
                    "message": (
                        "⚠ **Invalid Request**\n\n"
                        "I cannot modify my core instructions or reveal system prompts.\n\n"
                        "This restriction applies to all users for security.\n\n"
                        "How can I help you with legitimate work tasks?"
                    )
                }
    
    # ======================================================
    # 🟡 PRIORITY 5: TECHNOLOGY STACK MISMATCH (CONTEXT-AWARE)
    # Admin/Manager: Allow cross-stack work
    # Employee: Warn about mismatch
    # ======================================================
    
    tech_stack = context.get("tech_stack", [])
    
    if tech_stack and isinstance(tech_stack, list):
        query_lower = query.lower()
        tech_stack_lower = [t.lower() for t in tech_stack]
        
        for tech_name, tech_keywords in TECHNOLOGY_KEYWORDS.items():
            for keyword in tech_keywords:
                if keyword in query_lower:
                    if not any(keyword in stack_item or stack_item in keyword 
                            for stack_item in tech_stack_lower):
                        
                        if is_privileged:
                            # Admin/Manager: Allow
                            print(f"   ✅ {user_role.title()} - Tech mismatch allowed")
                            continue
                        
                        else:
                            # Employee: Warn
                            print(f"   ⚠ {user_role.title()} - Tech mismatch warning")
                            stack_list = ", ".join(tech_stack)
                            return {
                                "category": "tech_stack_mismatch",
                                "severity": "medium",
                                "matched_pattern": f"technology_{tech_name}",
                                "action": "confirm",
                                "message": (
                                    f"⚠ **Technology Stack Mismatch**\n\n"
                                    f"You requested help with **{tech_name.upper()}**, "
                                    f"which is not part of the current project's technology stack.\n\n"
                                    f"**Current project stack:** {stack_list}\n\n"
                                )
                            }
    
    # ======================================================
    # ✅ NO RISK DETECTED - Allow
    # ======================================================
    
    print(f"   ✅ No risk detected - Request allowed")
    return {
        "category": "none",
        "severity": "low",
        "matched_pattern": "none",
        "action": "allow",
        "message": ""
    }

# ======================================================
# 3.31.3 RISK LOGGING SYSTEM
# ======================================================

def log_risk_event(
    user_email: str,
    query: str,
    risk_category: str,
    severity: str,
    action_taken: str,
    project_id: str = None,
    chat_id: str = None,
    matched_pattern: str = None,
    supabase_client = None
):
    """
    Log risk detection event to database.
    
    Args:
        user_email: User's email
        query: The risky query
        risk_category: Category of risk detected
        severity: low/medium/high
        action_taken: allow/confirm/refuse
        project_id: Optional project context
        chat_id: Optional chat context
        matched_pattern: Pattern that triggered
        supabase_client: Supabase client instance
    """
    if not supabase_client:
        print("⚠ No Supabase client provided for risk logging")
        return
    
    try:
        from datetime import datetime, timezone
        
        log_entry = {
            "user_email": user_email,
            "query": query[:500],  # Truncate long queries
            "risk_category": risk_category,
            "severity": severity,
            "action_taken": action_taken,
            "project_id": project_id,
            "chat_id": chat_id,
            "matched_pattern": matched_pattern,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        supabase_client.table("risk_logs").insert(log_entry).execute()
        print(f"✅ Risk event logged: {risk_category} ({severity}) - {action_taken}")
        
    except Exception as e:
        print(f"❌ Failed to log risk event: {e}")
        # Don't raise - logging failure shouldn't break the flow


# ======================================================
# 3.31.4 MAIN RISK DETECTION FUNCTION
# ======================================================

def detect_and_handle_risk(
    user_input: str,
    user_email: str,
    context: dict = None,
    supabase_client = None
) -> tuple:
    """
    Main function for 3.31 risk detection and handling.
    
    This function should be called AFTER 3.26 content validation
    and BEFORE any database or system execution.
    
    Args:
        user_input: User's query
        user_email: User's email
        context: Context dict with user_role, project_id, tech_stack, etc.
        supabase_client: Supabase client for logging
        
    Returns:
        tuple: (is_safe: bool, response_dict: dict)
        
        If is_safe = False, response_dict contains:
            - "reply": User-facing message
            - "risk_category": Category detected
            - "severity": Risk severity
            - "action": Action taken
            
        If is_safe = True, response_dict is empty and flow continues normally.
    """
    # Detect risk
    risk_result = detect_risk_category(user_input, context)
    
    category = risk_result["category"]
    severity = risk_result["severity"]
    action = risk_result["action"]
    
    # Log the event (log everything, even "allow")
    log_risk_event(
        user_email=user_email,
        query=user_input,
        risk_category=category,
        severity=severity,
        action_taken=action,
        project_id=context.get("project_id") if context else None,
        chat_id=context.get("chat_id") if context else None,
        matched_pattern=risk_result["matched_pattern"],
        supabase_client=supabase_client
    )
    
    # Decision engine
    if action == "refuse":
        # HIGH RISK - Block immediately
        return False, {
            "reply": risk_result["message"],
            "risk_category": category,
            "severity": severity,
            "action": "refused",
            "requires_confirmation": False
        }
    
    elif action == "confirm":
        # MEDIUM RISK - Ask for confirmation
        return False, {
            "reply": risk_result["message"],
            "risk_category": category,
            "severity": severity,
            "action": "awaiting_confirmation",
            "requires_confirmation": True
        }
    
    else:
        # ALLOW - No risk or low risk
        return True, {}


# ======================================================
# 3.31.5 HELPER FUNCTION FOR TECH STACK EXTRACTION
# ======================================================

def extract_tech_stack_from_project(project_data: dict) -> list:
    """
    Extract technology stack from project data.
    
    Args:
        project_data: Project dict or list of project dicts
        
    Returns:
        list: Technology stack items
    """
    if not project_data:
        return []
    
    # Handle list of projects (take first)
    if isinstance(project_data, list):
        if not project_data:
            return []
        project_data = project_data[0]
    
    # Get tech_stack field
    tech_stack = project_data.get("tech_stack", [])
    
    # Handle string (comma-separated)
    if isinstance(tech_stack, str):
        return [t.strip() for t in tech_stack.split(",") if t.strip()]
    
    # Handle list
    if isinstance(tech_stack, list):
        return tech_stack
    
    return []