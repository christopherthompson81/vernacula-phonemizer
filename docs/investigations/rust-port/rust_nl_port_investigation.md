# Rust port: Dutch (`nl`)

Part of #1463. Same method as the de port (rust_de_port_investigation.md): per-module `fn-diff` differentials,
then the public entry end to end, then the golden gate.

## Run 1 — 2026-10-10 20:35 (the import closure, and where the inputs are)

**Question.** What does `src/languages/dutch/` need that the Rust core does not have yet? Does nl have a neural
entry or a Roman policy? Are the golden and FLEURS inputs present?

**Command.** Read dutch.ts, g2p.ts, morphology.ts, normalize.ts, numbers.ts and manifest.ts and their imports;
`grep -n "nl" src/neuralRegistry.ts`; read `ROMAN_POLICIES` / `ROMAN_EXCLUSIONS`; listed `csharp/goldens/nl.tsv`
and the FLEURS root named in dump.mts.

**Raw finding.**
- Every core import is already ported: `latinPhones` (latin_phone), `germanicMorphology` (makeDecompose, from the
  de port), `clauses` (assembleClauses), `normalizeSymbols` (makeSymbolNormalizer, with `rateDenominators` and
  `unitPer`), `initialisms` (makeInitialismNormalizer and makeUnreadableTest), `provenance` (rewrite), `numbers`
  (digitIndex), `dataSource`/`dataPath`. No new core module is needed.
- No nl entry in neuralRegistry.ts, no `ROMAN_POLICIES` entry, and no `ROMAN_EXCLUSIONS` entry, so the
  registry's default arm covers it.
- nl sets two `MorphologyConfig` options de never set: `minTrailingConstituent: 4` and `dontSplitKnownWords: true`.
  It also puts EVERY stressed prefix in `realWordStressedPrefixes` (de lists only `mit`). These branches exist in
  core/germanic_morphology.rs but the de differentials never ran them, so the nl `decompose` differential has
  to cover them.
- `functionWords` is looked up by the lowercased word. TS: `phonemize("constructor", "nl")` returns
  *kˈɔnstrʏktɔr*. core/jsonc.ts strips the prototype when it parses, so no `Object.prototype` read happens.
  An IndexMap in Rust matches that.
- Golden: `csharp/goldens/nl.tsv`, 200 rows, 112 distinct texts.
- **The FLEURS root that dump.mts hardcodes, `/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data`, is
  absent on this machine now.** An unbounded `find` over `/`, `/mnt/data` and the external drive found the
  transcripts at `<external-drive>/omnivoice_ipa/corpus/fleurs_transcripts/data/nl_nl/{train,dev,test}.tsv`.

**Implication.** Port manifest → numbers → g2p → morphology → normalize → dutch, one file each. To reach FLEURS
without changing anything outside this worktree, dump.mts gets a `FLEURS_ROOT` environment override; the
default path stays as it is.

## Run 2 — 2026-10-10 20:40 (the golden gate, first look)

**Command.** `cd rust && cargo run --release -p parity -- nl` (and `--sync nl`), after porting
`languages/dutch/{manifest,numbers,g2p,morphology,normalize,dutch}.rs`, with one arm in `build` and `nl` appended to
`LANGUAGES` (no `roman_policy` arm). normalize.ts's two object-literal tables (`MULTI_DOT`, `DOTTED_ABBREV`) were
generated from the TS source by `.probe/nl/gen_tables.mjs`, which evals the literal text. Nothing was typed by hand.

**Raw finding.** `nl: 200/200 identical, 0 differ` in both modes, on the first build, with no warnings. The golden
has 112 distinct texts.

**Implication.** As with de, a first-try green on 112 texts says little about the compound splitter's nl-only
branches (`dontSplitKnownWords`, `minTrailingConstituent: 4`, all stressed prefixes requiring a real word). The
per-module differentials have to carry that.

## Run 3 — 2026-10-10 20:47 (per-module differentials)

