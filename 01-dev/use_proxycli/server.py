"""
AI Proxy 橋接伺服器
讓 Next.js 透過 OpenAI 相容格式呼叫 proxy.py（gRPC）

啟動：uvicorn server:app --host 127.0.0.1 --port 8765
"""

import json
import time
import uuid
from typing import AsyncGenerator

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from proxy import ai, ai_stream

app = FastAPI(title="AI Proxy Bridge", version="1.0.0")

# 只允許本機 Next.js 呼叫
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


def _build_prompt(messages: list[dict]) -> tuple[str, str]:
    """把 OpenAI messages 格式轉成 (system, prompt)"""
    system = ""
    turns = []

    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if not isinstance(content, str):
            # 處理 content 是 parts 陣列的情況（AI SDK v6 UIMessage）
            content = " ".join(
                p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"
            )
        if role == "system":
            system = content
        elif role == "user":
            turns.append(f"Human: {content}")
        elif role == "assistant":
            turns.append(f"Assistant: {content}")

    prompt = "\n".join(turns)
    return system, prompt


def _make_chunk(content: str, chat_id: str, model: str, finish: bool = False) -> str:
    chunk = {
        "id": chat_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": {} if finish else {"content": content},
                "finish_reason": "stop" if finish else None,
            }
        ],
    }
    return f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"


async def _stream_response(
    system: str, prompt: str, model: str, max_tokens: int, project: str
) -> AsyncGenerator[str, None]:
    chat_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

    # 首個 chunk：role
    role_chunk = {
        "id": chat_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
    }
    yield f"data: {json.dumps(role_chunk)}\n\n"

    # 內容串流
    for chunk_text in ai_stream(
        prompt=prompt,
        provider="claude",
        model=model,
        system=system,
        max_tokens=max_tokens,
        project=project,
    ):
        yield _make_chunk(chunk_text, chat_id, model)

    # 結束
    yield _make_chunk("", chat_id, model, finish=True)
    yield "data: [DONE]\n\n"


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    messages: list = body.get("messages", [])
    model: str = body.get("model", "claude-sonnet-4-6")
    stream: bool = body.get("stream", False)
    max_tokens: int = body.get("max_tokens", 600)
    project: str = body.get("project", "agent-lifementor")

    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")

    system, prompt = _build_prompt(messages)

    if stream:
        return StreamingResponse(
            _stream_response(system, prompt, model, max_tokens, project),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    # 非串流
    try:
        text = ai(
            prompt=prompt,
            provider="claude",
            model=model,
            system=system,
            max_tokens=max_tokens,
            project=project,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse({
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    })


@app.get("/health")
async def health():
    return {"status": "ok"}
