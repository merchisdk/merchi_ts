import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib import error

import report_release as helper


class ReleaseReporterTests(unittest.TestCase):
    def response(self):
        response = Mock()
        response.__enter__ = lambda self: self
        response.__exit__ = lambda *args: None
        response.read.return_value = json.dumps({"release_id": "a" * 64}).encode()
        return response

    def test_lost_response_replays_identical_evidence_without_redirects(self):
        opener = Mock()
        opener.open.side_effect = [error.URLError("lost"), self.response()]
        with patch.object(helper.request, "build_opener", return_value=opener) as build, patch.object(helper.time, "sleep"):
            self.assertEqual(helper.report_release(sorted(helper.ENDPOINTS)[0], "secret", {"version": "1.2.3"}), "a" * 64)
        requests = [call.args[0] for call in opener.open.call_args_list]
        self.assertEqual(len(requests), 2)
        self.assertEqual(requests[0].data, requests[1].data)
        self.assertEqual(requests[0].get_header("Authorization"), "Bearer secret")
        handler = build.call_args.args[0]
        self.assertIsNone(handler.redirect_request(None, None, 302, "", {}, "https://example.com"))

    def test_refuses_forwarding_credentials_to_another_host(self):
        with patch.object(helper.request, "build_opener") as build:
            with self.assertRaises(ValueError):
                helper.report_release("https://example.com/releases", "secret", {})
            build.assert_not_called()

    def test_auth_failure_is_not_retried_and_does_not_expose_provider_body(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_text('{}')
            opener = Mock()
            opener.open.side_effect = error.HTTPError("https://example.com", 403, "AUDIT_SECRET", {}, io.BytesIO(b"AUDIT_SECRET"))
            output = io.StringIO()
            with patch.object(helper.sys, "argv", ["report_release.py", "--manifest", str(path)]), patch.dict(helper.os.environ, {"SYSTEM_AGENT_RELEASE_URL": sorted(helper.ENDPOINTS)[0], "SYSTEM_AGENT_RELEASE_TOKEN": "AUDIT_SECRET"}), patch.object(helper.request, "build_opener", return_value=opener), contextlib.redirect_stderr(output):
                self.assertEqual(helper.main(), 1)
            self.assertEqual(opener.open.call_count, 1)
            self.assertIn("HTTP 403", output.getvalue())
            self.assertNotIn("AUDIT_SECRET", output.getvalue())

    def test_saved_batch_can_be_replayed_and_empty_batch_is_a_noop(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            with patch.object(helper.sys, "argv", ["report_release.py", "--manifest", str(path)]), patch.object(helper, "report_release", return_value="a" * 64) as report, contextlib.redirect_stdout(io.StringIO()):
                path.write_text('[]')
                self.assertEqual(helper.main(), 0)
                report.assert_not_called()
                path.write_text('[{"version":"1.2.3"},{"version":"2.3.4"}]')
                self.assertEqual(helper.main(), 0)
                self.assertEqual(report.call_count, 2)


if __name__ == "__main__":
    unittest.main()
