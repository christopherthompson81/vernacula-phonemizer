# Rust port: German (`de`), and core `germanicMorphology`

Branch `worktree-agent-a721f06ea2016198c`, from main 224339e8. Part of #1463. The method is the earlier ports'
(rust_es_port_investigation.md, rust_fr_port_investigation.md): per-module `fn-diff` differentials, then the public
entry end to end, then the golden gate.

## Run 1 — 2026-10-10 19:51 (the import closure)

**Question.** What does `src/languages/german/` need that the Rust core does not have yet, and does de have a
neural entry?

**Command.** Read german.ts, g2p.ts, morphology.ts, normalize.ts, numbers.ts, manifest.ts and their imports;
compared each against `rust/vernacula-phonemizer/src/core/`; `grep -n -i german src/neuralRegistry.ts`.

**Raw finding.** Every core import is ported (`hostWord` LATIN_RUN/makeNativiser, `clauses` assembleClauses,
`normalizeSymbols` makeSymbolNormalizer, `initialisms` makeInitialismNormalizer/makeUnreadableTest, `loadTsv`,
`loadManifest`, `provenance` rewrite, `numbers` digitIndex) EXCEPT `core/germanicMorphology.ts` (makeDecompose,
176 lines), which morphology.ts is a config over. Its other consumers (nl, af) are unported. neuralRegistry.ts
mentions `de` only inside a comment about ckb's referee scores; there is no de entry, so `Engine::neural` stays
unimplemented. de is not in `ROMAN_POLICIES`, so the registry's default `roman_policy` arm covers it.

**Implication.** Port `core/germanic_morphology.rs` first (new core module), then manifest → numbers → g2p →
morphology → normalize → german, one file each.

## Run 2 — 2026-10-10 19:57 (the golden gate, first look)

**Command.** `cd rust && cargo run --release -p parity -- de` (and `--sync de`), after porting
`core/germanic_morphology.rs` and `languages/german/{manifest,numbers,g2p,morphology,normalize,german}.rs`, with one
arm in `build` and `de` appended to `LANGUAGES` (no `roman_policy` arm: de has no `ROMAN_POLICIES` entry).

**Raw finding.** `de: 200/200 identical, 0 differ`, both modes, on the first build. The golden has 110 distinct
texts.

**Implication.** A green golden on the first try says little about the compound splitter or the five
correction lexicons — 110 texts. The per-module differentials have to carry the weight.

## Run 3 — 2026-10-10 20:01 (per-module differentials)

**Commands.** `npx tsx rust/tools/fn-diff/dump.mts de-normalize | de-g2p | de-numbers > .probe/de/<name>.jsonl`, each
replayed by `cd rust && cargo run --release -p fn-diff -- <name> ../.probe/de/<name>.jsonl`. Inputs: the de golden,
FLEURS de_de columns 3 and 4 (checked: the first line is a corpus sentence of read travel-advice prose, not a WAV
filename) and `probes/de.txt` (synthetic lines: one per normalize.ts arm plus the neighbour it must decline, g2p
corners, compounds, a lone surrogate).
- de-normalize runs every text through each stage of text()'s chain SEPARATELY (normalizeGerman → initialisms →
  German's symbol tier → years, each fed the previous stage's output), plus the year pass on the raw text, plus
  `isUnreadableGerman` on every letter run.
- de-g2p feeds `phonemizeWord`, `toSegments` (ph/s/vowel) and `decompose` (parts·kinds·stressPart) every key of the six
  lexicons (stress, length, quality, consonant, er, lexicon), every letter run of the texts as written and lowercased,
  synthetic compounds built from the lexicon's own `k` constituents (a+link+b over every linking element, prefix+a,
  b+suffix, a+s+b+c, prefix+a+b+suffix), every 1–3 letter string over the German letters, and seven edge strings
  (empty, the internal marker Ɛ, a lone surrogate, ſt, İst).
- de-numbers: 0…20,000, k·10³(+1, +21), k·10⁶(+1001, +999999) for k < 1000, the powers of ten to 10²¹ and their
  neighbours, MAX_SAFE_INTEGER(+1), 1e21, 1.5, −1, −0, NaN, ±Infinity, and seven `raw` strings.

**Raw finding.**
```
  golden: 550 identical, 0 DIFFER
  fleurs: 19070 identical, 0 DIFFER
  probe: 410 identical, 0 DIFFER
  words: 17802 identical, 0 DIFFER
de-normalize: 37832 identical, 0 DIFFER
de-g2p: 300195 identical, 0 DIFFER
de-numbers: 26065 identical, 0 DIFFER
```
All three green on the first replay.

