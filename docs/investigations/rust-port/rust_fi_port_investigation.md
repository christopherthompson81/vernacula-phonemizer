# Rust port: Finnish (fi)

Part of #1463, the "north" group (fi, et, hu, is, fo). Method as in rust_sk_port_investigation.md: per-module
`fn-diff` differentials, then the public entry end to end (sync, async, both traces), then the golden gate.

Finnish is a greedy longest-match grapheme scan (manifest.ts: the long-vowel and diphthong digraphs, then
singles) with three code rules — consonant gemination, ⟨ng⟩→ŋː, ⟨nk⟩→ŋk — and NO stress mark; a cardinal
compositor (agglutinated below 1000, ⟨tuhat⟩ joined, ⟨miljoona⟩ separate, digit by digit from 10⁹); a normalizer
(normalize.ts, 12 steps) plus an initialism pass that first resolves the colon inflection on an initialism; and
the shared symbol tier, which finnish.ts applies AFTER both. No lexicon, no neural entry, no `ROMAN_POLICIES`
entry (the registry's default Roman pass applies).

## Run 1 — 2026-10-14 22:05 (the import closure, baseline)

**Question.** What does `src/languages/finnish/` need that the Rust core lacks?

**Command.** Read finnish.ts, manifest.ts, numbers.ts, normalize.ts and their imports; `grep -n "fi" src/registry.ts
src/neuralRegistry.ts`.

**Raw finding.**
- Imports: core `clauses`, `latinPhones`, `hostWord` (LATIN_RUN, makeNativiser), `normalizeSymbols`,
  `initialisms`, `numbers` (digitIndex), `loadManifest`, `provenance`. All ported; no new core module.
- registry.ts: `case "fi": return createFinnish();`; no `ROMAN_POLICIES` entry, not in `ROMAN_NATIVE`; no
  neuralRegistry entry.
- fi golden: 200 rows, 110 distinct texts. FLEURS fi_fi: 1,960 distinct column-3 texts.

**Implication.** Port manifest → numbers → normalize → finnish. The symbol tier's argument is generated, not
typed: `north/symdata.mts` imports finnish.ts through the fn-diff `symbols-hook.mjs` and prints `JSON.stringify` of
the recorded `SymbolData` (no `countForm`: the default selector, which the TS comment says is exactly Finnish's).

## Run 2 — 2026-10-14 22:25 (first end-to-end build, golden)

**Command.** `cd rust && cargo build --release -p parity && ./target/release/parity fi` after registering `fi`
(one `build` arm, `LANGUAGES`).

**Raw finding.** `fi: 200/200 identical, 0 differ` on the first build.

**Implication.** The differentials carry the weight; the golden is 110 texts.

## Run 3 — 2026-10-14 22:30 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `fi-normalize` and `fi-g2p` (`fi: "fi_fi"` in `FLEURS_DIR`), one `fn-diff`
arm: `FLEURS_ROOT=<external-drive>/omnivoice_ipa/corpus/fleurs_transcripts/data npx tsx rust/tools/fn-diff/dump.mts
<name> > .probe/fi/<name>.jsonl`, then `./target/release/fn-diff <name> …`. Inputs: the golden, FLEURS fi_fi
columns 3 and 4, and the new synthetic `probes/fi.txt` (one line per normalize.ts arm and the neighbour it must
decline).
- `fi-normalize`: per text, `normalizeFinnish`, `normalizeFinnishInitialisms` over its output and the symbol tier
  over that (the recorded tier); `isUnreadableFinnish` per letter run; synthetic rows (19 numbers × 11 heads × 6
  prefixes for the ordinal and its range, the dotted-date grid, the clock grid behind 6 markers, decimals and the
  colon suffixes); `ordinal` over 0…1200 and corners.
- `fi-g2p`: `phonemizeWord` over every letter run, every 1–3 letter string of 34 letters, every 4-letter string over
  `ngkaieuoyäöh`, corners (lone surrogates, İ, ſ, astral letters); the nativiser; `numberToWords` (0…20,000,
  magnitudes, unsafe and non-finite corners, raw strings including JS whitespace) and `readDigits`.
- end to end `LANGS=fi` `phonemize-sync`, `phonemize-best`, `phonemize-trace`, `trace`; `SYMBOLS_LANGS=fi symbols`.

**Raw finding.** First build, every one:
```
fi-normalize: 36034 identical, 0 DIFFER   (golden 330 / fleurs 11445 / probe 123 / synthetic 5748 / words 17180;
                                           the rest are the ordinal rows)
fi-g2p: 181332 identical, 0 DIFFER
phonemize-sync: 3966 identical, 0 DIFFER
phonemize-best: 3966 identical, 0 DIFFER
phonemize-trace: 3966 identical, 0 DIFFER
trace: 3966 identical, 0 DIFFER
symbols: 6997 identical, 0 DIFFER  (probe 3072 / finnish 3925)
```

**JS semantics reproduced on purpose.**
- `readDigits` splits code UNITS and tests `Number(d) === 0`, which is also true of a one-unit JS whitespace
  character (` `, `\t`, NBSP): those read *nolla*. Unreachable from `text()` (only `\d+` runs get there), kept.
- A non-ASCII digit (`٣`, `１`) is `NaN` to `Number` and `-1` to `digitIndex` (a string comparison against
  `"0"`…`"9"`), so `units[-1] ?? d` keeps it as itself; the Rust `digit_index` is ASCII-only too.
- `GRAPHEME_KEYS` is `Object.keys` order stably sorted by length (Rust's `sort_by` is stable too).

**Guard check (reverting a reproduction).** The abbreviation's `keepFinal` branch disabled (always the bare word):
`fi-normalize: 36024 identical, 10 DIFFER`. Restored: 0 DIFFER.

**Implication.** Every module agrees on every source.

## Run 4 — 2026-10-14 22:35 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<worktree> N=languages/finnish/normalize.ts FN=normalizeFinnish npx tsx north/t.mts fi <texts>`
(normalizeFinnish and the public `phonemize`).

**Raw finding (TS output, verbatim):**
1. **An en-dash clock range keeps a spurious pause in its second operand.** `klo 6.30–7.30 välillä` →
   normalized `klo 6 30–7.30 välillä` → `klo kuːsi kolmekymːentæ sei̯tsemæn . kolmekymːentæ ʋælilːæ`. The range
   arm (#1114) accepts only `ja` as the joiner, so the dashed range — the commoner written form — gets the
   single arm on its left operand and the defect #1114 fixed on its right.
2. **A comma-separated digit list is read as a decimal and then a pause.** `Arvot 1,2,3 ja 4.` → `1 pilkku 2,3`
   → `yksi pilkːu kɑksi , kolme`. Neither reading (decimal, list) is consistent across the run.
3. **(For a native reader.) The bare ordinal is always nominative.** `Hän voitti 2. kerran.` → `toinen kerran`,
   where the head's case wants *toisen kerran*. The header claims `N.` before ANY lowercase word but only
   measured month heads (partitive date, where the nominative ordinal is right); for other heads the ordinal's
   case is not the head's.

**Implication.** Reported in the PR. Rust reproduces all three (the end-to-end probes include each shape).

## Run 5 — 2026-10-14 22:40 (TS suite pins, gates)

**Changes.** finnish.rs gains a test module: every call test/finnish.test.ts makes into the engine (87: 17
`phonemizeWord`, 8 `normalizeFinnish`, 13 `ordinal`, 47 `createFinnish().text`, 2 registry `phonemize`) with the
value the TS returned, extracted MECHANICALLY by `north/pins.mts` — the suite run under a recording vitest shim
(`north/vitest-shim.mjs`, `pins-hook.mjs`, `pins-rec.mjs`) that also evaluates every matcher: 87 expects, 0
failures. Replaying the TS return value is stronger than replaying the matcher (`toContain`, `not.toBe`): every
expectation holds whenever the Rust value is the TS value.
Pin guard: ⟨nk⟩ → `n` instead of `ŋ` → the test FAILED on `sænky` vs `sæŋky`; restored, it passes.

**Raw finding.** parity, all 52 languages: every one `200/200` (hil 112/112, ilo 94/94) but mag at its known
199/200. `fi: 200/200 identical, 0 differ`.

**Implication.** No port-pending rows: TOKEN is all of Latin, and nothing else routes out of the engine.

## Run 6 — 2026-10-14 23:24 (regex escapes restored; found during the fo port)

**Command.** `grep -P '[\x{00a0}\x{202f}\x{2009}]' rust/vernacula-phonemizer/src/languages/finnish/*.rs`.

**Raw finding.** The editing tool had written step 1's `[ \u00a0\u202f\u2009]` as four LITERAL characters, where
normalize.ts writes the escapes. Same match, different code points (so no differential could see it). Restored
byte-level with `perl -CSD`; `north/audit_regex.py` then finds every raw pattern in the module verbatim in the TS.
Re-run: `fi-normalize 36034 identical, 0 DIFFER`; `phonemize-sync` (fi, hu, fo) 0 DIFFER; parity unchanged. The
fix rides in the fo commit (see rust_fo_port_investigation.md Run 2).
