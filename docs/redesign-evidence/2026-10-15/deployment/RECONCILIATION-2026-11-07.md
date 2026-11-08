# Historical deployment receipts preserved November 7, 2026

The adjacent fourteen files are exact October 15 receipt blobs from source
`4e40e877ba5ec45151aac4e915e22181ef2acfb5` (PR4). They describe their dated
redesign/Pages checkpoint; no new deployment, email, account or provider test
was run for this source reconciliation.

The original guest safety run passed 36/37 with one unclassified blocked GET;
a targeted 12/12 rerun and 27 functional guest checks passed. Twelve account
checks span an initial attempt and continuation, with simulated no-delivery
OTP/PKCE responses. These records do not establish a wholly green single full
run or delivered-email acceptance. See the [original receipt](README.md).

The twelve older launch/email receipt files from PR2 already match main.
Its mutable readiness/runbook and the older runtime/puzzles were excluded;
the redesign tree is already preserved at main-history commit `e343ac8`.
Current application source, puzzles, workflow definitions and current readiness
remain unchanged. Future deployment/provider actions retain their own gates.
