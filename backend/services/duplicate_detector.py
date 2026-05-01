"""
CrowdSolve - Duplicate Issue Detector
Uses difflib SequenceMatcher to detect similar issues before a new report is saved.

Duplicate rule:
  - Location must match (case-insensitive)  AND
  - Description similarity must be > 0.75
"""

from difflib import SequenceMatcher


def _similarity(a: str, b: str) -> float:
    """Return similarity ratio between two strings (0.0 to 1.0)."""
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def check_duplicate_issue(new_description: str, new_location: str, existing_issues: list) -> dict:
    """
    Compare a new issue against all existing issues using location + description similarity.

    A duplicate is declared only when BOTH conditions are met:
      1. The locations match (case-insensitive comparison).
      2. The description similarity ratio exceeds 0.75.

    This prevents issues in different cities from being incorrectly merged.

    Args:
        new_description: Description text from the incoming report.
        new_location:    Location/city from the incoming report.
        existing_issues: List of database Issue objects.

    Returns:
        {
            "is_duplicate": True/False,
            "matched_issue": issue_object or None
        }
    """
    THRESHOLD = 0.75
    normalized_new_location = new_location.lower().strip()

    for issue in existing_issues:
        if not issue.description or not issue.location:
            continue

        # Step 1 — Location must match first (cheap check, skip similarity if not)
        if issue.location.lower().strip() != normalized_new_location:
            continue

        # Step 2 — Run description similarity only when locations match
        ratio = _similarity(new_description, issue.description)
        if ratio >= THRESHOLD:
            return {
                "is_duplicate": True,
                "matched_issue": issue
            }

    return {
        "is_duplicate": False,
        "matched_issue": None
    }
