# Abbreviation rules at an ASCII `\b` — es, de, en, id, ceb, hil

Follow-up to the French fix (#1480, merged as #1494). JS `\b` is defined on ASCII `\w` even under the `u`
flag, so after an accented letter it sees a word boundary, and an abbreviation key matches the END of a
longer word. The French investigation (`docs/investigations/fr/fr_name_initial_honorifics_investigation.md`,
Run 5) found the same shape in six other normalizers. Portuguese has it too and is left to the pt branch.

All example text is synthetic. Corpus hits are cited as the word-final fragment only.

## Run 1 — 2026-10-09 22:05 — which rules

Command: `grep -n '\b'` over the six `normalize.ts` files, filtered to rules that start with `\b` and read
a dotted (or bare) abbreviation.

Raw finding — none of the six has a dedicated name-initial rule (es/de/en leave initials to the shared
initialism pass, which already uses explicit lookarounds). The affected rules:

| lang | rules |
|---|---|
| es | `a. C.` / `d. C.` (era), `EE. UU.` (both cases), `a. m.`/`p. m.`, `n.º` (número), the DOTTED_ABBREV table (continuing + phrase-final) |
| de | `v. Chr.`, `n. Chr.`, `z. B.`, `d. h.`, `u. a.`, `u. Ä.`, the table (both arms) |
| en | `st./dr./mt./mr./mrs.` + word, `st./dr./mt.` phrase-final, bare `st` (saint), `Rev.`, PLAIN_ABBREV (both arms), `max.`, bare `max` (its trailing `\b` too), `et al.` (both), `ca.`, `no(s).`, `e.g.`/`i.e.` (both), `a.m.`/`p.m.`, the dotted-initialism collapse (`U.S.`) |
| id | `Rp`, `no.`, the table (both arms) |
| ceb, hil | the table (single arm, no trailing guard) |

Not changed, listed: en `\bTY\s?(\d{4})\b` and `\bIR\b` (case-sensitive initialism glosses, not
abbreviations); the month/weekday abbreviation rules (`\b(${MONTH_ABBREV_ALT})\b`) — same `\b` shape, but
a separate rule family; the es/de clock and date rules (digit edges).

Implication: one fix shape — `(?<![\p{L}\p{M}\d_])` before and `(?![\p{L}\p{M}\d_])` after, which is `\b`'s
own ASCII behaviour applied to every script. Literal patterns stay literals (the regex extractor reads only
literals); the table templates use a per-file `WORD_START` constant.

⚠ Five English patterns had no `u` flag (`gi` or `g`), and `\p{L}` needs it. Adding `u` changes `i`:
under `iu` the alternation folds `s`↔`ſ` (#1122), so `ſt.` now matches the `st|dr|mt|mr|mrs` arms. The TS
callbacks used `!` on the table lookup; the C# phrase-final switch defaulted to "mount"; the Rust
`dotted_abbrev` panicked on an unknown key. All three now return the match unchanged on a miss.

## Run 2 — 2026-10-09 22:20 — footprint (old vs fixed normalizer)

Command: scratch `measure_edges.mts` — the origin/main `normalize.ts` copied beside the fixed one, both run
over each language's goldens, FLEURS (columns 3 and 4) and `tools/corpus/mined/<code>.jsonc`; texts whose
output differs are counted, with the differing fragment.

Raw finding:

| lang | golden | FLEURS | mined | fragment (old → fixed) |
|---|---|---|---|---|
| es | 0/307 | 1/3896 | 0/115 | `-ísanta.` → `-ísta.` (key `sta`, santa) |
| de | 0/110 | 1/3912 | 0/117 | `-löSankt.` → `-löst.` (key `st`, Sankt) |
| en | 0/114 | 1/3952 | 0/140 | `Taínumbers.` → `Taínos.` (key `nos`) |
| id | 0/119 | 0/3872 | 0/109 | — |
| ceb | 0/103 | 0/3864 | 0/324 | — |
| hil | 0/112 | — (no FLEURS) | 0/132 | — |

Implication: no golden in these six languages should move. The defect is real but rare in FLEURS: one text
each in es, de and en.

## Run 3 — 2026-10-09 22:35 — tests and revert proof

`test/abbrev-word-edge.test.ts`: one pair per rule, the abbreviation alone (must change) and the same
letters glued after a non-ASCII letter (must come back unchanged), 38 rows, plus a `ſt.` miss-branch check.

First version: 3 es rows passed on the OLD code. Their decline inputs (`Ñod. C.`, `Ñop. m.`, `Ñon.º`) put
an ASCII `o` before the key, and `\b` sees no boundary there, so they tested nothing. Rewritten with the
non-ASCII letter directly before the key (`Ñd. C.`, `Ñp. m.`, `Ñn.º`). After that, with the six old
`normalize.ts` swapped in: 38 of 38 rows fail. The `ſt.` check passes on old code by design: before the
`u` flag, `ſt.` never matched.

Another en row failed on the FIXED code: `Ømax. 5` became `Ømaximum. 5` through the bare `max` rule, whose
`\b`s were the same defect, so that rule joined the fix (and bare `st`).

C# `AbbrevWordEdgeTests.cs` and Rust `word_edge` modules (en, es) port the same rows.

## Run 4 — 2026-10-09 22:40 — ports and gates

C# (`Languages/{Spanish,German,English,Indonesian,Cebuano,Hiligaynon}/Normalize.cs`) mirrors every rule.
Rust (en, es; the other four are not ported) mirrors en and es; `dotted_abbrev` now returns `Option`.
`csharp/regex-corpus.jsonl` was re-extracted with the tool: 2385 patterns, 61 lines changed. Synthetic probe
lines were added to `rust/tools/fn-diff/probes/{en-normalize,es,fr}.txt`.

Revert proofs (origin/main implementation, this branch's tests): TS 38/38 rows fail; C# 41 of 54 fail across
the three test classes (38 rows + 2 `Mr` rows + the guard; the `ſt.` check and the French tests from #1480 pass
by design); Rust 4 of 4 new tests fail.

The French guard and the `Mr` rule land on the same branch. See the fr log, Run 7.

Gates, one at a time, on the final tree:

| gate | result |
|---|---|
| `npm run check:goldens` | 189 languages, 36495 rows, 0 stale (after the fr regeneration in fr Run 7) |
| `npx vitest run` (full) | 350 files, 6582 passed, 5 skipped, 0 failed (with the worktree's missing `node_modules/.bin/tsx` symlinked in for `check-goldens-jobs`) |
| `dotnet test` (full) | 7248 passed, 0 failed |
| C# parity (all 189 languages) | 36495/36495 byte-identical |
| C# regex-diff | 144846 identical, 0 DIFFER, 0 refused |
| Rust regex-diff | 144846 identical, 0 DIFFER, 0 refused, 0 UNSOUND |
| `cargo test --workspace` | 96 passed, 0 failed |
| Rust parity, all ten ported languages | 2000/2000 identical |
| fn-diff, dumps regenerated from the fixed TS | english-pre 4150, english-gb-pre 4150, es-normalize 11844, fr-normalize 12135, fr-ordinals 20122, fr-tagger 15009: all identical. phonemize-sync/best/trace (en, en-GB, es, fr) 16289/16293 — the 4 rows are the existing Greek/Cyrillic probes that need el and ru, unported in Rust (recorded in the Rust en and fr port logs). |
