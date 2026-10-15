# Rust port: Lao (lo)

The Lao engine (`src/languages/lao/`: lao, normalize) ported to `rust/vernacula-phonemizer/src/languages/lao/`, the
second of the "seasia" group. Tracking issue #1463. The group's import closure is in rust_vi_port_investigation.md
Run 0: Lao needs `clauses`, `loadManifest`, `normalizeSymbols`, `provenance` and `unicode` foldNativeDigits, all
already ported; it has no foreign reader, no neural entry and no Roman policy. `LaoDef` is declared in lao.ts (no
manifest.ts), so the struct lives in lao.rs.

## Run 1 — 2026-10-15 03:38 (first golden gate, and the code points)

**Question.** With lao.rs (reorder, cancelSilent, resolveVowel, tone, extractTones, scanFeatures, the number
compositor) and normalize.rs ported, is the golden byte-identical, and did any literal change code points?

**Command.** `cd rust && cargo run --release -p parity -- lo`; `audit_regex.py` / `nonascii_audit.py` over
`languages/lao` against the TS; the symbol tier's literal regenerated with `symdata.mts` (the TS literal through the
fn-diff recording hook, `JSON.stringify`'d) and compared byte for byte with the Rust `SYMBOL_DATA`.

**Raw finding.** `lo: 200/200 identical, 0 differ`, first build. Audit: `15 raw patterns, 1 not found verbatim` (the
`SYMBOL_DATA` JSON, which is not a pattern; `symdata equal: True`), `79 non-ASCII runs, 0 not found`. Step 1's class
holds three LITERAL format characters in the TS, `[­‌﻿]`, and the Rust literal's code points are `0xad 0x200c 0xfeff`;
the era markers' `[຀-໿]` (U+0E80–U+0EFF, both ends unassigned) and the scanner's 13 vowel signs (combining marks) are
the TS's own characters.

**Implication.** Per-module differentials next.

## Run 2 — 2026-10-15 03:42 (per-module differentials, and are they sensitive?)

**Command.** New dumps `lo-normalize` (normalizeLao and the registry's engine through `renderInHost("lo", t)` over the
golden, FLEURS lo_la columns 3+4 and new `probes/lo.txt`, plus synthetic rows per arm; the engine on 0…3,000, powers of
ten to 10²², 2⁵³±1 and a 20-digit run; and every input the symbol tier saw, through the tier alone) and `lo-g2p`
(phonemizeWord and wordFeatures over every Lao-block run of the texts raw and normalized, every onset × vowel pattern ×
tone mark × coda, with ຫ- and ຼ-clusters, the cancellation mark and ໆ in every position, and 6,000 fixed-seed PRNG
strings over U+0E80–U+0EFF). `bash fn.sh lo lo-normalize lo-g2p`.

**Raw finding.**
```
lo-normalize: 16257 identical, 0 DIFFER   (synthetic 430, number 3063, tier 6412, the rest golden/fleurs/probe)
lo-g2p:       234422 identical, 0 DIFFER
```
Haystack (FLEURS lo_la, 3,138 unique lines): ໌ 174, ໆ 444, `ຄ.ສ` 4, `%` 6, digit 626, a `d[.,]d` decimal or group 80,
`&` 2, U+200B 4, Latin 1,272; `°`, `−`, U+00AD and Lao digits 0. The degree, minus, soft-hyphen and native-digit arms
are reached only by the probes and the synthetic rows.

**Is the replay sensitive?** Two temporary breaks: cancelSilent's cluster walk stopping at `k >= 2`, and the
double-space collapse needing three spaces: `lo-g2p: 234154 identical, 268 DIFFER`, `lo-normalize: 16205 identical,
52 DIFFER`. Reverted: 234422/0 and 16257/0.

## Run 3 — 2026-10-15 03:45 (end to end, the trace, the tier, provenance, the TS suite)

**Command.** `LANGS=lo,th … phonemize-sync | phonemize-best | phonemize-trace | trace` (th too: its probes carry a Lao
run that was port-pending), `SYMBOLS_LANGS=lo … symbols`, `npx tsx tools/provenance-poison.mts lo`, `pins.mts` on
test/lao.test.ts, and the test file's two table invariants ported as a Rust test.

**Raw finding.**
```
phonemize-sync:  5726 identical, 0 DIFFER
phonemize-best:  5726 identical, 0 DIFFER
phonemize-trace: 5725 identical, 1 DIFFER
trace:           5726 identical, 0 DIFFER
symbols:         6216 identical, 0 DIFFER   (lao tier 3144)
```
The phonemize-trace row is th's own probe `ไทย\ud800ไทย`: the `&str` end-to-end API carries the lone surrogate as
U+FFFD, so `normalized` differs while the reading is identical. A harness limit that predates this port. The Thai
port's one known port-pending row, `ไทยລາວไทย`, now reads through `lo` in both engines (0 DIFFER).
provenance-poison: `distinct poison sites: 0`. TS suite: `75 pinned, 0 skipped; expects evaluated: 86, failures: 0`
(30 normalizeLao, 32 phonemizeWord, 13 phonemize). `cargo test lao`: 3 passed (the suite's calls, the poison test,
the pattern-table invariants).

**Implication.** lo meets the parity definition on this machine.

## Run 4 — 2026-10-15 03:47 (reading for correctness: TS findings)

**Command.** `npx tsx <scratch>/t.mts lo …` on synthetic input; FLEURS counts with `hay.sh lo_la`. Rust reproduces
each reading.

**Raw finding.**
1. **A number that uses both marks is not read as a number** (normalize.ts steps 3 and 7). The grouping rule's
   lookahead `(?![\p{Nd}.,])` refuses a group followed by a decimal mark, and the decimal rule refuses a dotted run,
   so `1.234,5` and `1,234.5` fall through to the tokenizer: `1,234.5` reads "one two hundred thirty-four" then a
   SENTENCE PAUSE then "five" (*nɯ˧ŋ sɔː˩ŋ hɔː˥˨j … siː˧ . haː˧˩*), and `1.234,5` puts the pause after the "one". The
   header's table lists both conventions but not the mixed numeral. FLEURS lo_la has 0 instances.
2. `3/4` reads "three four" with the slash silent: no fraction arm, and fractions are not among the four classes the
   header declines. FLEURS lo_la has 0 `d/d`.

**Implication.** Reported in the PR, not fixed.
