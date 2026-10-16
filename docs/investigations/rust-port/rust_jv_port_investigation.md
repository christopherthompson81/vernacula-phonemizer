# Rust port: Javanese (jv)

The Javanese engine (`src/languages/javanese/`: javanese, manifest, aksara, normalize) ported to
`rust/vernacula-phonemizer/src/languages/javanese/`, the fourth of the "seasia" group. Tracking issue #1463. Import
closure (rust_vi_port_investigation.md Run 0): `clauses`, `hostWord` (hostWordRun, makeNativiser), `initialisms`
(makeInitialismNormalizer, makeUnreadableTest), `loadManifest`, `loadTsv`, `normalizeSymbols`, `provenance` — all
ported. ⚠ Javanese imports NOTHING from the ported Indonesian or Malay engines: its g2p, numbers and normalizer are
its own, so there was nothing to reuse. No foreign reader (the registry calls `createJavanese()`), no neural entry,
no Roman policy. `Seg` is declared in javanese.ts and imported by aksara.ts, so it lives in javanese.rs.

## Run 1 — 2026-10-15 04:25 (first golden gate, and every compiled pattern by code point)

**Question.** Is the golden byte-identical, and does every pattern the Rust compiles for a jv run equal a TS pattern
code point for code point?

**Command.** `cd rust && cargo run --release -p parity -- jv`; `audit.sh javanese javanese`; then `allregs.sh`: a
TEMPORARY `eprintln!` in `JsRegex::new` logs every pattern one `phonemize(…, "jv")` compiles (61), compared by
`cmpregs.py` with every RegExp the TS constructs on the same call (`regs2.mts`, a Proxy over the global constructor)
plus every literal in csharp/regex-corpus.jsonl.

**Raw finding.** `jv: 200/200 identical, 0 differ`, first build. Audit: 20 raw patterns, 1 `format!` template (the
fractions), `26 non-ASCII runs, 0 not found`. The compiled-pattern check: `rust-only 15`, of which 13 are core or
English patterns this port did not write (core/initialisms and the fold passes write a literal NBSP or symbol where
the TS writes ` `-style escapes: semantically the same class, a byte difference only), and TWO are javanese
normalize.ts patterns: `(['’"”′″°])\s*[-–]\s*(?=\d)` and `(\d+)\s*°\s*C(?![\p{L}])`/gui. Both are missing from the
corpus because **the corpus extractor mis-parses the first one**: the `"` inside the class ends a string in
`tools/extract_regexes.mts`'s scan, so it records one garbage entry spanning both literals
(`'([\'’""$1 nganti ");\n…/(\\d+)\\s*°\\s*C(?![\\p{L}])'`). Checked against the TS source by code point instead:
`U+2019 U+201D U+2032 U+2033 U+00B0 U+2013` and `U+00B0`, the same as the Rust. Consequence: regex-diff has never
compared these two patterns against Node; the fn-diff rows below are what cover them.

⚠ A DEAD END WORTH KEEPING: `allregs.sh` restored js_regex.rs with `mv file.bak file`, which keeps the backup's OLD
mtime, so cargo judged the crate fresh and the next `fn-diff` build still logged every pattern (its replay printed
`REGEX` lines). The script now `touch`es the restored file; the crate was rebuilt and every replay below is from the
clean build.

## Run 2 — 2026-10-15 04:33 (per-module differentials, and are they sensitive?)

**Command.** New dumps `jv-normalize` (normalizeJavanese, the recorded symbol tier, isUnreadableJavanese over every
letter run, and the registry's engine via `renderInHost("jv", t)` over the golden, FLEURS jv_id columns 3+4, new
`probes/jv.txt` and synthetic rows per arm; the digit token on 0…3,000, magnitudes to 10²², 10¹⁵ ± 1, 2⁵³ ± 1 and
Aksara digits) and `jv-g2p` (phonemizeWord, phonemizeWordRules and the nativiser over every letter run as
written/lower/UPPER, every ⟨e⟩-lexicon key, every 1–3 letter string, every 4-letter string over a context set, and
6,000 fixed-seed Aksara Jawa strings over U+A980–U+A9DF).

