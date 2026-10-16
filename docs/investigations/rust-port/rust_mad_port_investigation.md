# Rust port: Madurese (mad)

The Madurese engine (`src/languages/madurese/`: madurese, manifest, numbers, normalize) ported to
`rust/vernacula-phonemizer/src/languages/madurese/`, the last of the "seasia" group. Tracking issue #1463. Import
closure (rust_vi_port_investigation.md Run 0): `clauses`, `hostWord`, `latinPhones`, `loadManifest`,
`normalizeSymbols`, `numbers` digitIndex, `provenance`, all ported; nothing from the Indonesian, Malay or Javanese
engines. No foreign reader, no neural entry, no Roman policy. ⚠ No FLEURS transcript exists for mad: the golden (108
distinct texts) and the synthetic probes are the whole haystack.

## Run 1 — 2026-10-15 05:02 (first golden gate, code points, the JS semantics that matter)

**Question.** Is the golden byte-identical, and does every literal and every compiled pattern match the TS?

**Command.** `cd rust && cargo run --release -p parity -- mad`; `audit.sh madurese madurese`; `allregs.sh mad …`
against `regs2.mts` (and a second TS run whose input reaches the decimal callback, which builds its hour-word pattern
per call). Tables (`UNIT_WORD`, `EXP_WORD`) and the symbol tier's JSON were generated from the TS and spliced in.

**Raw finding.** `mad: 200/200 identical, 0 differ`, first build. Audit: 18 raw patterns, 2 not verbatim (the TOKEN
template, the symbol JSON), `60 non-ASCII runs, 0 not found`. Compiled patterns: the madurese ones all match the TS,
except two that are not in csharp/regex-corpus.jsonl at all — the quote/degree range `(?<=\d)(['’′″"”º°]+)…` and,
merged into the same garbage entry, the `°C` rule — the same `tools/extract_regexes.mts` mis-parse of a `"` inside a
class that rust_jv_port_investigation.md Run 1 found; checked against the TS source by code point instead
(`U+2019 U+2032 U+2033 U+201D U+00BA U+00B0 U+2013 U+2014`, identical).

JS semantics reproduced on purpose (each would be an easy "improvement"): the tokenizer indexes the word by UTF-16
CODE UNIT (`w[i]`, `w.startsWith(key, i)`), so an astral letter reaches `latinPhone` as half a surrogate pair; `CONS` is
a JS `Map` built raise → low → transparent, so a duplicate key keeps its first position, and the length-descending key
sort is stable; `UNIT_WORD[u.toLowerCase()]!` inside a template would print "undefined" on a miss.

## Run 2 — 2026-10-15 05:07 (per-module differentials, and are they sensitive?)

**Command.** New dumps `mad-normalize` (normalizeMadurese, the recorded symbol tier and the registry's engine via
`renderInHost("mad", t)` over the golden, new `probes/mad.txt` and synthetic rows per arm; the number path on
0…3,000, the scales, 10¹⁵ − 1, 10¹⁵, 2⁵³ + 1) and `mad-g2p` (phonemizeWord and the nativiser over every letter run as
written/lower/UPPER, every 1–3 letter string over the alphabet with â è é ò ḍ ṭ ', every 4-letter string over a
context set of geminates, hiatus pairs and register classes, edge strings; numberToWords over 0…20,000, powers of ten
to 10²², the unsafe and non-finite corners, and the `raw` digit fallback including non-ASCII digits).

**Raw finding.**
```
mad-normalize: 9106 identical, 0 DIFFER   (synthetic 876, number 3599, tier 4199, golden/probe)
mad-g2p:       236723 identical, 0 DIFFER
```
**Is the replay sensitive?** Hiatus epenthesis made strictly falling (`<` for `<=`) and the mark-range lookbehind
needing two digits: `mad-g2p: 228144 identical, 8579 DIFFER`, `mad-normalize: 8905 identical, 201 DIFFER`. Reverted:
236723/0 and 9106/0.

## Run 3 — 2026-10-15 05:10 (end to end, the trace, the tier, provenance, the TS suite)

**Command.** `LANGS=mad … phonemize-sync | phonemize-best | phonemize-trace | trace`, `SYMBOLS_LANGS=mad … symbols`,
`npx tsx tools/provenance-poison.mts mad`, `pins.mts` on test/madurese.test.ts.

**Raw finding.** `phonemize-sync 216/0`, `phonemize-best 216/0`, `phonemize-trace 216/0`, `trace 216/0`, `symbols
3272/0` (madurese tier 200). provenance-poison: 0 sites. TS suite: `80 pinned, 0 skipped; expects evaluated: 82,
failures: 0` (34 normalizeMadurese, 38 phonemize, 5 numberToWords, 3 phonemizeWord). `cargo test madurese`: 2 passed.

## Run 4 — 2026-10-15 05:12 (reading for correctness: TS findings)

**Command.** `npx tsx <scratch>/t.mts mad …` on synthetic input. Rust reproduces each reading.

**Raw finding.**
1. **Only whole hours are clocks.** The three clock rules read `H.00`/`H:00` and nothing else, so `jam 7.30` keeps its
   dot (the decimal rule declines after an hour word) and reads with a SENTENCE PAUSE: *ɟɤm pətːɔʔ . təlɔ pɔlɔ*;
   `pokol 9.15 WIB` likewise; `7.30 WIB` with no hour word is read as a DECIMAL ("seven point three zero"); `10:30`
   gets a comma pause. (The same gap as jv's, Run 4 there.)
2. **A dot decimal with four or more fractional digits** reads with a pause: `3.14159` → *təlɔ . sapɔlɔ bɤn əmpaʔ ɛbu
   …* (the decimal rules take one to three digits).
3. **`M` after a number is always the era**: `Rp 5 M` → *lɛmaʔ ɾupijah masɛhi* ("five rupiah AD"). In a currency
   context `M` is the usual abbreviation for miliar; the era rule runs before the symbol tier and does not look at
   the currency. Whether to special-case it is a sourcing question.

**Implication.** Reported in the PR, not fixed (TS first).

## Run 5 — 2026-10-15 20:40 (#1589 fixes, TS first, mirrored to C# and Rust)

**Finding.** Item 1: the hour-word and clock-marker arms now take `[0-5]\d` minutes and read the hour then the
minutes, with no connective (same reasoning as jv): `jam 7.30`, `7.30 WIB`, `kol 17.30 – 21.00 WIB`. Both arms still
need a word or a marker, so `Rp 16.31 milyad` stays money.

Item 2: both decimal arms take `\d+`; the corpus has no 4+-digit fraction either way.

Item 3: the era rule refuses a number preceded by a currency amount (`(?<!(?:Rp\.?|\$|€|£)\s?[\d.,]*)`), so
`Rp 5 M` no longer reads "five rupiah AD". Reading `M` as miliar is DECLINED: the corpus never writes `M` after a
currency (all four `d M` are years), and id/jv/su all leave the letter too, so it would be a fleet decision, not a
Madurese one. `940 M` still reads *Masèhi*.

Golden mad: 1 row. `kol 17.30 – 21.00 WIB` in the bus-route article lost the sentence pause inside 17.30; the rest
of the row is identical.

**Test.** `test/sea-defects-1589.test.ts`, `SeaDefects1589Tests.cs`, and `defects_1589_tests` in the language's own Rust
module; relational, no typed IPA. Each fails with its fix reverted.
