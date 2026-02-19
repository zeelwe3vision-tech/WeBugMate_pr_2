import uuid
# from werkzeug.security import generate_password_hash, check_password_hash
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")   

# In-memory storage for demo purposes
# In a real app, this would be a database model
users_db = {}

class User:
    def __init__(self, id, email, password_hash, name=''):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.name = name
    
    def set_password(self, password):
        # self.password_hash = generate_password_hash(password)
        self.password_hash = pwd_context.hash(password)
    
    def check_password(self, password):
        # return check_password_hash(self.password_hash, password)
        return pwd_context.verify(password, self.password_hash)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'name': self.name
        }
    
    @classmethod
    def create(cls, email, password, name=''):
        """Create a new user"""
        if cls.get_by_email(email):
            raise ValueError('Email already registered')
        
        user = cls(
            id=str(uuid.uuid4()),
            email=email,
            password_hash=generate_password_hash(password),
            name=name
        )
        
        users_db[user.id] = user
        return user
    
    @classmethod
    def get_by_id(cls, user_id):
        """Get user by ID"""
        return users_db.get(user_id)
    
    @classmethod
    def get_by_email(cls, email):
        """Get user by email"""
        for user in users_db.values():
            if user.email == email:
                return user
        return None
    
    @classmethod
    def authenticate(cls, email, password):
        """Authenticate a user"""
        user = cls.get_by_email(email)
        if user and user.check_password(password):
            return user
        return None