**Raw finding.**
```
jv-normalize: 96771 identical, 0 DIFFER   (synthetic 777, number 3602, tier 7735, unreadable rows, golden/fleurs/probe)
jv-g2p:       265860 identical, 0 DIFFER
```
Haystack (FLEURS jv_id, 3,926 unique lines): Aksara Jawa 0 (the script arm is reached only by probes and the PRNG
rows), `d.00` 40, a grouped number 66, a comma decimal 42, a dot decimal 86, `%` 8, `°` 4, a number range 38, an
all-caps run 145, ⟨é è ê⟩ 33; `Rp`, `1/2…1/4`, `±` and `jiwa` 0.

**Is the replay sensitive?** The a→ɔ penult reach widened (`last_v - penult <= 3`) and the DOI look-back narrowed
from 40 to 4 units: `jv-g2p: 264262 identical, 1598 DIFFER`, `jv-normalize: 95761 identical, 1010 DIFFER`. Reverted:
265860/0 and 96771/0.

## Run 3 — 2026-10-15 04:38 (end to end, the trace, the tier, provenance, the TS suite)

**Command.** `LANGS=jv … phonemize-sync | phonemize-best | phonemize-trace | trace`, `SYMBOLS_LANGS=jv … symbols`,
`npx tsx tools/provenance-poison.mts jv`, `pins.mts` on test/javanese.test.ts.

**Raw finding.** `phonemize-sync 3952/0`, `phonemize-best 3952/0`, `phonemize-trace 3952/0`, `trace 3952/0`,
`symbols 7000/0` (javanese tier 3928). provenance-poison: 0 sites. TS suite: first `128 pinned, 11 skipped`, the 11
being `phonemizeWord` called through `.map` with (value, index, array); the extractor now keeps the value only (the
function takes one parameter): `139 pinned, 0 skipped; expects evaluated: 110, failures: 0`, 134 distinct.
`cargo test javanese`: 2 passed.

## Run 4 — 2026-10-15 04:42 (reading for correctness: TS findings)

**Command.** `npx tsx <scratch>/t.mts jv …`; `hay.sh jv_id` counts. Rust reproduces each reading.

**Raw finding.**
1. **A clock `jam H.MM` reads with a SENTENCE PAUSE inside it** (normalize.ts). The decimal rule rightly declines a
   dot after `jam`, and the `.00` rules handle whole hours, but nothing reads `H.MM`, so the dot reaches the tokenizer
   as clause punctuation: `jam 07.30` → *d͡ʒˈam pˈitʊ . tˈəlʊŋ pˈulʊh*, `jam 10.15 esuk` likewise. **12 FLEURS jv_id
   lines** have `jam H.MM` with nonzero minutes. `15:30` gets a comma pause the same way (8 lines with `d:dd`).
2. **The Aksara Jawa pada marks reach the output padded** (aksara.jsonc `pada`: `" , "`, `" . "`). `sink.pause`
   inserts the mark between single spaces, so `ꦲꦏꦸ꧈ ꦲꦏꦸ꧉ ꦲꦏꦸ` reads `ˈaku  ,  ˈaku  .  ˈaku`, with double spaces —
   the hazard lao.ts's own comment names ("a padded value reaches the output as a double space"). FLEURS has no Aksara
   text; probe-only.
3. **Tool defect**: `tools/extract_regexes.mts` merges normalize.ts's quote-range literal and the next one into one
   garbage corpus entry (Run 1), so neither is in the regex-diff corpus.

**Implication.** Reported in the PR, not fixed (TS first).

## Run 5 — 2026-10-15 20:40 (#1589 fixes, TS first, mirrored to C# and Rust)

**Finding.** Item 1: a clock with real minutes after `jam` now reads the hour then the minutes, with no connector:
`jam 07.30` → *jam pitu telung puluh*, no pause. Still no minute or "past" word is attested (FLEURS jv_id writes
its 12 clocks as digits in both columns; `menit` ×0), so none is guessed. The colon form is claimed after `jam`
only (`jam 8:46 esuk`, ×3 FLEURS). A BARE `15:30` is DECLINED: a markerless `d:dd` can be a score or ratio, the line
Indonesian drew in #1534, so it keeps its comma pause.

Item 2: the pada values in `aksara.jsonc` are now unpadded like `clausePunctuation`. The Aksara line reads
byte-identically to its Latin twin and has no double space. One data edit fixes all three engines.

Item 3 (the extractor) was fixed by #1602. Golden jv: 0 rows changed.

**Test.** `test/sea-defects-1589.test.ts`, `SeaDefects1589Tests.cs`, and `defects_1589_tests` in the language's own Rust
module; relational, no typed IPA. Each fails with its fix reverted.
