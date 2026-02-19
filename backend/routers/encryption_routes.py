# chirag logic start
"""
Example Encrypted Chat Routes
=============================

This file demonstrates how to integrate encryption into your chat API.
You can merge this with your existing routers/chat_routes.py or use it
as a reference implementation.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from security.auth_utils import get_current_user
from security.encrypt_utils import encrypt_api, decrypt_api
from core import save_chat_message, call_openrouter, load_chat_history

router = APIRouter(prefix="/chat", tags=["Encrypted Chat"])


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str
    project_id: str
    chat_id: str
    user_email: Optional[str] = None  # Can be extracted from JWT


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    reply: str
    chat_id: str
    project_id: str
    encrypted: bool = True  # Indicates that messages are encrypted in DB


# ==============================================================================
# ENCRYPTED CHAT ENDPOINT
# ==============================================================================

@router.post("/send", response_model=ChatResponse)
async def send_encrypted_message(
    payload: ChatRequest,
    current_user = Depends(get_current_user)
):
    """
    Send an encrypted chat message.
    
    Flow:
    1. Receive plaintext message from user
    2. Encrypt user message before saving to database
    3. Call LLM with plaintext (in memory only)
    4. Encrypt LLM reply before saving to database
    5. Return plaintext reply to user
    
    Security:
    - Messages are encrypted at rest in the database
    - Different projects cannot decrypt each other's messages
    - Plaintext only exists in memory during processing
    """
    try:
        # Extract user information from JWT
        user_email = current_user.get("email") or payload.user_email
        
        if not user_email:
            raise HTTPException(status_code=401, detail="User email not found")
        
        # Validate input
        if not payload.message or not payload.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        if not payload.project_id:
            raise HTTPException(status_code=400, detail="Project ID is required")
        
        # ------------------------------------------------------------------
        # STEP 1: Encrypt user message BEFORE saving
        # ------------------------------------------------------------------
        encrypted_user_msg = encrypt_api(
            payload.message.strip(),
            payload.project_id
        )
        
        # Save encrypted user message
        save_chat_message(
            user_email=user_email,
            role="user",
            content=encrypted_user_msg,  
            project_id=payload.project_id,
            chat_id=payload.chat_id
        )
        
        # ------------------------------------------------------------------
        # STEP 2: Load chat history and decrypt for LLM context
        # ------------------------------------------------------------------
        # Note: load_chat_history returns encrypted messages from DB
        encrypted_history = load_chat_history(
            user_email,
            payload.project_id,
            payload.chat_id,
            limit=10
        ) or []
        
        # Decrypt history for LLM (in memory only)
        decrypted_history = []
        for msg in encrypted_history:
            decrypted_content = decrypt_api(msg["content"], payload.project_id)
            decrypted_history.append({
                "role": msg["role"],
                "content": decrypted_content
            })
        
        # ------------------------------------------------------------------
        # STEP 3: Call LLM with plaintext (memory only, never stored)
        # ------------------------------------------------------------------
        messages = [
            {"role": "system", "content": "You are a helpful AI assistant."},
            *decrypted_history,
            {"role": "user", "content": payload.message}
        ]
        
        raw_reply = call_openrouter(messages) or "I apologize, but I couldn't generate a response."
        
        # ------------------------------------------------------------------
        # STEP 4: Encrypt AI reply BEFORE saving
        # ------------------------------------------------------------------
        encrypted_reply = encrypt_api(
            raw_reply,
            payload.project_id
        )
        
        # Save encrypted assistant message
        save_chat_message(
            user_email=user_email,
            role="assistant",
            content=encrypted_reply,  
            project_id=payload.project_id,
            chat_id=payload.chat_id
        )
        
        # ------------------------------------------------------------------
        # STEP 5: Return plaintext to user (for immediate display)
        # ------------------------------------------------------------------
        return ChatResponse(
            reply=raw_reply,  # ← PLAINTEXT (decrypted for response)
            chat_id=payload.chat_id,
            project_id=payload.project_id,
            encrypted=True
        )
        
    except ValueError as e:
        # Encryption/decryption errors
        raise HTTPException(status_code=400, detail=f"Encryption error: {str(e)}")
    
    except Exception as e:
        # General errors
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


# ==============================================================================
# RETRIEVE ENCRYPTED CHAT HISTORY
# ==============================================================================

@router.get("/history/{chat_id}")
async def get_encrypted_chat_history(
    chat_id: str,
    project_id: str,
    current_user = Depends(get_current_user)
):
    """
    Retrieve and decrypt chat history for display.
    
    Args:
        chat_id: Chat session ID
        project_id: Project ID for decryption
        current_user: Authenticated user from JWT
        
    Returns:
        List of decrypted chat messages
    """
    try:
        user_email = current_user.get("email")
        
        # Load encrypted history from database
        encrypted_history = load_chat_history(
            user_email,
            project_id,
            chat_id,
            limit=50
        ) or []
        
        # Decrypt for display
        decrypted_history = []
        for msg in encrypted_history:
            decrypted_content = decrypt_api(msg["content"], project_id)
            
            decrypted_history.append({
                "role": msg["role"],
                "content": decrypted_content,
                "timestamp": msg.get("timestamp"),
                "message_id": msg.get("id")
            })
        
        return {
            "chat_id": chat_id,
            "project_id": project_id,
            "messages": decrypted_history,
            "total": len(decrypted_history)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")


# ==============================================================================
# UTILITY: TEST ENCRYPTION
# ==============================================================================

@router.post("/test-encryption")
async def test_encryption(project_id: str, message: str):
    """
    Test endpoint to verify encryption/decryption works.
    
    WARNING: This is for testing only! Remove in production.
    """
    try:
        # Encrypt
        encrypted = encrypt_api(message, project_id)
        
        # Decrypt
        decrypted = decrypt_api(encrypted, project_id)
        
        return {
            "original": message,
            "encrypted": encrypted,
            "decrypted": decrypted,
            "match": message == decrypted
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# chirag logic end