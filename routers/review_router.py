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
            (r.id, r.created_at.isoformat()[:19], r.page, r.comment, r.name)
            for r in session.query(ReviewFeedback).order_by(ReviewFeedback.created_at.desc()).all()
        ]
    html = "<html><head><style>body{font-family:sans-serif;margin:40px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#333;color:#fff}tr:nth-child(even){background:#f5f5f5}</style></head><body>"
    html += f"<h2>Review Feedback ({len(rows)} submissions)</h2>"
    html += "<table><tr><th>Time</th><th>Page</th><th>Comment</th><th>Name</th></tr>"
    for rid, ts, page, comment, name in rows:
        short_page = page.split('/')[-1] or 'index.html'
        short_comment = (comment[:80] + '…') if len(comment) > 80 else comment
        html += f'<tr style="cursor:pointer" onclick="window.location=\'/api/review/feedback/{rid}\'">'
        html += f"<td>{ts}</td><td>{short_page}</td><td>{short_comment}</td><td>{name}</td></tr>"
    html += "</table></body></html>"
    return html
    
    
@router.get("/feedback/{feedback_id}", response_class=HTMLResponse)
async def feedback_detail(feedback_id: int):
    """View a single feedback submission."""
    with get_db() as session:
        r = session.query(ReviewFeedback).filter_by(id=feedback_id).first()
        if not r:
            return HTMLResponse("<h2>Not found</h2>", status_code=404)
        data = (r.id, r.created_at.isoformat()[:19], r.page, r.comment, r.name)
    rid, ts, page, comment, name = data
    html = "<html><head><style>body{font-family:sans-serif;margin:40px;max-width:800px}"
    html += "label{font-weight:bold;display:block;margin-top:20px;color:#666;font-size:0.85rem}"
    html += "p{margin:4px 0 0;font-size:1rem;line-height:1.6}a{color:#333}</style></head><body>"
    html += '<a href="/api/review/feedback/report">&larr; Back to report</a>'
    html += f"<h2>Feedback #{rid}</h2>"
    html += f"<label>Time</label><p>{ts}</p>"
    html += f"<label>Page</label><p><a href=\"{page}\" target=\"_blank\">{page}</a></p>"
    html += f"<label>Name</label><p>{name or '(anonymous)'}</p>"
    html += f"<label>Comment</label><p>{comment}</p>"
    html += "</body></html>"
    return html    