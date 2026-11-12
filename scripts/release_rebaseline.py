"""Read-only release rebaseline planner; this module never performs remote writes."""
import argparse
import json
from pathlib import Path

LEGACY_SOFTWARE_TAGS = frozenset({"v1.1.0", "v1.2.0", "v1.3.0", "v1.3.1", "v1.5.0"})
DATA_TAG = "spectra-index-2026.08.02"


def _assets(release):
    keys = ("id", "name", "size", "browser_download_url", "digest")
    return sorted((tuple(asset.get(key) for key in keys) for asset in release.get("assets", [])), key=lambda item: str(item[0]))


def build_archive_plan(snapshot, current_releases, current_tag_refs, *, replacements_ready=False):
    """Refuse changed targets and emit only reversible allowlisted metadata updates."""
    if not replacements_ready:
        raise ValueError("REPLACEMENTS_NOT_VERIFIED")
    tags = snapshot.get("legacy_software_tags", [])
    if snapshot.get("schema_version") != 1 or not tags or len(tags) != len(set(tags)) or not set(tags) <= LEGACY_SOFTWARE_TAGS or snapshot.get("protected_data_tag") != DATA_TAG:
        raise ValueError("INVALID_LEGACY_ALLOWLIST")
    for tag, sha in snapshot["tag_refs"].items():
        if current_tag_refs.get(tag) != sha:
            raise ValueError(f"TAG_REF_CHANGED: {tag}")
    before = {release["tag_name"]: release for release in snapshot["releases"]}
    current = {release["tag_name"]: release for release in current_releases}
    if len(current) != len(current_releases):
        raise ValueError("DUPLICATE_RELEASE_TAG")
    actions = []
    for tag in [*tags, DATA_TAG]:
        if tag not in before or tag not in current:
            raise ValueError(f"MISSING_RELEASE: {tag}")
        original, live = before[tag], current[tag]
        for key in ("id", "tag_name", "body", "prerelease", "target_commitish", "immutable"):
            if original.get(key) != live.get(key):
                raise ValueError(f"RELEASE_SNAPSHOT_CHANGED: {tag}/{key}")
        if _assets(original) != _assets(live):
            raise ValueError(f"RELEASE_SNAPSHOT_CHANGED: {tag}/assets")
        if tag == DATA_TAG:
            desired_name = f"Data resource · {original['name']}"
            if live.get("draft") or live.get("name") not in {original["name"], desired_name}:
                raise ValueError(f"RELEASE_SNAPSHOT_CHANGED: {tag}/visibility")
            if live["name"] != desired_name:
                actions.append({"release_id": live["id"], "tag": tag, "action": "label-data", "name": desired_name})
        else:
            if original.get("assets") or live.get("name") != original.get("name"):
                raise ValueError(f"RELEASE_SNAPSHOT_CHANGED: {tag}/name-or-unexpected-assets")
            if not live.get("draft"):
                actions.append({"release_id": live["id"], "tag": tag, "action": "draft", "draft": True})
    return actions


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("current_releases", type=Path)
    parser.add_argument("current_tag_refs", type=Path)
    parser.add_argument("--replacements-verified", action="store_true")
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_text(encoding="utf-8"))
    print(json.dumps(build_archive_plan(read(args.snapshot), read(args.current_releases), read(args.current_tag_refs), replacements_ready=args.replacements_verified), ensure_ascii=False, indent=2))
