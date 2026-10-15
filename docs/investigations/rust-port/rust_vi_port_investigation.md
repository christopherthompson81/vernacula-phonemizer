# Rust port: Vietnamese (vi)

The Vietnamese engine (`src/languages/vietnamese/`: vietnamese, manifest, g2p, numbers, normalize) ported to
`rust/vernacula-phonemizer/src/languages/vietnamese/`, the first of the "seasia" group (vi, lo, my, jv, su, mad).
Tracking issue #1463. Method as the earlier ports (rust_th / rust_id logs): per-module fn-diff, then the public entry
end to end, the trace, then the golden gate.

## Run 0 — 2026-10-15 03:05 (import closure of the group, neural and Roman entries)

**Question.** What do the six engines import that the Rust core lacks; do jv/su/mad reuse the ported Indonesian or
Malay modules; does any have a neural entry or a Roman policy?

**Command.** `grep -h "^import" src/languages/{vietnamese,lao,burmese,javanese,sundanese,madurese}/*.ts | sort -u`;
`grep -nwE "vi|lo|my|jv|su|mad" src/neuralRegistry.ts`; `ROMAN_POLICIES` in src/registry.ts; `ls csharp/goldens`
and the FLEURS transcript directory.

**Raw finding.**
- Core imports across the group: `clauses` (assembleClauses, clauseSink, emitUnclaimed), `loadManifest`, `loadTsv`,
  `normalizeSymbols`, `provenance` rewrite, `boundaries`, `unicode` foldNativeDigits, `segment` (segmentByDag,
  loadSegWords), `trace` (beginToken/endToken/enterEngine), `hostWord`, `initialisms`, `latinPhones`, `numbers`
  digitIndex. Every one already exists under `rust/vernacula-phonemizer/src/core/`: no new core module.
- No cross-language import: jv, su and mad import nothing from indonesian/ or malay/ (each has its own engine).
- `src/neuralRegistry.ts` names none of the six; none is in `ROMAN_POLICIES`.
- Registry: `vi` → `createVietnamese(readAsEnglish)`, `lo` → `createLao()`, `my` → `createBurmese(readAsEnglish)`
  (the registry comment says burmese stores the reader and never reads it), `jv`/`su`/`mad` → their factory, no reader.
- Goldens: all six. FLEURS: `vi_vn`, `lo_la`, `my_mm`, `jv_id`; nothing for su or mad.

**Implication.** Port in the given order. su and mad have no corpus, so their probes carry the weight.

## Run 1 — 2026-10-15 03:12 (first golden gate)

**Question.** With the five modules ported (the manifest struct names every field of `VietnameseManifest`; the one TS
literal table, `VI_ABBREV`, copied in order), is the golden byte-identical?

**Command.** `cd rust && cargo run --release -p parity -- vi`

**Raw finding.** `vi: 200/200 identical, 0 differ`, first build. Code-point audit of every Rust literal against the TS
(`audit_regex.py`: raw patterns verbatim in the TS; `nonascii_audit.py`: every non-ASCII run in a Rust string occurs
in the TS): `33 raw patterns, 4 not found verbatim` — the four `format!` templates around `NOT_LETTER_AFTER`, checked
by hand — and `59 non-ASCII runs, 0 not found`. The TOKEN class keeps its literal `̀-̣` (U+0300–U+0323) range and
`t̪` in CODA_RE keeps U+032A, as in the TS; the three char literals `ê ô ơ` are U+00EA, U+00F4, U+01A1 (precomposed),
as the TS's `"ê"`, `"ô"`, `"ơ"`.

**Implication.** Per-module differentials next.

## Run 2 — 2026-10-15 03:20 (per-module differentials, and a harness trap)

**Question.** Do normalize, the symbol tier, the engine's `text`, the syllable g2p and the number compositor match the
TS call for call?

