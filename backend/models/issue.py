from pydantic import BaseModel
from typing import Optional

class Issue(BaseModel):
    title: str
    description: str
    location: str
    status: str = "Pending"

class CreateIssue(BaseModel):
    title: str
    description: str
    location: str
    status: str = "Pending"

class UpdateIssue(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = "Pending"
