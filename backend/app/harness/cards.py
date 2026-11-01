"""Agent cards: one YAML file per agent in backend/agents/."""
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from ..config import get_settings


@dataclass(frozen=True)
class AgentCard:
    id: str
    name: str
    purpose: str
    role_prompt: str
    tools: tuple[str, ...]
    model: str = "slm"  # slm (local, default) | llm (escalation tier)
    max_steps: int = 6
    max_tool_calls: int = 8
    max_tokens: int = 12000
    timeout_s: int = 120
    run_permission: str = "agent:run"
    owner: str = "architecture"
    version: str = "1"
    tags: tuple[str, ...] = field(default_factory=tuple)

    def public(self) -> dict:
        return {k: (list(v) if isinstance(v, tuple) else v) for k, v in self.__dict__.items() if k != "role_prompt"} | {
            "role_prompt": self.role_prompt}


def _load(path: Path) -> AgentCard:
    raw = yaml.safe_load(path.read_text())
    raw["tools"] = tuple(raw.get("tools", []))
    raw["tags"] = tuple(raw.get("tags", []))
    card = AgentCard(**raw)
    if card.id != path.stem:
        raise ValueError(f"{path.name}: id must match the file name")
    return card


def load_cards(directory: Path | None = None) -> dict[str, AgentCard]:
    d = directory or get_settings().agents_dir
    return {c.id: c for c in (_load(p) for p in sorted(d.glob("*.yaml")))}
