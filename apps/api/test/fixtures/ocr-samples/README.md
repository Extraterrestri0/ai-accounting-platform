# OCR validation samples (gitignored)

Put real inbound **supplier** invoice files here (PDF + scanned images) and your filled
`ocr-validation-ground-truth.json`. **Everything in this folder except this README is
gitignored** — these are private customer documents and must never be committed.

- File paths in the ground-truth JSON are resolved relative to its `baseDir`
  (defaults to this folder).
- Template + how-to: `apps/api/scripts/ocr-validation-ground-truth.example.json` and
  `docs/runbooks/ocr-validation.md`.
