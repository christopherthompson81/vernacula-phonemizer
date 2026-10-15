# Rust port: the West African group (yo, ig, ha, ee, ak, wo)

Part of #1463. Method as in the southern Bantu and Dravidian logs: per-module `fn-diff` differentials, then the
public entries end to end (sync, best, trace), then the golden gate. One log for the group, because the six engines
share a shape (a pre-tokenizer normalizer, a three-way TOKEN, a letter scan, a cardinal compositor) and three of them
write tone with combining marks.

## Run 1 — 2026-10-15 06:00 (the import closure, baseline)

**Question.** What do the six TS directories need that the Rust core lacks? Is there a neural side? What is shared?

**Command.** `grep -n 'from "' src/languages/{yoruba,igbo,hausa,ewe,akan,wolof}/*.ts`; the registry arms
(`grep -nE -A3 'case "(ha|ak|ee|yo|ig|wo)":' src/registry.ts`); `src/neuralRegistry.ts`; `ROMAN_POLICIES`;
`ls csharp/goldens`; the FLEURS transcript directory.

**Raw finding.**
- Core imports across the group: `clauses`, `hostWord` (`hostWordRun`, `LATIN_RUN`, `makeNativiser`), `initialisms`
  (`makeInitialismNormalizer`, `makeUnreadableTest`; ha only), `ipa` (`IPA_VOWEL`; ak only), `latinPhones`,
  `loadManifest`, `loadTsv` (ha's `tone.tsv`, ak's `akan-tone.tsv`), `normalizeSymbols` (`makeSymbolNormalizer`;
  `makeBareUnitNormalizer` for ee and ak), `numbers` (`digitIndex`; ig only), `provenance` (`rewrite`,
  `renormalize`). Every one is already in `rust/vernacula-phonemizer/src/core/`: no new core module.