**Commands.** `FLEURS_ROOT=<external-drive>/omnivoice_ipa/corpus/fleurs_transcripts/data npx tsx
rust/tools/fn-diff/dump.mts nl-normalize | nl-g2p | nl-numbers > .probe/nl/<name>.jsonl`, each replayed by
`rust/target/release/fn-diff <name> ../.probe/nl/<name>.jsonl`. Inputs: the nl golden, FLEURS nl_nl columns 3 and 4
(checked: the first FLEURS text is a sentence, not a WAV filename), and `probes/nl.txt` (synthetic: one line per
normalize.ts arm plus the neighbour it must decline, g2p corners, a block of compounds, a lone surrogate, foreign
scripts).
- nl-normalize runs each stage of text()'s chain separately (normalizeDutch, then the initialisms, then the
  Dutch symbol tier, each fed the previous stage's output). The initialism pass and the tier also run on the RAW
  text. `isUnreadableDutch` runs on every letter run.
- nl-g2p feeds `phonemizeWord`, `toSegments`, `decompose` and `isLexicalWord` with every 3rd nl-stems.txt entry,
  every letter run of the texts as written and lowercased, and SYNTHETIC compounds built from the stem list.
  Those are: a+link+b over every linking element, prefix+stem, prefix+non-word (the stem with its first letter
  cut), stem+suffix, stem+3-letter word (the `minTrailingConstituent: 4` floor), a+link+b+c, and
  prefix+a+b+suffix. Up to 3,000 list entries that are themselves a stem·stem concatenation are added (the
  `dontSplitKnownWords` branch), plus each with -en and -heid. Also every 1–2 letter string over 46 Dutch/accented
  letters, three letters over a context set, and edge strings (empty, `'t`, `’t`, `constructor`, lone surrogates,
  İs, ſt, the Ĳ ligature, an astral letter).
- nl-numbers: numberToWords and ordinalWord over 0…20,000; k·10³ (+1, +22), k·10⁶ (+1001) and k·10⁹ (+999,999,999)
  for k < 1000; powers of ten to 10²¹ and their neighbours; 10¹²−1, 10¹², MAX_SAFE_INTEGER (+1), 1e21, 1.5, −1, −0,
  NaN and ±Infinity. Also eight `raw` strings, one with an astral digit.

**Raw finding.**
```
  golden: 560 identical, 0 DIFFER
  fleurs: 17770 identical, 0 DIFFER
  probe: 390 identical, 0 DIFFER
  words: 11042 identical, 0 DIFFER
nl-normalize: 29762 identical, 0 DIFFER
nl-g2p: 502552 identical, 0 DIFFER
nl-numbers: 54126 identical, 0 DIFFER
```
All three were green on the first replay.

**How much of nl-g2p exercised the morphology** (`.probe/nl/cov.mjs` over the decomp rows). Of 125,638 words,
30,956 decompose into more than one morpheme. 14,491 carry a prefix, 10,857 a suffix, 9,904 split into exactly
two stems and 2,710 into three or more.

**Is the replay sensitive to the three nl-only morphology branches?** Each was broken in
`languages/dutch/morphology.rs`, then reverted:
- `dont_split_known_words: false` gives `472235 identical, 30317 DIFFER`.
- `min_trailing_constituent: None` (the default floor of 3) gives `489789 identical, 12763 DIFFER`.
- `real_word_stressed_prefixes: None` (stressed prefixes stripped on the loose onset gate) gives
  `495237 identical, 7315 DIFFER`.
- After reverting: `502552 identical, 0 DIFFER`.

So the core germanic_morphology.rs paths that de never ran are exercised and match the TS. No fork of the module
was needed.

**Per-arm reach of normalize.ts** (`.probe/nl/arms.mts`). This counts the texts whose RAW form matches each arm's
regex, so it under-counts an arm that fires only on an earlier step's output. Counts are golden / fleurs / probe:

