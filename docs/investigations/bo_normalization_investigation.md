# bo (Tibetan) normalization — investigation log

Following `docs/normalization_playbook.md`. Branch `norm-bo`.

The artifact `tools/corpus/mined/bo.jsonc` was already mined and committed (89,427 dump paragraphs,
30/35 cells covered, 419 retained segments), so step 0b was done before this run started. Everything
below is measured against that artifact plus `bo.wikipedia.org` through `attest.ts`/`concept.ts`.

---

## Run 1 — 2026-08-14 12:20 — what the artifact contains

`mine.ts scan --in tools/corpus/mined/bo.jsonc --lang bo`, and windowed reads of each cell.

Whole-corpus cell counts that matter: `ranges` 796, `year` 6222, `digit-run` 6366, `decimals` 355,
`clock` 157, `version-dot` 122, `grouped` 98, `percent` 86, `abbrev` 70, `signed-number` 59,
`fractions` 54, `ampersand` 42, `arithmetic` 40, `degrees` 33, `units` 32, `era-marker` 23,
`currency` 8, `exponent` 6, `rate` 2. `latin-in-native` is 5449 and `initialism` 892 — this wiki
carries a great deal of embedded English/German, and the `abbrev`, `dotted`, `era-marker` and
`letter-name` cells turn out to be almost entirely that (`A.D.`, `N. U. Z.`, `K.P.S. Menon`), i.e.
they are cells about the LATIN text inside a Tibetan wiki, not about Tibetan. Recorded so the counts
are not mistaken for Tibetan abbreviation practice.

**The single structural finding: Tibetan PREPOSES the unit/measure noun to its figure.** Every slot
in this corpus writes it that way, without exception:

```
སྤྱི་ལེ་ ༡༣༡ ལྷག          131-odd KILOMETRES        (unit, then figure)
སྨི་ (6,638 m             6,638 METRES
མི་ལི་མེ་ཏྲེར་ ༣༥༠ ནས་ ༤༠༠   350 to 400 MILLIMETRES
བརྒྱ་ཆ་ 95%               95 PERCENT
ཨ་སྒོར་༣༡,༢༠༠             $31,200
ཆུ་ཚོད་ ༣༠༠༠              3000 HOURS
སེ་དྲོད༣༩                 39 °C
སྤྱི་ལེ་གྲུ་བཞི་མ་ ༤༧་༠༠༠    47,000 SQUARE KILOMETRES
```

That rules the shared `core/normalizeSymbols.ts` tier out entirely — it can only postpose
(playbook trap 47, reason 2) — so every rule here is local.

**The range frame is the corpus's own, and it is a circumfix.** `X ནས Y བར` ("from X to Y") is
written with numerals on both sides throughout: `༧℃ནས16℃བར`, `38 ནས་ 50 ℃ བར`, `༢༣ནས་༢༨བར`,
`༡༤༩༨ ནས་ ༡༥༡༨ བར`, `༡༨° ནས ༥༤° བར`, `མི་ལི་མེ་ཏྲེར་ ༣༥༠ ནས་ ༤༠༠ བར`. 35 windows in the retained
text. So the hyphen ranges get rewritten into the shape the language already writes.

---

## Run 2 — 2026-08-14 12:35 — what the engine does with those forms today

`phonemize(form, "bo")` on every attested shape. The defect list is what came out, not what was
assumed:

