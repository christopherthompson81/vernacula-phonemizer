# Rust port: the southern Bantu group (zu, xh, st, tn, nso, sn)

Part of #1463. Method as in rust_cy_port_investigation.md and the Dravidian log: per-module `fn-diff` differentials,
then the public entries end to end (sync, best, trace), then the golden gate. One log for the group, because the six
engines have the same shape (a pre-tokenizer normalizer, the shared symbol tier, a cardinal compositor, a
longest-match grapheme scan) and the Nguni pair shares modules outright.

## Run 1 — 2026-10-15 04:05 (the import closure, baseline)

**Question.** What do the six TS directories need that the Rust core lacks? Is there a neural side? What is shared?

**Command.** Read every module under `src/languages/{zulu,xhosa,sesotho,setswana,sepedi,shona}/` and their imports;
`grep -nE '"(zu|xh|st|tn|nso|sn)"' src/neuralRegistry.ts`; the `ROMAN_POLICIES` table; `ls <FLEURS_ROOT>`; each TS
suite through the recording vitest shim (`sbantu/pins.sh <test> <code>`).

**Raw finding.**
- Core imports across the group: `clauses`, `hostWord` (`LATIN_RUN`, `hostWordRun`, `makeNativiser`), `latinPhones`,
  `loadManifest`, `loadTsv` (zu's tone lexicon, optional, no fold), `normalizeSymbols` (`makeSymbolNormalizer`, and
  `makeBareUnitNormalizer` for nso), `numbers` (`digitIndex`), `provenance` (`rewrite`). All ported.
- No neural entry for any of the six, and none is in `ROMAN_POLICIES`.
- Sharing: xh imports `zulu/g2p.ts` (`toSegments`), `zulu/nguniLoans.ts` (`NGUNI_LOANS`, `deClick`) and the
  `ZuluManifest` type, so those are ported once under `languages/zulu/` and reused. st, tn and nso import nothing
  from each other: each has its own grapheme table, normalizer and compositor (they are similar, not shared), so
  there is nothing to reuse. sn imports nothing from the others.
- Two TS copy-pastes inside the Nguni pair: xhosa.ts repeats `NGUNI_ONSET` / `isNguniPossible` /
  `isForeignNguniWord`, and xhosa/normalize.ts repeats `NGUNI_LETTER_NAME` / `WORD_ACRONYMS` /
  `spellNguniInitialisms`, byte for byte. The Rust collapses each into the zu module and calls it from xh (an
  engineering cleanup the contract allows; the differentials replay both).
- FLEURS: `zu_za`, `xh_za` (train split only, declared in `FLEURS_SPLITS`), `nso_za`, `sn_zw`. Nothing for st or tn,
  so their probes and synthetic rows carry the weight.
- Registry: zu and xh take `readAsEnglish` plus an English-dictionary test,
  `(getPhonemizer("en") as EnglishPhonemizer).knownWord(w) !== undefined` (`en` is ROMAN_NATIVE, so the cached
  object is the engine itself and the cast reaches `knownWord`). Rust: `read_as_english` and
  `english().known_word(w).is_some()`.
- Pins, 0 failures each: zu 157 calls / 163 expects, xh 161 / 173 (1 skipped, an object result), st 66 / 66,
  tn 100 / 101 (1 skipped), nso 87 / 88, sn 90 / 91.
- Symbol-tier arguments recorded through the fn-diff hook (`sbantu/symdata.sh`), one per language.

