"""
Review feedback endpoint for focus group site review.
Remove this file after review cycle.
"""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from zoneinfo import ZoneInfo
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
async def feedback_report(source: str = None, sort: str = None):
    """View all feedback as a readable HTML table. Filter: ?source=book|website  Sort: ?sort=page|name|status"""
    with get_db() as session:
        sort_col = {
            "page": ReviewFeedback.page,
            "name": ReviewFeedback.name,
            "status": ReviewFeedback.status,
            "time": ReviewFeedback.created_at.desc(),
        }.get(sort, ReviewFeedback.created_at.desc())
        query = session.query(ReviewFeedback).order_by(sort_col)
        if source == "book":
            query = query.filter(ReviewFeedback.page.contains("three-wounds.netlify.app"))
        elif source == "website":
            query = query.filter(ReviewFeedback.page.contains("worshipwaves.netlify.app"))
        utc = ZoneInfo("UTC")
        pac = ZoneInfo("America/Los_Angeles")
        rows = [
            (r.id, r.created_at.replace(tzinfo=utc).astimezone(pac).strftime("%Y-%m-%d %I:%M %p"), r.page, r.comment, r.name, r.status or 'open', r.response_note or '')
            for r in query.all()
        ]
    html = "<html><head><style>body{font-family:sans-serif;margin:40px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#333;color:#fff}tr:nth-child(even){background:#f5f5f5}</style></head><body>"
    label = "All" if not source else source.title()
    html += f"<h2>Review Feedback — {label} ({len(rows)} submissions)</h2>"
    html += '<p><a href="/api/review/feedback/report">All</a> &middot; <a href="/api/review/feedback/report?source=website">Website</a> &middot; <a href="/api/review/feedback/report?source=book">Book</a></p>'
    qs = f"source={source}&" if source else ""
    html += f'<table><tr><th><a href="?{qs}sort=time" style="color:#fff">Time</a></th><th><a href="?{qs}sort=page" style="color:#fff">Page</a></th><th>Comment</th><th><a href="?{qs}sort=name" style="color:#fff">Name</a></th><th><a href="?{qs}sort=status" style="color:#fff">Status</a></th><th>Note</th></tr>'
    for rid, ts, page, comment, name, status, note in rows:
        short_page = page.split('/')[-1] or 'index.html'
        flat_comment = comment.replace(chr(10), ' ')
        short_comment = (flat_comment[:80] + '…') if len(flat_comment) > 80 else flat_comment
        short_note = (note[:60] + '…') if len(note) > 60 else note
        color = {"addressed": "#2a7b2a", "declined": "#999", "open": "#b08a4e"}.get(status, "#333")
        html += f'<tr style="cursor:pointer" onclick="window.location=\'/api/review/feedback/{rid}\'">'
        html += f'<td>{ts}</td><td>{short_page}</td><td>{short_comment}</td><td>{name}</td><td style="color:{color};font-weight:bold">{status}</td><td>{short_note}</td></tr>'
    html += "</table></body></html>"
    return html
    
    
@router.get("/feedback/{feedback_id}", response_class=HTMLResponse)
async def feedback_detail(feedback_id: int):
    """View a single feedback submission."""
    with get_db() as session:
        r = session.query(ReviewFeedback).filter_by(id=feedback_id).first()
        if not r:
            return HTMLResponse("<h2>Not found</h2>", status_code=404)
        utc = ZoneInfo("UTC")
        pac = ZoneInfo("America/Los_Angeles")
        data = (r.id, r.created_at.replace(tzinfo=utc).astimezone(pac).strftime("%Y-%m-%d %I:%M %p"), r.page, r.comment, r.name, r.status or 'open', r.response_note or '—')
    rid, ts, page, comment, name, status, note = data
    html = "<html><head><style>body{font-family:sans-serif;margin:40px;max-width:800px}"
    html += "label{font-weight:bold;display:block;margin-top:20px;color:#666;font-size:0.85rem}"
    html += "p{margin:4px 0 0;font-size:1rem;line-height:1.6}a{color:#333}</style></head><body>"
    html += '<a href="/api/review/feedback/report">&larr; Back to report</a>'
    html += f"<h2>Feedback #{rid}</h2>"
    html += f"<label>Time</label><p>{ts}</p>"
    html += f"<label>Page</label><p><a href=\"{page}\" target=\"_blank\">{page}</a></p>"
    html += f"<label>Name</label><p>{name or '(anonymous)'}</p>"
    html += f"<label>Comment</label><p>{comment.replace(chr(10), '<br>')}</p>"
    html += f"<label>Status</label><p>{status}</p>"
    html += f"<label>Response Note</label><p>{note}</p>"
    html += "</body></html>"
    return html    