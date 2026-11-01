import pytest

from app import design as dm


@pytest.fixture()
def team(admin, make_user):
    users = {r: make_user(f"{r}@nexus.test", r.title()) for r in ("owner", "lead", "architect", "security", "reviewer", "viewer", "outsider")}
    p = users["owner"].post("/api/projects", {"name": "Payments", "start": "sample"}).json()
    for r in ("lead", "architect", "security", "reviewer", "viewer"):
        assert users["owner"].put(f"/api/projects/{p['id']}/members", {"email": f"{r}@nexus.test", "role": r}).status_code == 200
    return p["id"], users


def save(api, pid, mutate=None):
    d = api.get(f"/api/projects/{pid}/design").json()
    design = d["design"]
    if mutate:
        mutate(design)
    return api.put(f"/api/projects/{pid}/design", {"design": design, "base_version": d["version"]})


def test_outsider_cannot_see_project(team):
    pid, u = team
    assert u["outsider"].get(f"/api/projects/{pid}").status_code == 404
    assert u["outsider"].get("/api/projects").json() == []


def test_admin_sees_all(admin, team):
    pid, _ = team
    assert any(p["id"] == pid and p["role"] == "owner" for p in admin.get("/api/projects").json())


@pytest.mark.parametrize("role,code", [("viewer", 403), ("reviewer", 403), ("security", 403), ("architect", 200),
                                       ("lead", 200), ("owner", 200)])
def test_who_can_edit_design(team, role, code):
    pid, u = team
    assert save(u[role], pid).status_code == code


def test_version_conflict(team):
    pid, u = team
    d = u["architect"].get(f"/api/projects/{pid}/design").json()
    assert save(u["lead"], pid).status_code == 200
    r = u["architect"].put(f"/api/projects/{pid}/design", {"design": d["design"], "base_version": d["version"]})
    assert r.status_code == 409


def test_invalid_design_rejected(team):
    pid, u = team
    r = save(u["architect"], pid, lambda d: d["edges"].append({"from": "U1", "to": "NOPE"}))
    assert r.status_code == 422


def test_secrets_are_stripped(team):
    pid, u = team
    def put_key(d):
        d.setdefault("settings", {}).setdefault("escalation", {})["key"] = "sk-secret"
    assert save(u["architect"], pid, put_key).status_code == 200
    stored = u["viewer"].get(f"/api/projects/{pid}/design").json()["design"]
    assert stored["settings"]["escalation"]["key"] == ""


def test_role_ceiling_on_members(team):
    pid, u = team
    # a lead cannot make someone owner, nor demote the owner
    assert u["lead"].put(f"/api/projects/{pid}/members", {"email": "viewer@nexus.test", "role": "owner"}).status_code == 403
    assert u["lead"].put(f"/api/projects/{pid}/members", {"email": "owner@nexus.test", "role": "viewer"}).status_code == 403
    assert u["lead"].put(f"/api/projects/{pid}/members", {"email": "viewer@nexus.test", "role": "reviewer"}).status_code == 200
    assert u["architect"].put(f"/api/projects/{pid}/members", {"email": "viewer@nexus.test", "role": "viewer"}).status_code == 403


def test_last_owner_protected(team):
    pid, u = team
    me = u["owner"].get("/api/auth/me").json()
    assert u["owner"].delete(f"/api/projects/{pid}/members/{me['id']}").status_code == 400


def test_only_owner_deletes(team):
    pid, u = team
    assert u["lead"].delete(f"/api/projects/{pid}").status_code == 403
    assert u["owner"].delete(f"/api/projects/{pid}").status_code == 204


def test_changeset_flow(team):
    pid, u = team
    ops = [{"op": "update_node", "id": "SVC2", "set": {"rep": 2}}]
    assert u["reviewer"].post(f"/api/projects/{pid}/changesets", {"title": "x", "ops": ops}).status_code == 403
    cs = u["security"].post(f"/api/projects/{pid}/changesets", {"title": "Scale SVC2", "ops": ops}).json()
    assert cs["status"] == "proposed"
    assert u["security"].post(f"/api/projects/{pid}/changesets/{cs['id']}/apply", {}).status_code == 403
    r = u["architect"].post(f"/api/projects/{pid}/changesets/{cs['id']}/apply", {"note": "ok"})
    assert r.status_code == 200 and r.json()["status"] == "applied"
    assert u["viewer"].get(f"/api/projects/{pid}/design").json()["design"]["nodes"]["SVC2"]["rep"] == 2
    revs = u["viewer"].get(f"/api/projects/{pid}/revisions").json()
    assert revs[0]["source"] == f"changeset:{cs['id']}"
    assert u["architect"].post(f"/api/projects/{pid}/changesets/{cs['id']}/apply", {}).status_code == 409


def test_bad_changeset_dry_run(team):
    pid, u = team
    r = u["architect"].post(f"/api/projects/{pid}/changesets", {"title": "x", "ops": [{"op": "remove_node", "id": "NOPE"}]})
    assert r.status_code == 422


def test_blank_project(admin):
    p = admin.post("/api/projects", {"name": "Empty", "start": "blank", "deploy": "gcp"}).json()
    d = admin.get(f"/api/projects/{p['id']}/design").json()["design"]
    assert d["nodes"] == {} and d["deploy"] == "gcp" and d["gt"]
    assert dm.validate(d) == []


def test_roles_matrix_public():
    from fastapi.testclient import TestClient
    from app.main import app
    m = TestClient(app).get("/api/auth/roles").json()
    assert [r["id"] for r in m["project_roles"]] == ["viewer", "reviewer", "security", "architect", "lead", "owner"]
