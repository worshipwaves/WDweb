"""
Review feedback endpoint for focus group site review.
Remove this file after review cycle.
"""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from database import get_db, ReviewFeedback

router = APIRouter(prefix="/api/review", tags=["review"])


class ReviewFeedbackIn(BaseModel):
    page: str
    comment: str
    name: str = ""


@router.post("/feedback")
async def submit_feedback(fb: ReviewFeedbackIn):
    """Receive a single feedback submission from the review site."""
    with get_db() as session:
        row = ReviewFeedback(page=fb.page, comment=fb.comment, name=fb.name)
        session.add(row)
    return {"status": "ok"}


@router.get("/feedback")
async def list_feedback():
    """View all collected feedback as JSON."""
    with get_db() as session:
        return {"feedback": [
            {"id": r.id, "page": r.page, "comment": r.comment, "name": r.name, "timestamp": r.created_at.isoformat()}
            for r in session.query(ReviewFeedback).order_by(ReviewFeedback.created_at.desc()).all()
        ]}


@router.get("/feedback/report", response_class=HTMLResponse)
async def feedback_report():
    """View all feedback as a readable HTML table."""
    with get_db() as session:
        rows = [
            (r.created_at.isoformat()[:19], r.page, r.comment, r.name)
            for r in session.query(ReviewFeedback).order_by(ReviewFeedback.created_at.desc()).all()
        ]
    html = "<html><head><style>body{font-family:sans-serif;margin:40px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#333;color:#fff}tr:nth-child(even){background:#f5f5f5}</style></head><body>"
    html += f"<h2>Review Feedback ({len(rows)} submissions)</h2>"
    html += "<table><tr><th>Time</th><th>Page</th><th>Comment</th><th>Name</th></tr>"
    for ts, page, comment, name in rows:
        html += f"<tr><td>{ts}</td><td>{page}</td><td>{comment}</td><td>{name}</td></tr>"
    html += "</table></body></html>"
    return html