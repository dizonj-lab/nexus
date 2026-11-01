import time


class BudgetExceeded(Exception):
    pass


class Budget:
    def __init__(self, max_steps: int, max_tool_calls: int, max_tokens: int, timeout_s: int):
        self.max_steps, self.max_tool_calls, self.max_tokens = max_steps, max_tool_calls, max_tokens
        self.deadline = time.monotonic() + timeout_s
        self.steps = self.tool_calls = self.tokens = 0

    def step(self) -> None:
        if self.steps >= self.max_steps:
            raise BudgetExceeded(f"step limit ({self.max_steps}) reached")
        if time.monotonic() > self.deadline:
            raise BudgetExceeded("time limit reached")
        self.steps += 1

    def tool(self) -> None:
        if self.tool_calls >= self.max_tool_calls:
            raise BudgetExceeded(f"tool-call limit ({self.max_tool_calls}) reached")
        self.tool_calls += 1

    def charge(self, tokens: int) -> None:
        self.tokens += tokens
        if self.tokens > self.max_tokens:
            raise BudgetExceeded(f"token limit ({self.max_tokens}) reached")

    def remaining_s(self) -> float:
        return max(1.0, self.deadline - time.monotonic())
