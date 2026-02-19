"""
Setup script for JWT Authentication System

This script will:
1. Generate RSA key pair if they don't exist
2. Install required Python packages
3. Show you how to update your FastAPI app to use the authentication system
"""
import os
import sys
from pathlib import Path
import subprocess

def print_header(text):
    print("\n" + "=" * 80)
    print(f" {text}".center(80))
    print("=" * 80)

def run_command(command, cwd=None):
    print(f"\n$ {command}")
    result = subprocess.run(
        command, 
        shell=True, 
        cwd=cwd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.PIPE,
        text=True
    )
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
    else:
        print(result.stdout)
    return result.returncode == 0

def main():
    # Check if we're in the backend directory
    backend_dir = Path(__file__).parent
    
    print_header("JWT Authentication Setup")
    
    # 1. Create config/keys directory if it doesn't exist
    keys_dir = backend_dir / "config" / "keys"
    keys_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Generate RSA keys if they don't exist
    private_key = keys_dir / "private.pem"
    public_key = keys_dir / "public.pem"
    
    if not private_key.exists() or not public_key.exists():
        print("\nGenerating RSA key pair...")
        from scripts.generate_keys import generate_rsa_keys, save_keys
        private_pem, public_pem = generate_rsa_keys()
        save_keys(private_pem, public_pem, str(keys_dir))
        print("✅ RSA key pair generated successfully!")
    else:
        print("\n✅ RSA key pair already exists.")
    
    # 3. Install required packages
    print_header("Installing Required Packages")
    
    # Check if virtual environment is activated
    if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("⚠️  Virtual environment not detected. It's recommended to use a virtual environment.")
        print("   You can create one with: python -m venv venv")
        print("   Then activate it with: source venv/bin/activate (Linux/Mac) or .\\venv\\Scripts\\activate (Windows)")
        print("\nContinuing with system Python...")
    
    # Install requirements
    requirements_file = backend_dir / "requirements-auth.txt"
    if requirements_file.exists():
        print(f"\nInstalling packages from {requirements_file}...")
        if not run_command(f"pip install -r {requirements_file}", cwd=backend_dir):
            print("❌ Failed to install requirements. Please check the error messages above.")
            return
    else:
        print(f"❌ Requirements file not found: {requirements_file}")
        return
    
    # 4. Show next steps
    print_header("Next Steps")
    print("\n✅ Authentication system is ready to use!")
#     print("\nTo integrate with your Flask app, add the following to your app.py:")
    
#     print("""
# # Import the auth blueprint
# from security import auth_bp

# # Register the auth blueprint
# app.register_blueprint(auth_bp, url_prefix='/api/auth')

# # Protect routes with @token_required decorator
# @app.route('/api/protected')
# @token_required
# def protected_route():
#     return jsonify({"message": "This is a protected route", "user": request.user})
#     """)
    

    print("\nTo integrate with your FastAPI app, add the following to your main.py:")

    print("""
    from fastapi import FastAPI
    from security import router as auth_router

    app = FastAPI()

    # Register authentication routes
    app.include_router(auth_router)
    """)

    print("\nAvailable authentication endpoints:")
    # print("  POST   /api/auth/register    - Register a new user")
    # print("  POST   /api/auth/login       - Login and get JWT tokens")
    # print("  POST   /api/auth/refresh     - Refresh access token")
    # print("  POST   /api/auth/logout      - Logout (clear tokens)")
    # print("  GET    /api/auth/me          - Get current user info")
    print("  POST   /auth/register    - Register a new user")
    print("  POST   /auth/login       - Login and get JWT tokens")
    print("  POST   /auth/refresh     - Refresh access token")
    print("  POST   /auth/logout      - Logout (clear tokens)")
    print("  GET    /auth/me          - Get current user info")

    
    print("\nTo test the authentication system, you can use curl or Postman.")
#     print("Example registration:")
#     print('''curl -X POST http://localhost:5000/api/auth/register \
#   -H "Content-Type: application/json" \
#   -d '{"email":"user@example.com","password":"securepassword","name":"Test User"}'
# ''')
    
#     print("\nExample login:")
#     print('''curl -X POST http://localhost:5000/api/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"email":"user@example.com","password":"securepassword"}'
# ''')
    
#     print("\nExample protected route:")
#     print('''curl http://localhost:5000/api/protected \
#   -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
# ''')
    print("Example registration:")
    print('''curl -X POST https://zeelsheta-webugmate-backend-pr-2-1.hf.space/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"securepassword","name":"Test User"}'
    ''')

    print("\nExample login:")
    print('''curl -X POST https://zeelsheta-webugmate-backend-pr-2-1.hf.space/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"securepassword"}'
    ''')

    print("\nExample protected route (FastAPI):")
    print('''curl https://zeelsheta-webugmate-backend-pr-2-1.hf.space/protected \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ''')


if __name__ == "__main__":
    main()