- No cross-language import: each of the six imports only `../../core/*` and its own directory.
- No neural entry for any of the six (`src/neuralRegistry.ts` names none); none is in `ROMAN_POLICIES`.
- Registry: `yo` → `createYoruba(readAsEnglish)` (stored, never read, as burmese's), every other one → its factory
  with no reader. An unclaimed Latin run reaches English through `clauses.ts`'s fleet default.
- Goldens: all six. FLEURS: `yo_ng`, `ig_ng`, `ha_ng` (train split only), `wo_sn`. Nothing for ee or ak, so their
  probes and synthetic rows carry the weight.
- Tone marks: yo and ig scan the NFD word for U+0300 / U+0301 / U+0304 / U+0323 (ig also U+0307); ee keeps U+0303 and
  folds U+0342; ak appends U+0303 and Chao letters from its tone lexicon. Every such character in the Rust is written
  from an ASCII placeholder and swapped in at the byte level (`wafrica/swap.py`), then audited by code point against
  the TS (`audit_regex.py`, `escape_audit.py`, `nonascii_audit.py`).

**Implication.** Port in the order given; nothing is shared between the six, so each is self-contained.

## Run 2 — 2026-10-15 06:05 (yo: first build, audits, the golden gate)

**Commands.** The four modules written with placeholders, `swap.py` (yoruba.rs 9, normalize.rs 5); `wire.py` (mod,
build arm, LANGUAGES 97 → 98); `cargo build --release -p parity && ./target/release/parity yo`; `wafrica/audit.sh
yoruba yoruba`.

**Raw finding.** `yo: 200/200 identical, 0 differ` on the first build. Audits: `18 raw patterns, 0 not found verbatim
in the TS`; `3 TS escapes, 0 code points short` (the two `\u00a0` in METRE and `\u2212`, kept as escape text in raw
strings); `38 non-ASCII runs, 0 not found in the TS`; no literal invisibles. The TOKEN class keeps its literal
U+0300–U+036F range, the four mark constants are the literal U+0323 / U+0301 / U+0300 / U+0304 as in the TS, and
`hẹ́kítà` / `ẹsẹ̀ bàtà` keep the dotted vowel plus a separate combining tone (no precomposed form exists).

**Implication.** Per-module differentials next.

## Run 3 — 2026-10-15 06:20 (yo: per-module differentials, guard check, end to end)

**Commands.** New `dump.mts` entries `yo-normalize` and `yo-g2p`, `FLEURS_DIR` `yo: "yo_ng"`, one fn-diff arm;
`probes/yo.txt` (26 synthetic lines); `wafrica/e2e.sh yo yo-normalize yo-g2p`, then
`wafrica/e2e.sh yo phonemize-sync phonemize-best phonemize-trace trace`. Inputs: the golden, FLEURS yo_ng columns 3
and 4 (first row checked to be a sentence), the probes and 272 synthetic rows (grouping in every shape, every range
dash, the U+2212 minus with each refusal including the spaced exponent, both percent arms × the said-before / said-after
windows, squared units, `sq` incl. `\u212am`, the tier's currencies / units / rates / `&`, the metre and the
`9h 50m` refusal, scaled degrees incl. `5°\u212a`, `×`, decimals, lone surrogates). `yo-g2p` replays `phonemizeWord`
over every letter run (as written, lower, UPPER, NFD, NFC), every 1–3 string over 29 letters plus the five combining
marks, and corners; `yorubaNumber` over 0…20,000, scaled samples and runs to 10²²; `yorubaCardinal` over fractions,
negatives, ±0, NaN, ±Infinity, 1e21; `readYorubaNumbers` over every text plus Arabic-Indic and Bengali digits.

**Raw finding.** First build, every one:
```
yo-normalize: 12025 identical, 0 DIFFER   (golden 254 / fleurs 7186 / probe 52 / synthetic 544 / tier 3989)
yo-g2p: 92370 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3746 identical, 0 DIFFER each
```
Haystack: `normalizeYoruba` changed golden 6/127, FLEURS 158/3,593, probes 19/26, synthetic 212/272 texts; 5,672 of
the 7,096 FLEURS yo_ng texts carry a combining tone or dot-below mark, so the NFD scan is exercised by the corpus,
not only by the synthetic strings.

**Guard check.** The said-before window widened from 20 to 30 code units, and the ⟨w⟩ labialisation's vowel test
loosened to "any next character": `yo-normalize: 12018 identical, 7 DIFFER`, `yo-g2p: 91797 identical, 573 DIFFER`.
Restored: 0 DIFFER both.

## Run 4 — 2026-10-15 06:30 (yo: TS-suite pins, reading for correctness)

**Changes.** yoruba.rs gains a test module: all 132 calls test/yoruba.test.ts (12), test/yorubaNormalize.test.ts (50)
and test/yorubaNumbers.test.ts (70) make, extracted by `wafrica/pins.sh` (every matcher evaluated: 145, 0 failures)
and appended by `gen_tests.py` (a byte-level write).

**Raw finding.** `cargo test --release yoruba`: 1 passed; with 15's irregular arm moved to 16 it fails at the first
pin that reads 15, and passes again restored. clippy on the new files: only `module_inception`, 0 `error:` lines.

**TS finding (reported, not fixed; the Rust reproduces it).** An INFIX U+2212 is silently dropped:
`ó jẹ́ 5 − 3 ni` and `ó jẹ́ 5−3 ni` both read *… ma˥ɾũ˩ ũ˥ mɛ˥ta˧ …* ("five three"). Rule 2b claims only a
leading U+2212, and the range rule's class `[-–—]` does not hold it, so the operator between two digits reaches no
rule and TOKEN skips it. normalize.ts's 2b note says U+2212 "can only be the operator"; the subtraction is the one
place that reading is lost.

**Checked, not a defect.** TOKEN's `À-ɏ` range holds `×` (U+00D7) and `÷` (U+00F7), so a stray one is claimed as a
"word" and reads as nothing (`a × b` → *a˧ b*); the header records ÷ as deliberately unread and every digit-flanked ×
is claimed by rule 6 first. And the `ì` / `ọ` alternatives in SAID_BEFORE / SAID_AFTER are dead (the patterns test the
mark-stripped fold), which is harmless.

**Implication.** Commit yo; ig next.

## Run 5 — 2026-10-15 06:50 (ig: first build, differentials, pins)

**Shape.** manifest.rs (`IgboManifest`: clause punctuation and numbers), numbers, normalize (the tier's argument is a
TS object literal, so it is the RECORDED `JSON.stringify` of it, byte-compared against the recording; FUSED_QUANTITY
is built from the `UNIT` table at runtime, as the TS builds it) and igbo (`IgboDef`, igbo.ts's own slice of the same
jsonc). `digits()` reproduces `units[digitIndex(d)] ?? d`: a non-digit code point passes through as itself.

**Commands.** As Runs 2–4: placeholders + `swap.py` (igbo.rs 9), `audit.sh igbo igbo`, `parity ig`; `ig-normalize` /
`ig-g2p` dumps with `FLEURS_DIR` `ig: "ig_ng"` and `probes/ig.txt` (16 synthetic lines) plus 160 synthetic rows
(grouping, the ordinal tail in every case incl. the long s and the boundary refusals, ranges, the fused-quantity space
over 6 prefixes × 12 unit spellings, the tier, decimals incl. `2.30pm` / `100.9fm`); `ig-g2p` over every letter run ×
5 forms, every 1–3 string over 31 letters plus five marks (U+0307 among them), corners, and `numberToWords` over
0…20,000 with and without the raw digits, runs past 10¹², and non-integer / non-finite values with and without raw;
e2e; the three TS suites' calls.

**Raw finding.** `ig: 200/200` on the first build; audits `6 raw patterns, 1 not verbatim` (the recorded JSON, equal to
the recording byte for byte), `0 TS escapes`, `18 non-ASCII runs, 0 not found`. Then:
```
ig-normalize: 12430 identical, 0 DIFFER   (golden 230 / fleurs 7706 / probe 32 / synthetic 320 / tier 4142)
ig-g2p: 106756 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3984 identical, 0 DIFFER each
cargo test --release igbo: 1 passed (67 pins: igbo 12, igboNormalize 33, igboNumbers 22; 68 expects, 0 failures)
```
Haystack: `normalizeIgbo` changed golden 7/115, FLEURS 138/3,853, probes 11/16, synthetic 124/160 texts.

**Guard check.** FUSED_QUANTITY's power class narrowed from `[²³23]` to `[²³2]`, and `below100`'s unit remainder of 1
read through `units` instead of `one`: `ig-normalize: 12365 identical, 65 DIFFER`, `ig-g2p: 100430 identical, 6326
DIFFER`. Restored: 0 DIFFER both.

**TS observation (reported, not fixed).** A letter `x` between digits reads as the Latin fallback's initial /z/:
`4x100` → *anɔ z otu naɾɪ* ("four z one hundred"). The header declines MULTIPLICATION for lack of a word, which covers
`×`; an ASCII `x` is not declined but voiced. The leading minus (`-5` → *ise*) and the infix U+2212 (`5 − 3` →
*ise atɔ*) are silent too, which the header records as an accepted silence.

**Implication.** Commit ig; ha next.

## Run 6 — 2026-10-15 07:15 (ha: first build, differentials, pins)

**Shape.** manifest (the rule table as `(String, String, bool)` tuples; the tier's `exponentWords` is its own struct
because the TS declares `squared` and `cubed` required), g2p (the optional, trimmed `tone.tsv`; `codes[n]` read one
code UNIT at a time, `?? ""` past the end), numbers ("" for anything but a non-negative integer below 10¹²), normalize
(the initialism pass and `isUnreadableHausa` over the manifest's phonotactics; each `{…}[u.toLowerCase()]!` table a
`match` whose miss stringifies as `undefined`) and hausa (TOKEN built from `hostWordRun(["Latin"], "'’")`, the
nativiser, the tier from the manifest, the digit-at-a-time fallback).

**Commands.** As before; `ha-normalize` / `ha-g2p` dumps with `FLEURS_DIR` `ha: "ha_ng"` and `FLEURS_SPLITS`
`ha_ng: ["train"]` (the directory ships only train), `probes/ha.txt` (21 synthetic lines) and 652 synthetic rows
(entities, era markers, dotted capitals incl. hooked ones, `v.`, `US$`, both range rules incl. `1, -2`, a clock grid of
9 hours × 5 minutes × 10 markers, timezone clocks, GHz, decimal + unit over 16 unit spellings incl. U+212A and U+017F,
version letters, comma decimals, fractions, degrees × scales × compass, rates, the preposed unit, the signs, A&B, the
decimal percent, 14 initialisms × 2 frames); `isUnreadableHausa` over every letter run; `ha-g2p` over every letter run
× 3 forms, every tone key × 3 casings, every 1–3 string over 31 letters, every 4-letter string over 16 context
letters, corners, the nativiser on each, and `numberToWords` over 0…20,000, scaled samples and the 10¹² edge.

**Raw finding.** `ha: 200/200` on the first build; audits `36 raw patterns, 0 not found verbatim` (TOKEN's `format!`
checked by hand), `1 TS escape, 0 short`, `24 non-ASCII runs, 0 not found` (the minus class keeps its literal U+2212
as the TS writes it). Then:
```
ha-normalize: 86953 identical, 0 DIFFER   (golden 2741 / fleurs 77220 / probe 174 / synthetic 3299 / tier 3519)
ha-g2p: 248249 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3029 identical, 0 DIFFER each
cargo test --release hausa: 1 passed (67 pins: 22 phonemizeWord, 11 numberToWords, 34 phonemize; 72 expects, 0 failures)
```
Haystack: `normalizeHausa` changed golden 9/100, FLEURS 183/2,908, probes 17/21, synthetic 447/652 texts.

**Guard check.** The range rule's operand loosened back to `(\d[\d,]*)` (the `1, -2` shape #1015 closed), and the tone
overlay's lowercase fallback removed: `ha-normalize: 86484 identical, 469 DIFFER`, `ha-g2p: 245013 identical, 3236
DIFFER`. Restored: 0 DIFFER both.

**TS findings (reported, not fixed; the Rust reproduces each).**
1. `nisa 12.8 m/ſ ne` (U+017F) → normalized `nisa 12 maki takwas undefined ne` → *… undeɸˈined …*: the decimal + unit
   rule's alternation `m\/s` is matched under `iu`, which admits the long s, and the lookup table keyed by
   `u.toLowerCase()` has no row for it (#1122's shape). The Kelvin sign is safe there: U+212A lowercases to `k`.
2. A sentence ending in a capital loses its full stop: `Ya je BBC. Bello ya zo.` reads *… t͡ʃˈa˥ bˈe˥llo˩ …* with no
   clause break, while `Ya je Kano. Bello ya zo.` keeps it. Step 3's `(?<=\p{Lu})\.(?=\s+\p{Lu})` is written for an
   initial (`M. Bello`), but an acronym at the end of a sentence followed by any capitalised sentence matches it too.

**Implication.** Commit ha; ee next.

## Run 7 — 2026-10-15 07:35 (ee: first build, differentials, pins)

**Shape.** No manifest.ts: ewe.rs loads `EweDef` (digraphs, letters) itself; numbers.rs holds its tables as the TS
does (the nasal `etɔ̃` / `atɔ̃` keep their separate U+0303); normalize.rs builds its unit, percent and currency
patterns at runtime from the same `UNITS` / `CURRENCY` tables and `NUM` / `NLB` / `NOT_MAGNITUDE` sources the TS
interpolates (each `format!` template checked against the TS template by hand: the three `audit_regex` misses are
exactly these). The invisible-character class the TS holds as literal U+200B / U+200C / U+200D / U+FEFF is written as
`\u{…}` escapes in an ordinary string (same code points, as clippy requires); the U+0342 → U+0303 fold keeps both
marks literal, as the TS writes them. The `w` rule reads the first code UNIT of the next character's NFD, as
`normalize("NFD")[0]` does.

**Commands.** As before; `ee-normalize` / `ee-g2p` dumps (no FLEURS: the golden, `probes/ee.txt` (15 synthetic lines)
and 279 synthetic rows: the homoglyph fold incl. U+0342, entities, the five invisibles, grouping in every separator,
4 units × 8 prefixes × 6 suffixes incl. the currency-magnitude refusal, percent ranges and percents, every currency
key, dotted abbreviations, number ranges and their refusals, decimals, ordinal tails, the ampersand); `ee-g2p` over
every letter run × 5 forms, every 1–3 string over 34 letters plus the tilde, acute and grave, precomposed marked
letters and corners, and `numberToWords` over 0…20,000 with and without raw, the 10⁹ edge and non-finite values.

**Raw finding.** `ee: 200/200` on the first build; audits `19 raw patterns, 3 not verbatim` (the three templates),
`6 TS escapes, 0 short`, `42 non-ASCII runs, 0 not found`. Then:
```
ee-normalize: 988 identical, 0 DIFFER   (golden 400 / probe 30 / synthetic 558)
ee-g2p: 99205 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 215 identical, 0 DIFFER each
cargo test --release ewe: 1 passed (68 pins: 28 normalizeEwe, 11 phonemizeWord, 14 numberToWords, 15 createEwe().text;
1 call skipped, an object result; 68 expects, 0 failures)
```
Haystack: `normalizeEwe` changed golden 40/200, probes 9/15, synthetic 186/279 texts. No FLEURS for Ewe, so the
golden and the synthetic rows are the whole corpus side; stated rather than left implicit.

**Guard check.** The number range's "one side has two digits" condition removed, and ⟨r⟩'s post-vowel [r] reduced to
word-initial only: `ee-normalize: 794 identical, 194 DIFFER`, `ee-g2p: 97997 identical, 1208 DIFFER`. Restored:
0 DIFFER both.

**TS findings.** None new. The silent minus (`ame -5 le` → *ame atɔ̃ le*) and the absent decimal word
(`3.14` → *etɔ̃ ɖeka ene*) are both recorded in normalize.ts's header as known.

**Implication.** Commit ee; ak next.
