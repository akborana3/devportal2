import os
import json
import re
import httpx
import subprocess
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.database import get_username, DB_FILE
import sqlite3

router = APIRouter()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")

OPENROUTER_URL = "https://" + "openrouter.ai/api/v1/chat/completions"
NVIDIA_URL = "https://" + "integrate.api.nvidia.com/v1/chat/completions"
REFERER_URL = "https://" + "huggingface.co/"

@router.post("/api/ai_edit")
async def ai_edit(data: dict):
    prompt, content = data.get("prompt"), data.get("content")
    messages = [
        {"role": "system", "content": "You are an expert coder. Rewrite the provided code based on the user's request. Output ONLY the raw updated code. Do not use markdown blocks like ```python. No conversational text."},
        {"role": "user", "content": f"Current Code:\n{content}\n\nRequest: {prompt}"}
    ]
    payload = {"model": "openrouter/auto", "messages": messages}
    
    try:
        headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": REFERER_URL}
        async with httpx.AsyncClient(trust_env=False) as client:
            res = await client.post(OPENROUTER_URL, headers=headers, json=payload, timeout=60.0)
            if res.status_code != 200:
                return {"code": f"# API_ERROR: {res.text}"}
            new_code = res.json()['choices'][0]['message']['content']
    except Exception as httpx_err:
        try:
            cmd = [
                "curl", "--noproxy", "*", "-s", "-X", "POST", OPENROUTER_URL,
                "-H", f"Authorization: Bearer {OPENROUTER_API_KEY}",
                "-H", "Content-Type: application/json",
                "-H", f"HTTP-Referer: {REFERER_URL}",
                "-d", json.dumps(payload)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                return {"code": f"# CURL_NETWORK_ERROR: {result.stderr}\n# HTTPX_ERROR: {str(httpx_err)}"}
            res_json = json.loads(result.stdout)
            new_code = res_json['choices'][0]['message']['content']
        except Exception as curl_err:
            return {"code": f"# FATAL_NETWORK_ERROR. HTTPX: {str(httpx_err)} | CURL: {str(curl_err)}"}

    new_code = re.sub(r"^```[a-z]*\n", "", new_code)
    new_code = re.sub(r"\n```$", "", new_code)
    return {"code": new_code.strip()}

async def ask_openrouter(messages) -> str:
    if not OPENROUTER_API_KEY:
        return "API_ERROR: OPENROUTER_API_KEY is not set in Spaces Secrets."
    data = {"model": "openrouter/auto", "messages": messages}
    try:
        headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": REFERER_URL}
        async with httpx.AsyncClient(trust_env=False) as client:
            response = await client.post(OPENROUTER_URL, headers=headers, json=data, timeout=45.0)
            if response.status_code != 200: return f"API_ERROR: {response.text}"
            return response.json()['choices'][0]['message']['content']
    except Exception as e:
        httpx_error = str(e)
        try:
            cmd = [
                "curl", "--noproxy", "*", "-s", "-X", "POST", OPENROUTER_URL,
                "-H", f"Authorization: Bearer {OPENROUTER_API_KEY}",
                "-H", "Content-Type: application/json",
                "-H", f"HTTP-Referer: {REFERER_URL}",
                "-d", json.dumps(data)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
            if result.returncode != 0:
                return f"CURL_NETWORK_ERROR: {result.stderr}\nHTTPX_ERROR: {httpx_error}"
            res_json = json.loads(result.stdout)
            if "error" in res_json:
                return f"API_ERROR: {json.dumps(res_json['error'])}"
            return res_json['choices'][0]['message']['content']
        except Exception as curl_e:
            return f"FATAL_NETWORK_ERROR\nHTTPX Error: {httpx_error}\nCURL Error: {str(curl_e)}"

@router.post("/api/chat")
async def chat_with_ai(data: dict):
    token = data.get("token")
    user_msg = data.get("message")
    history = data.get("history", [])
    model = data.get("model", "openrouter/auto")
    openrouter_key = data.get("openrouter_key", "").strip()
    nvidia_key = data.get("nvidia_key", "").strip()
    sys_prompt = data.get("system_prompt", "You are a helpful coding assistant.")

    # Determine which API URL and Key to use based on the selected model
    is_nvidia_model = model.startswith("meta/llama3") or model == "nvidia/llama3-chatqa-1.5-8b"

    if is_nvidia_model:
        api_key = nvidia_key if nvidia_key else NVIDIA_API_KEY
        base_url = NVIDIA_URL
        if not api_key:
            # Fallback to OpenRouter if no NVIDIA key exists but they requested an open model
            api_key = openrouter_key if openrouter_key else OPENROUTER_API_KEY
            base_url = OPENROUTER_URL
    else:
        api_key = openrouter_key if openrouter_key else OPENROUTER_API_KEY
        base_url = OPENROUTER_URL

    if not api_key:
        async def err_stream(): yield "Error: No API Key provided in Settings or Environment."
        return StreamingResponse(err_stream(), media_type="text/plain")

    messages = [{"role": "system", "content": sys_prompt}] + history + [{"role": "user", "content": user_msg}]
    payload = {"model": model, "messages": messages, "stream": True}

    async def stream_generator():
        headers = {"Authorization": f"Bearer {api_key}", "HTTP-Referer": REFERER_URL}
        try:
            async with httpx.AsyncClient(trust_env=False) as client:
                async with client.stream("POST", base_url, headers=headers, json=payload, timeout=60.0) as response:
                    if response.status_code != 200:
                        err = await response.aread()
                        yield f"API Error: {err.decode('utf-8')}"
                        return

                    full_reply = ""
                    async for line in response.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            try:
                                data_chunk = json.loads(line[6:])
                                content_chunk = data_chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if content_chunk:
                                    full_reply += content_chunk
                                    yield content_chunk
                            except json.JSONDecodeError:
                                pass

                    # After successful stream, save to DB
                    if full_reply:
                        username = get_username(token)
                        if username:
                            conn = sqlite3.connect(DB_FILE)
                            c = conn.cursor()
                            c.execute("INSERT INTO ai_history (username, role, content) VALUES (?, ?, ?)", (username, 'user', user_msg))
                            c.execute("INSERT INTO ai_history (username, role, content) VALUES (?, ?, ?)", (username, 'assistant', full_reply))
                            conn.commit()
                            conn.close()

        except Exception as e:
            yield f"\n\n**Network Error:** {str(e)}"
    return StreamingResponse(stream_generator(), media_type="text/plain")

@router.post("/api/chat/history")
async def get_chat_history(data: dict):
    username = get_username(data.get("token"))
    if not username: return {"error": "Unauthorized"}

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT role, content FROM ai_history WHERE username=? ORDER BY timestamp ASC", (username,))
    history = [{"role": row[0], "content": row[1]} for row in c.fetchall()]
    conn.close()

    return {"history": history}

@router.post("/api/chat/history/clear")
async def clear_chat_history(data: dict):
    username = get_username(data.get("token"))
    if not username: return {"error": "Unauthorized"}

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("DELETE FROM ai_history WHERE username=?", (username,))
    conn.commit()
    conn.close()

    return {"success": True}
