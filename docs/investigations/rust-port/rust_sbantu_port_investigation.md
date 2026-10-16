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

## Run 5 — 2026-10-15 05:20 (xh: the shared modules, first build, differentials)

**What xh reuses.** `zulu::g2p::to_segments` with Xhosa's own rule table (`rules_of(MANIFEST)`, Zulu's plus ⟨rh⟩),
`zulu::nguni_loans`, the `ZuluManifest` type, and the two copy-pasted blocks Run 1 found: `is_foreign_nguni_word`
and `spell_nguni_initialisms` are called from zu's modules. The dump replays xhosa.ts's OWN `isForeignNguniWord`
against the Rust zu one, which is what proves the collapse.

**Dead end, then a type change.** The first read of `xhosa.jsonc` through `ZuluManifest` would have failed: the TS
interface declares `ordinalYe` required, and xhosa.jsonc has no such key (TS never notices, since Xhosa never reads
it). `ordinal_ye` is therefore an `Option` in the shared struct, and `create_zulu` checks it is present for zu.

**Commands.** As Run 2 and 3: the three audits (`fix_esc.py` restored 44 literal NBSP/NNBSP/thin spaces in
normalize.rs; afterwards 40 raw patterns, 1 not verbatim (the TOKEN template), 0 escapes short, 0 non-ASCII runs
missing); `parity xh`; `xh-normalize` / `xh-g2p` dumps with `FLEURS_DIR` `xh: "xh_za"`;
`sbantu/e2e.sh xh xh-normalize xh-g2p phonemize-sync phonemize-best trace`.

**Raw finding.** `xh: 200/200 identical, 0 differ` on the first build, and:
```
xh-normalize: 26543 identical, 0 DIFFER   (golden 285 / fleurs 8781 / probe 57 / synthetic 1593, + foreign-test rows)
xh-g2p: 115132 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 3041 identical, 0 DIFFER each
```
Haystack: `normalizeXhosa` changed golden 16/95, FLEURS 286/2,927, probes 16/19, synthetic 498/531 texts;
`isForeignNguniWord` answered yes for 448 words.

**TS finding (reported, not fixed).** `±` is silently DROPPED in xh: `Ubushushu bu-±5 apha` normalizes unchanged and
reads *… ɓˈuː kʼuɬˈaːnu …* with no sign at all. zu reads it (`plas o mayinas`) and zu's step 8c explains why that
word is not free for xh; but xhosa/normalize.ts's own step 14 says "a dropped sign is INAUDIBLE — the one outcome
that cannot be right", and no step claims `±`. The Rust reproduces the drop.

**TS finding (type only).** `XhosaManifest = ZuluManifest` declares `ordinalYe` required; xhosa.jsonc has none.

## Run 6 — 2026-10-15 05:30 (xh: pins, gates)

**Changes.** xhosa.rs gains a test module: all 161 calls test/xhosa.test.ts makes (89 `normalizeXhosa`, 50
`phonemize`, 11 `createXhosa().text`, 8 `phonemizeWord`, 3 `numberToWords`), extracted as for zu.

**Raw finding.** `cargo test --release xhosa`: 1 passed. fmt clean; clippy on the new files: only `module_inception`.
`parity`: every line byte-identical but the known mag 199, tt 199, syl 195; zu and xh 200/200.

## Run 7 — 2026-10-15 05:50 (st: first build, differentials, pins)

**Shape.** No manifest.ts: sesotho.ts, numbers.ts and normalize.ts each load their own slice of sesotho.jsonc, and
the Rust does the same (`SesothoDef` in sesotho.rs, `SesothoNumbersDef` in numbers.rs; normalize.rs reads `and` from
the numbers slice). The symbol tier is built in normalize.ts and called mid-pass, so it lives in normalize.rs
(`try_symbols`), and `magnitudes` in its JSON is the module's `MAGNITUDES` constant.