**Implication.** Port in the order given; zu's g2p, loans and manifest serve xh. Watch the `iu` fold on table
lookups (#1122 shape): zu's `PER[d.toLowerCase()]!` is reached by `\u017f`.

## Run 2 — 2026-10-15 04:30 (zu: first build, escapes, the golden gate)

**Commands.** `audit_regex.py`, `escape_audit.py`, `nonascii_audit.py` over `languages/zulu` against `src/languages/zulu`
straight after writing; `fix_esc.py` (a byte-level rewrite of literal NBSP/NNBSP/thin space back into `\u00a0`
escape text); `cargo build --release -p parity && ./target/release/parity zu`.

**Raw finding.** The editing tool had again written EVERY `\u00a0`, `\u202f` and `\u2009` in normalize.rs's raw regex
strings as the literal character: 48 of them (`escape_audit`: "SHORT U+00A0: TS 45, Rust 1", U+202F and U+2009 2 each).
The one survivor was the `format!` in `expandDotted`, where TS's template literal cooks `\u00a0` into a literal NBSP
and the Rust writes `\u{a0}` (same code point in the pattern). After `fix_esc.py`: 49 raw patterns, 2 not verbatim
(the TOKEN `format!` template and the recorded symbol JSON, both checked by hand), 0 escapes short, 0 non-ASCII runs
missing from the TS. Then `zu: 200/200 identical, 0 differ` on the first build.

The same tool also wrote the dump block's `\u00a0`, `\u212a` (KELVIN SIGN) and `\u017f` escapes as literals. They
were NOT NFC-folded (the Kelvin sign survived as U+212A, checked by code point), and `esc_region.py` restored the
escapes so a later normalizing edit cannot turn the Kelvin probe into a plain K.

**Implication.** Run the three audits after every write; `fix_esc.py` is safe on a file only when every such
character in it belongs in a raw regex.

## Run 3 — 2026-10-15 04:40 (zu: per-module differentials, end to end)

**Commands.** New `dump.mts` entries `zu-normalize` and `zu-g2p`, `FLEURS_DIR` `zu: "zu_za"`, one `fn-diff` arm;
`sbantu/e2e.sh zu zu-normalize zu-g2p phonemize-sync phonemize-best trace`. Inputs: the golden (112 texts), FLEURS
zu_za columns 3 and 4 (2,846 texts; first row checked to be a sentence), `probes/zu.txt` (25 synthetic lines) and
694 synthetic rows (entities, era markers × tails × NBSP, dotted capitals, grouping in every separator, sports times,
a clock grid of 8 hours × 6 minutes × 8 markers, timezone clocks, half-day markers, signs, degrees with and without a
preceding `amazinga`, ranges, rates including `m/\u017f` and `\u212am/h`, square miles, `kma`, decimals, comma decimals,
fractions, math signs, spaced dashes, `njll`/`udkt`, initialisms). `zu-normalize` also replays `isForeignNguniWord`
over every letter run against the real English lexicon; `zu-g2p` replays `phonemizeWord` (lexicon tone, explicit
codes, empty codes), `phonemizeCompound`, `toSegments`, `nat`, `deClick` and the loan table over every letter run,
every tone key (and its Titlecase / `e`+Titlecase compound forms), every 1–3 letter string of 27 letters, every
4-letter string over `aeiounhgcqxtsk`, and corners; `numberToWords` over 0…20,000, magnitudes and non-finite values.

**Raw finding.** First build, every one:
```
zu-normalize: 25754 identical, 0 DIFFER   (golden 336 / fleurs 8538 / probe 75 / synthetic 2082, + 14723 foreign-test rows)
zu-g2p: 640645 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 2983 identical, 0 DIFFER each
```
Haystack: `normalizeZulu` changed golden 15/112, FLEURS 258/2,846, probes 20/25, synthetic 562/694 texts.
`isForeignNguniWord` answered yes for 364 words, so the English route is exercised end to end.

**JS semantics reproduced on purpose.** `UNIT_WORD[…]!` / `PER[…]!` / `COMPASS[…]!` stringify a miss as `undefined`;
the scan walks code units; `split(SPLIT)` is the regex's zero-width match positions; `toneCodes ?? lexicon` keeps an
explicit `""` (no lexicon lookup for a compound part when the whole word has no entry).

**Guard check.** `isForeignNguniWord`'s signal 3 (`!isNguniPossible`) removed, and `PER`'s miss made `""`:
`zu-normalize: 25709 identical, 45 DIFFER` (43 foreign rows, the two `m/\u017f` rows). Restored: 0 DIFFER.

**TS finding (reported, not fixed; the Rust reproduces it).** `ngejubane le-5 m/\u017f manje` → normalized
`… 5 amamitha undefined manje` → *… amamˈiːtʰa und̤ɛfˈiːnɛd̤ …*: the rate rule's class `[hs]` is matched under `iu`,
which admits U+017F LONG S, and `PER[d.toLowerCase()]!` has no row for it (#1122's shape).

**Implication.** zu is done pending the TS-suite pins and the full gates.

## Run 4 — 2026-10-15 04:55 (zu: TS-suite pins, gates)

**Changes.** zulu.rs gains a test module: all 157 calls test/zulu.test.ts makes (94 `normalizeZulu`, 47
`phonemize`, 16 `phonemizeWord`), extracted by `sbantu/pins.mts` and appended by `gen_tests.py` (a byte-level write,
so the IPA's combining marks are the TS output's).

**Raw finding.** `cargo test --release zulu`: 1 passed. `cargo fmt` clean; clippy on the new files: only
`module_inception`. `parity` (all): every line byte-identical but mag 199/200, tt 199/200, syl 195/200 (the known
port-pending rows); `zu: 200/200`. No zu row is port-pending (its foreign runs go to `en`, which is ported).

**Implication.** Commit zu; xh next.
