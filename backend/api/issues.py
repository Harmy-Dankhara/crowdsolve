from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from backend.models.issue import Issue
from database.models import Issue as DB_Issue
from sqlalchemy.orm import Session
from backend.utils.dependencies import get_db
from ai_engine.issue_analyzer import analyze_issue
from backend.services.duplicate_detector import check_duplicate_issue
from backend.api.notifications import create_notification
import uuid
import os
import shutil
from datetime import datetime
from backend.mongo import comments_collection
from bson import ObjectId

def now():
    return datetime.now().strftime("%d %b %Y, %I:%M %p")

router = APIRouter()

@router.post("/report-issue")
async def report_issue(
    title: str = Form(...),
    description: str = Form(...),
    location: str = Form(...),
    latitude: float = Form(None),
    longitude: float = Form(None),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # --- Duplicate Detection ---
    existing_issues = db.query(DB_Issue).all()
    duplicate_result = check_duplicate_issue(description, location, existing_issues)

    if duplicate_result["is_duplicate"]:
        matched = duplicate_result["matched_issue"]
        # Increment the support_count on the matched issue
        matched.support_count = (matched.support_count or 0) + 1
        db.commit()
        db.refresh(matched)
        return {
            "duplicate": True,
            "message": "Similar issue already reported",
            "existing_issue_id": matched.id,
            "existing_issue_title": matched.title,
            "support_count": matched.support_count
        }

    # --- Run AI analysis on the submitted text ---
    analysis = analyze_issue(title + " " + description)
    category = analysis["category"]
    severity = analysis["severity"]
    department = analysis["department"]

    image_path = None
    if image:
        os.makedirs("uploads", exist_ok=True)
        file_ext = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_ext}"
        filepath = f"uploads/{filename}"

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        image_path = filepath

    # --- Geocoding ---
    lat = latitude
    lon = longitude
    
    # Fallback dictionary for common test locations to prevent map marker failures during rate-limiting
    FALLBACK_COORDS = {
        "mumbai": (19.0760, 72.8777),
        "surat": (21.1702, 72.8311),
        "delhi": (28.7041, 77.1025),
        "pune": (18.5204, 73.8567),
        "bangalore": (12.9716, 77.5946),
        "chennai": (13.0827, 80.2707),
        "kolkata": (22.5726, 88.3639)
    }

    if lat is None or lon is None:
        try:
            import requests
            import urllib.parse
            encoded_location = urllib.parse.quote(location)
            response = requests.get(
                f"https://nominatim.openstreetmap.org/search?q={encoded_location}&format=json",
                headers={"User-Agent": "CrowdSolveApp/1.0 (contact: admin@crowdsolve.local)"},
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    lat = float(data[0].get("lat"))
                    lon = float(data[0].get("lon"))
                else:
                    print(f"[GEOCODING WARNING] API returned empty data for location: '{location}'. Falling back to defaults.")
            else:
                print(f"[GEOCODING ERROR] Nominatim API HTTP {response.status_code}: {response.text}. Falling back.")
                
        except Exception as e:
            print(f"[GEOCODING EXCEPTION] Caught error fetching from Nominatim for '{location}': {e}")

    # Explicit Fallback Mapping if Nominatim failed
    if lat is None or lon is None:
        loc_lower = str(location).lower()
        for key, coords in FALLBACK_COORDS.items():
            if key in loc_lower:
                lat, lon = coords
                print(f"[GEOCODING INFO] Used fallback coordinates for {location}: {lat}, {lon}")
                break
                
    if lat is None or lon is None:
        print(f"[GEOCODING FATAL] Could not resolve any coordinates for '{location}'. Map marker will be skipped.")

    current_time = now()
    # --- Duplicate logic fixed: Use ONLY MongoDB for new issues ---
    current_time = now()

    print("MongoDB Insert Data:", title, description, location, category, severity)
    comments_collection.insert_one({
        "title": title,
        "description": description,
        "location": location,
        "latitude": lat,
        "longitude": lon,
        "category": category,
        "severity": severity,
        "image_url": image_path,
        "created_at": current_time
    })

    # --- Notifications ---
    create_notification(db, f"📢 New issue reported: '{title}' in {location}", "authority", None)
    if severity == "High":
        create_notification(db, f"🚨 URGENT: High-severity issue '{title}' reported in {location}!", "authority", None)

    return {"message": "Issue recorded in MongoDB", "source": "mongo"}

@router.get("/issues")
async def get_issues(db: Session = Depends(get_db)):
    from datetime import datetime
    import re
    
    def format_time(t):
        if not t or str(t).strip() == "" or str(t) == "None":
            return ""
        if isinstance(t, datetime):
            return t.strftime("%d %b %Y, %I:%M %p")
        if isinstance(t, str):
            if re.match(r"^\d{2} \w{3} \d{4}, \d{2}:\d{2} [APM]{2}$", t):
                return t
            try:
                dt = datetime.fromisoformat(t.split(".")[0])
                return dt.strftime("%d %b %Y, %I:%M %p")
            except:
                pass
        return str(t)

    result = []
    seen = set()
    
    # 1. MongoDB issues (Primary)
    import pymongo
    mongo_docs = comments_collection.find({"is_deleted": {"$ne": True}}).sort("_id", pymongo.DESCENDING)
    for doc in mongo_docs:
        title = doc.get("title", "")
        desc = doc.get("description", "")
        loc = doc.get("location", "")
        seen.add((title, desc, loc))
        
        result.append({
            "id": str(doc["_id"]),
            "title": title,
            "description": desc,
            "location": loc,
            "city": loc,
            "status": doc.get("status", "Reported"),
            "category": doc.get("category", "Other"),
            "severity": doc.get("severity", "Low"),
            "latitude": doc.get("latitude"),
            "longitude": doc.get("longitude"),
            "image_url": doc.get("image_url", ""),
            "created_at": format_time(doc.get("created_at")),
            "updated_at": format_time(doc.get("updated_at")),
            "resolved_at": format_time(doc.get("resolved_at")),
            "source": "mongo"
        })
        
    # 2. SQLite issues (Legacy / Existing Only)
    issues = db.query(DB_Issue).filter(DB_Issue.is_deleted == False).order_by(DB_Issue.created_at.desc()).all()
    for issue in issues:
        key = (issue.title, issue.description, issue.location)
        if key in seen:
            continue  # Filter out duplicates that already exist in Mongo
            
        issue_dict = {
            "id": issue.id,
            "title": issue.title,
            "description": issue.description,
            "city": issue.location,
            "location": issue.location,
            "status": issue.status,
            "category": issue.category,
            "severity": issue.severity,
            "department": issue.department,
            "image_url": issue.image_url,
            "support_count": issue.support_count,
            "latitude": issue.latitude,
            "longitude": issue.longitude,
            "created_at": format_time(issue.created_at),
            "updated_at": format_time(issue.updated_at),
            "resolved_at": format_time(issue.resolved_at),
            "source": "sqlite"
        }
        result.append(issue_dict)
        
    # Sort combined result to ensure exact consistency across DBs
    def get_sort_key(issue):
        t_str = issue.get("created_at")
        if not t_str: return datetime.min
        try:
            # Need to parse 16 Apr 2026, 04:30 PM format
            return datetime.strptime(t_str, "%d %b %Y, %I:%M %p")
        except Exception:
            try:
                # Fallback for ISO format
                return datetime.fromisoformat(t_str.split(".")[0])
            except:
                return datetime.min

    result.sort(key=get_sort_key, reverse=True)

    return result

@router.delete("/delete-issue/{issue_id}")
@router.delete("/issues/{issue_id}")
async def delete_issue(issue_id: str, source: str = None, db: Session = Depends(get_db)):
    # Safely handle both routing parameter names due to dual routing paths
    target_id = issue_id
    
    if source == "mongo" or is_mongo_id(target_id):
        comments_collection.update_one(
            {"_id": ObjectId(target_id)},
            {"$set": {"is_deleted": True}}
        )
        return {"message": "Mongo issue soft deleted"}
    else:
        db_issue = db.query(DB_Issue).filter(DB_Issue.id == int(target_id)).first()
        if db_issue:
            db_issue.is_deleted = True
            db.commit()
        return {"message": "SQL issue soft deleted"}

def is_mongo_id(id):
    return len(str(id)) == 24

@router.put("/issues/{issue_id}")
async def update_issue(issue_id: str, issue: dict, source: str = None, db: Session = Depends(get_db)):
    if source == "mongo" or is_mongo_id(issue_id):
        if "status" in issue:
            new_status = issue["status"]
            update_data = {"status": new_status, "updated_at": now()}
            if new_status == "Resolved":
                update_data["resolved_at"] = now()
            comments_collection.update_one(
                {"_id": ObjectId(issue_id)},
                {"$set": update_data}
            )
        return {"message": "MongoDB issue updated"}

    db_issue = db.query(DB_Issue).filter(DB_Issue.id == int(issue_id)).first()
    if db_issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    if "status" in issue:
        new_status = issue["status"]
        db_issue.status = new_status
        db_issue.updated_at = now()
        if new_status == "Resolved":
            db_issue.resolved_at = now()
            create_notification(db, f"✅ Your issue '{db_issue.title}' has been resolved!", "citizen", db_issue.id)
        else:
            create_notification(db, f"🔄 Issue '{db_issue.title}' status updated to: {new_status}", "citizen", db_issue.id)
    if "title" in issue:
        db_issue.title = issue["title"]
    if "description" in issue:
        db_issue.description = issue["description"]
    if "location" in issue:
        db_issue.location = issue["location"]
    
    db.commit()
    db.refresh(db_issue)
    return db_issue
