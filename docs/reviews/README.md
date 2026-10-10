# Integrity review archive

The reports in this directory describe historical repository snapshots. Their findings and test counts are not a statement of the current test status. Repository reorganization updated links and runnable script paths; the recorded numerical evidence was preserved byte-for-byte.

- [Original review](integrity-review.md) and [expanded review](integrity-review-2026-10-10.md): historical findings.
- [Remediation status](../integrity-remediation.md): documented fixes and outstanding inputs.
- `evidence/`: recorded JSON output from the original, expanded, and remediation reviews.
- `fixtures/`: review-specific synthetic inputs.
- `scripts/`: probe programs corresponding to those reviews.

`scripts/probes.py` and `scripts/current-probes.py` intentionally assert pre-repair defects. They are historical reproduction tools, not current acceptance tests. `scripts/remediation-probes.py` collects API evidence for the remediation checks. Running a probe overwrites its corresponding evidence file; run it only when intentionally recording a new review snapshot. Normal application tests live in `backend/tests/`.
