from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas, auth, database

router = APIRouter(prefix="/api/auth", tags=["auth"])
DEFAULT_ADMIN_EMAIL = "admin@pfi-platform.local"
DEFAULT_ADMIN_PASSWORD = "admin123"

@router.post("/login")
def login(credentials: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    admin = db.query(models.Admin).filter(models.Admin.email == credentials.email).first()
    if not admin or not auth.verify_password(credentials.password, admin.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = auth.create_access_token({"sub": str(admin.id)})
    return {"access_token": token, "token_type": "bearer", "admin": {"id": admin.id, "email": admin.email, "name": admin.name}}

@router.post("/seed")
def seed_admin(db: Session = Depends(database.get_db)):
    admin = db.query(models.Admin).filter(models.Admin.email == DEFAULT_ADMIN_EMAIL).first()
    if not admin:
        admin = models.Admin(
            email=DEFAULT_ADMIN_EMAIL,
            password=auth.get_password_hash(DEFAULT_ADMIN_PASSWORD),
            name="PFI Platform Admin"
        )
        db.add(admin)
        db.commit()
        return {"message": "Default admin created"}
    return {"message": "Admin already exists"}
