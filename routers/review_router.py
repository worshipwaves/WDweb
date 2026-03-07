"""
Review feedback endpoint for focus group site review.
Remove this file after review cycle.
"""

import csv
import os
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/review", tags=["review"])

FEEDBACK_FILE = "review_feedback.csv"


class ReviewFeedback(BaseModel):
    page: str
    comment: str
    name: str = ""


@router.post("/feedback")
async def submit_feedback(fb: ReviewFeedback):
    """Receive a single feedback submission from the review site."""
    file_exists = os.path.exists(FEEDBACK_FILE)
    with open(FEEDBACK_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["timestamp", "page", "comment", "name"])
        writer.writerow([
            datetime.now(timezone.utc).isoformat(),
            fb.page,
            fb.comment,
            fb.name
        ])
    return {"status": "ok"}


@router.get("/feedback")
async def list_feedback():
    """View all collected feedback. For your eyes only."""
    if not os.path.exists(FEEDBACK_FILE):
        return {"feedback": []}
    with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {"feedback": list(reader)}
