"""Tool policy: an agent gets the tools on its card that the person running it may use."""
from .cards import AgentCard
from .tools import REGISTRY


def effective_tools(card: AgentCard, perms: set[str]) -> tuple[list[str], list[dict]]:
    allowed, denied = [], []
    for name in card.tools:
        tool = REGISTRY.get(name)
        if tool is None:
            denied.append({"tool": name, "reason": "not registered"})
        elif tool.permission not in perms:
            denied.append({"tool": name, "reason": f"your role lacks {tool.permission}"})
        else:
            allowed.append(name)
    return allowed, denied
