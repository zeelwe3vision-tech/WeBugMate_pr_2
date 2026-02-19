# JWT Authentication System

This document provides instructions for setting up and using the JWT authentication system in your Flask application.

## Features

- Secure JWT authentication with RSA-2048 keys
- Access and refresh token support
- Protected routes with `@token_required` decorator
- Secure password hashing with bcrypt
- HTTP-only cookies for better security
- Token refresh mechanism

## Setup

1. **Install Dependencies**

   ```bash
   # Navigate to the backend directory
   cd /path/to/your/project/backend
   
   # Install the required packages
   pip install -r requirements-auth.txt
   ```

2. **Generate RSA Keys**

   Run the setup script to generate RSA keys and set up the authentication system:

   ```bash
   python setup_auth.py
   ```

   This will:
   - Create a `config/keys` directory
   - Generate RSA key pairs (private.pem and public.pem)
   - Install required Python packages
   - Provide instructions for integrating with your Flask app

3. **Update .env**

   Add these environment variables to your `.env` file:

   ```env
   # JWT Configuration
   JWT_ISSUER=your-company
   JWT_AUDIENCE=your-audience
   ACCESS_TOKEN_EXPIRE_MINUTES=15
   REFRESH_TOKEN_EXPIRE_DAYS=7
   
   # Optional: Override key paths (default: config/keys/private.pem and config/keys/public.pem)
   # PRIVATE_KEY_PATH=/path/to/private.pem
   # PUBLIC_KEY_PATH=/path/to/public.pem
   ```

## Integration with Flask App

1. **Register the Auth Blueprint**

   In your `app.py` or main application file, add:

   ```python
   from security import auth_bp
   
   # Register the auth blueprint
   app.register_blueprint(auth_bp, url_prefix='/api/auth')
   ```

2. **Protect Routes**

   Use the `@token_required` decorator to protect routes:

   ```python
   from security import token_required
   
   @app.route('/api/protected')
   @token_required
   def protected_route():
       # Access the authenticated user with request.user
       return jsonify({
           "message": "This is a protected route",
           "user_id": request.user['sub']
       })
   ```

## API Endpoints

### Register a New User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "Test User"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Refresh Access Token

```http
POST /api/auth/refresh
Cookie: refresh_token=your_refresh_token
```

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer your_access_token
```

### Logout

```http
POST /api/auth/logout
```

## Security Best Practices

1. **Never commit private keys** - The `private.pem` file is in `.gitignore` by default
2. **Use HTTPS** - Always use HTTPS in production
3. **Secure cookies** - The system sets `HttpOnly`, `Secure`, and `SameSite` flags on cookies
4. **Token expiration** - Access tokens expire in 15 minutes by default
5. **Key rotation** - Rotate your RSA keys periodically

## Testing Authentication

You can test the authentication system using `curl` or tools like Postman.

### Example: Register a User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123","name":"Test User"}'
```

### Example: Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'
```

### Example: Access Protected Route

```bash
# Using the access token from the login response
curl http://localhost:5000/api/protected \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

- **Invalid token errors**: Ensure the token is being sent correctly in the Authorization header
- **Token expired**: Use the refresh token to get a new access token
- **Permission denied**: Check that the user has the required permissions

## License

This authentication system is provided as-is under the MIT License.
