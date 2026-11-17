import os
from dataclasses import dataclass, field

from groq import Groq
from groq import RateLimitError, APIStatusError
from tenacity import retry, wait_exponential_jitter, stop_after_attempt, retry_if_exception_type
from dotenv import load_dotenv

load_dotenv()


class BudgetExceeded(Exception):
    """Raised when an agent has spent its token budget — controller marks task failed."""


@dataclass
class Budget:
    max_tokens: int = 200_000
    max_calls: int = 40
    used_tokens: int = 0
    used_calls: int = 0

    def charge(self, tokens: int):
        self.used_tokens += tokens
        self.used_calls += 1
        if self.used_tokens > self.max_tokens or self.used_calls > self.max_calls:
            raise BudgetExceeded(
                f"budget exceeded: {self.used_tokens} tok / {self.used_calls} calls "
                f"(limits {self.max_tokens}/{self.max_calls})"
            )


@dataclass
class LLMClient:
    model: str = "openai/gpt-oss-120b"
    temperature: float = 0.2
    budget: Budget = field(default_factory=Budget)

    def __post_init__(self):
        self._client = Groq(api_key=os.environ["GROQ_API_KEY"])

    @retry(
        retry=retry_if_exception_type((RateLimitError, APIStatusError)),
        wait=wait_exponential_jitter(initial=2, max=30),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    def chat(self, messages: list[dict], tools: list[dict] | None = None) -> dict:
        """
        One LLM round-trip. Returns the raw Groq response dict (OpenAI shape).
        Raises BudgetExceeded if this agent has spent its allowance.
        """
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=tools or None,
            tool_choice="auto" if tools else "none",
            temperature=self.temperature,
        )
        self.budget.charge(resp.usage.total_tokens)
        return resp.model_dump()