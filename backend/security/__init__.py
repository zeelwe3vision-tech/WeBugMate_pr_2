# # from .routes import auth_bp
# from .chat_security import ChatSecurity, encrypt_chat_message, decrypt_chat_message

# # This makes the security module a proper Python package
# __all__ = [
#     'token_required',
#     'ChatSecurity',
#     'encrypt_chat_message',
#     'decrypt_chat_message'
# ]
# from .routes import router
from .fastapi_routes import router
from .chat_security import (
    ChatSecurity,
    encrypt_chat_message,
    decrypt_chat_message
)

__all__ = [
    "router",
    "ChatSecurity",
    "encrypt_chat_message",
    "decrypt_chat_message"
]
