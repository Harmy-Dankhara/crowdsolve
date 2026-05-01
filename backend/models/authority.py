from pydantic import BaseModel, EmailStr


class AuthoritySignup(BaseModel):
    name: str
    email: str
    department: str
    city: str
    password: str


class AuthorityLogin(BaseModel):
    email: str
    password: str


class AuthorityResetPassword(BaseModel):
    email: str
    new_password: str
