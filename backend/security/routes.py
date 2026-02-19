# from flask import Blueprint, request, jsonify, make_response
# from werkzeug.security import generate_password_hash, check_password_hash
# from .auth_utils import (
#     create_access_token, 
#     create_refresh_token, 
#     verify_token
# )
# import datetime

# # Import the User model from the local models directory
# from .models.user import User

# auth_bp = Blueprint('auth', __name__)

# @auth_bp.route('/register', methods=['POST'])
# def register():
#     """Register a new user"""
#     data = request.get_json()
    
#     # Validate input
#     if not data or not data.get('email') or not data.get('password'):
#         return jsonify({'message': 'Email and password are required'}), 400
    
#     # Check if user already exists
#     if User.get_by_email(data['email']):
#         return jsonify({'message': 'User already exists'}), 400
    
#     # Create new user
#     try:
#         user = User.create(
#             email=data['email'],
#             password=data['password'],
#             name=data.get('name', '')
#         )
        
#         # Create tokens
#         access_token = create_access_token(user.id)
#         refresh_token = create_refresh_token(user.id)
        
#         # Prepare response
#         response_data = {
#             'message': 'User registered successfully',
#             'access_token': access_token,
#             'refresh_token': refresh_token,
#             'user': {
#                 'id': str(user.id),
#                 'email': user.email,
#                 'name': user.name
#             }
#         }
        
#         # Set HTTP-only cookies for better security
#         response = make_response(jsonify(response_data))
#         response.set_cookie(
#             'token',
#             access_token,
#             httponly=True,
#             secure=True,  # Enable in production with HTTPS
#             samesite='Strict',
#             max_age=15 * 60  # 15 minutes
#         )
#         response.set_cookie(
#             'refresh_token',
#             refresh_token,
#             httponly=True,
#             secure=True,  # Enable in production with HTTPS
#             samesite='Strict',
#             max_age=7 * 24 * 60 * 60  # 7 days
#         )
        
#         return response, 201
#     except Exception as e:
#         return jsonify({'message': str(e)}), 500

# @auth_bp.route('/login', methods=['POST'])
# def login():
#     """Login user and return JWT tokens"""
#     data = request.get_json()
    
#     if not data or not data.get('email') or not data.get('password'):
#         return jsonify({'message': 'Email and password are required'}), 400
    
#     # Find user
#     user = User.get_by_email(data['email'])
#     if not user or not user.check_password(data['password']):
#         return jsonify({'message': 'Invalid credentials'}), 401
    
#     # Create tokens
#     access_token = create_access_token(user.id)
#     refresh_token = create_refresh_token(user.id)
    
#     # Prepare response
#     response_data = {
#         'message': 'Login successful',
#         'access_token': access_token,
#         'refresh_token': refresh_token,
#         'user': {
#             'id': str(user.id),
#             'email': user.email,
#             'name': user.name
#         }
#     }
    
#     # Set HTTP-only cookies
#     response = make_response(jsonify(response_data))
#     response.set_cookie(
#         'token',
#         access_token,
#         httponly=True,
#         secure=True,  # Enable in production with HTTPS
#         samesite='Strict',
#         max_age=15 * 60  # 15 minutes
#     )
#     response.set_cookie(
#         'refresh_token',
#         refresh_token,
#         httponly=True,
#         secure=True,  # Enable in production with HTTPS
#         samesite='Strict',
#         max_age=7 * 24 * 60 * 60  # 7 days
#     )
    
#     return response

# @auth_bp.route('/refresh', methods=['POST'])
# def refresh():
#     """Refresh access token using refresh token"""
#     refresh_token = request.cookies.get('refresh_token') or request.json.get('refresh_token')
    
#     if not refresh_token:
#         return jsonify({'message': 'Refresh token is required'}), 400
    
#     # Verify refresh token
#     payload = verify_token(refresh_token)
#     if 'error' in payload:
#         return jsonify({'message': payload['error']}), 401
    
#     if payload.get('type') != 'refresh':
#         return jsonify({'message': 'Invalid token type'}), 401
    
#     # Create new access token
#     access_token = create_access_token(payload['sub'])
    
#     return jsonify({
#         'access_token': access_token,
#         'token_type': 'Bearer',
#         'expires_in': 15 * 60  # 15 minutes
#     })

# @auth_bp.route('/logout', methods=['POST'])
# def logout():
#     """Logout user by clearing tokens"""
#     response = make_response(jsonify({'message': 'Successfully logged out'}))
#     response.delete_cookie('token')
#     response.delete_cookie('refresh_token')
#     return response

# @auth_bp.route('/me', methods=['GET'])
# def get_current_user():
#     """Get current user info"""
#     user_id = request.user['sub']
#     user = User.get_by_id(user_id)
    
#     if not user:
#         return jsonify({'message': 'User not found'}), 404
    
#     return jsonify({
#         'id': str(user.id),
#         'email': user.email,
#         'name': user.name
#     })
