import os
import unittest
from pathlib import Path
from unittest.mock import patch

from fema_proxy_server import build_health_payload


class DeploymentMetadataTests(unittest.TestCase):
    def test_shipped_source_version_wins_over_stale_deployment_environment(self):
        expected = (Path(__file__).resolve().parents[2] / "VERSION").read_text(encoding="utf-8").strip()
        with patch.dict(os.environ, {"API_VERSION": "1.5.0", "RENDER_GIT_COMMIT": "current-source"}):
            payload = build_health_payload()
        self.assertEqual(payload["api_version"], expected)
        self.assertEqual(payload["deploy_commit"], "current-source")

    def test_health_exposes_api_version_and_optional_render_commit(self):
        with patch.dict(os.environ, {"API_VERSION": "1.5.0", "RENDER_GIT_COMMIT": "abc123"}, clear=False):
            payload = build_health_payload()
        self.assertEqual(payload["api_version"], (Path(__file__).resolve().parents[2] / "VERSION").read_text(encoding="utf-8").strip())
        self.assertEqual(payload["deploy_commit"], "abc123")
        self.assertTrue(payload["ok"])


if __name__ == "__main__":
    unittest.main()