**Command.** New dump entries `vi-normalize` (normalizeVietnamese, the recorded symbol tier on its output, and
`renderInHost("vi", t)` — the engine with the English reader, in vi's host scope, no pre-pass) and `vi-g2p`
(phonemizeSyllable over every letter run of the texts as written/lower/UPPER, every onset × rhyme key × tone mark in
NFD, NFC and upper, every 1–3 letter string over the Vietnamese alphabet plus f j w z, edge strings; numberToWords over
0…20,000, scaled samples, powers of ten to 10²⁴, 2⁵³, 1e300, fractions, negatives, NaN/±Infinity). Texts: the golden,
FLEURS vi_vn columns 3+4 (3,956 unique; first row checked to be a sentence) and new `probes/vi.txt` (synthetic, one
or more lines per arm with the neighbour each must decline, plus decomposed and reordered tone marks). Replayed with
`fn-diff`.

**Raw finding.**
- First replay: `vi-g2p: 245390 identical, 0 DIFFER`; `vi-normalize: 14948 identical, 1 DIFFER`, the probe line
  `Lone \ud800 surrogate and 𝐀𝐁 maths and ﬁ ligature.`: TS `… ˈənd ﬁ lˈɪɡət͡ʃɚ .`, Rust drops the `ﬁ`. Through the
  public entry both engines read it the same (`seasia_probe` vs `phonemize`), so it was the HARNESS: the replay built
  the engine directly, so the registry had never installed the default foreign reader, and the one unclaimed Latin run
  (`ﬁ`, outside TOKEN's class) had no reader. The arm now builds `vi` through the registry first. After:
  `vi-normalize: 14958 identical, 0 DIFFER` (fleurs 11550, probe 129, synthetic 2958).
- A second harness limit: the end-to-end `phonemize-trace` dump goes through the `&str` API, so a lone surrogate
  arrives in Rust as U+FFFD and its trace's `normalized` differs while the reading matches (1 DIFFER). The lone-surrogate
  lines moved from probes/vi.txt into `vi-normalize`'s synthetic rows, which carry UTF-16 units.
- Haystack: FLEURS vi_vn has 0 lines with a decomposed tone mark (U+0300–U+0323), 834 with a digit, 114 with an
  all-caps run, 22 with a `d:dd` clock. Decomposed and reordered marks are reached only by the probes and by `vi-g2p`'s
  NFD rows (every onset × rhyme × tone).

**Is the replay sensitive?** Two temporary breaks, rebuilt and replayed, then reverted: `lăm` after a ten only for
t ≥ 2 (`numbers.rs`) and the decimal comma needing two digits after it (`normalize.rs`): `vi-g2p: 243141 identical,
2249 DIFFER`, `vi-normalize: 14766 identical, 183 DIFFER`, and the TS-suite test fails (`14,7 tỷ` left unread).
Reverted: 245390/0 and 14949/0.

**Implication.** The modules match. End to end next.

## Run 3 — 2026-10-15 03:28 (end to end, the trace, the symbol tier, provenance, the TS suite)

**Command.** `LANGS=vi npx tsx rust/tools/fn-diff/dump.mts phonemize-sync | phonemize-best | phonemize-trace | trace`
and `SYMBOLS_LANGS=vi … symbols`, each replayed; `npx tsx tools/provenance-poison.mts vi`; the TS suite's calls
extracted by running `test/vietnamese.test.ts` under a recording vitest shim (`pins.mts`: every matcher evaluated,
all green) into `the_ts_suite_calls_return_the_ts_values`; a Rust poison test over probes + golden.

**Raw finding.**
```
phonemize-sync:  4000 identical, 0 DIFFER
phonemize-best:  4000 identical, 0 DIFFER
phonemize-trace: 4000 identical, 0 DIFFER
trace:           4000 identical, 0 DIFFER
symbols:         7029 identical, 0 DIFFER  (vietnamese tier 3957)
```
provenance-poison: `distinct poison sites: 0`. TS suite: `84 pinned, 0 skipped; expects evaluated: 85, failures: 0`
(49 normalizeVietnamese, 22 phonemizeWord, 13 phonemize); the Rust test passes, and fails under the Run 2 break.
Nothing is port-pending: the only foreign target is `en`.

**Implication.** vi meets the parity definition on this machine.

## Run 4 — 2026-10-15 03:33 (reading for correctness: TS findings)

**Command.** `npx tsx <scratch>/t.mts vi …` (the TS engine's own `phonemize` and `numberToWords` on synthetic input
chosen while reading each file against its docstring). Rust reproduces each one (the `vi-g2p` rows cover them).

**Raw finding.**
1. **A number of 10¹² or more loses its top scale** (numbers.ts). `SCALES` stops at `tỷ` (10⁹), so for a group
   index ≥ 4 `SCALES[g]` is `undefined`, which `join(" ")` renders as an empty word: `numberToWords(1e12)` is
   `"một "` and `phonemize("1000000000000", "vi")` reads *mˈo˨˩ˀt̪* ("one"); `2000000000005` reads "hai không trăm linh
   năm" (two … five), and `1234567890123` drops its trillions word the same way. The docstring promises scales
   "by thousands: nghìn / triệu / tỷ" and says nothing past them; Vietnamese continues with `nghìn tỷ` (10¹²). FLEURS
   vi_vn has 0 digit runs of 13+ digits, so the corpus does not witness it.
2. Checked and NOT a defect: TOKEN's class `à-ỹ` / `À-Ỹ` spans U+00E0–U+1EF9, so Greek, Cyrillic, Thai and every
   other script in that range is claimed as a "syllable"; phonemizeSyllable then returns "" and the English reader
   receives the run, which routes it to its own script reader (`xin Привет chào` → *… prʲɪvʲˈet …*, Thai and Greek
   likewise). The detour works, but the script run is not traced as foreign at the vi level.

**Implication.** Item 1 reported in the PR, not fixed (TS first, in its own change).

## Run 5 — 2026-10-15 05:40 (the group rebased onto main, and a gate that depended on order)

**Question.** After rebasing the six commits onto origin/main a64aa195 (the East Indic, west and Dravidian groups
landed meanwhile; registry, module list, dump.mts and the replay arms conflicted at every step and were rebuilt from
upstream plus each language's own additions), do all gates hold?

**Command.** `cargo run --release -p parity` (every language, one process), then `parity vi` and `parity en vi`.

**Raw finding.** The full run: `vi: 193/200 identical, 7 differ`, every row an embedded English word (`Daesh`, `Pago
Pago`, `Niue`, `Saint-Saens`, `Muskoka`) read with a neural reading where the golden has the n-gram one. Alone, and
after `en`: `vi: 200/200`. Cause: the foreign-OOV memo is process-wide; tools/gen_parity_goldens.mts calls
`clearForeignOov()` before every language (and so does the C# parity tool), the Rust parity tool did not, and the
new non-Latin languages now ahead of `vi` in LANGUAGES prewarm the same FLEURS sentences' English words. Fixed in the
HARNESS (`clear_foreign_oov()` per language in rust/tools/parity, its own commit): full run `vi: 200/200`; every
other language unchanged (mag 199/200, tt 199/200, syl 195/200 are their known Arabic-run port-pending rows).

**Implication.** A one-language parity run cannot see an order dependence; the full run is the gate.