**How much of de-g2p exercised the morphology** (`.probe/de/cov.mjs` over the decomp rows): of 100,065 words, 62,080
decompose into more than one morpheme; 14,634 carry a prefix, 41,195 a suffix, 18,195 split into exactly two stems
and 3,029 into three or more. So the compound splitter, the Fugen links and the per-morpheme composition are
heavily exercised, not incidentally.

**Is the replay sensitive?** Three deliberate breaks, each reverted after:
- the Fugen-s promotion (`links_for` prepends `e` instead of `s` for an `s`-flagged head): `de-g2p: 300169
  identical, 26 DIFFER`. Small because `s` is also the second default link; the promotion only matters where `""`
  would split first.
- `includes("")` in the g2p (`includes_or_empty` → false for a missing letter, i.e. chSound("") = ç and the medial
  hiatus guard): `40 DIFFER`.
- the correction-spec map read FIRST-write-wins instead of JS `Map.set` last-write-wins: **0 DIFFER**. No row in
  length/quality/consonant.tsv repeats an ordinal, so that semantic is unexercised by the data. Kept as JS has it.

**Per-arm coverage of normalize.ts** (`.probe/de/cov/`: a resolve hook swaps provenance.ts for a wrapper that counts,
per pattern, the texts it MATCHED/CHANGED; golden, FLEURS, probe):

| arm | golden | fleurs | probe |
|---|---|---|---|
| v. Chr. / n. Chr. | 0/0, 0/0 | 12/12, 3/3 | 3/3, 2/2 |
| z. B. / d. h. / u. a. / u. Ä. | 0 each | 7/7, 4/4, 1/1, 0/0 | 2/2, 2/2, 1/1, 1/1 |
| N. ordinal | 3/3 | 112/106 | 13/8 |
| bare day before a month | 0/0 | 2/2 | 3/3 |
| dotted abbrev (continues / ends) | 3/3, 0/0 | 48/48, 5/5 | 7/6, 2/2 |
| clock | 1/1 | 29/29 | 4/4 |
| km/h, m/s, °C, °F, ° | 0 each | 18, 2, 4, 2, 2 | 1 each |
| minus, ±, glued +, spaced + | 0 each | 0, 0, 0, 4/4 | 1/1 each |
| = < > ÷ | 0 each | 0 each | 1/1 each |
| fractions | 0/0 | 2/2 | 2/2 |
| decade / year | 0/0, 3/3 | 18/18, 136/136 | 1/1, 4/4 |

Eight arms (u. Ä., minus, ±, glued +, =, <, >, ÷) are reached ONLY by the probes. Every arm is reached by at least
one probe line.

**Implication.** The modules match. Next: end to end, then the symbol tier.

## Run 4 — 2026-10-10 20:04 (end to end, and the symbol tier)

**Commands.** `LANGS=de npx tsx rust/tools/fn-diff/dump.mts phonemize-sync` and `phonemize-best`, replayed by fn-diff;
`SYMBOLS_LANGS=de npx tsx rust/tools/fn-diff/dump.mts symbols`, replayed.

**Raw finding.**
```
phonemize-sync: 4005 identical, 1 DIFFER
phonemize-best: 4005 identical, 1 DIFFER
symbols: 128 normalizers recorded, 128 distinct; probe 3072, german 3924; 6996 identical, 0 DIFFER
```
The one DIFFER row (both modes) is the synthetic foreign-script probe line with a Cyrillic, a Han and a Greek
run: the TS reads the Cyrillic and Greek runs through ru and el, which are not ported, so Rust drops them; the Han
run reads through the ported cmn and matches. PORT-PENDING (ru, el), not a defect. No golden or FLEURS row needs
another engine.

**Implication.** de meets the parity definition on this machine. Remaining: reading for correctness, then gates.

## Run 5 — 2026-10-10 20:06 (reading for correctness: TS findings)

**Command.** `npx tsx .probe/de/findings.mts` — the TS engine's own normalize and phonemize output on synthetic
inputs chosen while reading each file against its docstring. Rust reproduces every one (they are in probes/de.txt
or reach the same code); none is fixed here.

