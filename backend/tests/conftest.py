import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["NEXUS_DATABASE_URL"] = os.environ.get("NEXUS_TEST_DATABASE_URL") or f"sqlite:///{_tmp}/test.db"
os.environ["NEXUS_ADMIN_EMAIL"] = "admin@nexus.test"
os.environ["NEXUS_ADMIN_PASSWORD"] = "Admin-Pass-2026"
os.environ["NEXUS_SECRET_KEY"] = "test-secret-test-secret-test-secret-42"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.security import throttle  # noqa: E402

H = {"X-Nexus-Client": "test"}
PW = "Strong-Pass-2026"


class Api:
    def __init__(self, client: TestClient):
        self.c = client

    def get(self, url, **kw):
        return self.c.get(url, **kw)

    def post(self, url, json=None, **kw):
        return self.c.post(url, json=json, headers=H, **kw)

    def put(self, url, json=None, **kw):
        return self.c.put(url, json=json, headers=H, **kw)

    def patch(self, url, json=None, **kw):
        return self.c.patch(url, json=json, headers=H, **kw)

    def delete(self, url, **kw):
        return self.c.delete(url, headers=H, **kw)


@pytest.fixture()
def fresh():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    throttle.fails.clear()
    yield


def login(email, password) -> Api:
    c = TestClient(app)
    c.__enter__()
    api = Api(c)
    r = api.post("/api/auth/login", {"email": email, "password": password})
    assert r.status_code == 200, r.text
    return api


@pytest.fixture()
def admin(fresh) -> Api:
    return login("admin@nexus.test", "Admin-Pass-2026")


@pytest.fixture()
def make_user(admin):
    def make(email, name="User", role="member") -> Api:
        r = admin.post("/api/admin/users", {"email": email, "name": name, "password": PW, "system_role": role})
        assert r.status_code == 201, r.text
        return login(email, PW)
    return make