| input | reading now | defect |
|---|---|---|
| `92,900` | `kʰo˩ɲiː˥ , ku˩kʲa˥` | the grouping comma is a CLAUSE PAUSE and splits one numeral into two |
| `3.4℃` | `sum˥ . ɕi˩ sˈiː` | the decimal point is a SENTENCE BREAK; `℃` folds to `°C`, `°` is dropped and `C` is read as the ENGLISH letter name |
| `༡༦༤༢-༡༧༢༠` | two bare numerals | the hyphen is dropped, no span joiner |
| `43%` | `ɕe˩sum˥` | `%` DROPPED |
| `$110` | `kʲa˩taŋ˥t͡ɕu˥` | `$` DROPPED |
| `111 cm.` | `… , km .` | ⟨cm⟩ reads as ⟨km⟩ — trap 56, a defect that produces a plausible READING |
| `641 mm` | `… , m` | ⟨mm⟩ collapses to one ⟨m⟩ |
| `༡༤༥༧m` | `… ˈɛm` | bare ⟨m⟩ is the English letter name |
| `600km²` | `… ˈʊkm skwˈɛɹd` | the whole area expression is read in English |
| `༤༧༨༠ft` | `… ft` | raw Latin into the IPA |
| `118-149km/h` | `… ˈʊkm ˈeᶦt͡ʃ` | the rate denominator is the English letter H (playbook trap 47's table) |
| `སྤྱི་ལེ་ ༡༣༡ ལྷག` | `… , … , …` | **every SPACE is a clause pause** — `[།༎ ,;:]` in `tibetan.ts`'s TOKEN includes a literal space |
| `རྒྱལ་​དབང་​ལྔ་​པའི་` | one word per syllable | ZWSP after every tsheg breaks the word token, so each syllable is read as word-INITIAL and takes contrastive tone |

The space count is worth stating precisely, because most of it is harmless and the harmful part is
not: 3439 spaces in the retained text, **2582 of them immediately after a shad** (where `།` has
already set the same pending pause, so they cost nothing), 133 between two Tibetan letters, and
**622 adjacent to a digit**. The digit-adjacent ones are pure typographic spacing around a numeral
and every one of them fabricates a pause.

The 133 letter-to-letter ones are NOT all noise and must not be swept up with them: Tibetan omits
the shad after a ⟨ག⟩ suffix and writes a space instead, so `མཚོ་འགག ནུབ་`, `འདུག བོད་`,
`ཡན་ལག དབུས་`, `ཅེག ལྷོ་ནུབ` are genuine clause breaks carried by the space alone. Only the
digit-adjacent space is claimed.

---

## Run 3 — 2026-08-14 12:45 — sourcing every word the layer would emit

`concept.ts` (Wikidata label + the independent second expression, the article TITLE), then
`attest.ts` on bo.wikipedia with the examples READ, then the artifact itself. Cache in
`tools/corpus/attest/bo.jsonc`.

**bo.wikipedia carries an SI-unit stub series that names the ABBREVIATION in its own first
sentence**, which is the strongest sourcing available anywhere in this run — the wiki glosses the
sign, so there is no slot question left to guess at:

```
ལི་སྨིད་(cm)ནི་ཚད་འཇལ་བྱེད་ཀྱི་སྡེ་ཚན་གཅིག་རེད། ༡ལི་སྨིད། = ༡/༡༠༠སྨི།      cm, and m in the same line
སྟོང་ཁེའུ་(མཚོན་རྟགས།: kg)ནི་ཚད་འཇལ་བྱེད་ཀྱི་སྡེ་ཚན་གཅིག་རེད།              kg
སེ་དྲོད་(མཚོན་རྟགས།: °C)ནི་ཚད་འཇལ་བྱེད་ཀྱི་སྡེ་ཚན་གཅིག་རེད།               °C
སྐར་ཆ་(s)ནི་ཚད་འཇལ་བྱེད་ཀྱི་སྡེ་ཚན་གཅིག་རེད།                              s
```

| slot | word | evidence | sense checked |
|---|---|---|---|
| km | སྤྱི་ལེ | artifact ×30, Wikidata label AND bo article title (Q828224) | `ཟི་ལིང་གྲོང་ཁྱེར་ནས་སྤྱི་ལེ་ ༡༣༡ ལྷག` — 131 km from Xining ✓ |
| m | སྨི | artifact ×16/19t, Wikidata + article title (Q11573), and the cm stub's `༡ལི་སྨིད། = ༡/༡༠༠སྨི།` | `མཚོ་ངོས་ནས་སྨི6000m` ✓ |
| cm | ལི་སྨིད | wiki stub names `(cm)`; ×6 articles | `སྦོམ་ཚད་སྨིད་བཞི…ལི་སྨིད་དྲུག་ཅུ` — a pillar's dimensions ✓ |
| mm | མི་ལི་མེ་ཏྲེར | artifact ×1 in slot, wiki ×2 in slot | `ཆར་ཆུའི་འབབ་ཚད་ནི་མི་ལི་མེ་ཏྲེར་ ༣༥༠ ནས་ ༤༠༠` — rainfall 350–400 mm ✓ |
| kg | སྟོང་ཁེའུ | wiki stub names `kg`; Wikidata label (Q11570) | definitional ✓ |
| km² / m² | UNIT + གྲུ་བཞི་མ | artifact ×many (`སྤྱི་ལེ་གྲུ་བཞི་མ`), wiki ×many, and applied productively to other units in the corpus itself (`མི་ལི་མེ་ཏྲེར་གྲུ་བཞི་མ`, `ལེ་དབར་གྲུ་བཞི་མ`) | `རྒྱ་ཁྱོན་སྤྱི་ལེ་གྲུ་བཞི་མ་ ༤༧་༠༠༠` ✓ |
| °C | སེ་དྲོད | wiki stub names `°C`; Wikidata + article title (Q25267) | `ལུས་ཀྱི་དྲོད་ཁམས་འཕེལ་ཏེ་སེ་དྲོད༣༩` — a fever of 39 °C ✓ |
| % | བརྒྱ་ཆ | artifact ×16, wiki ×6 | `ཁ་ཆེའི་ཆོས་ལུགས་(མི་མང་གི་བརྒྱ་ཆ་༥༥)` — 55% Muslim ✓ |
| $ | ཨ་སྒོར | artifact ×7, wiki ×6 | `ཨ་སྒོར་༣༡,༢༠༠` ✓ |
| hour | ཆུ་ཚོད | artifact ×5, wiki ×6, referee word list | `ཆུ་ཚོད་གཅིག … ཆུ་སྲང་དྲུག་ཅུའི་ཚད` — one hour = 60 minutes ✓ |
| minute | སྐར་མ | wiki, referee word list | `པིན་ཆེན་ཆུ་ཚོད་ཀྱིས་སྐར་མ་བཅོ་ལྔ་རེའི་མཚམས་སུ` — Big Ben chimes every 15 minutes ✓ (the other hits are སྐར་མ "star", trap 37) |
| per hour | ཆུ་ཚོད་རེར | artifact | `མྱུར་ཚད་ཆུ་ཚོད་རེར་སྤྱི་ལེ་20རྒྱུག་ཐུབ་པ` — 20 km per hour, denominator phrase FIRST ✓ |
| range | ནས … བར | artifact, 35 windows | see run 1 ✓ |

**Refused, each with the reason:**

- **The decimal point.** Every route is dry. `sources.ts` reports `[NONE] decimal-point`; espeak does
  not ship Tibetan at all; Wikidata Q427968 has no bo label and no bo article, and neither do Q81365
  / Q840057 / Q20154908; `attest.ts` on ten candidate spellings (`གྲངས་ཚག`, `ཚག་རྟགས`, `ཆ་ཚག`,
  `ཚེག་རྟགས`, `བཅུ་ཆ`, `དེ་སི་མཱལ`, …) returns 0 for eight and, for the two that hit, the wrong sense
  — `ཚག` is a monastery name (ར་ཚག་རི་ཁྲོད) and `ཚེག` is the *tsheg punctuation mark* itself
  (`ཚེག་བར་གསུམ་པ`, "three-syllable"). A web search offers `གྲངས་ཆུང` / `ཚེག` on the strength of one
  ACL paper; the PDF could not be read to confirm it and an unverified summary is not a citation.
  **Cost of the refusal, priced as trap 53 requires: 355 corpus decimals keep a fabricated SENTENCE
  BREAK between the integer and the fraction.** That is bad, and it is still the lesser of the two —
  emitting the digits with no separator invents a quantity (`3.4` → "three four"), which is the Igbo
  `790 km2` → "790 kilometres two" failure.
  **The composed candidate is recorded so it is not re-derived:** the ཆ-fraction series IS attested
  as a series (a dictionary entry in the wiki lists `བརྒྱ་ཆ། སྟོང་ཆ། སྟོད་ཆ། སྨད་ཆ།` together), and
  `བརྒྱ་ཆ་༢༠` fixes the position, so `3.4` → `གསུམ་དང་བཅུ་ཆ་བཞི` ("three and four tenths") composes
  from attested pieces in the Fula `e teemedere` manner. It is NOT shipped because that construction
  renders a *fraction*, and nothing attests a reader using it for the decimal NOTATION — the mos
  `koabg pʋgẽ` distinction between a real phrase and the slot it is claimed for.
- **The minus.** No word: `sources.ts` `[chk?] minus-word`, Wikidata's subtraction label is
  འཕྲི་རྩིས, the operation NOUN (trap 35, hi's `धन`/`जोड़`). And nearly nothing to read even if there
  were: of the retained sign instances, `97°54′-101°50′` is a coordinate span, `1.6*10-19` and
  `1.672*10-27Kg` are scientific-notation exponents, `270-350 A.D.` is a year span, `464 -5` /
  `184 – 18` / `220 – 14 – 3` are the column separators of one historic land register, and
  `ཀླད་ཀོར་འོག་གི -25℃` writes "below zero" in words beside the sign, so the sign there is
  REDUNDANT (trap 12). The one arguable true negative is `Ayding Lake (−154m)`.
- **A bare `°`.** ~20 of the 28 degree signs are geographic COORDINATES (`26°50’`, `78°25′`), which
  need a degree/arc-minute/arc-second reading and not a degree word bolted on — the same refusal tl,
  yo and hil record. ཏུའུ (Chinese 度) is attested as a degree word exactly once
  (`དྲོད་ཚད་ཏུའུ ༡-༡༨བར`) against five wiki hits that are all Chinese proper names (ཏུའུ་མུའུ 杜牧,
  ཁྲིན་ཏུའུ Chengdu) — trap 37 with a healthy count. `°C` is read through the definitionally-sourced
  སེ་དྲོད instead; `°F` is ×0 in the corpus and is not declared.
- **The cube.** `གྲུ་གསུམ་མ` is ×0 on the wiki and nothing else surfaced. Following ak rather than ig
  (trap 53): the unit rule REFUSES a key followed by `3`/`³` outright, so `m³` reads exactly as it
  does today instead of becoming a confidently wrong LENGTH.
- **`ft`.** 2 instances, no Tibetan word sourced. It keeps leaking as raw Latin and stays visible to
  the scan.
- **A bare `&`.** All 42 `ampersand`-cell hits in the retained text are HTML entities (`&nbsp;`,
  `&ndash;`, `&#126;`) or sit inside an embedded ENGLISH title (`"flower & Moon"`). The entities are
  folded; a bare `&` is left unread rather than given དང inside an English phrase.

---

## Run 4 — 2026-08-14 12:50 — the range guard, measured

A span joiner has to not claim the land register. Counting every `N[-–—~～]N` pair in the retained
text by direction: **41 ascending, 31 descending, 0 equal**. Every descending pair is either the
land register (`ཁལ་464 -5`, `184 – 18`, `61 – 10`, `2072 – 5`, `120513 – 16`, `49146 – 12`,
`13557 – 6`, `405 – 19`, …, all one document) or an artefact of the mining concatenation, where a
Tibetan-digit run abuts an ASCII one (`༣༥༠270-350`). Every ascending pair is a real span. So the
rule requires the second operand to be GREATER than the first, which is a property of a span and not
a heuristic, and it costs nothing on this corpus.

Two further guards, both from shapes present here: a chain (`220 – 14 – 3`) is rejected on either
neighbour being a dash (Burmese's guard), and a mantissa is rejected on a `*`/`×`/`x` before the left
operand (`1.6*10-19`, `1.672*10-27Kg`, `9.107*10-31Kg` — trap 52's shape, and the reason the operand
is anchored at both edges rather than guarded by a lookbehind alone).

---

## Run 5 — 2026-08-14 13:05 — the corpus diff, and the defect the diff found in my own rule

Baseline emitted BEFORE any edit (playbook's fan-out rule 2), never `git stash`:

```
npx tsx tools/normalization/corpus-diff.ts emit --lang bo --corpus mined:bo --out /tmp/bo.before
# …write normalize.ts…
npx tsx tools/normalization/corpus-diff.ts emit --lang bo --corpus mined:bo --out /tmp/bo.after
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/bo.before --after /tmp/bo.after
```

**changed 134/417 (32.1%), DROP 27 → 23, RAWMARK 1 → 1, every other leak class 0 → 0.**

Reading all 134 (classified token-by-token, then the residue by hand): 442 fabricated pauses removed, 28
spans gaining `ནས` and 24 gaining `བར`, 7 `°C`, 3 percent, 2 currency, 2 km², 2 mm, 1 cm, 1 km/h, plus the
de-groupings and the ZWSP repair. Nothing changed that was not one of those.

**The diff caught a defect in my own rule that no probe would have — playbook trap 3, exactly as advertised.**
The corpus writes the figure hard against the preceding word (`མི་གྲངས་ཀྱི43%`), so preposing a bare
`བརྒྱ་ཆ` produced `…ཀྱིབརྒྱ་ཆ་43`, and tibetan.ts splits a word into syllables **on the tsheg** — so ⟨ཀྱི⟩
and ⟨བ⟩ fused into one stack, ⟨བ⟩ was read as that syllable's SUFFIX, and the word came out *kʲip* instead
of *kʲi*. Four utterances had a word corrupted this way, and in one (index 189) the ⟨བརྒྱ⟩ syllable was
swallowed outright. Every inserted word now opens with a tsheg; a doubled or leading tsheg costs nothing
because `phonemizeWord` filters empty syllables.

Re-run after the fix: 4 utterances changed, all four the corruption, nothing else.

The remaining word-boundary effect is NOT a defect and is recorded so it is not "fixed": a tsheg-joined run
is one WORD to this engine, so an inserted `བརྒྱ་ཆ` is a non-initial syllable and Lhasa's word-tone template
flattens it from *kʲa˩t͡ɕʰa˥* to *kʲa˥t͡ɕʰa˥*. That is precisely what the engine already does to the corpus's
OWN `བརྒྱ་ཆའི་69.36%`, so matching it is faithful rather than lossy.

## Run 6 — 2026-08-14 13:16 — the four gates

- `npx vitest run` — **245 files, 4215 passed, 5 skipped**, after two mechanical updates the change forces:
  `tools/language-catalogue` (bo's `normalization` cell went `None` → `done`; `derive-normalization.py` then
  `build.py`) and `test/accepted-silent.test.ts`'s language roster.
- `npx tsc --noEmit` — clean. `npm run check:package` — clean.
- `npx tsx tools/referee-eval/eval.ts bo` — 40/40 (100%) on the primary JIPA anchor, 819/1281 (63.9%,
  89.6% symbol accuracy) on the kaikki secondary. **Unchanged BY CONSTRUCTION, not merely unchanged in
  observation**: `eval.ts` imports `phonemizeWord` from tibetan.ts, and this layer lives in `text()`. Worth
  stating rather than reporting a flat number as if it were evidence.
- `mine.ts scan` — see run 7.

## Run 7 — 2026-08-14 13:25 — what stays red, and why that is the right answer

```
DROP minus         ×3
SILENT ྋ U+0F8B    ×3
LEAK RAW-LATIN ft  ×2
LEAK RAWMARK       ×1
MARKUP currency    ×1
ACCEPTED-CLASS math-sign ×15   ACCEPTED-CLASS ampersand ×1   ACCEPTED percent ×4
REDUNDANT currency ×4          REDUNDANT percent ×1
```

`review.ts --lang bo` therefore reports **2 FAILING — `sign classes: minus` and the artifact scan** — and
both are deliberate:

- **`minus` is kept OUT of `ACCEPTED_SIGN_SILENCE`** (the gn / ln / rw / sn stance). The retained text has a
  genuine negative, `Ayding Lake (−154m)`; omitting a minus INVERTS where omitting a plus is lossless; and
  what is missing is a WORD, not a guard. A permanently red line that names a real gap is worth more than a
  green one that hides it.
- **`ft` ×2** — no Tibetan foot word sourced, so the raw Latin stays visible.
- **RAWMARK ×1** is a `º` (U+00BA) inside an embedded Latin run and is unchanged from before this layer.
- **SILENT ྋ (U+0F8B)** is a Tibetan mark inert in the g2p — a `tibetan.ts` question, not a normalization one.

The eight classes that ARE exempted (`plus`, `plus-minus`, `equals`, `less-than`, `greater-than`, `times`,
`divide`, `ampersand`) each carry their measurement in `ACCEPTED_SIGN_SILENCE.bo`. The one worth repeating
here is `equals` ×15, the largest remaining drop: every instance is bo.wikipedia's SI-unit stub series
defining one unit in terms of another (`༡སྐར་ཆ། = ༡ ༠༠༠ སྐར་ཆ་ཕྲ་མོ།(ms)`), school algebra, chemistry or a
Devanagari glossary — and the one candidate word fails on part of speech in the corpus's own sentence:
`མཉམ་བྱ` in `X=22ནི་མཉམ་བྱ་x+12=34` is the NOUN "equation" naming the expression, not what a reader says at
the sign. The Fula `hakkunde` failure, with the evidence in the same line that supplies the word.

The four `ACCEPTED percent` instances are in `ACCEPTED_SILENT.bo`, listed WITH the word in the span so a
genuinely dropped percent elsewhere still reports.

**One instrument blindness, recorded rather than worked around.** `review.ts`'s `sourcing` line reports
`[??] no percent/currency/decimal word declared`. That is its honest-unknown branch, not a false green: the
extractor reads `.replace()` calls written with a LITERAL regex, and this layer builds every pattern through
`new RegExp` inside one `prepose()` helper, so no needle is extracted. Restructuring the layer to satisfy the
parser would be the gate causing the edit, which `review.ts`'s own header names as the worst thing a gate can
do. The sourcing argument for all three words is in run 3, in normalize.ts's header, and in the committed
`tools/corpus/attest/bo.jsonc`. (A second, smaller blindness found on the way: the attestation haystack reads
example prose only from findings whose verdict is exactly `attested`, and every finding in an unspaced script
is written `attested*` — so for bo, Khmer, Thai, Han and kana the wiki examples never enter the haystack at
all. Reported here, not fixed, because that file is shared.)

## Run 8 — 2026-08-14 13:30 — what this layer does NOT fix

For the next reader, in descending cost:

1. **The decimal point** — 355 instances, still a fabricated sentence break. Refusal argued in run 3 and in
   normalize.ts's header. This is the one item worth re-opening the moment a Tibetan decimal-separator word
   is attested anywhere; the composed candidate and the reason it was declined are recorded so the question
   can be re-decided rather than re-investigated.
2. **Period- and space-grouped thousands** (`༥༥༣.༩༠༤` ×19, `༡ ༠༠༠ ༠༠༠`) — the same characters this corpus
   uses as a decimal point and a word space, so de-grouping them would MERGE two numerals and invent a
   quantity wherever it guessed wrong. Left alone deliberately, not overlooked.
3. **Geographic coordinates** (`26°50’`, ~20 instances) — degree, arc-minute, arc-second and a hemisphere
   letter, none of them sourced; the `N`/`E` currently reads as an English letter name.
4. **`ft`**, **the minus**, and **the `º` RAWMARK** — see run 7.
5. **The `SILENT ྋ` report** belongs to `tibetan.ts`, not here.
