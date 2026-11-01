"""Settings from the environment (prefix NEXUS_)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-change-me-dev-only-change-me"
ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NEXUS_", env_file=".env", extra="ignore")

    env: str = "development"  # development | production
    database_url: str = f"sqlite:///{ROOT / 'nexus-dev.db'}"
    secret_key: str = DEV_SECRET
    session_hours: int = 8
    cookie_secure: bool = False  # true behind HTTPS
    # First administrator, created on start-up when no user exists yet.
    admin_email: str = ""
    admin_password: str = ""
    admin_name: str = "Administrator"
    # Model server (OpenAI-compatible, e.g. Ollama). "slm" is the default tier, "llm" the escalation tier.
    llm_base_url: str = "http://host.docker.internal:11434/v1"
    llm_api_key: str = ""
    slm_model: str = "qwen2.5:7b-instruct"
    llm_model: str = "gpt-oss:latest"
    llm_timeout_s: float = 120.0
    agents_dir: Path = ROOT / "agents"
    login_max_failures: int = 5
    login_lock_minutes: int = 15

    def check(self) -> None:
        if self.env == "production":
            if self.secret_key == DEV_SECRET or len(self.secret_key) < 32:
                raise RuntimeError("NEXUS_SECRET_KEY must be set to 32+ random characters in production")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.check()
    return s
