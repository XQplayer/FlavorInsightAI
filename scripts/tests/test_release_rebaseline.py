import copy
import unittest

from scripts.release_rebaseline import build_archive_plan


class ReleaseRebaselineTests(unittest.TestCase):
    def setUp(self):
        # Synthetic metadata: two software releases and one protected data release.
        self.releases = [
            {"id": 11, "tag_name": "v1.1.0", "name": "Old one", "body": "original one", "draft": False, "assets": []},
            {"id": 15, "tag_name": "v1.5.0", "name": "Old five", "body": "original five", "draft": False, "assets": []},
            {"id": 20, "tag_name": "spectra-index-2026.08.02", "name": "GNPS index", "body": "dataset", "draft": False, "assets": [{"id": 21, "name": "index.gz", "size": 123, "browser_download_url": "https://example.invalid/index.gz"}]},
        ]
        self.refs = {"v1.1.0": "a" * 40, "v1.5.0": "b" * 40, "spectra-index-2026.08.02": "c" * 40}
        self.snapshot = {"schema_version": 1, "legacy_software_tags": ["v1.1.0", "v1.5.0"], "protected_data_tag": "spectra-index-2026.08.02", "releases": copy.deepcopy(self.releases), "tag_refs": dict(self.refs)}
        self.expected = {"flavorinsight-v1.0.0": "e" * 40, "flavorinsight-v1.1.0": "f" * 40}
        self.releases += [{"id": 30, "tag_name": "flavorinsight-v1.0.0", "draft": False, "prerelease": False}, {"id": 31, "tag_name": "flavorinsight-v1.1.0", "draft": False, "prerelease": False}]
        self.refs.update(self.expected)

    def plan(self, snapshot=None, releases=None, refs=None, **kwargs):
        return build_archive_plan(snapshot or self.snapshot, self.releases if releases is None else releases, refs or self.refs, expected_replacements=self.expected, **kwargs)

    def test_ready_flag_never_bypasses_missing_draft_or_conflicting_replacements(self):
        with self.assertRaisesRegex(ValueError, "REPLACEMENT_RELEASE_NOT_READY"):
            self.plan(releases=self.releases[:3], replacements_ready=True)
        changed = copy.deepcopy(self.releases); changed[-1]["draft"] = True
        with self.assertRaisesRegex(ValueError, "REPLACEMENT_RELEASE_NOT_READY"):
            self.plan(releases=changed, replacements_ready=True)
        refs = dict(self.refs); refs["flavorinsight-v1.0.0"] = "9" * 40
        with self.assertRaisesRegex(ValueError, "REPLACEMENT_TAG_CONFLICT"):
            self.plan(refs=refs, replacements_ready=True)

    def test_only_allowlisted_software_is_drafted_and_data_only_relabelled(self):
        plan = self.plan(replacements_ready=True)
        self.assertEqual([a["release_id"] for a in plan if a["action"] == "draft"], [11, 15])
        self.assertEqual([a["release_id"] for a in plan if a["action"] == "label-data"], [20])
        self.assertFalse(any(a.get("draft") and a["release_id"] == 20 for a in plan))
        self.assertTrue(all(a["action"] in {"draft", "label-data"} for a in plan))
        self.assertFalse(any(r["draft"] for r in self.releases))

    def test_replacements_required_and_changed_evidence_refused(self):
        with self.assertRaisesRegex(ValueError, "REPLACEMENTS_NOT_VERIFIED"):
            self.plan()
        for index, key, value in [(0, "body", "changed"), (1, "id", 999), (2, "assets", [])]:
            changed = copy.deepcopy(self.releases)
            changed[index][key] = value
            with self.assertRaisesRegex(ValueError, "RELEASE_SNAPSHOT_CHANGED"):
                self.plan(releases=changed, replacements_ready=True)
        changed_refs = dict(self.refs, **{"v1.1.0": "d" * 40})
        with self.assertRaisesRegex(ValueError, "TAG_REF_CHANGED"):
            self.plan(refs=changed_refs, replacements_ready=True)

    def test_unknown_or_missing_targets_cannot_be_silently_archived(self):
        changed = copy.deepcopy(self.snapshot)
        changed["legacy_software_tags"].append("spectra-index-2026.08.02")
        with self.assertRaisesRegex(ValueError, "INVALID_LEGACY_ALLOWLIST"):
            self.plan(snapshot=changed, replacements_ready=True)
        with self.assertRaisesRegex(ValueError, "MISSING_RELEASE"):
            self.plan(releases=self.releases[1:], replacements_ready=True)

    def test_plan_is_idempotent_after_authorized_reversible_updates(self):
        plan = self.plan(replacements_ready=True)
        changed = copy.deepcopy(self.releases)
        for action in plan:
            release = next(r for r in changed if r["id"] == action["release_id"])
            if action["action"] == "draft":
                release["draft"] = True
            else:
                release["name"] = action["name"]
        self.assertEqual(self.plan(releases=changed, replacements_ready=True), [])


if __name__ == "__main__":
    unittest.main()
