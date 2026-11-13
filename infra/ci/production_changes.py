"""Select production cloud jobs without initializing any Terraform backend."""

import json
import os
from pathlib import Path
import subprocess


def git(*args):
    return subprocess.check_output(["git", *args])


def production_changed(event_name, event):
    if event_name == "workflow_dispatch":
        return True
    if event_name == "pull_request":
        head = event["pull_request"]["head"]["sha"]
        base = event["pull_request"]["base"]["sha"]
        base = git("merge-base", base, head).decode().strip()
    elif event_name == "push":
        base, head = event["before"], event["after"]
    else:
        raise ValueError(f"Unsupported event: {event_name}")

    # Reject missing history, including an all-zero before SHA. Never silently
    # classify an indeterminate comparison as a billing-only change.
    for revision in (base, head):
        git("rev-parse", "--verify", "--end-of-options", revision + "^{commit}")
    # Disabling rename detection exposes both the old and new paths as D/A.
    paths = git("diff", "--no-renames", "--name-only", "-z", base, head, "--").split(b"\0")
    return any(
        path == b".github/workflows/terraform.yml"
        or path.startswith((b"infra/production/", b"infra/modules/", b"infra/ci/"))
        for path in paths
    )


def main():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    changed = production_changed(os.environ["GITHUB_EVENT_NAME"], event)
    with Path(os.environ["GITHUB_OUTPUT"]).open("a") as output:
        output.write(f"production_changed={str(changed).lower()}\n")
    if not changed:
        message = (
            "Offline checks only: no production, shared-module, or Terraform CI "
            "changes. Cloud plan, infrastructure approval, and apply are skipped."
        )
        print(f"::notice::{message}")
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as summary:
            summary.write(message + "\n")


if __name__ == "__main__":
    main()
