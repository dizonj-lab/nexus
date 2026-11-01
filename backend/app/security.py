"""Passwords, session tokens and the login throttle."""
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

from .config import get_settings

COOKIE = "nexus_session"
_ph = PasswordHasher()
MIN_PASSWORD = 10


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, pw)
    except (VerificationError, Exception):
        return False


def password_problem(pw: str) -> str | None:
    if len(pw) < MIN_PASSWORD:
        return f"Use at least {MIN_PASSWORD} characters."
    if pw.lower() == pw or pw.upper() == pw or not any(c.isdigit() for c in pw):
        return "Mix upper and lower case letters and at least one digit."
    return None


def make_token(user_id: int, session_version: int) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "sv": session_version, "iat": now, "exp": now + timedelta(hours=s.session_hours)}
    return jwt.encode(payload, s.secret_key, algorithm="HS256")


def read_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


class LoginThrottle:
    """Locks an email (per client address) after repeated failures. In memory: one API process per site for now."""

    def __init__(self):
        self.fails: dict[str, list[float]] = defaultdict(list)

    def _key(self, email: str, ip: str) -> str:
        return f"{email.lower()}|{ip}"

    def locked(self, email: str, ip: str) -> bool:
        s = get_settings()
        window = s.login_lock_minutes * 60
        k = self._key(email, ip)
        self.fails[k] = [t for t in self.fails[k] if time.time() - t < window]
        return len(self.fails[k]) >= s.login_max_failures

    def fail(self, email: str, ip: str) -> None:
        self.fails[self._key(email, ip)].append(time.time())

    def clear(self, email: str, ip: str) -> None:
        self.fails.pop(self._key(email, ip), None)


throttle = LoginThrottle()