| arm | golden | fleurs | probe |
|---|---|---|---|
| US$/AUD$ | 0 | 1 | 2 |
| v./n. Chr. | 0 | 5 | 2 |
| e.d. / o.a. / e.a. | 0 | 2 | 2 |
| d.w.z. / m.a.w. / i.p.v. / a.u.b. | 0 | 0 | 2 |
| dotted caps | 0 | 4 | 2 |
| abbrev continues / ends | 0, 0 | 20, 5 | 6, 2 |
| ordinal (18e, 15de, 60ste) | 0 | 60 | 4 |
| clock `:` / `.` | 1, 1 | 7, 25 | 1, 1 |
| °C/°F, ° compass, ° bare | 0 each | 2, 1, 4 | 3, 1, 5 |
| + | 0 | 4 | 1 |
| ± = < > ÷ | 0 each | 0 each | 1 each |
| X&Y, spaced & | 0, 0 | 2, 4 | 2, 1 |
| fraction | 0 | 2 | 2 |

Six arms are reached ONLY by the probes: the four-letter multi-dot abbreviations, ±, =, <, > and ÷. Every arm is
reached by at least one probe line. The golden reaches only the two clock arms.

**Implication.** The modules match. Next: end to end (sync and best), and the symbol tier.

## Run 4 — 2026-10-10 20:49 (end to end, and the symbol tier)

**Commands.** `LANGS=nl npx tsx rust/tools/fn-diff/dump.mts phonemize-sync` and `phonemize-best`, then
`SYMBOLS_LANGS=nl … symbols`, each with the `FLEURS_ROOT` override, and each replayed by fn-diff.

**Raw finding.**
```
phonemize-sync: 3744 identical, 0 DIFFER
phonemize-best: 3744 identical, 0 DIFFER
symbols: 128 normalizers recorded, 128 distinct; probe 3072, dutch 3666; 6738 identical, 0 DIFFER
```
That includes the synthetic foreign-script probe line (Cyrillic, Han and Greek runs inside Dutch). ru, cmn and el
are all ported now, so unlike the de port there is no port-pending row. nl has no neural entry, so best is the sync
path, and the two dumps agree.

**Implication.** nl meets the parity definition on this machine. Remaining: reading for correctness, then the gates.

## Run 5 — 2026-10-10 20:51 (reading for correctness: TS findings)

**Command.** `npx tsx .probe/nl/findings.mts`, which prints the TS engine's own output on synthetic inputs chosen
while reading each file against its docstring. Rust reproduces every one: they are in probes/nl.txt, or reach the
same code. None is fixed here.

**Raw finding.**
1. **A grouped integer loses its decimal** (dutch.ts TOKEN). This is the defect de has (rust_de Run 5 #1), in the
   same alternation. `3.000,50 euro` reads *drˈidˈœy̯zənt , vˈɛi̯ftəx ˈøːroː*: the grouped branch
   `[1-9]\d{0,2}(?:\.\d{3})+` has no `(?:,\d+)?`, so the decimal comma becomes a clause PAUSE and *50* a new integer
   (*vijftig*). `1.000,5` reads *dˈœy̯zənt , vˈɛi̯f*. The ungrouped `3000,50` reads correctly, *… kˈɔmaː vˈɛi̯f nˈʏl*.
   The handler already splits on `,` after dropping the dots, so only the class is short. Period grouping plus a
   comma decimal is the ordinary Dutch way of writing an amount, and the TOKEN's own comment names both separators.
2. **ì ò ù are base-mapped in g2p.ts but are not vowel letters, so they are read as CONSONANTS.**
   `vowelLetters` is `aeiouyáéíóúàèâêîôûäëïöü`, with no ì, ò or ù. Yet the vowel branch's `base` table lists
   `"íìîï"`, `"óòô"` and `"úùû"`, so those three rows can never be reached. The letter falls to `latinPhone` and
   comes out as a non-syllabic seg: `toSegments("però")` gives *p ɛ* r o* with the o non-vowel, `Niccolò` gives
   *nˈɪkɔlo*, and `lì` gives *li* with no nucleus and no stress mark. This is the class the file's own circumflex
   comment describes ("an omitted one deletes a vowel"). The fix is the manifest string, not the g2p.
3. **The stress shift is a bare orthographic prefix test** (dutch.ts placeStress). `UNSTRESSED_PREFIX` matches any
   word that starts with be/ge/te/ver/ont/her and has a full second nucleus, whatever the morphology says. So
   `tennis` reads *tənˈɪs*, `telling` *təlˈɪŋ* and `hertog` *ɦɛrtˈɔx*: stress lands on the second syllable, and for
   te- the first vowel is also reduced to schwa. `isLexicalWord` sends a dictionary word straight to
   phonemizeChunk, so being in the stem list does not protect it. The splitter's own `ambiguousPrefixes` gate
   (be/ge/te strip only before a real word) never reaches placeStress. That gives two prefix tests with different
   answers on one word (PORTING.md question 3). The docstring says the schwa test "distinguishes a real prefix
   from a ⟨ge⟩-root". It does that for ge-, but not for te-/her- roots with a full second vowel. (`herberg` escapes
   only because its ⟨e⟩ in *berg* reduces.) Corpus impact not measured. Per "measure, don't judge", this is a
   report, not a proposal.
