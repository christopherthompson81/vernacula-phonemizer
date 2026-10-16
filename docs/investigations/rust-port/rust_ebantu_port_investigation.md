# Rust port: the East/Central Bantu group (sw, rw, rn, lg, ln, nya)

Swahili (`src/languages/swahili/`), Kinyarwanda (`kinyarwanda/`), Kirundi (`kirundi/`), Luganda (`luganda/`),
Lingala (`lingala/`) and Chichewa (`chichewa/`, registry code `nya`). One log for the group: all six are a
Latin-script rule g2p over a manifest, a normalizer and (for most) a number composer, and rn reuses rw's number
composer. Tracking issue #1463. Method as the earlier ports (rust_vi / rust_dravidian logs): per-module fn-diff, the
public entry end to end, the trace, then the golden gate.

## Run 0 — 2026-10-15 05:20 (import closure, registry codes, neural and Roman entries)

**Question.** What do the six engines import that the Rust core lacks; which registry codes, neural entries, Roman
policies, goldens, FLEURS transcripts and test files exist?

**Command.** `grep -h "^import" src/languages/{swahili,kinyarwanda,kirundi,luganda,lingala,chichewa}/*.ts | sort -u`;
`grep` of the six factories in src/registry.ts and of the codes in src/neuralRegistry.ts and `ROMAN_POLICIES`;
`ls csharp/goldens`, the FLEURS transcript directory and `test/`.

**Raw finding.**
- Core imports: `clauses` (assembleClauses), `hostWord` (hostWordRun, LATIN_RUN, makeNativiser), `loadManifest`,
  `normalizeSymbols` (makeSymbolNormalizer; lingala `makeBareUnitNormalizer`), `provenance` (rewrite, renormalize),
  `latinPhones` (latinPhone), `numbers` (digitIndex). Every one exists under `rust/vernacula-phonemizer/src/core/`:
  no new core module.
- One cross-language import: kirundi imports `composeRwandaRundi` from `kinyarwanda/numbers.ts` and the type
  `RwandaRundiNumbers` from `kinyarwanda/manifest.ts`. Ported once with rw and reused by rn.
- Registry codes: `sw`, `rw`, `rn`, `lg`, `ln`, and **`nya`** for Chichewa (not `ny`). Every factory takes no reader.
  None is in `src/neuralRegistry.ts`, `ROMAN_POLICIES`, `FOLD_OPT_OUT` or `VULGAR_FOLD_OPT_OUT`.
- Goldens: sw, rw, rn, lg, ln, nya (200 rows each). FLEURS: `sw_ke`, `lg_ug`, `ln_cd`, `ny_mw`; nothing for rw or rn
  (probes carry them). Test files: test/{swahili,kinyarwanda,kirundi,luganda,lingala,chichewa}.test.ts.
- The sibling "sbantu" group (zu, xh, st, tn, nso, sn) has not landed on origin/main (0d87566f); nothing of it to
  reuse.

**Implication.** Port in the given order, rw's numbers module before rn.

## Run 1 — 2026-10-15 05:30 (sw: first golden gate and the code-point audit)

**What was written.** `languages/swahili/{manifest,normalize,swahili}.rs`. The manifest struct names every field of
`SwahiliDef` (the symbol tier is a `Required<Pick<…>>`, so every key is required). The TS's escaped NBSP — a ` `
cooked into a template string (expandDotted) and a ` ` regex escape (the bare `BC` rule) — and the literal
U+0329 of the syllabic nasal were written from placeholders and substituted byte-level (`subst.py`).
`w.startsWith(velarNasal, i)` takes a code-unit index while `i` counts code points; reproduced and noted.

**Command.** `cargo run --release -p parity -- sw`; `audit.sh swahili swahili`; `escape_audit.py`.

**Raw finding.** `sw: 200/200 identical, 0 differ`, first build. Audits: `26 raw patterns, 1 not found verbatim` (the
TOKEN `format!` template, checked by hand); `15 non-ASCII runs, 0 not found`; `2 TS escapes, 0 code points short`.
No Cf character in the Rust.

