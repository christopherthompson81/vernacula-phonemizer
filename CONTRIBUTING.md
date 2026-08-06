# Contributing

## Build, test, typecheck

```
npm ci
npm run typecheck      # tsc --noEmit
npm test               # vitest, ~3100 tests
```

There is no build step — `exports` points at `src/index.ts` and the package ships TypeScript source.
`onnxruntime-node` is an optional dependency; every neural path degrades to a rule or lexicon path
without it, so the suite passes on a machine that has no ONNX runtime.

Tools under `tools/` are offline and never imported by the runtime. Several read external data roots
from the environment (`FLEURS`, `DUMPS`, `ESPEAK_NG`, …) — see [`tools/README.md`](tools/README.md).
None are needed to build, test or use the phonemizer.

## Formatting

Prettier, 4-space indent, 120 columns — `.prettierrc.json`. `npx prettier --write <file>`.

`.prettierignore` covers committed data (`*.tsv`, mined corpora, referee sets) so artifacts are never
restyled. Hand-aligned data tables in source carry `// prettier-ignore`; keep it when you touch them,
or a readable grid becomes one entry per line.

## Comments

The codebase is heavily commented on purpose — the phonology is the hard part, and a rule that looks
arbitrary usually is not. But comments should read as **documentation for someone new to the file**,
not as a development log.

A useful test: *write it the way you would if you were porting this file to another language.* A
porter has no history to tell, so they write what the code does and what will bite you.

**Keep** — anything that changes what the next person does:

- the invariant, and what breaks when it is violated
  (`⚠ ORDER IS LOAD-BEARING: the operator arm must claim 3 + 4 first, or the sign arm reads *toru plus whā*`)
- traps: things that look right and are not
  (`tapawhā is a square as in a plaza, not "squared"`)
- deliberate omissions, so they are not "fixed"
  (`mm has no attested word — leave it leaking rather than invent one`)
- one concrete failing example where it makes a rule stick, as a clause rather than a paragraph

**Drop** — anything that only describes how the code came to be:

- chronology: "used to", "previously", "the first attempt", "an earlier draft of this comment"
- corpus counts, attestation hunts, decode transcripts, quotations proving a word exists — that is the
  investigation record, not the code
- self-assessment: "found by a corpus diff at 10% of utterances", "which is the fourth time on this issue"
- status narration: "this layer is X and nothing else yet"
- issue numbers — they do not resolve outside the development history

Reference points in the tree: `src/core/hostWord.ts`, `src/languages/maori/normalize.ts`.

⚠ Beware `*/` forming by accident inside a block comment. Markdown-style emphasis around a slashed
alternative does it — `*tri*/*štiri*` terminates the comment early and the rest of the block parses as
code. `npm run typecheck` always catches it (the remaining prose never parses), but the error points
*past* the real cause and usually reads as an unterminated regex. Look for emphasis before a slash.

When you cut comments, **do not touch code in the same commit**. Both files above were verified
token-identical to their originals; that check is what makes a large comment pass reviewable.

## Data and provenance

Any new data file or model lands with a `*.PROVENANCE.md` sidecar or a header naming its source and
license, a row in [`LICENSES/PROVENANCE.md`](LICENSES/PROVENANCE.md), and — where attribution is owed —
an entry in [`NOTICE.md`](NOTICE.md). See [`LICENSES/licencing_posture.md`](LICENSES/licencing_posture.md)
for how facts-vs-expression is applied.
