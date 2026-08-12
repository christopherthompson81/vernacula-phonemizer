# bm (Bambara / Bamanankan) — text-normalization investigation

Worktree `/tmp/vp-norm-bm`, branch `norm/bm`. Method: `docs/normalization_playbook.md`.

## Run 1 — 2026-08-11 (baseline, before any edit)

**Question.** What is the pre-change state of every gate, and what does the engine already have?

**Commands and raw findings.**

`ls src/languages/bambara/` → `bambara.ts`, `bambaraNko.ts`, `manifest.ts`, `numbers.ts`,
`bambara.jsonc`. **No `normalize.ts`.** Test file is `test/bambara.test.ts` (not `test/bm.test.ts` —
the task brief guessed the other name; the committed golden file is `bambara.test.ts`).

`tools/corpus/mined/bm.jsonc` already exists and is TRACKED — 1530 segments, dump-sourced
(`bm.wikipedia.org dump (pages-articles, paragraphs)`), `cellsCovered 28 / cellsTotal 35`.

```
npx tsx tools/normalization/corpus-diff.ts emit --lang bm --corpus mined:bm --out …/bm.before
  → emitted 343 utterances
```

```
npx tsx tools/referee-eval/eval.ts bm
  === bm vs kaikki Bambara (Wiktionary, human, narrow) [primary] (74 words) ===
  raw exact:      2/74 (2.7%)
  folded backbone:64/74 (86.5%)
  symbol accuracy:96.5%
```
(Residuals are all g2p/lexical: `adamaden` final-n, `dingɛ`, `ncɔgɔn`. Nothing normalization touches.)

```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/bm.jsonc --lang bm
  DROP percent       ×27
  DROP math-sign     ×16
  DROP exponent      ×7
  DROP currency      ×4
  DROP ampersand     ×3
  DROP minus         ×1
```
Six DROP classes, 58 instances. That is the defect list to work from.

```
npx tsx tools/normalization/review.ts --lang bm
  [FAIL] normalizer  src/languages/bambara/normalize.ts missing   (1 FAILING)
```

```
npx tsx tools/normalization/sources.ts --lang bm
  [NONE] letter-names     espeak does not ship this language at all
  [NONE] decimal-point    no _dpt, no _., no manifest word
  [  · ] era-phrase       no era marker in the corpus
  [  · ] scale-names      no ° in the corpus
  [chk?] percent-word     % in corpus, no declaration found
  [chk?] currency-word    sign in corpus, no declaration found
  [NONE] fraction-series  fraction occurs, no series to compose from
  [chk?] minus/equals/times/ampersand/exponent-word — sign occurs, no reading found
  espeak: NOT SHIPPED · referee: 76 lines · corpus: 371 lines
```

**Implication.** espeak ships no Bambara at all, so the usual §5c fallback is closed. Every word this
layer emits must come from (a) the corpus itself, (b) `numbers.ts` (already sourced, three citations),
or (c) `attest.ts` against bm.wikipedia. Letter names are structurally blocked → no initialism seam.
Next: tabulate the corpus by hand and probe the engine on the attested forms.

## Run 2 — 2026-08-11 (corpus tabulation and engine probes)

**Question.** What does bm text actually contain, and what does the engine do to it?

**A fresh dump, because the artifact is only 371 excerpted lines.**