**Commands.** The three audits (`fix_esc.py` restored 17 literals; then 22 raw patterns, 1 not verbatim (the TOKEN
template), 0 escapes short, 0 non-ASCII runs missing); `parity st`; `st-normalize` / `st-g2p` dumps (no FLEURS;
the golden, `probes/st.txt` (15 synthetic lines) and 151 synthetic rows: every entity, the ampersand, dotted
capitals × tails, dotted dates, the three grouping separators, the currency-glued `m`/`bn`, the four percent
spellings and the glued `ho12%`, ranges incl. descending, signed and above-2^53 endpoints, ordinal suffixes, the
tier's prefix shapes, the concord repair, decimals); `sbantu/e2e.sh st st-normalize st-g2p phonemize-sync
phonemize-best trace`; the TS suite's 66 calls appended to sesotho.rs.

**Raw finding.** `st: 200/200` on the first build, and:
```
st-normalize: 1098 identical, 0 DIFFER   (golden 600 / probe 45 / synthetic 453; normalize, symbols, text per text)
st-g2p: 58776 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 215 identical, 0 DIFFER each
cargo test --release sesotho: 1 passed (66 pins)
```
Haystack: `normalizeSesotho` changed golden 54/200, probes 13/15, synthetic 125/151 texts. No FLEURS, so the golden's
200 rows and the synthetic rows are the whole corpus side; stated rather than left implicit.

**Guard check.** The range rule's ascending test `<` loosened to `<=`: `st-normalize: 1094 identical, 4 DIFFER`
(the `5-5` rows). Restored: 0 DIFFER.

**TS findings (reported, not fixed; the Rust reproduces each).**
1. A road number reads as money. `Tsela ya R59 le N12 e kgolo` → `… diranta tse 59 le N12 …`: st declares `R` on the
   tier with no guard, while setswana/normalize.ts documents exactly this hazard (`R59, N12, N17 le N3`) and keeps
   `R` off its tier for it.
2. A magnitude suffix with no currency sign is spelled out as letters: `Ho ne ho le 1.5bn` → `… 1 5bn` →
   *… nŋwɛ ɬɑnɔ bn*. Step 5 claims `m`/`bn` only after `[$£€R]`.

## Run 8 — 2026-10-15 06:15 (tn: first build, differentials, pins)

**Shape.** manifest.rs (with `GRAPHEME_KEYS`, a stable length-descending sort), numbers, normalize (two passes,
`normalizeSetswanaPre` and `…Post`) and setswana (the tier between the passes; its `ampersand` is the manifest's
`numbers.and`, so the recorded JSON takes it from the manifest rather than hard-coding it). `numberToWords`'s digit
fallback indexes `units[Number(d)]`, so a miss joins as `""` (Array.join), not as the character: reproduced through
`js_number` on each code point.

**Commands.** The three audits (`fix_esc.py` restored 21 literals; then 18 raw patterns, 1 not verbatim (the TOKEN
template), 0 escapes short, 0 non-ASCII runs missing); `parity tn`; `tn-normalize` / `tn-g2p` dumps (no FLEURS; the
golden, `probes/tn.txt` (12 synthetic lines) and 609 synthetic rows: entities and the ampersand, the currency-glued
`m`/`M`/`bn`, the rand guard (road numbers, separators, magnitude words in both scripts), signed degrees, a clock grid
of 7 hours × 5 minutes × 14 markers incl. timezones and day-parts, grouping, ordinal suffixes, both range rules, the
tier's prefix shapes, decimals incl. the `0.125` arm); `pre`, `symbols`, `post` (on the tier's output and on the raw
text) and `text` per text; `sbantu/e2e.sh tn tn-normalize tn-g2p phonemize-sync phonemize-best trace`; the TS
suite's 100 calls appended to setswana.rs.

**Raw finding.** `tn: 200/200` on the first build, and:
```
tn-normalize: 4105 identical, 0 DIFFER   (golden 1000 / probe 60 / synthetic 3045)
tn-g2p: 56949 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 212 identical, 0 DIFFER each
cargo test --release setswana: 1 passed (100 pins)
```
Haystack: pre + tier + post changed golden 41/200, probes 10/12, synthetic 361/609 texts. No FLEURS (stated).

**Guard check.** The rand guard (a bare small integer after `R` is a road number) disabled:
`tn-normalize: 4091 identical, 14 DIFFER`. Restored: 0 DIFFER.

**TS finding (reported, not fixed).** As in st, a magnitude suffix with no currency sign is spelled as letters:
`Go ne go le 1.5bn` → `… 1 ntlha 5bn` → *… bʊt͡ɬʰanʊ bn*.

## Run 9 — 2026-10-15 06:45 (nso: first build, differentials, pins)

**Shape.** As st (no manifest.ts; sepedi.rs and numbers.rs load their own slices; sepedi.rs follows sesotho.rs line
for line, as the two TS files do). normalize.rs runs the tier FIRST; its JSON takes `TSE`/`AND` from the manifest.
Two of its patterns are `String.raw` templates, whose NBSP stays an ESCAPE (`\u00a0` text) in the pattern, while
the unit pattern is a cooked template whose NBSP / NNBSP / thin space are literal characters; the Rust spells each
the way the TS pattern holds it. `UNIT` keeps the object's order for `makeBareUnitNormalizer` and the alternations.

**Commands.** The three audits (`fix_esc.py` restored 25 literals; then 22 raw patterns, 1 not verbatim (TOKEN),
0 escapes short, 0 non-ASCII runs missing; the two `format!` rand templates checked by hand); `parity nso`;
`nso-normalize` / `nso-g2p` dumps with `FLEURS_DIR` `nso: "nso_za"`; `sbantu/e2e.sh nso nso-normalize nso-g2p
phonemize-sync phonemize-best trace`; the TS suite's 87 calls appended to sepedi.rs.

**Raw finding.** `nso: 200/200` on the first build, and:
```
nso-normalize: 11073 identical, 0 DIFFER   (golden 423 / fleurs 10140 / probe 39 / synthetic 471)
nso-g2p: 65392 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 3534 identical, 0 DIFFER each
cargo test --release sepedi: 1 passed (87 pins)
```
Haystack: `normalizeSepedi` changed golden 15/141, FLEURS 248/3,380, probes 11/13, synthetic 119/157 texts.

**Guard check.** The range rule's digit-count guard (a length difference of 2 or more keeps the pair) loosened to
99: `nso-normalize: 11063 identical, 10 DIFFER`. Restored: 0 DIFFER.

**Clippy note.** `cargo clippy --workspace` stops with one `invisible_characters` error, in
`languages/sylheti/normalize.rs:163` (main's, fixed by a PR landing now). None of this group's files holds a literal
invisible or format character (grep over the six TS directories and the Rust modules).

## Run 10 — 2026-10-15 07:20 (sn: first build, differentials, pins)

**Shape.** manifest.rs (with `GRAPHEME_KEYS`), numbers (magnitude nouns with concorded counts, the digit fallback
from 10^12, `withClass6Concord`), normalize (two passes around the tier) and shona. Differences from tn that the port
keeps: TOKEN is `hostWordRun(["Latin"], "'’")` (both apostrophes inside a word), `phonemizeWord` folds `’` to `'`
after lowercasing, the native class is `[a-z'’]`, and `DEG` is an ordinary TS string, so its NBSP is a literal
character in the cooked pattern.

**Commands.** The three audits (`fix_esc.py` restored 14 literals; then 19 raw patterns, 2 not verbatim (TOKEN and
the recorded JSON), 0 escapes short, 0 non-ASCII runs missing); `parity sn`; `sn-normalize` / `sn-g2p` dumps with
`FLEURS_DIR` `sn: "sn_zw"`; `sbantu/e2e.sh sn sn-normalize sn-g2p phonemize-sync phonemize-best trace`; the TS
suite's 90 calls appended to shona.rs.

**Raw finding.** `sn: 200/200` on the first build, and:
```
sn-normalize: 19800 identical, 0 DIFFER   (golden 650 / fleurs 18380 / probe 65 / synthetic 705)
sn-g2p: 69675 identical, 0 DIFFER   (incl. withClass6Concord over 0…2,000 and corners)
phonemize-sync / phonemize-best / trace: 3819 identical, 0 DIFFER each
cargo test --release shona: 1 passed (90 pins)
```

**Guard check.** The concord pass's ceiling (`n >= 1e6` keeps the digits) raised to 1e18:
`sn-normalize: 19796 identical, 4 DIFFER`. Restored: 0 DIFFER.

**TS findings (reported, not fixed).**
1. The bare-`o` degree arm reads a free-standing `o` after a number as degrees: `Vaive 5 o kure` →
   `Vaive madhigiriyi mashanu kure`. The step's note says the arm "cannot bite into an ordinary word" because it
   demands a space before the letter; a one-letter word after a numeral is exactly the case that guard leaves open.
2. As in st and tn, a magnitude suffix with no word is spelled as letters: `Ne $1.5bn zvakare` →
   `… $1 poyindi 5bn …` → *… ʃanu ɓn …*.

## Run 11 — 2026-10-15 07:50 (merge of main 149e11e3, every gate on the combined tree)

**What changed.** origin/main gained the Dravidian (#1586) and seasia (#1588) groups and #1591 (invisible regex
characters as escapes). Every one of the six commits would have conflicted in the registry, so main was MERGED once
instead. The four routine conflicts (`registry.rs`, `languages/mod.rs`, `dump.mts`, fn-diff `main.rs`) were
resolved by `sbantu/remerge.py`: main's file plus this branch's contiguous additions cut from HEAD. LANGUAGES
went 97 → 103, its declared length matches its entry count, and `dump.mts` parses.

**Commands.** `sbantu/gates.sh` (fmt, build, parity over all languages, regex-diff, clippy incl. errors, test);
`sbantu/e2e.sh zu,xh,st,tn,nso,sn phonemize-sync phonemize-best phonemize-trace trace`; `sbantu/modules.sh`
(every per-module dump re-dumped and replayed).

**Raw finding.**
- fmt clean; build 0 warnings.
- parity: every line byte-identical but mag 199/200, tt 199/200, syl 195/200 (the known port-pending rows); all six
  of this group 200/200.
- regex-diff: `146326 probe results identical, 0 DIFFER, 0 patterns refused`.
- clippy: completes with no `error:` lines now that #1591 is in (Run 9's sylheti error is gone); in the new files only
  the six `module_inception` warnings.
- cargo test: 308 + 1 passed, 0 failed.
- end to end: `phonemize-sync / phonemize-best / phonemize-trace / trace: 13804 identical, 0 DIFFER` each.
- per module: zu 25754 / 640645, xh 26543 / 115132, st 1098 / 58776, tn 4105 / 56949, nso 11073 / 65392,
  sn 19800 / 69675, all 0 DIFFER.

**Port-pending.** None.

**Implication.** Ready for the PR.

## Run 12 — 2026-10-15 21:30 (fixing the #1593 findings, TS-first, mirrored to C# and Rust)

Question: which of the reported xh/st/tn/sn findings are real, and what does each language's own corpus say the
reading should be? All probes are synthetic.

**zu long-ſ** is already fixed fleet-wide by the registry fold of historic letter forms (#1601).

**xh `±`.** Probe on main: `Ubushushu bu-±5 apha` normalized unchanged and read *… ɓˈuː kʼuɬˈaːnu …*, with no
sign. Fixed in step 14 with zu's own reading, `plas o mayinas` (the English loan said whole). zu's step 8c note
("± is not free for xh") concerns composing it from xh's own minus word *thabatha*, the verb "subtract"; the loan
does not do that. Now `bu-±5` reads as `bu- plas o mayinas 5`.

**xh `ordinalYe`.** Type only: `XhosaManifest` is now `Omit<ZuluManifest, "ordinalYe">`. Rust (`Option`) and C#
(empty default) already treated it as optional.

**st road number.** Census of the `R`+digit instances in `tools/corpus/mined/st.jsonc`: `R22.7 milione`, `R22.8m`,
`R23.5 limilione`, `R2.3m` ×2, `R28.9 limilione`, `R30,000,000`, `R3,2 milione` ×2, `R332 milione`, `R470 bilione`,
`R8 million`. Each has a separator, a magnitude word, or (once step 4 has de-grouped it) more than three digits. So
tn's discriminator, "a bare 1–3 digit integer is a road", declines none of them. Implemented as step 8b: the `R` of
a road hides from the tier behind `PUA_SENTINEL` and is restored right after it.
`Tsela ya R59 le N12` now keeps `R59`, while `R30,000,000`, `R8 million`, `R332 milione`, `R2.3m` and
`R3,2 milione` still read *diranta*.

**st/tn/sn bare `bn`.** Scoped to `bn`, which is never a unit; a bare `m` is a metre in all three. Each file's own
currency arm already gave the shape to copy:
- st: `$1.5bn` → *didolara tse dibilione tse 1 5*, and the corpus writes a bare magnitude first, with its concord
  (`limilione tse 88`, `limilione tse 375`). So `1.5bn` → `dibilione tse 1.5`.
- tn: `$1.5bn` → *… 1 ntlha 5 dibilione*. So `1.5bn` → `1.5 dibilione`.
- sn had no magnitude arm at all; even `$1.5bn` read the letters *ɓn*. The corpus pairs a decimal with a singular
  magnitude after it (`6.7 miriyoni`, `25 miriyoni`, `110 miriyoni`), so `1.5bn` → `1.5 bhiriyoni` (the manifest's
  `numbers.billion`), with or without `$`. It now reads byte-identically to the written-out form.

**sn bare `o` degree: DECLINED, on a measurement.** In the sn corpus a free-standing `o` occurs 0 times outside
the degree use. All 28 `<digit> o` instances are degrees, and 6 of them are followed by an ordinary word
(`20 o iri kuMaodzanyemba` ×4, `30 o kana kuti 3` ×2). A guard on what follows the `o` would lose those 6 real
degrees, to protect an input (`5 o kure`) that this corpus never writes.

**Guard proof.** Reverting each language's normalize file alone fails its tests:
- TS: xh 1, st 2, tn 1, sn 1;
- C#: xh 1, st 3, tn 1, sn 1;
- Rust: 1 per language.
The rand-amount tests are controls and pass either way.

`check-goldens`: xh, st, tn, sn and zu are fresh, 0 rows changed. The regex corpus gains 1 pattern (the shared
`bn` arm). Both regex-diffs report 152,970 identical.