4. **The fraction rule has no decimal-side guard** (normalize.ts step 11, the #1495 family; nl is not in
   test/fraction-guards-1495.test.ts). `1/2,5` normalizes to *een half,5* and reads *ˈeːn ɦˈɑlf , vˈɛi̯f*. `1,5/2`
   normalizes to *1,vijf halve* and reads *ˈeːn , vˈɛi̯f ɦˈɑlvə*. The spaced forms read *… tʋˈeː kˈɔmaː vˈɛi̯f* and
   *… kˈɔmaː vˈɛi̯f tʋˈeː*. de/es/pt/fr/it carry the mirrored guards; nl has the bare `(?<![\d/])…(?![\d/])`.
5. **A dotted two-digit section number reads as a clock** (normalize.ts step 5b). `hoofdstuk 3.12` and
   `paragraaf 2.05` become *drie uur twaalf* and *twee uur vijf*. The comment says `figuur 1.1` fails the rule, and
   it does, but only because its minute has one digit. Low priority.
6. No `Object.prototype` read is reachable. `FUNCTION_WORDS[word]` would be one for `constructor`, but
   core/jsonc.ts strips the prototype at parse, and the TS reads *kˈɔnstrʏktɔr* (probed). LONG/SHORT/CONS get
   one code unit, VOICED_FINAL a seg, CLAUSE_MARK one of its own keys, letterNames one code point, and the
   DOTTED_ABBREV miss is handled (#1122).

**Implication.** These are reported in the PR, not fixed (the bidirectional rule: TS first, in a separate change).
One synthetic probe line carrying #1–#5 is appended to probes/nl.txt, so the dumps pin the reproduced behaviour.

## Run 6 — 2026-10-10 20:56 (tests, and every gate on the final tree)

**Changes.** dutch.rs gains a test module. It holds test/dutch.test.ts's 42 `phonemizeWord` and 40
`d.text(…).trim()` pins, which are all 82 of that file's `toBe` assertions, plus test/rate-denominator.test.ts's
four `phonemize(…, "nl")` pins. They were extracted MECHANICALLY by `.probe/nl/pins.mjs`, which evaluates each
string literal; no reading was typed by hand. The NBSP in two pins is written as `\u{a0}`. To prove the pin test is
a guard, I disabled the ge-/be-/ver-/te- vowel reduction: `the_ts_suite_pins_hold` FAILED. With it restored, the
test passes. Every dump was regenerated on the final tree (with the findings probe line) and replayed. The large
dumps were deleted afterwards.

**Raw finding.**
```
nl-normalize:   29774 identical, 0 DIFFER  (golden 560, fleurs 17770, probe 395, words 11049)
nl-g2p:         502580 identical, 0 DIFFER
nl-numbers:     54126 identical, 0 DIFFER
phonemize-sync: 3745 identical, 0 DIFFER
phonemize-best: 3745 identical, 0 DIFFER
symbols (nl):   6738 identical, 0 DIFFER
regex-diff:     144898 probe results identical, 0 DIFFER, 0 patterns refused
parity:         en en-GB ja it es pt pt-BR hi cmn fr el ko th ru de nl: 200/200 identical each (nl also --sync)
cargo test --workspace (debug and release): 118 + 1 passed
cargo fmt --check clean; release build 0 warnings
cargo clippy --workspace: nothing new except module_inception on dutch/mod.rs (the mirrored-tree rule makes
  `dutch/dutch.rs`, as for every ported language)
```
No TS regex was added or changed, so `csharp/regex-corpus.jsonl` needs no re-extraction.

**Implication.** Done on this machine. No new core module: core/germanic_morphology.rs (de port) covers nl
unchanged, and its three nl-only branches are proven by the Run 3 breaks.

## Run 7 — 2026-10-11 15:05 (#1524 item 3: does any lexical gate on the stress shift pay?)

**Question.** The shift fires on any be/ge/te/ver/ont/her spelling (`tennis` *tənˈɪs*, `telling`, `hertog`). Would
gating it on the morphology, the way the splitter's `ambiguousPrefixes` gate does, fix those without breaking real
prefixes? Measured, not judged.

**Command.** A scratch script (not committed) over every kaikki nl / wikipron nld word whose spelling starts with a
prefixUnstressed member (no space or hyphen): `phonemizeWord` vs the referee, folded backbone through
`tools/referee-eval`'s own `makeFold`, plus the stressed-syllable index (kaikki carries ˈ; wikipron broad does not).
Variants sat behind a temporary env switch in `placeStress`, since removed.

**Raw finding** (kaikki, n = 4,728; stress compared on 4,608):
```
base                                                       seg 2888 (61.08%)  stress 3308 (71.79%)
A  be/ge/te shift only if the remainder is a stem-list word  seg 2398 (50.72%)  stress 2486 (53.95%)
C  all six: remainder is a stem-list word                    seg 2137 (45.20%)  stress 2090 (45.36%)
D  A, or the remainder decomposes to a stem-list head         seg 2540 (53.72%)  stress 2668 (57.90%)
E  shift unless the WHOLE word is lexical and D fails         seg 2608 (55.16%)  stress 2791 (60.57%)
F  the first nucleus's next seg starts inside the prefix      seg 2948 (62.35%)  stress 3353 (72.76%)
G  be/ge/te followed by e/i/u (the e-digraphs) never shift     seg 2941 (62.20%)  stress 3353 (72.76%)
```
A loses hundreds of real prefixes on BOUND roots: beginnen, gebruiken, begrijpen, belofte, geboorte, gedrag,
genoeg — the remainder (`ginnen`, `bruiken`, `lofte`) is not a word, so a word gate cannot see the prefix. The
tennis/tempo/techno/Gerrit gains are real but an order of magnitude fewer. Every lexical gate is net negative.

The diff of base→A also surfaced a different shape, which F and G go after: `beenhouwer` read *bənɦˈɑu̯ər*. The
prefix letters ⟨be⟩ are not a syllable there (the scanner reads ⟨ee⟩ as ONE nucleus), and the schwa reduction
overwrote the whole digraph, deleting a vowel. F does this through the seg starts, but it also catches a degeminated
⟨rr⟩ (`terras` r@3), which is chance, not structure (it loses terras/terrein/terreur and gains Gerrit). G is the
orthographic statement of the scanner's own digraphs (⟨ee⟩/⟨eeuw⟩, ⟨ei⟩, ⟨eu⟩): 57 stress gained / 12 lost, seg
53 gained / **0 lost**. The 12 lost (geestdriftig, beeldschoon, Geertruida, …) are final-stressed words where base
landed on the right syllable by deleting the digraph, so they were segmentally wrong before and stay wrong.

**Implication.** Ship G. Decline the tennis/telling/hertog part: the instrument says a rule cannot separate a
bound-root prefix from a non-prefix root, and these words need a lexicon (the correction lexicon the bring-up
log already defers), not a gate.

## Run 8 — 2026-10-11 15:20 (#1524 items 1, 2, 4, 5: the TS fixes and the item-5 witness)

**Changes.** TOKEN's grouped arm takes `(?:,\d+)?` (de #1514's fix, verbatim); `vowelLetters` gains ì ò ù; the
fraction rule takes the mirrored guards that `it` carries (`(?<![\d/]|\d\.|(?<![\d/])\d+,)…(?![\d/]|\.\d|,\d+(?![\d/]))`).

