from fastapi import APIRouter, Depends
from database.models import Notification as DB_Notification
from sqlalchemy.orm import Session
from backend.utils.dependencies import get_db
from datetime import datetime

router = APIRouter()

def now():
    return datetime.now().strftime("%d %b %Y, %I:%M %p")

def create_notification(db: Session, message: str, user_type: str, issue_id: int = None):
    """Internal helper used by other routes to generate notifications."""
    notif = DB_Notification(
        message=message,
        user_type=user_type,
        issue_id=issue_id,
        is_read=0,
        created_at=now()
    )
    db.add(notif)
    db.commit()

@router.get("/notifications")
async def get_notifications(user_type: str = "citizen", db: Session = Depends(get_db)):
    """Return all notifications for a given user_type, latest first."""
    notifications = (
        db.query(DB_Notification)
        .filter(DB_Notification.user_type == user_type)
        .order_by(DB_Notification.id.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "message": n.message,
            "user_type": n.user_type,
            "issue_id": n.issue_id,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifications
    ]

@router.patch("/notifications/{notif_id}/read")
async def mark_as_read(notif_id: int, db: Session = Depends(get_db)):
    """Mark a single notification as read."""
    n = db.query(DB_Notification).filter(DB_Notification.id == notif_id).first()
    if n:
        n.is_read = 1
        db.commit()
    return {"success": True}

@router.patch("/notifications/read-all")
async def mark_all_read(user_type: str = "citizen", db: Session = Depends(get_db)):
    """Mark all notifications as read for a user type."""
    db.query(DB_Notification).filter(
        DB_Notification.user_type == user_type,
        DB_Notification.is_read == 0
    ).update({"is_read": 1})
    db.commit()
    return {"success": True}
