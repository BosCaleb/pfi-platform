from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app import models, database
import os

SECRET_KEY = os.getenv("SECRET_KEY", "pfi-platform-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480
MEMBER_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours for members

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme        = OAuth2PasswordBearer(tokenUrl="api/auth/login")
oauth2_member_scheme = OAuth2PasswordBearer(tokenUrl="api/member/login")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_member_token(member_id: int) -> str:
    """Create a JWT for a member. Subject is prefixed 'member:' to distinguish from admin tokens."""
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=MEMBER_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": f"member:{member_id}", "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM,
    )

def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        admin_id: str = payload.get("sub")
        if admin_id is None or str(admin_id).startswith("member:"):
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    admin = db.query(models.Admin).filter(models.Admin.id == int(admin_id)).first()
    if admin is None:
        raise credentials_exception
    return admin

def get_current_member(token: str = Depends(oauth2_member_scheme), db: Session = Depends(database.get_db)):
    """Dependency for member-only endpoints. Validates member JWT and returns the Member row."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Member authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub", "")
        if not sub.startswith("member:"):
            raise credentials_exception
        member_id = int(sub.split(":", 1)[1])
    except (JWTError, ValueError):
        raise credentials_exception
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if member is None or not member.portal_enabled:
        raise credentials_exception
    return member