**Raw finding** (`phonemize`, synthetic probes):
```
3.000,50 euro  == 3000,50 euro   drˈidˈœy̯zənt kˈɔmaː vˈɛi̯f nˈʏl ˈøːroː
1.000, dan     == 1000, dan      (the list comma stays a pause)
però → pˈeːroː   lì → lˈi        (was a non-syllabic o / no nucleus)
1/2,5 == 1 2,5   1,5/2 == 1,5 2   1/2,3/4 == 1/2, 3/4   3/1/2 == 3 1 2
beenhouwer → bˈeːnɦɑu̯ər   beginnen → bəɣˈɪnən   beëdigen → bəˈeːdiɣən   tennis → tənˈɪs (declined)
```
Full referee eval after all four: kaikki 31,151 → 31,205, wikipron 30,831 → 30,884.

Item 5 (`hoofdstuk 3.12` → *drie uur twaalf*): the FLEURS nl transcripts hold 14 dotted `h.mm` tokens, and all 14
are clocks. Three carry no `uur` (`21.19 GMT`, `11.00 lokale`, `tussen 6.30 en`), so requiring `uur` would lose
real clocks, and no instrument here has a single dotted section number to say how one is read (*drie punt
twaalf*? *drie twaalf*?).

**Implication.** Item 5 declined: a fix needs the section-number reading, which nothing here witnesses.

