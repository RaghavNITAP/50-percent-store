import httpx
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-oss-120b",
                "messages": [{"role": "user", "content": "Nike shoes under 5000"}],
                "max_tokens": 300
            },
            timeout=10.0
        )
        print(r.status_code)
        print(r.text)

asyncio.run(test())