**Implication.** Per-module differentials next.

## Run 2 — 2026-10-15 05:36 (sw: per-module differentials, sensitivity, end to end, trace, symbols, TS suite)

**Command.** New dump entries `sw-normalize` (normalizeSwahili, the engine's own symbol tier recorded through
`symbols-wrap.ts`, and `renderInHost("sw", t)`, over the golden, FLEURS sw_ke columns 3+4, the new synthetic
`probes/sw.txt` and generated rows per arm; and digit strings 0…3,000, scaled samples, 10⁶…10²² and long runs
through the engine) and `sw-g2p` (phonemizeWord and the nativiser over every letter run of the texts as written /
lower / UPPER, every 1–3 letter string over a–z plus `'`, every 4-letter string over a nasal/glide/vowel context
set, and edge strings). Then `LANGS=sw e2e.sh … phonemize-sync phonemize-best phonemize-trace trace` and
`SYMBOLS_LANGS=sw … symbols`; `npx tsx tools/provenance-poison.mts sw`; test/swahili.test.ts run under the recording
vitest shim (`pins.mts`) into `the_ts_suite_calls_return_the_ts_values`; a Rust poison test over probes + golden.

**Raw finding.**
```
sw-normalize: 16335 identical, 0 DIFFER   (golden 327, fleurs 11304, probe 63, synthetic 1026, number 3615)
sw-g2p:      180212 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3898 identical, 0 DIFFER each
symbols:       6948 identical, 0 DIFFER
```
Sensitivity (two temporary breaks, then reverted): the labialization arm's vowel test forced true, and the range
comparison `<` → `<=`: `sw-normalize: 16307 identical, 28 DIFFER` (fleurs 16, probe 4, synthetic 8), `sw-g2p:
174505 identical, 5707 DIFFER`. Reverted: 16335/0.
provenance-poison: `distinct poison sites: 0`. TS suite: `49 pinned, 0 skipped; expects evaluated: 54, failures:
0`; both Rust tests pass. Nothing port-pending: sw wires no foreign reader.

**Reading for correctness** (TS prints, `t.mts sw`):
- `joto 10-15°C` → `ʄˈoto kˈumi ɲˈuzi ʄˈoto kˈumi nˈa tˈano selsiˈasi`: the degree rule (step 5) runs BEFORE the
  range rule (step 6) and puts `nyuzi joto` between the two endpoints, so the range never matches and the dash is
  dropped — a temperature range reads "ten degrees fifteen Celsius", no `hadi`. `10 - 15°C` the same.
