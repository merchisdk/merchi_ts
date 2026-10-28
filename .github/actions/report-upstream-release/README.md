# Verified upstream release reporting

This action sends completed-release evidence to System Agent. It never publishes
packages, changes downstream code, launches coding agents, or closes incidents.
Use the dedicated `SYSTEM_AGENT_RELEASE_TOKEN`, never a coding or administrator
credential. Call this action only from trusted release/deployment workflows after
the package, template or production deployment is verified available.

The input file is one release-ingress manifest or an array of manifests. The
endpoint is restricted to the exact production/staging release ingress. Network
failures, rate limits and server errors retry identical immutable evidence;
authentication and validation failures do not retry. Credentials and response
bodies are never printed. An empty verified batch makes no requests.

API and template callers can supply `kind` instead of `manifest`, after their
production deployment or template test/type-check gate succeeds. The helper
requires the expected repository/branch, derives immutable evidence from the
full source SHA, and saves it in `runner.temp` before sending. API main/preview
builds cannot generate production deployment evidence. The action archives the
generated manifest even when its report fails. Consumers should pin this public
action to an explicitly reviewed full commit SHA.

The TypeScript publisher persists each registry-verified, successfully tagged
package to `.release/system-agent-releases.json`. A later package failure does
not erase earlier confirmed releases. The workflow saves this evidence before
reporting, including on partial publish failure.

If reporting still fails, download the `verified-system-agent-releases` artifact
from that workflow run and replay that exact file with this action/helper after
repairing configuration. Do not republish packages to retry a notice. The ingress
deduplicates an identical release by upstream/component/version, and rejects
different evidence under an existing identity. Artifacts retain evidence for 90
days; retain it separately if an incident requires longer recovery.

Optional `.github/system-agent-release-notes.json` maps package names to
`{"fixed_issues": [63]}`. Only explicitly verified upstream issue numbers belong
there; absence produces no fixed-issue claims. An available package is not proof
that a downstream incident is fixed. Its coding agent must assess applicability,
create any required upgrade PR, test the deployment and record adoption.
