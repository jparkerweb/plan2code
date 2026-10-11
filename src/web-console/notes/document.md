# Documentation on the Web Console

Workflow notes for `document`, part of the web console contract (`console.md`).

The questions are few — which draft, a clarification, the sign-off — but the
docs are the point: post each phase file as a doc as it is written, so a
browser-only person watches the spec take shape. Each one mirrors a file on
disk, so carry its `saved` path, and post it as a `file` block
(`{ "id": "body", "file": "specs/<feature>/phase-2.md" }`) rather than pasting
the text you just wrote. Pass `--spec specs/<feature>` once the folder is known;
it is what the resume command needs. Finish commands follow the pipeline: the
sign-off's is `/plan2code-3-implement specs/<feature>/overview.md`.