## Run 9 — 2026-10-11 16:10 (ports, tests, and every gate on the tree rebased onto main)

**Changes.** C# and Rust mirror the TS: TOKEN's grouped decimal, DIGRAPH_PREFIX in placeStress, and the mirrored
fraction guards. The ì/ò/ù change is the jsonc alone, which all three engines read. Tests are test/dutch-1524.test.ts,
the nl row in test/fraction-guards-1495.test.ts (and in its C# twin), Dutch1524Tests.cs and
`the_1524_findings_are_fixed` in dutch.rs. They are relational or structural, with no typed IPA. probes/nl.txt
gains one synthetic line for item 3.

**Proof by revert.** I reverted each fix on its own in each engine:
- TS token: 2 tests fail. TS vowels: 4 fail. TS digraph: 5 fail. TS fraction: 4 fail.
- C#: token 2, digraph 5, fraction 4, vowels 4.
- Rust: the 1524 test fails for each of token, digraph, fraction and vowels.

**Raw finding** (after rebasing onto origin/main, which now includes de #1514, uk, th, ru and ko):
```
goldens: nl regenerated, 0 rows moved; check:goldens fresh, 189 languages, 36495 rows, 0 stale
regex-corpus.jsonl: re-extracted, unchanged (the new patterns are already in it from it/de)
npm test 6871 passed | 5 skipped; typecheck clean
dotnet test (full) 7554 passed; C# parity 189 byte-identical; C# regex-diff 145096 identical
cargo fmt clean; cargo test 199 + 1 passed; parity: 50 languages, all identical except mag 199/200 (known, Arabic)
regex-diff 145096 identical, 0 DIFFER, 0 refused
fn-diff (pre-rebase): nl-normalize 29783, nl-g2p 502588, nl-numbers 54126, phonemize-sync/best 3746, symbols 6738 — 0 DIFFER
```

**Implication.** Items 1, 2 and 4 are fixed. Item 3 is half fixed: the e-digraph case ships, and the bound-root
case (tennis/telling/hertog) is declined on the Run 7 measurement. Item 5 is declined on the Run 8 witness.