**Raw finding.**
1. **A grouped integer loses its decimal** (german.ts TOKEN). `3.000,50 Euro` reads *dʁaɪ̯tˈaʊ̯zənt , fˈʏnft͡sɪç
   ˈɔʏ̯ʁo* and `1.000,5` *ˈaɪ̯ntaʊ̯zənt , fʏnf*: the grouped alternative `[1-9]\d{0,2}(?:\.\d{3})+` has no `(?:,\d+)?`,
   so the decimal comma becomes a clause PAUSE and the fraction a new integer. The ungrouped `3000,50` reads
   *… kˈɔma fʏnf nʊl*. The text() handler already splits on `,` after dropping the dots, so only the class is short.
   This is the ordinary German way of writing an amount.
2. **z. B. and u. Ä. are case-sensitive while v. Chr. is not** (normalize.ts step 1). The file's own comment makes
   v. Chr. case-insensitive because "lowercased input is real input", but `z. b. das` reads *t͡s . p . das* and
   `u. ä. mehr` *uː . ɛː . meːɐ̯* (letters plus two phrase breaks); `z. B.` reads *zum Beispiel*. d. h. and u. a. are
   lowercase in standard spelling, so only the two with a capital are affected.
3. **`1/1` reads *ein erstel***, not a word (fractions: ordinalStem(1) = erst + -el). Low priority.
4. **`1 Mio.` reads *eins Millionen*** (the abbreviation table maps `mio` to the plural, and the number token reads
   the bare cardinal *eins*). Low priority.
5. **`chSound("")` is the ach-laut** (g2p.ts): `"aou".includes("")` is true, so a non-initial ⟨ch⟩ with no vowel
   letter before it in the morpheme reads x (`lchen` → *l x eː n*). Same `includes("")` family as #1476. Probably
   unreachable from real words, since every stem with a medial ⟨ch⟩ has a vowel before it; latent.
6. No `Object.prototype` read is reachable: LONG/SHORT/CONS/LONG_OF/SHORT_OF get one code unit, VOICED_FINAL a
   segment, IRREGULAR_STEM `String(n)`, DOTTED_ABBREV a fold of its own keys (miss handled), CLAUSE_MARK one of
   its own keys, PREFIX_IPA/SUFFIX_IPA a listed affix.

**Implication.** Reported in the PR, not fixed (the bidirectional rule: TS first, in a separate change).

## Run 6 — 2026-10-10 20:13 (tests, the findings line, every gate)

**Changes.** german.rs gains a test module holding test/german.test.ts's 142 `phonemizeWord` and 58
`phonemize(…, "de")` pins, extracted from that file MECHANICALLY (`.probe/de/pins.mjs`, a regex over the source;
no reading typed by hand), and test/abbrev-word-edge.test.ts's eight de pairs. `de` joins the fraction-guard test in
`languages/mod.rs` (test/fraction-guards-1495.test.ts lists it). probes/de.txt gains one synthetic line carrying the
Run 5 findings, so the dumps pin the reproduced behaviour. rust/README.md's stale status line ("Nothing phonemizes
yet") now names the ported set. Every dump regenerated and replayed on the final tree.

Dead end: the first rebuild after the regeneration failed with `No space left on device` (the shared root
filesystem at 100%, 83 MB free, from concurrent builds). I removed only my own rebuildable `target/release/examples`
and a stale symbols dump; space was then freed elsewhere (19 GB) and the build went through. No result above rests on
a partial build: every number below is from a rerun after it.

**Raw finding.**
```
de-normalize:   37839 identical, 0 DIFFER  (golden 550, fleurs 19070, probe 415, words 17804)
de-g2p:         300198 identical, 0 DIFFER
de-numbers:     26065 identical, 0 DIFFER
phonemize-sync: 4006 identical, 1 DIFFER   (the ru/el port-pending probe line)
phonemize-best: 4006 identical, 1 DIFFER   (the same line)
symbols (de):   6996 identical, 0 DIFFER
regex-diff:     144898 probe results identical, 0 DIFFER, 0 patterns refused
parity:         en en-GB ja it es pt pt-BR hi cmn fr de — 200/200 identical each
cargo test --workspace (debug and release): 104 + 1 passed
cargo fmt --check clean; release build 0 warnings
cargo clippy: nothing in the new files except module_inception on german/mod.rs, which every ported language has
  (the mirrored-tree rule makes `german/german.rs`)
```
No TS regex was added or changed, so `csharp/regex-corpus.jsonl` needs no re-extraction (extract_regexes.mts scans
`src/` only).

**Implication.** Done on this machine. New core module: `core/germanic_morphology.rs` (nl and af reuse it when ported).
