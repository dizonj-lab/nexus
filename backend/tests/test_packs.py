"""Every knowledge pack in packs/ must match packs/schema/pack.schema.json."""
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2] / "packs"
SCHEMA = json.loads((ROOT / "schema" / "pack.schema.json").read_text())
PACKS = sorted([*(ROOT / "core").glob("*.json"), *(ROOT / "components").glob("*.json")])


def test_there_are_packs():
    assert len(PACKS) >= 20


@pytest.mark.parametrize("path", PACKS, ids=lambda p: p.stem)
def test_pack_matches_schema(path):
    errors = sorted(Draft202012Validator(SCHEMA).iter_errors(json.loads(path.read_text())), key=str)
    assert not errors, "\n".join(f"{'/'.join(map(str, e.path))}: {e.message}" for e in errors)


@pytest.mark.parametrize("path", PACKS, ids=lambda p: p.stem)
def test_pack_id_matches_file_name(path):
    assert json.loads(path.read_text())["id"] == path.stem
