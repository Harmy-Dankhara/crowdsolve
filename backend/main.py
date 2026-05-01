from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from backend.api.issues import router
from backend.api.authority import router as authority_router
from backend.api.notifications import router as notifications_router
from database.db import engine, Base
from sqlalchemy.orm import Session
from backend.utils.dependencies import get_db
import database.models
from pydantic import BaseModel
from backend.mongo import comments_collection

# Create FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(router)
app.include_router(authority_router)
app.include_router(notifications_router)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def is_mongo_id(id):
    return len(str(id)) == 24

class IssueStatusUpdate(BaseModel):
    status: str

@app.put("/issues/{issue_id}/status")
async def update_issue_status(issue_id: str, status_update: IssueStatusUpdate, source: str = None, db: Session = Depends(get_db)):
    from datetime import datetime
    current_time = datetime.now().strftime("%d %b %Y, %I:%M %p")
    
    if source == "mongo" or is_mongo_id(issue_id):
        from bson import ObjectId
        update_data = {"status": status_update.status, "updated_at": current_time}
        if status_update.status == "Resolved":
            update_data["resolved_at"] = current_time
            
        comments_collection.update_one(
            {"_id": ObjectId(issue_id)},
            {"$set": update_data}
        )
        return {"message": "MongoDB issue updated"}

    db_issue = db.query(database.models.Issue).filter(database.models.Issue.id == int(issue_id)).first()
    if db_issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    db_issue.status = status_update.status
    db_issue.updated_at = current_time
    if status_update.status == "Resolved":
        db_issue.resolved_at = current_time
        
    db.commit()
    db.refresh(db_issue)
    return db_issue

# Home route
@app.get("/")
def home():
    return {"message": "CrowdSolve API Running Successfully 🚀"}

@app.get("/test-mongo")
def test_mongo():
    comments_collection.insert_one({"test": "MongoDB connected"})
    return {"message": "MongoDB working"}