```
curl -sSL https://dumps.wikimedia.org/bmwiki/latest/bmwiki-latest-pages-articles.xml.bz2
python3 tools/normalization/wikidump-to-text.py bmwiki.xml.bz2 bm.txt
  → pages seen 2130, paragraphs written 1077 → 2359 lines, 430,646 chars
python3 tools/normalization/filter-markup.py bm.txt   → 2359 -> 2359, dropped 0
```
(The committed artifact records 1530 segments from an older dump; the counts below are the fresh one,
which is what every rule comment cites. The whole bm wiki is 430 KB, so "over the corpus" here really is
over the whole language's wiki.)

**Raw counts over bm.txt (2359 lines).**

```
apostrophe elision  \p{L}['’ʼ]\p{L}  1484   (C'V only: 1218)
digit-hyphen-digit                     76
Nnan ordinal                           50
percent %                              45
decimal comma  \d+,\d{1,2}             42
equals =                               40
space grouping \d{1,3}( \d{3})+        38
decimal dot    \d+.\d{1,2}             38
dotted \p{L}.\p{L}.                    33
dot grouping                           22
km2 / km²                              18
comma grouping                          9
slash n/n                               9
superscript ² ³                         9
km 9 · cm 4 · mm 2 · m 4 (all inside m³) · kg 0 · ha 0 · t 0
ampersand                               6
ISBN                                    5
K.Ɲ.                                    5
currency sign                           4
times ×                                 3
leading minus                           3   (1 sentence)
colon clock                             0
```

**Engine probes on the attested forms — the defect list, measured not assumed.**

```
40%                  → binaani                                   the sign is SILENT (×45)
114.983              → kɛmɛ ni tã ni naani . kɛmɛ …            grouping dot → a SENTENCE BREAK
1,200 million        → kelẽ , kɛmɛ fila milliõ                   grouping comma → a PAUSE, wrong number
241 038 km2          → …kelẽ bisaba ni seeɡĩ km fila            space grouping → 2 numbers, km raw, 2 read
7,62                 → wolõwula , biwɔɔrɔ ni fila                decimal comma → "seven, sixty-two"
1.8 milion           → kelẽ . seeɡĩ miliõ                        decimal dot → a SENTENCE BREAK
619,745 km²          → …ni duuru km                              unit raw as [km], exponent gone
135 000 m³           → kɛmɛ ni bisaba ni duuru fu m              "135 zero" + a bare [m]
$4 / dolar miliyar $4→ naani / dolar milijar naani               the sign is silent
1965-1969            → two cardinals, no connective              (×76 hyphen pairs)
A.R.P. bangera       → a . r . p . bãɡera                        3 spurious clause breaks
304 K.Ɲ.             → kɛmɛ saba ni naani k . ɲ .                2 more, plus an unreadable [kɲ]
k'a / b'a / y'a      → k a  /  b a  /  j a                       a BARE CONSONANT as a word (×1218)
S&P / &              → s p                                       the ampersand is silent
san -100             → sã kɛmɛ                                   the minus is silent
E=mc^2               → e mt͡ʃ                                     `=` and `^2` silent
07:37:40             → wolõwula , bisaba ni wolõwula , binaani   a clock read as commas
```

**Implication.** Eleven classes have a real defect. The two that dominate by count are the elision
apostrophe (1218) and the number separators (69 grouping + 80 decimal). Next: source a word for every
symbol before writing a rule for it.

## Run 3 — 2026-08-11 (sourcing: one word at a time)

**Question.** For every symbol with a defect, is there a Bambara word, and does it fit the slot?

```
npx tsx tools/normalization/attest.ts --lang bm \
    --words kɛmɛsarada,kɛnɛ,kubu,kube,wirigili,pwen,tomi,dolar,wari,fo,dɔgɔya,pilisi
  word          verdict     tok  arts  substr
  kɛmɛsarada    attested      4     4      0
  kɛnɛ          attested     20    19      0
  kubu          absent        0     0      0
  kube          attested      2     2      0
  wirigili      absent        0     0      0
  pwen          absent        0     0      0
  tomi          attested      1     1      0
  dolar         attested      4     4      0
  wari          attested     28    19      0
  fo            attested     53    20      0
  pilisi        absent        0     0      0
```

**Read the examples, not the counts.**

- **PERCENT = `kɛmɛsarada`, POSTPOSED.** The corpus glosses its own symbol, five separate sentences, four
  articles: `40% (binani kɛmɛsara)`, `90% (bikɔnɔtɔn kɛmɛ sarada)`, `40% (biinaani kɛmɛsarada)`,
  `Gambia jamanaden bikɔnɔtɔn kɛmɛsarada 90%`, and once with no sign at all —
  `Masuruyala, binani kɛmɛsarada jamana la ye Sahara cencen ye`. Number always before the word.
  Spellings over the dump: `kɛmɛsarada` ×4, `kɛmɛ sarada` ×3, bare `kɛmɛsara` ×1. Take the plurality.
  This is trap 45's technique with no FLEURS: the wiki spells the symbol out beside itself.
- **SQUARE = `kɛnɛ`, POSTPOSED after the unit noun.** Bare `kɛnɛ` is ×36 whole-word and that count is the
  WRONG measure (trap 37) — the residue is ordinary Bambara `kɛnɛ kan` "in public", `man kɛnɛ` "unwell".
  The COLLOCATION `<metre-noun> kɛnɛ` is ×17, and every instance is a gloss of `km²` in a country
  article: `637,657 km² (bametri kɛnɛ)`, `30355 km2 (bametri kɛnɛ)`, `bamɛtri/Kilomɛtri kɛnɛ 103 000 km2`,
  `Jamana fensen ye bametri kene 916 445`.
- **CUBE — REFUSED.** `kube` is attested ×2 and BOTH hits mean CAPITAL CITY (`Kɔnakry kɛli a faaba (kube)
  ye`, `Jine kube n'a Kubeso lu`). `kubu` ×0. The corpus's one `m³` gloss is raw French (`metre cube
  135 000 m³`). Shipping `kube` would be the Fula-`hakkunde` failure exactly. `m³` stays unread (×2).
- **DECIMAL POINT — REFUSED, no candidate exists.** `wirigili` ×0, `pwen` ×0, `tomi` ×1 and that one is a
  TREE in a list of trees (`mangoro pegun tomi balansan nɛrɛ`). espeak ships no bm. So the fractional
  digits are read one at a time with NO separator word — what `sources.ts` itself prescribes, and the ln
  precedent.
- **RANGE = `fo`.** The bare token count (53) is mostly the VERB `fɔ` "to say" spelled without the accent
  — again trap 37. Digit-flanked `fo` is ×19 and every one is a genuine span: `san ba 2 fo 3`,
  `san 1712 fo ka se san 1861`, `10 fo 15 dɔrɔn %`, `dɔgɔkun 1 fo dɔgɔkun 8`, `1969 … fo 1992`,
  `304 K.Ɲ. fo san 232 K.Ɲ.`. Infix, both operands bare — the slot the rule needs.
- **CURRENCY = `dolar`, PREPOSED.** ×4, all monetary: `dolar wari 1.25`, `dolar wari US$ 1.25`,
  `dolar miliyar $4`, `dolar wari $56065245`. ⚠ ALL FOUR ALREADY NAME THE CURRENCY, so every corpus
  instance is trap 12's redundant position and the rule fires on none of them; it exists so the class is
  READABLE at all (`$5` → *dolar 5*).
- **UNIT NOUN GOES BEFORE THE NUMBER.** 32 unit-word-then-digits against 2 the other way:
  `kilomɛtɛrɛ 10`, `bamɛtɛrɛ 60`, `mɛtɛrɛ 3776`, `milimɛtɛrɛ 7,62`, `bametri kene 916 445`. That is
  playbook §47 reason 2 — the shared tier can only postpose — so units are local.
  Spellings: `kilomɛtɛrɛ` ×22 (the ba- calque `bametri`/`bamɛtri`/`bamɛtrɛ`/`bamɛtɛrɛ` totals ×30 across
  four spellings; `kilomɛtɛrɛ` is the single most frequent form and the one the abbreviation `km`
  transparently matches). `mɛtɛrɛ` ×6, `milimɛtɛrɛ` ×5, `santimɛtɛrɛ` ×2.
- **AMPERSAND = `ani`** (×962, the ordinary conjunction). No sourcing argument needed.
- **ERA `K.Ɲ.`** — the corpus glosses this family of abbreviations itself: `san 800 Krista bange kɔ (KK)`,
  `san 900 KB (Krista Bangelen)`, `san 10000 kakɔn Yesu Krista ka wati (KYW)`, and the unabbreviated
  phrase `Krisita tile ɲɛ` ×3. `K.Ɲ.` = *Krisita ɲɛ*, "before Christ". ⚠ NEGATIVE RESULT KEPT: one of
  the five instances uses it for a CE span (`Wagadu c. 200–1240 K.Ɲ.`), i.e. the source text itself is
  inconsistent. The rule reads the abbreviation, not the century.
- **`=` `×` `−` `:` — REFUSED, with the instances read.** `=` ×40: EasyTimeline markup residue
  (`ImageSize = width:420`, `DateFormat = yyyy`), linguistic glosses (`ba = ma`, `ka ji Bɔn = jibɔn`) and
  `E=mc^2`. Zero digit-flanked arithmetic. `×` ×3: cartridge dimensions (`7,62 × 39 mm`, `7.62 ×33 mm`),
  which is "by", not "times". Leading minus ×3, all in ONE sentence and both BCE years
  (`Julius Caesar (bangera san -100 - ka sa kalo san -44)`) — and omitting a minus INVERTS, so this is
  a KNOWN-WRONG silence, not an accepted one. Colon clock: **×0 in the whole wiki.**

**Implication.** Nine rules are sourced and four classes are refused with evidence. Write the layer.

## Run 4 — 2026-08-11 (the layer, and every gate)

**Question.** Do the twelve rules close the defects without breaking ordinary text?

`src/languages/bambara/normalize.ts`, wired at `bambara.ts:77`
(`assembleClauses(normalizeBambara(input), TOKEN, …)`). Twelve numbered steps: NFC → HTML
entities/zero-width → elision apostrophe → era `K.Ɲ.` then dotted initialisms → ISBN → de-grouping
(comma/dot/space) → units (span arm + magnitude hop, unit-first) → ranges (`fo`) → percent
(`kɛmɛsarada`) → currency (`dolar`) → decimals (digit-by-digit) → ampersand (`ani`).

**Gates.**

```
npx tsc --noEmit                                   clean
npx vitest run                                     234 files, 3413 passed, 5 skipped  (0 failed)
npx tsx tools/referee-eval/eval.ts bm               2/74 raw · 64/74 folded · 96.5% symbol
                                                    — IDENTICAL to Run 1, as it must be: the referee
                                                      is a single-WORD g2p comparison and this layer
                                                      only rewrites non-word input
corpus-diff emit/compare (mined:bm, 343 utterances)
    changed 171/343 (49.9%)
    before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 48, THROW: 0 }
    after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 19, THROW: 0 }
