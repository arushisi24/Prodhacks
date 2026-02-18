import os
import uuid
from typing import Dict

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from core import user_data, route_message_payload


app = FastAPI()

# In-memory session store (fine for MVP; resets if server restarts)
SESSIONS: Dict[str, user_data] = {}


def get_or_set_session_id(request: Request, response: Response) -> str:
    sid = request.cookies.get("sid")
    if not sid:
        sid = str(uuid.uuid4())
        response.set_cookie("sid", sid, httponly=True, samesite="lax")
    return sid


def get_state(sid: str) -> user_data:
    if sid not in SESSIONS:
        SESSIONS[sid] = user_data()
    return SESSIONS[sid]


def compute_progress(state: user_data) -> float:
    steps = [
        state.independent is not None,
        state.household_size is not None,
        state.income_range is not None,
        state.asset_range is not None,
    ]
    return sum(1 for s in steps if s) / len(steps)


# Serve static assets (JS/CSS)
app.mount("/static", StaticFiles(directory="static"), name="static")


def serve_html(filename: str) -> HTMLResponse:
    path = os.path.join("static", filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Missing {filename}")
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


# Pages that match your prototype files
@app.get("/", response_class=HTMLResponse)
def home():
    return serve_html("index.html")


@app.get("/checklist", response_class=HTMLResponse)
def checklist():
    return serve_html("checklist.html")


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    return serve_html("dashboard.html")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    path = os.path.join("static", "favicon.ico")
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404)


# API: chat
@app.post("/api/chat")
async def chat(request: Request, response: Response):
    sid = get_or_set_session_id(request, response)
    state = get_state(sid)

    data = await request.json()
    message = (data.get("message") or "").strip()

    payload = route_message_payload(state, message)
    return JSONResponse(payload)


@app.post("/api/reset")
async def reset(request: Request, response: Response):
    sid = get_or_set_session_id(request, response)
    SESSIONS[sid] = user_data()
    return {"ok": True}


@app.get("/api/state")
async def api_state(request: Request, response: Response):
    sid = get_or_set_session_id(request, response)
    st = get_state(sid)
    return {"mode": st.mode, "progress": compute_progress(st), "state": st.__dict__}