- Not defects, recorded: `1/2` reads `mˈoʄa ᵐbˈili` (no fraction rule; the slash is dropped); `5,5` reads as two
  numbers with a pause (the decimal comma is documented as unhandled); `1.000.000` reads as a decimal plus a
  sentence break (dot grouping is not Swahili's convention).

**Implication.** sw done. TS defect to report (not fixed): normalize.ts's degree step pre-empts the range step on a
temperature range.

## Run 3 — 2026-10-15 06:05 (rw: the engine, the shared Rwanda-Rundi composer, the normalizer)

**What was written.** `languages/kinyarwanda/{manifest,numbers,normalize,kinyarwanda}.rs`. `RwandaRundiNumbers` and
`compose_rwanda_rundi` are `pub` for rn. The normalizer's escapes: the regex-literal NBSP / NNBSP / thin-space / NUL
escapes stay ESCAPES in raw strings, and the ones the TS cooks into a template or plain string (`NOT_COORD`, the
unit, clock, range and per-unit templates, the NUL sentinel) are Rust `\u{…}` escapes in ordinary strings, so the
compiled pattern has the TS's code points and no invisible character is literal. All of them were written as
placeholders and substituted byte-level. A `UNIT[key]` miss falls back to `"undefined"`, as the TS template would
write it (#1122); no input reaches that arm (under `/iu` the only fold onto a key letter is the Kelvin sign onto
`k`, which lowercases onto `k`).

**Command.** `parity -- rw`; `audit.sh kinyarwanda kinyarwanda`; `escape_audit.py`; `regs.sh rw` (JsRegex::new
temporarily logs every pattern while fn-diff replays the rw sync dump; compared by code point with every RegExp the
TS constructs over the same texts plus the regex corpus); the `rw-normalize` / `rw-g2p` dumps (golden, the new
synthetic `probes/rw.txt`, generated arms; every 1–3 letter string, 4-letter context strings; numberToWords over
0…20,000, the 10¹² ceiling and raw strings); two mutations; e2e + trace + symbols; provenance-poison; pins.

**Raw finding.**
- `rw: 200/200 identical`, first build.
- Audits: 23 raw patterns, 1 miss (the TOKEN template); 27 non-ASCII runs, 0 missing; escapes `TS 38, Rust 30` for
  U+00A0 — the 8 cooked NBSPs inside templates are the one `NB` constant interpolated 8 times, so the count cannot
  match; checked by the compiled-pattern comparison instead: `rust 95, ts 3423, rust-only 14`, and all 14 Rust-only
  patterns are core pre-pass patterns (`core/unicode.rs` mojibake repair, separator hygiene, the symbol tier's
  own), none from `languages/kinyarwanda/`. Every rw pattern Rust compiles is one the TS compiles, code point for
  code point.
- One rw pattern holds `"` inside a character class (the compass rule's `[″"]`), which regex-diff cannot see (#1590);
  covered by the compiled-pattern comparison above and by the compass probes.
- `rw-normalize: 6443 identical, 0 DIFFER` (golden 600, probe 57, synthetic 2172, number 3614); `rw-g2p: 170857
  identical, 0 DIFFER`.
- Mutations (the 2–9 thousand multiplier range cut to 2–8; the initialism's end-of-input test dropped):
  `rw-normalize: 6428 identical, 15 DIFFER`, `rw-g2p: 169856 identical, 1001 DIFFER`. A slip in `mutate.py` (an
  ambiguous revert string) left the second one in place for one rebuild; reverted by hand and re-run: 6443/0.
- `phonemize-sync / phonemize-best / phonemize-trace / trace: 219 identical, 0 DIFFER` each; `symbols: 3272
  identical, 0 DIFFER`; provenance-poison `0` sites; test/kinyarwanda.test.ts `134 pinned, 0 skipped; expects
  evaluated: 139, failures: 0` (83 normalizeKinyarwanda, 31 numberToWords, 20 phonemize); both Rust tests pass.
- Haystack: rw has no FLEURS, so beyond the 200 golden rows only the synthetic probes reach the arms.

**Reading for correctness** (TS prints, `t.mts rw`):
- A decimal with three or more fractional digits is not a decimal to this normalizer: the decimal rules take
  `\d{1,2}` after the mark, and dot de-grouping claims `[1-9]\d{0,2}(\.\d{3})+`. So `3.141` reads as the integer
  3141 (`ibihumbi bitatu na ijana na mirongo ine na rimwe`), `0.125` as `zeru . ijana na makumyabiri na gatanu` (a
  sentence break and then 125), and `3.14159` as `gatatu .` followed by 14,159. The first is the dot-grouping
  convention working as designed; the last two read a confidently wrong quantity.
- Not defects, recorded: a bare `-5` loses its sign (there is no negative rule outside the degree arm); `1/2` reads
  `rimwe kabiri`; `5°C-10°C` reads both temperatures with no range word.

**Implication.** rw done; rn reuses `compose_rwanda_rundi`. TS defect to report (not fixed): kinyarwanda/normalize.ts
reads a decimal with ≥3 fractional digits that dot de-grouping cannot claim as a sentence break plus an integer.

## Run 4 — 2026-10-15 06:30 (rn: reusing rw's composer, its own normalizer, and a pin-extraction collision)

**What was written.** `languages/kirundi/{manifest,numbers,normalize,kirundi}.rs`. `manifest.rs` types its number
table as `kinyarwanda::manifest::RwandaRundiNumbers` and `numbers.rs` calls `kinyarwanda::numbers::
compose_rwanda_rundi`, as the TS imports them: one composer, not a fork. kirundi.ts's `phonemizeWord` is its OWN
module in the TS (a near-clone of rw's, not an import), so it is its own Rust function. normalize.ts is also its own
module; a comment-stripped diff against rw's (`strip.py` + `diff`) lists what differs: a dotted-date rule, two units
with a singular table, `exponentPhrase`, year spans as `kuva … gushika`, degree spans with `na`, a sign carried into
the degree body, `saidNear` without rw's sentinel, the `kw'ijana` percent rule, no clock words.

**Command.** `parity -- rn`; `audit.sh kirundi kirundi`; `escape_audit.py`; `regs.sh rn`; `rn-normalize` / `rn-g2p`
dumps (golden, the new synthetic `probes/rn.txt`, generated arms); two mutations; e2e + trace + symbols;
provenance-poison; pins.

**Raw finding.**
- `rn: 200/200 identical`, first build.
- Audits: 29 raw patterns, 2 misses (the TOKEN template; the `(?<=dogere…)` template, checked by the compiled
  comparison); 20 non-ASCII runs, 0 missing; U+00A0 escapes `TS 25, Rust 21` — the four cooked template NBSPs, the
  `NB` constant. `regs.sh rn`: `rust 93, rust-only 16`; 15 are the core pre-pass patterns rw also listed, and ONE is
  rn's: `(?:kuva|guhera)\s\S{0,10}\s*$` (`iu`), absent from the TS side because it is a regex literal INSIDE a
  template-literal interpolation (normalize.ts's `join`), which `tools/extract_regexes.mts` does not reach — so the
  regex corpus, and therefore regex-diff, cannot see it either. ASCII only; checked by hand against the TS: identical.
  The compass-free `[′']` and `kw['’]ijana` classes hold no `"`.
- `rn-normalize: 6059 identical, 0 DIFFER` (golden 600, probe 51, synthetic 1794, number 3614); `rn-g2p: 167240
  identical, 0 DIFFER`.
- Mutations (`exponentPhrase`'s cubed test narrowed to `³`; the `kuva`/`guhera` look-back forced false):
  `rn-normalize: 6015 identical, 44 DIFFER` (probe 6, synthetic 38). Reverted: 6059/0.
- `phonemize-sync / phonemize-best / phonemize-trace / trace: 217 identical, 0 DIFFER` each; `symbols: 3272
  identical, 0 DIFFER`; provenance-poison `0` sites.
- **Pins, first attempt: a FALSE failure.** test/kirundi.test.ts imports `phonemizeWord` and `numberToWords` from
  BOTH kirundi and kinyarwanda (it compares the two), and the recorder named calls by export name only, so rw's
  `phonemizeWord("ijana")` → `iʒana` was replayed through rn's (`id͡ʒana`). The recorder now qualifies names by
  language directory under `PIN_QUALIFY=1`: `114 pinned, 0 skipped; expects evaluated: 117, failures: 0` (58
  kirundi.normalizeKirundi, 17 kirundi.numberToWords, 9 kirundi.phonemizeWord, 7 kinyarwanda.phonemizeWord, 3
  kinyarwanda.numberToWords, 20 phonemize); both Rust tests pass.

**Reading for correctness** (TS prints, `t.mts rn`):
- **A negative temperature loses its sign.** The degree rules capture `([-−–]?)` and put it straight into the body,
  `dogere -5`, where the tokenizer has no arm for `-` and drops it: `-5°C` reads `doɡeɾe ɡatanu`, "five degrees".
  rw reads the same input with `munsi ya zeru` ("below zero").
- Recorded, by design per the TS header (all five of the corpus's slash spans are measurements, and there is no
  fraction rule): `1/2` reads `rimwe gushika kuri kabiri` ("one up to two") and `3/4` the same shape.
- `0.125` has rw's decimal shape: `zeru . ijana na mirongo ibiri na gatanu`.

**Implication.** rn done. TS defects to report (not fixed): kirundi/normalize.ts drops the sign of a negative
temperature; a decimal with ≥3 fractional digits reads as a sentence break plus an integer (shared with rw).

## Run 5 — 2026-10-15 06:35 (lg, and a harness slip that left a logging binary behind)

**What was written.** `languages/luganda/{manifest,numbers,normalize,luganda}.rs`. The engine scans by UTF-16 code
unit (`w[i]`, `w.startsWith(k, i)`), as the TS does; `G[sp] ?? "ⁿ"` keeps an empty-string value (only a miss takes
the fallback). The range rule's pattern is built with `String.raw`, so its ` ` is an ESCAPE in the pattern
(not a cooked NBSP as in rw's templates) and stays one in Rust; the cm/mm/kg template doubles its backslash
(`\\u00a0`), so it is an escape too. `saidNear` builds its alternation at call time with the TS's own escaping
(`[.*+?^${}()|[\]\\]` → `\$&`, a space → `\s+`).

**Command.** `parity -- lg`; `audit.sh luganda luganda`; `escape_audit.py`; `regs.sh lg` then `newonly.py lg` (the
Rust-only patterns minus the core pre-pass set rw established); `lg-normalize` (golden, FLEURS lg_ug columns 3+4,
`probes/lg.txt`, generated rows per arm) / `lg-g2p`; two mutations; e2e + trace; provenance-poison; pins.

**Raw finding.**
- `lg: 200/200 identical`, first build.
- Audits: 27 raw patterns, 1 miss (the TOKEN template); 23 non-ASCII runs, 0 missing; `22 TS escapes, 0 code points
  short`. `newonly.py lg`: `rust 72, rust-only 11, of which core baseline 11, other 0`.
- `lg-normalize: 12175 identical, 0 DIFFER` (golden 256, fleurs 7346, probe 26, synthetic 934, number 3613);
  `lg-g2p: 176147 identical, 0 DIFFER`.
- Mutations (`ᵑ` before ⟨k⟩ only, not ⟨g⟩; the year test `na >= 1000` → `> 1000`): `lg-normalize: 9331 identical,
  2844 DIFFER` (golden 92, fleurs 2747), `lg-g2p: 172310 identical, 3837 DIFFER`. Reverted: 12175/0, 176147/0.
- **Harness slip.** The first `regs.sh lg` was piped into a `grep` that failed at once (ugrep rejected the
  pattern); SIGPIPE killed the script after it had restored `core/js_regex.rs` but BEFORE its rebuild, so the next
  e2e run replayed through an fn-diff that still logged every pattern to stderr (the results were unaffected,
  stdout only, but the output was unreadable). `git status` confirmed the source was clean; rebuilt the workspace
  and re-ran: `phonemize-sync / phonemize-best / phonemize-trace / trace: 3814 identical, 0 DIFFER` each. Rule
  kept from here: `regs.sh` is never piped into a filter; its output is read afterwards with `newonly.py`.
- provenance-poison `0` sites; test/luganda.test.ts `141 pinned, 0 skipped; expects evaluated: 143, failures: 0`
  (65 normalizeLuganda, 16 numberToWords, 30 phonemizeWord, 30 phonemize); both Rust tests pass.

**Reading for correctness** (TS prints, `t.mts lg`). Nothing new to report: the readings that look wrong are
documented refusals in the normalize.ts header — `20°C` reads `amakumi abiɾi c` (no sourced scale name; the header
records that the bare `C` then reads as the palatal stop), a decimal reads its digits with no point word (`1.5 km`
→ `kiɾomita emu tːaːno`), `5 km/h` keeps raw letters (no rate rule), and a bare `-5` loses its sign.

**Implication.** lg done.

## Run 6 — 2026-10-15 06:50 (ln: written tone, the NFD pipeline string, literal zero-width characters)

**What was written.** `languages/lingala/{lingala,normalize}.rs` (the TS has no manifest module: the engine loads
lingala.jsonc itself, and normalize.ts loads it a second time for `firstCard`, so both Rust modules do the same).
Code points that needed care, all written from placeholders and substituted byte-level:
- the four tone marks U+0301 U+0300 U+0302 U+030C and the TOKEN class range U+0300–U+036F are LITERAL in the TS and
  stay literal (combining marks; not an invisible-character lint target);
- the zero-width class `[​‌‍﻿]` (U+200B U+200C U+200D U+FEFF) is literal in the TS; per the #1591 rule it is written
  as `\u{…}` escapes in an ordinary Rust string — same code points in the compiled pattern, nothing invisible in the
  source;
- the `expandDotted` NBSP is cooked from a template, so a Rust `\u{a0}` escape; the de-grouping class keeps its
  regex-literal `   ` escapes.
The text path runs `renormalize(…, NFD)` on the pipeline string and the g2p NFD/NFC on the word (off the seam).

**Command.** `parity -- ln`; `audit.sh lingala lingala`; `escape_audit.py`; `regs.sh ln` then `newonly.py ln`;
`ln-normalize` (golden, FLEURS ln_cd columns 3+4, `probes/ln.txt`, every text again in NFD, generated arms) /
`ln-g2p` (letter runs as written / lower / UPPER / NFD, every 1–3 letter string over a–z ɛ ɔ, every vowel × two
tone-mark slots composed and decomposed, 4-letter context strings); mutations; e2e + trace; provenance-poison; pins.

**Raw finding.**
- `ln: 200/200 identical`, first build.
- Audits: 31 raw patterns, 0 misses; 60 non-ASCII runs, 0 missing; `7 TS escapes, 0 code points short`.
  `newonly.py ln`: `rust 238, rust-only 17, core baseline 11, other 6`. Five of the six are reached through the
  default foreign reader (English initials, DMS coordinates, Cyrillic stress marks, the micro sign) on the probes'
  foreign names, i.e. not ln's. The sixth is ln's: `[– -]` (`gu`), the ISBN separator class, a regex literal inside
  a template interpolation, which `tools/extract_regexes.mts` does not reach (the rn finding again; the same line
  exists in haitian/ and bambara/). Checked by code point against the TS: U+2013 U+0020 U+002D, identical.
- `ln-normalize: 13051 identical, 0 DIFFER` (golden 198, fleurs 7482, probe 34, synthetic 1576, number 3761);
  `ln-g2p: 75924 identical, 0 DIFFER`.
- Mutations: the spaced-range single-digit refusal narrowed to the left operand, and the fraction ceiling `<= 10` →
  `< 10`: `ln-normalize: 13041 identical, 10 DIFFER` (probe 4, synthetic 6). The consonant keys sorted shortest
  first: `ln-normalize: 6619 identical, 6432 DIFFER`, `ln-g2p: 67830 identical, 8094 DIFFER`. All reverted:
  13051/0, 75924/0.
- `phonemize-sync / phonemize-best / phonemize-trace / trace: 3857 identical, 0 DIFFER` each; provenance-poison `0`
  sites; test/lingala.test.ts `97 pinned, 2 skipped` (the `getPhonemizer("ln")` object and a `loadManifest` call
  return objects; the 19 `.text` calls through it are pinned and replayed through `registry::phonemize_in`),
  `expects evaluated: 99, failures: 0`; both Rust tests pass.

**Reading for correctness** (TS prints, `t.mts ln`):
- **The `Ne` ordinal rule fuses a following digit.** `(?<![\d\p{L}\p{M}])(\d+)e(?![\p{L}\p{M}])` checks only that no
  LETTER follows the `e`, so `1e5` reads `ya zómi na mítáno` ("fifteenth") and `2e6 ya bato` reads `ya túkú míbalé na
  motóbá` ("twenty-sixth") — the `e` is deleted and the digits on either side join into a number nobody wrote.
- Recorded, documented or by design: `25°F` reads the number and a bare `f` (only `°C` has a rule); `-5` loses its
  sign; `5 - 6` (spaced single digits) stays a juxtaposition.

**Implication.** ln done. TS defect to report (not fixed): lingala/normalize.ts's French ordinal rule `(\d+)e` has no
digit guard after the `e`.

## Run 7 — 2026-10-15 07:05 (nya)

**What was written.** `languages/chichewa/{manifest,numbers,normalize,chichewa}.rs`. The symbol tier's tables are
generated from chichewa.ts's object literals (key order kept; no integer-like keys); the tier runs on the raw input
BEFORE normalize.ts, as in the TS. The clock pattern is a template (its two NBSPs cooked, so the one `NB` escape
constant); the rest keep their regex-literal escapes. The registry code is `nya` (FLEURS directory `ny_mw`).

**Command.** `parity -- nya`; audits; `regs.sh nya` + `newonly.py nya`; `nya-normalize` (golden, FLEURS ny_mw
columns 3+4, `probes/nya.txt`, generated arms; normalize / symbols / text) / `nya-g2p`; two mutations; e2e + trace +
symbols; provenance-poison; pins.

**Raw finding.**
- `nya: 200/200 identical`, first build.
- Audits: 21 raw patterns, 2 misses (the TOKEN and clock templates, checked by the compiled comparison); 11
  non-ASCII runs, 0 missing; U+00A0 `TS 15, Rust 14` (the clock template's two cooked NBSPs are the one `NB`
  constant). `newonly.py nya`: `rust 82, rust-only 13, of which core baseline 13, other 0`.
- `nya-normalize: 17138 identical, 0 DIFFER` (golden 600, fleurs 11538, probe 45, synthetic 1341, number 3614);
  `nya-g2p: 252417 identical, 0 DIFFER`.
- Mutations (the loan magnitude's multiplier series class-6 → citation; the clock's hour ceiling 23 → 22):
  `nya-normalize: 16679 identical, 459 DIFFER` (golden 9, fleurs 2, number 406), `nya-g2p: 251513 identical, 904
  DIFFER`. Reverted: 17138/0, 252417/0.
- `phonemize-sync / phonemize-best / phonemize-trace / trace: 4061 identical, 0 DIFFER` each; `symbols: 7118
  identical, 0 DIFFER`; provenance-poison `0` sites; test/chichewa.test.ts `103 pinned, 0 skipped; expects
  evaluated: 106, failures: 0` (49 normalizeChichewa, 33 numberToWords, 21 phonemize); both Rust tests pass.

**Reading for correctness** (TS prints, `t.mts nya`): the rw decimal shape again — the decimal rules take only
`\d{1,2}` after the mark, so `0.125` reads `ziro .` and then 125, and `3.14159` reads `zitatu .` and then 14,159.
Recorded, not defects: an unmarked `7:30` reads two numbers with a pause (the clock rule needs a meridiem, zone or
day-part); `-5` loses its sign; `1/2` reads `chimodzi ziwiri`; `5 m/s` leaves a raw `s`.

**Implication.** nya done; all six ported. TS defect to report (not fixed): chichewa/normalize.ts reads a decimal with
≥3 fractional digits as a sentence break plus an integer (the rw/rn shape).

## Run 8 — 2026-10-15 07:35 (merge of origin/main 263f6bf3, every gate on the combined tree)

**What changed.** origin/main gained the southern Bantu group (#1592) and the invisible-character fix (#1591). Every
one of the six commits conflicted at the same tails (LANGUAGES, the `build` arms, FLEURS_DIR, the end of the dumps
table, the end of the replay match), so origin/main was MERGED once rather than rebased. git had interleaved the two
sides' replay arms in main.rs hunk by hunk, so the three files were resolved by taking main's side and re-applying
this group's arms and blocks with the same scripts that first inserted them (`rewire.sh`: `wire.py` × 6, `add.py` ×
6). Nothing from the sbantu group was reusable here (no shared module with these six).

**Command.** `gates.sh` (scratchpad): dump.mts parse check, fmt, build, `parity` over every language, `cargo test`,
regex-diff, clippy, the twelve per-module dumps re-made and replayed, and `LANGS=sw,rw,rn,lg,ln,nya` e2e.

**Raw finding.**
- LANGUAGES: declared 109, 109 entries, 109 distinct. dump.mts parses. fmt clean; build 0 warnings.
- parity: every language line 200/200 (hil 112/112, ilo 94/94, nog 68/68) except the known port-pending rows mag
  199/200, tt 199/200, syl 195/200. sw, rw, rn, lg, ln, nya: 200/200 each.
- `cargo test`: 320 + 1 passed, 0 failed. regex-diff: `146326 probe results identical, 0 DIFFER, 0 patterns refused`.
- clippy: completes with 0 `error:` lines. In the six new directories: the six `module_inception` warnings, and ONE
  more, `manual_range_contains` on ln's number guard (`num >= 0.0 && num < 1e12`), fixed to
  `(0.0..1e12).contains(&num)` (the same for -0, NaN and ±Infinity); after it ln 200/200, ln-normalize 13051/0.
- per-module: sw 16335/0 + 180212/0, rw 6443/0 + 170857/0, rn 6059/0 + 167240/0, lg 12175/0 + 176147/0, ln 13051/0 +
  75924/0, nya 17138/0 + 252417/0 (identical / DIFFER).
- combined e2e: `phonemize-sync / phonemize-best / phonemize-trace / trace: 16066 identical, 0 DIFFER` each.

**Port-pending.** None: no row of the six routes to an unported engine.

**Implication.** Ready for the PR.

## Run 9 — 2026-10-15 20:55 (#1595: the TS defects this port recorded, fixed in all three engines)

Probed on main (4b6e7511) with the TS engine, using synthetic inputs, then fixed TS-first and mirrored to C# and Rust.

- **sw `10-15°C`** read *kumi nyuzi joto kumi na tano Selsiasi*: the `°C` arm claimed `15°C` before RANGE could
  see a second endpoint. A temperature-range arm now runs before the degree arms. It gives `nyuzi joto A hadi B
  <scale>`, which composes the corpus's own "nyuzi joto 45°C" order with RANGE's `hadi`. It is ascending only,
  so `15-10°C` falls through unchanged.
- **rw, rn, nya `0.125`, `3.14159`** read "zero." then an integer: the dot decimal arm took a 1–2 digit tail
  only. Every grouped dot shape is spent by the de-grouping step first, so a longer tail that reaches the decimal
  arm is a decimal. Measured over the mined artifacts:
  - `\d+\.\d{4,}`: ×2 in rw, both decimal coordinates (`−2.010556`, `30.557500`); ×0 in rn and nya.
  - `0\.\d{3,}`: ×0 in all three.
  - No dotted date has a four-digit tail.
  The dot arm now takes any tail. ⚠ The COMMA arm keeps its 1–2 limit, because a date comma (`Novembala
  26,2008`) has a four-digit tail.
- **ln `1e5`, `2e6`** read as ordinals ("fifteenth", "twenty-sixth"). The bare-`e` arm gained `\d` in its
  negative lookahead. `\d+e\d` is ×0 in the corpus; `1e5` now reads like `1 e 5`, and a tight `2e` still reads
  `ya 2`.
- **rn `-5°C` loses its sign: DECLINED.** This is the refusal the file already records. Kirundi has no
  attested reading: rn.wikipedia gives 0 hits for `"munsi ya zeru"` and 0 for `"munsi ya" dogere`, and rw's
  `munsi ya zeru` citations are Kinyarwanda.

Goldens: sw, rw, rn, nya and ln are all unchanged (1000 rows, 0 stale). Tests are relational in all three
engines:
- TS: 3 tests;
- C#: 13 cases;
- Rust: one per language, in its own module.

With the fixes reverted, all 3 TS tests fail, 11 of the 13 C# cases fail (the 2 controls pass), and all 5 Rust
tests fail.