mine.ts scan
    before  DROP percent ×27 · math-sign ×16 · exponent ×7 · currency ×4 · ampersand ×3 · minus ×1
    after   DROP minus ×1
            ACCEPTED-CLASS math-sign ×16 · ACCEPTED currency ×2 · percent ×2 · exponent ×1
            REDUNDANT currency ×2 · percent ×1
review.ts --lang bm    2 FAILING, both the SAME deliberate minus refusal
sources.ts             unchanged (it reads tier declarations; bm declares its words as literals)
python3 tools/language-catalogue/derive-normalization.py → 1 cell differs → build.py → 215 rows
npx vitest run test/languageCatalogue.test.ts          4 passed
```

**Reading the 171 changed utterances** (word-level edit tally, 154 distinct edits). Every one is an
intended rule firing: `k a ⇒ ka` ×36, `n a ⇒ na` ×35, `j a ⇒ ja` ×26, `b a ⇒ ba` ×15 (elision);
`⇒ kɛmɛsarada` ×28; `⇒ waga` ×19 / `⇒ miljɔ̃` ×19 / `⇒ ni` ×16 (de-grouping re-composing the number);
`⇒ fo` ×15; `. ⇒` ×13 and `, ⇒` ×7 (grouping marks that were CLAUSE BREAKS); `fu ⇒` ×7 (a space-grouped
`000` no longer read as "zero"); `km ⇒` ×10 and `⇒ kilomɛtɛrɛ kɛnɛ` ×8; `a . r . p . ⇒ arp` ×3;
`k . ɲ . ⇒ krisita ɲɛ` ×3; `⇒ ani` ×5.

**Every clause-mark count that changed was checked individually** (`.`/`,` per utterance, before vs
after). All 39 reductions are a grouping separator, a dotted-abbreviation dot, or an elision apostrophe.
Spot-read in full: `10,180,000 kare kilometres` was *tã , kɛmɛ ni biseeɡĩ , fu kare kilometres* and is now
*miljɔ̃ tã ni waɡa kɛmɛ ni biseeɡĩ kare kilometres*; `miliyari 1,1 … 1,8` was *milijari kelẽ , kelẽ …*;
`15,3` was *tã ni duuru , saba*. **Zero sentence-final pauses were lost.**

**Two defects the probes did not name, found while reading:**

1. `US$ 1.25` read *usdolar kelẽ fila duuru* — the `US` capture was re-emitted hard against the figure,
   ONE token where the text has two. Trap 18's shape in a replacement instead of a probe.
2. `10%ye` read *tã kɛmɛsaradaje* — the `%` was also a TOKEN BOUNDARY, and consuming it welded the word
   to the following letter. The corpus writes this shape three times (`a 10%ye`, `ni 65% yɛ`,
   `Bambanan (28%)u`). Both fixed by supplying the boundary the sign was providing.

**One rule widened on evidence found mid-run.** The first percent rule required the sign to touch the
figure and left `ka 0,3 dafa %` silent. Counting the shape over the dump: `\d+ \p{L}+ ?%` is ×10 against
35 bare, and all ten were read back — `hakɛ ye 52 ye %`, `ni nɛgɛ hakɛ bɛ se 69 ma %`, `Macron ye se sɔrɔ
ni 66,1 ye %`, `a bɛ 50 Sɔrɔ % jamanadenw na`, `10 fo 15 dɔrɔn %`. The intervening token is always a
copula/postposition or a quantity adverb. 10 true positives, 0 false, gap capped at ONE token.

**What stays red, and why it should.** `review.ts` fails on `minus`: the corpus's only leading minuses are
`san -100` / `san -44`, both BCE years in one sentence, and no Bambara negative-number word is attested
anywhere. Omitting a minus INVERTS, so this is a KNOWN-WRONG silence and it is deliberately NOT in
`ACCEPTED_SILENT` — an accepted silence claims the drop is correct. The gate comes green the day the word
is attested, not before. (`ln` records the identical refusal.)

**`degrees` was closed as an accepted class after measuring it:** `°` occurs exactly TWICE in the whole bm
wiki, both geographic coordinates on one page (`Latitude: 44°27'56″`), and `selsiyu`/`degere`/`digere`/
`Celsius` are all ×0.

**Declined, recorded, not fixed:** `numbers.ts` ships five literals the dump does not attest — `seegin`
(the corpus writes `segin`, and its bare count of 24 is the VERB "to return"), `biseegin`, `bikɔnɔntɔn`
(corpus `bikɔnɔtɔn`), `waga` (corpus `ba`: `ba kelen keme segin`, `san ba 2 fo 3`, `kilomɛtɛrɛ ba 7`) and
`milyɔn` (corpus `miliyɔn` ×27). It is authored DATA with three citations and rewrites every number in the
language, so it needs its own diff and its own sourcing argument — the ln precedent. This layer emits
DIGITS, so nothing in it rests on those spellings.
