"""Model clients. The router picks the tier from the card: slm (local first) or llm (escalation)."""
from dataclasses import dataclass
from typing import Protocol

import httpx

from ..config import get_settings


@dataclass
class Reply:
    text: str
    tokens: int
    model: str


class ModelClient(Protocol):
    name: str

    def complete(self, messages: list[dict], timeout_s: float) -> Reply: ...


class OpenAICompatible:
    """Any OpenAI-compatible endpoint: Ollama on Buddy, vLLM, or LiteLLM in front of a cloud model."""

    def __init__(self, base_url: str, model: str, api_key: str = ""):
        self.base_url, self.name, self.api_key = base_url.rstrip("/"), model, api_key

    def complete(self, messages: list[dict], timeout_s: float) -> Reply:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        body = {"model": self.name, "messages": messages, "temperature": 0.2,
                "response_format": {"type": "json_object"}}
        r = httpx.post(f"{self.base_url}/chat/completions", json=body, headers=headers, timeout=timeout_s)
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage") or {}
        text = data["choices"][0]["message"].get("content") or ""
        return Reply(text, int(usage.get("total_tokens") or (len(text) // 4)), self.name)


class ScriptedModel:
    """Replays fixed replies. Used by tests and offline evals."""

    def __init__(self, replies: list[str], name: str = "scripted"):
        self.replies, self.name, self.seen = list(replies), name, []

    def complete(self, messages: list[dict], timeout_s: float) -> Reply:
        self.seen.append(messages)
        text = self.replies.pop(0) if self.replies else '{"action":"final","answer":"(no more scripted replies)"}'
        return Reply(text, 50, self.name)


def route(tier: str) -> ModelClient:
    s = get_settings()
    return OpenAICompatible(s.llm_base_url, s.llm_model if tier == "llm" else s.slm_model, s.llm_api_key)
