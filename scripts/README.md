# Scripts

Deployment uses the repeatable Hardhat Ignition module in
`ignition/modules/VotingSystem.ts`.

`upload_vote_package.ts` validates a vote-package JSON file, rewrites it into
canonical JSON, and uploads that exact content through an IPFS HTTP API. It
prints the resulting `ipfs://...` content ID and the package digest.

```bash
npm run upload:vote-package -- path/to/vote-package.json
```

The upload script has an optional local mock-IPFS test. It is skipped by
default because some sandboxes block localhost listeners:

```bash
RUN_IPFS_UPLOAD_SCRIPT_TEST=1 npm run test:crypto
```

Batch construction and tally scripts should only be added after their schemas
and proof statements are fixed. Empty or fake scripts would make the demo look
more complete than it is.
