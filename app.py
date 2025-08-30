import os, requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# serve frontend
@app.get("/")
async def index():
    return FileResponse("index.html")

# proxy search
@app.get("/search")
async def google_search_proxy(
    q: str = Query(...), key: str = Query(...), cx: str = Query(...), num: int = Query(5)
):
    url = "https://www.googleapis.com/customsearch/v1"
    params = {"q": q, "key": key, "cx": cx, "num": min(10, max(1, num))}
    r = requests.get(url, params=params, timeout=10)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=r.text)
    data = r.json()
    items = []
    for it in data.get("items", []):
        items.append({"title": it.get("title"), "snippet": it.get("snippet"), "link": it.get("link")})
    return {"query": q, "items": items}

# generate endpoint stub
@app.post("/generate")
async def generate(payload: dict):
    # For POC: echo back + simulate tool call
    msgs = payload.get("messages", [])
    last = msgs[-1]["content"] if msgs else ""
    if "search" in last.lower():
        return {"output": "", "tool_calls": [{"name":"web_search","arguments":{"query":"IBM"}}]}
    return {"output": f"Echo: {last}"}
