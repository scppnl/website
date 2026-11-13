"""Render bounded, escaped Terraform output in the GitHub Actions job summary."""

import html
import os
from pathlib import Path
import sys


output = Path(sys.argv[1]).read_bytes()
limit = 60_000
if len(output) > limit:
    output = (
        output[: limit // 2]
        + b"\n\n... Plan output truncated; see the full step log. ...\n\n"
        + output[-limit // 2 :]
    )

with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as summary:
    summary.write("\n### Production Terraform plan\n\n<pre>")
    summary.write(html.escape(output.decode("utf-8", errors="replace")))
    summary.write("</pre>\n")
