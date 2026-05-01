"""
CrowdSolve AI Engine - Issue Analyzer
Automatically detects category and severity from issue text.
"""

# Category keyword rules
CATEGORY_RULES = {
    "Road":        ["pothole", "road", "street", "broken road"],
    "Water":       ["water", "pipe", "leak", "drain", "sewage"],
    "Electricity": ["electric", "power", "light", "pole", "wire"],
    "Garbage":     ["garbage", "trash", "waste", "dump"],
}

# Severity keyword rules (checked in priority order)
SEVERITY_RULES = [
    ("High",   ["accident", "danger", "huge", "major", "severe"]),
    ("Medium", ["large", "broken", "problem"]),
    ("Low",    ["small", "minor"]),
]

# Department mapping based on category
DEPARTMENT_MAP = {
    "Road":        "Road & Infrastructure Department",
    "Water":       "Water Supply Department",
    "Electricity": "Electricity Board",
    "Garbage":     "Sanitation Department",
    "Medical":     "Emergency Services",
    "Other":       "General Municipal Department",
}


def analyze_issue(text: str) -> dict:
    """
    Analyze the given issue text and return its detected category, severity, and department.

    Args:
        text: The combined issue title and/or description.

    Returns:
        A dict with keys 'category', 'severity', and 'department'.
    """
    lower_text = text.lower()

    # --- Detect Category ---
    category = "Other"
    for cat, keywords in CATEGORY_RULES.items():
        if any(keyword in lower_text for keyword in keywords):
            category = cat
            break

    # Medical/Emergency check — runs before the Other fallback is accepted
    medical_keywords = ["blood", "hospital", "ambulance", "injury", "medical", "doctor"]
    if category == "Other" and any(word in lower_text for word in medical_keywords):
        category = "Medical"

    # --- Detect Severity ---
    severity = "Low"  # default
    for level, keywords in SEVERITY_RULES:
        if any(keyword in lower_text for keyword in keywords):
            severity = level
            break

    # --- Assign Department ---
    if category == "Road":
        department = "Road & Infrastructure Department"
    elif category == "Water":
        department = "Water Supply Department"
    elif category == "Electricity":
        department = "Electricity Board"
    elif category == "Garbage":
        department = "Sanitation Department"
    elif category == "Medical":
        department = "Emergency Services"
    else:
        department = "General Municipal Department"

    return {
        "category": category,
        "severity": severity,
        "department": department,
    }
