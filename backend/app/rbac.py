"""Role-based access control.

Two levels:
* System role (per user): admin manages users and sees every project; member creates projects.
* Project role (per membership): decides what the user may do in that project.

Permissions are the unit of checking. Agents run inside the harness with the
permissions of the person who started them, never more (see harness/policy.py).
"""

PERMISSIONS: dict[str, str] = {
    "project:read": "Open the project, its design, history and agent runs",
    "comment": "Comment on components and decisions",
    "security:signoff": "Record a security review on a design or changeset",
    "design:edit": "Change the design on the canvas",
    "design:propose": "Propose a changeset for someone to review",
    "changeset:apply": "Apply or reject a proposed changeset",
    "agent:run": "Run AI agents on the project",
    "model:escalate": "Escalate to the larger model and ask for a second opinion",
    "adr:create": "Record architecture decisions",
    "adr:approve": "Approve or reject architecture decisions",
    "members:manage": "Add, change or remove project members",
    "project:settings": "Rename, describe or archive the project",
    "project:delete": "Delete the project",
}

_viewer = {"project:read"}
_reviewer = _viewer | {"comment"}
_security = _reviewer | {"security:signoff", "design:propose", "agent:run"}
_architect = _reviewer | {"design:edit", "design:propose", "changeset:apply", "agent:run", "model:escalate", "adr:create"}
_lead = _architect | {"security:signoff", "adr:approve", "members:manage"}
_owner = _lead | {"project:settings", "project:delete"}

# Ordered from least to most access.
PROJECT_ROLES: dict[str, dict] = {
    "viewer": {"label": "Viewer", "summary": "Reads designs, history and decisions.", "perms": _viewer},
    "reviewer": {"label": "Reviewer", "summary": "Reads and comments; a team reviewing its layer.", "perms": _reviewer},
    "security": {"label": "Security architect", "summary": "Reviews, signs off security and proposes changes.", "perms": _security},
    "architect": {"label": "Architect", "summary": "Designs, runs agents and applies changesets.", "perms": _architect},
    "lead": {"label": "Lead architect", "summary": "Architect who also approves decisions and manages members.", "perms": _lead},
    "owner": {"label": "Owner", "summary": "Full control of the project, including deletion.", "perms": _owner},
}
ROLE_ORDER = list(PROJECT_ROLES)

SYSTEM_ROLES = {
    "admin": "Manages users and can open every project as owner",
    "member": "Signs in, creates projects and works in projects they are a member of",
}


def role_perms(role: str | None) -> set[str]:
    return set(PROJECT_ROLES[role]["perms"]) if role in PROJECT_ROLES else set()


def outranks(a: str, b: str) -> bool:
    """True when role a gives at least the access of role b (by order)."""
    return ROLE_ORDER.index(a) >= ROLE_ORDER.index(b)


def matrix() -> dict:
    return {
        "permissions": PERMISSIONS,
        "project_roles": [
            {"id": r, "label": v["label"], "summary": v["summary"], "permissions": sorted(v["perms"])}
            for r, v in PROJECT_ROLES.items()
        ],
        "system_roles": SYSTEM_ROLES,
    }
