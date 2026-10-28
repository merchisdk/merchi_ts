#!/usr/bin/env python3
"""Report verified releases; never publish packages or run downstream agents."""

import argparse
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib import error, request

ENDPOINTS = {
    "https://system-agent.merchi.co/v1/repository-workflow/releases",
    "https://system-agent.staging.merchi.co/v1/repository-workflow/releases",
}


class NoRedirects(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def deployment_manifest(repository, head, kind, ref, notes=None):
    expected = {
        "merchisdk/merchi_api": ("api_deployment", "merchi-api", "refs/heads/production"),
        "merchisdk/merchi_store_boilerplate": ("template", "storefront-template", "refs/heads/main"),
    }
    if repository not in expected or not re.fullmatch(r"[a-f0-9]{40}", head):
        raise ValueError("A verified upstream repository and commit are required")
    expected_kind, component, expected_ref = expected[repository]
    if kind != expected_kind or ref != expected_ref:
        raise ValueError("Release kind or workflow branch does not match the upstream")
    fixed_issues = (notes or {}).get(component, {}).get("fixed_issues", [])
    if not isinstance(fixed_issues, list) or len(fixed_issues) > 100 or any(type(n) is not int or n < 1 for n in fixed_issues):
        raise ValueError("Fixed issues require explicit positive issue numbers")
    return {
        "upstream": repository, "component": component, "version": head,
        "kind": kind, "commit_sha": head,
        "availability_url": f"https://github.com/{repository}/commit/{head}",
        "summary": "Production API deployment completed successfully." if kind == "api_deployment" else "Storefront template commit passed repository tests and type checking.",
        "migration": "Inspect this API change for applicability and verify the deployed storefront against the live API; code changes may not be required." if kind == "api_deployment" else "Compare this template commit with the site's verified baseline, preserve customizations and create a tested adoption PR for applicable changes.",
        "verification": "The upstream pipeline completed its release gate. The external coding agent must verify its own repository and deployment, then record adoption. This notice does not resolve an incident or execute code.",
        "affected_versions": [], "fixed_issues": sorted(set(fixed_issues)),
    }


def report_release(endpoint, token, manifest):
    if endpoint not in ENDPOINTS or not token or any(c in token for c in "\r\n"):
        raise ValueError("Use the exact release endpoint and dedicated credential")
    body = json.dumps(manifest, sort_keys=True).encode("utf-8")
    if len(body) > 60000:
        raise ValueError("Release manifest is too large")
    for attempt in range(3):
        req = request.Request(endpoint, data=body, method="POST", headers={
            "Authorization": f"Bearer {token}", "Content-Type": "application/json",
        })
        try:
            with request.build_opener(NoRedirects()).open(req, timeout=30) as response:
                release_id = json.loads(response.read().decode("utf-8"))["release_id"]
            if not isinstance(release_id, str) or not re.fullmatch(r"[a-f0-9]{64}", release_id):
                raise ValueError("Release identity was not confirmed")
            return release_id
        except error.HTTPError as exc:
            if exc.code != 429 and exc.code < 500:
                raise
            if attempt == 2:
                raise
        except (error.URLError, TimeoutError):
            if attempt == 2:
                raise
        # Replaying identical immutable evidence is idempotent at the ingress.
        time.sleep(attempt + 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default="")
    parser.add_argument("--kind", default="")
    args = parser.parse_args()
    try:
        if bool(args.manifest) == bool(args.kind):
            raise ValueError("Supply either saved evidence or a completed deployment kind")
        if args.kind:
            notes_path = Path(".github/system-agent-release-notes.json")
            notes = json.loads(notes_path.read_text()) if notes_path.exists() else {}
            payload = deployment_manifest(
                os.environ.get("GITHUB_REPOSITORY", ""), os.environ.get("GITHUB_SHA", ""),
                args.kind, os.environ.get("GITHUB_REF", ""), notes,
            )
            saved = Path(os.environ.get("RUNNER_TEMP", ".release")) / "system-agent-release.json"
            saved.parent.mkdir(parents=True, exist_ok=True)
            saved.write_text(json.dumps(payload, indent=2) + "\n")
        else:
            manifest_path = Path(args.manifest)
            if manifest_path.stat().st_size > 1800000:
                raise ValueError("Release batch is too large")
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifests = payload if isinstance(payload, list) else [payload]
        if len(manifests) > 30 or any(not isinstance(m, dict) for m in manifests):
            raise ValueError("Invalid release batch")
        for manifest in manifests:
            release_id = report_release(
                os.environ.get("SYSTEM_AGENT_RELEASE_URL", ""),
                os.environ.get("SYSTEM_AGENT_RELEASE_TOKEN", ""), manifest,
            )
            print(f"Recorded upstream release {release_id}")
    except Exception as exc:
        # No raw exceptions, provider bodies, credentials or request headers.
        detail = f"HTTP {exc.code}" if isinstance(exc, error.HTTPError) else type(exc).__name__
        print(f"Release record not confirmed ({detail}); replay the saved manifest.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
