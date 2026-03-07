"""
Review feedback endpoint for focus group site review.
Remove this file after review cycle.
"""

import csv
import os
from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
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
        
@router.get("/feedback/report", response_class=HTMLResponse)
async def feedback_report():
    """View all feedback as a readable HTML table."""
    if not os.path.exists(FEEDBACK_FILE):
        rows = []
    else:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    html = "<html><head><style>body{font-family:sans-serif;margin:40px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#333;color:#fff}tr:nth-child(even){background:#f5f5f5}</style></head><body>"
    html += f"<h2>Review Feedback ({len(rows)} submissions)</h2>"
    html += "<table><tr><th>Time</th><th>Page</th><th>Comment</th><th>Name</th></tr>"
    for r in rows:
        html += f"<tr><td>{r.get('timestamp','')[:19]}</td><td>{r.get('page','')}</td><td>{r.get('comment','')}</td><td>{r.get('name','')}</td></tr>"
    html += "</table></body></html>"
    return html        
