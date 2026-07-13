# Frontend

The repository includes a zero-dependency local dashboard in `frontend/demo/`.
It is intentionally served by the artifact generator, so reviewers see the
same real ballot proofs, batch, receipts, and threshold result exercised by the
tests instead of disconnected screenshots.

Pages:

- `frontend/demo/pages/registration.html`
- `frontend/demo/pages/voting.html`
- `frontend/demo/pages/receipt.html`
- `frontend/demo/pages/batch.html`
- `frontend/demo/pages/tally.html`
- `frontend/demo/pages/verification.html`

Run `npm run demo:serve`, then open `http://127.0.0.1:8080`. Registration has a
deterministic biometric fail/pass simulation whose audit log retains no raw
biometric fields. Voting, receipt, tally, and verification pages load generated
JSON evidence from the local server. Every page includes visible trust-boundary
labels.

This static UI is not a replacement for:

- live Anon Aadhaar proof generation;
- recursive batch or tally SNARK circuits;
- deployed verifier contracts;
- a provider-sponsored Amoy transaction; or
- a production web app.
