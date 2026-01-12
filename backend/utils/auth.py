from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from database import users_collection
import os
from passlib.context import CryptContext
import bcrypt

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# auto_error=False permite requests fără token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Bcrypt lucrează cu bytes, deci convertim string-urile
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')

        # Verificăm parola direct cu librăria bcrypt
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        print(f"Eroare la verificarea parolei: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt directly"""
    # Bcrypt are o limită de 72 de caractere.
    # Dacă parola este mai lungă, o trunchiem pentru siguranță.
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]

    # Generăm un salt și hash-uim parola
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password_bytes, salt)

    # Returnăm hash-ul ca string (pentru a fi salvat în DB)
    return hashed_password.decode('utf-8')

def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token with user_id as sub"""
    to_encode = {"sub": user_id}
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    """Decode and verify a JWT token, return user_id"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user_id from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception
    return user_id
