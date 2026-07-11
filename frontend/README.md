# Frontend

The production Next.js frontend is still deferred until real proof artifacts,
deployed verifier addresses, and ERC-4337 configuration are available.

The repository now includes a static local demo UI in `frontend/demo/` so the
research flow can be reviewed without pretending that mock proofs are real.

Pages:

- `frontend/demo/pages/registration.html`
- `frontend/demo/pages/voting.html`
- `frontend/demo/pages/receipt.html`
- `frontend/demo/pages/batch.html`
- `frontend/demo/pages/tally.html`
- `frontend/demo/pages/verification.html`

Open `frontend/demo/index.html` in a browser to walk through the current
pipeline. Every page includes visible trust-boundary labels for placeholder
proofs, pending real circuits, or mock verifier seams.

This static UI is not a replacement for:

- real Anon Aadhaar proof generation;
- real ballot, batch, or tally circuits;
- deployed verifier contracts;
- ERC-4337 sponsored transactions; or
- a production web app.
