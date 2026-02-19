import os
import uuid
from werkzeug.utils import secure_filename
# from flask import current_app

def allowed_file(filename):
    """Check if the file is an allowed image type"""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_avatar(file):
    """Save uploaded avatar file and return the relative URL"""
    if not file or file.filename == '':
        return None
        
    if not allowed_file(file.filename):
        return None
    
    # Generate a secure filename
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{filename}"
    
    # Ensure upload directory exists
    upload_folder = os.path.join(current_app.root_path, '..', '..', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    
    # Save the file
    filepath = os.path.join(upload_folder, unique_filename)
    file.save(filepath)
    
    # Return the relative URL
    return f"/uploads/{unique_filename}"

def get_avatar_url(user):
    """Get the avatar URL for a user, with a default if not set"""
    if hasattr(user, 'avatar_url') and user.avatar_url:
        return user.avatar_url
    
    # Default avatar based on user's name or email
    name = getattr(user, 'name', '') or getattr(user, 'email', 'User')
    return f"https://ui-avatars.com/api/?name={name}&background=random&length=1"

def delete_old_avatar(user):
    """Delete the old avatar file when a new one is uploaded"""
    if not hasattr(user, 'avatar_url') or not user.avatar_url:
        return
    
    # Only delete if it's a local file (not a URL from a third-party service)
    if user.avatar_url.startswith('/uploads/'):
        try:
            filepath = os.path.join(
                current_app.root_path, 
                '..', 
                '..', 
                user.avatar_url.lstrip('/')
            )
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            current_app.logger.error(f"Error deleting old avatar: {e}")
