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
