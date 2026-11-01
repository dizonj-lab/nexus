from fastapi.testclient import TestClient

from app.main import app

from .conftest import H, PW, login


def test_health():
    assert TestClient(app).get("/healthz").json()["status"] == "ok"


def test_bootstrap_admin_and_me(admin):
    me = admin.get("/api/auth/me").json()
    assert me["system_role"] == "admin" and me["email"] == "admin@nexus.test"


def test_wrong_password_is_generic_and_locks(fresh):
    with TestClient(app) as c:
        for _ in range(5):
            r = c.post("/api/auth/login", json={"email": "admin@nexus.test", "password": "nope"}, headers=H)
            assert r.status_code == 401 and r.json()["detail"] == "Email or password is not correct."
        r = c.post("/api/auth/login", json={"email": "admin@nexus.test", "password": "Admin-Pass-2026"}, headers=H)
        assert r.status_code == 429


def test_unknown_user_same_message(fresh):
    with TestClient(app) as c:
        r = c.post("/api/auth/login", json={"email": "ghost@nexus.test", "password": "x"}, headers=H)
        assert r.status_code == 401 and r.json()["detail"] == "Email or password is not correct."


def test_mutations_need_client_header(admin):
    r = admin.c.post("/api/projects", json={"name": "X"})
    assert r.status_code == 403


def test_anonymous_blocked(fresh):
    with TestClient(app) as c:
        assert c.get("/api/projects").status_code == 401
        assert c.get("/api/auth/check").status_code == 401


def test_logout_and_check(admin):
    assert admin.get("/api/auth/check").status_code == 204
    admin.post("/api/auth/logout")
    assert admin.get("/api/auth/me").status_code == 401


def test_deactivation_revokes_session(admin, make_user):
    bob = make_user("bob@nexus.test")
    uid = bob.get("/api/auth/me").json()["id"]
    assert admin.patch(f"/api/admin/users/{uid}", {"active": False}).status_code == 200
    assert bob.get("/api/auth/me").status_code == 401


def test_admin_only_user_management(make_user):
    bob = make_user("bob@nexus.test")
    assert bob.get("/api/admin/users").status_code == 403
    assert bob.post("/api/admin/users", {"email": "x@y.z", "name": "x", "password": PW}).status_code == 403


def test_weak_password_rejected(admin):
    r = admin.post("/api/admin/users", {"email": "w@nexus.test", "name": "W", "password": "short"})
    assert r.status_code == 400


def test_password_change_revokes_other_sessions(admin, make_user):
    make_user("carol@nexus.test")
    s1, s2 = login("carol@nexus.test", PW), login("carol@nexus.test", PW)
    assert s1.post("/api/auth/password", {"current": PW, "new": "Newer-Pass-2027"}).status_code == 204
    assert s1.get("/api/auth/me").status_code == 200  # gets a fresh cookie
    assert s2.get("/api/auth/me").status_code == 401


def test_admin_cannot_demote_self(admin):
    me = admin.get("/api/auth/me").json()
    assert admin.patch(f"/api/admin/users/{me['id']}", {"system_role": "member"}).status_code == 400


def test_audit_records_logins(admin):
    actions = [e["action"] for e in admin.get("/api/admin/audit").json()]
    assert "auth.login" in actions and "user.bootstrap_admin" in actions
