# PDF export fidelity investigation

## Verified 2026-09-26

The isolated revision 93 resume export loses the initial B in the saved
qualification `B.E., Computer Science`. The synthetic Firestore profile retains
the exact qualification. Its cloud PDF contains a malformed empty ToUnicode
entry. This is an export defect, not permission to rewrite profile data.

Reproduction script: `apps/web/scripts/check-degree-export.tsx`.
The `--cloud-profile` option reads only the fixed synthetic QA account using the
configured gcloud identity; it does not modify that account or print credentials.

- Official Node 22.20.0 macOS x64 archive downloaded and SHA-256 verified against
  Node's published checksum: `00df9c5df3e4ec6848c26b70fb47bf96492f342f4bed6b17f12d99b3a45eeecc`.
- Four sequential exports of the fixture preserve the exact qualification.
- PDF parsing followed by eight simultaneous exports preserves it in all eight.
- The same sequential/parsing/concurrent sequence using the actual saved
  synthetic cloud profile also preserves it in all nine inspected outputs.
- **Reproduced:** rendering a themed cover letter first, then the saved synthetic
  profile sequentially and concurrently, corrupts all nine resume outputs.
  The exact qualification disappears and pypdf reports an empty ToUnicode entry.
- Web TypeScript check and diagnostic-script ESLint check pass.
- Text verification used pypdf. These scratch outputs are diagnostic evidence,
  not visually accepted customer deliverables.

The Node major version and saved profile alone do not reproduce the defect.
Mixed cover-letter/resume history does reproduce it locally; shared font state
is now the leading hypothesis. Linux/container behavior and the compiled server
remain unverified. Do not promote revision 93 until cloud export
fidelity and visual QA pass. The expanded authenticated journey already checks
every saved qualification against exported PDF text.

## Local fix

Custom font families now receive fresh registrations for each document. A
process-local queue makes registration replacement and rendering atomic, so
simultaneous exports cannot replace one another's fonts. Built-in report fonts
are left intact. Failed exports release the queue for subsequent requests.
The previously failing mixed-document sequence using the saved synthetic cloud
profile now preserves the qualification in all nine outputs without malformed
font-map warnings. The rendered single-page resume was inspected: the B is
visible, text is aligned, and no overlaps or clipping were seen.

The reproduction script now asserts exact qualification fidelity and rejects
empty ToUnicode entries, rather than merely reporting generated filenames.
This fix is local and has not yet been verified on a new Cloud Run revision.
The full web unit suite passes: 322 tests across 75 files.
