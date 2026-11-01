"""python -m app.cli create-admin --email you@example.com --name "Your Name"   (prompts for the password)"""
import argparse
import getpass
import sys

from sqlalchemy import func, select

from .db import SessionLocal
from .models import User
from .security import hash_password, password_problem


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create-admin", help="create an administrator, or reset one's password")
    c.add_argument("--email", required=True)
    c.add_argument("--name", default="Administrator")
    a = ap.parse_args(argv)
    pw = getpass.getpass("Password: ")
    if problem := password_problem(pw):
        print(problem, file=sys.stderr)
        return 1
    if pw != getpass.getpass("Again: "):
        print("Passwords differ.", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        u = db.scalar(select(User).where(func.lower(User.email) == a.email.lower()))
        if u:
            u.password_hash, u.system_role, u.active = hash_password(pw), "admin", True
            u.session_version += 1
        else:
            db.add(User(email=a.email.lower(), name=a.name, password_hash=hash_password(pw), system_role="admin"))
        db.commit()
    print(f"Administrator {a.email} is ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
