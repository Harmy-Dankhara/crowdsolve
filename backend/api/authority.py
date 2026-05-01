"""
CrowdSolve - Authority Authentication API
Handles signup, login, and password reset for authority users.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session


from database.models import Authority as DB_Authority
from backend.models.authority import AuthoritySignup, AuthorityLogin, AuthorityResetPassword
from backend.utils.dependencies import get_db

router = APIRouter(prefix="/authority", tags=["Authority Auth"])

import bcrypt

def hash_password(password: str) -> str:
    # Safely encode and truncate to avoid bcrypt's strict 72-byte limit restriction
    password_bytes = password.encode('utf-8')[:72]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    plain_bytes = plain.encode('utf-8')[:72]
    hashed_bytes = hashed.encode('utf-8')
    try:
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False


# ── Signup ────────────────────────────────────────────────────────────────────

@router.post("/signup")
def authority_signup(data: AuthoritySignup, db: Session = Depends(get_db)):
    # Check if email is already registered
    existing_authority = db.query(DB_Authority).filter(DB_Authority.email == data.email).first()

    if existing_authority:
        raise HTTPException(
            status_code=400,
            detail="Account with this email already exists"
        )

    authority = DB_Authority(
        name=data.name,
        email=data.email,
        department=data.department,
        city=data.city,
        password_hash=hash_password(data.password),
    )
    db.add(authority)
    db.commit()
    db.refresh(authority)

    return {
        "success": True,
        "message": "Authority account created successfully",
        "id": authority.id,
        "name": authority.name,
        "email": authority.email,
    }


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
def authority_login(data: AuthorityLogin, db: Session = Depends(get_db)):
    authority = db.query(DB_Authority).filter(DB_Authority.email == data.email).first()

    if not authority or not verify_password(data.password, authority.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "success": True,
        "message": "Login successful",
        "name": authority.name,
        "email": authority.email,
        "department": authority.department,
        "city": authority.city,
    }


# ── Check Email (for forgot password) ────────────────────────────────────────

@router.post("/check-email")
def check_email(data: AuthorityLogin, db: Session = Depends(get_db)):
    """Lightweight check that an email exists, used by forgot-password flow."""
    authority = db.query(DB_Authority).filter(DB_Authority.email == data.email).first()
    if not authority:
        raise HTTPException(status_code=404, detail="No account found with this email")
    return {"exists": True, "name": authority.name}


# ── Reset Password ────────────────────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(data: AuthorityResetPassword, db: Session = Depends(get_db)):
    authority = db.query(DB_Authority).filter(DB_Authority.email == data.email).first()
    if not authority:
        raise HTTPException(status_code=404, detail="No account found with this email")

    authority.password_hash = hash_password(data.new_password)
    db.commit()

    return {"success": True, "message": "Password updated successfully"}


# ── Logout (stateless — just for API completeness) ────────────────────────────

@router.post("/logout")
def authority_logout():
    """Session is managed client-side via localStorage. This endpoint is a no-op stub."""
    return {"success": True, "message": "Logged out"}
