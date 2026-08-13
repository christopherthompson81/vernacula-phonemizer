# hmn (Hmong / White Hmong, RPA) — text normalization

Giving `hmn` the normalization treatment per `docs/normalization_playbook.md`.

⚠ `hmn` is a **macrolanguage**. Everything below is about **White Hmong / Hmoob Dawb (Hmong Daw, `mww`)**,
which is the variety `src/languages/hmong/` targets and the variety the only available corpus is written in.
Green Hmong / Mong Njua (`hnj`) is a different variety with different sibilants and laterals; no source below
is about it, and none is labelled as if it were.

---

## Run 1 — 2026-08-12 19:20 — which SCRIPT, and is there any corpus at all?

**Question.** Hmong is written in three scripts — the Romanized Popular Alphabet (RPA), Pahawh Hmong
(U+16B00–16B8F) and Nyiakeng Puachue (U+1E100–1E14F). Which does the engine accept, and which does a real
corpus contain? (The `cdo` run found a "Sinitic" language not written in Han at all, which reversed three of
its design decisions.)

**Commands.**

```
grep -rn "hmn" src/registry.ts
# engine: src/languages/hmong/hmong.ts  — NATIVE_CLASS = "[a-zA-Z]", manifest "script": ["Latin"]
curl .../hmn.wikipedia.org/w/api.php?...siteinfo      # empty
curl .../mww.wikipedia.org  ·  .../hnj.wikipedia.org  # empty
curl .../incubator.wikimedia.org/...&srsearch=prefix:Wp/mww   # totalhits 101
curl .../incubator.wikimedia.org/...&srsearch=prefix:Wp/hnj   # totalhits 0
curl .../incubator.wikimedia.org/...&srsearch=prefix:Wp/hmn   # totalhits 1
```

**Raw finding.**

- **The front end is RPA only.** `hmong.ts`'s token class is `LATIN_RUN`, its nativiser class is `[a-zA-Z]`,
  and the manifest declares `"script": ["Latin"]`. Neither Pahawh nor Nyiakeng Puachue is accepted; a run in
  either is routed away by `core/scripts.ts` and never reaches these rules.
- **There is no Hmong Wikipedia at any code.** `hmn`, `mww` and `hnj` all fail to resolve. `Wp/hnj` does not
  exist on Incubator either. `Wp/hmn` is ONE page, and it is a note in ENGLISH saying that `hmn` is a
  macrolanguage — it is not a corpus, it is a disambiguation.
- **The whole of the Hmong corpus that exists is Wikimedia Incubator `Wp/mww`** — 112 article pages, i.e.
  White Hmong specifically. That is the corpus, and it is also its own ceiling: there is nothing further to
  fetch, so an empty cell here is a query that HAS been run (the cjy situation, playbook §0b).

**Implication.** Design for RPA and nothing else, and say so. And expect a thin corpus, so every rule has to
carry its own sourcing argument rather than leaning on counts.

---

## Run 2 — 2026-08-12 19:35 — building the artifact, and the contamination check that came back NEGATIVE

**Commands.**

```
python3 <fetch script>  Wp/mww  ->  mww.xml            # 112 titles, MediaWiki export XML
python3 tools/normalization/wikidump-to-text.py mww.xml.bz2 mww_paras.txt --title-prefix "Wp/mww/"
python3 tools/normalization/filter-by-language.py --lang hmn --in mww_paras.txt --out mww_paras.hmn.txt
npx tsx tools/normalization/mine.ts mine --in mww_paras.hmn.txt --out tools/corpus/mined/hmn.jsonc …
```

**Raw finding — the script census over the extracted prose (76,348 chars).**

```
Pahawh (U+16B00–16B8F)          3 characters
Nyiakeng Puachue (U+1E100–1E14F) 3 characters
Han                            31 characters
ASCII letters              58,050
```

Six characters. All of them are inside the *Hmong language* article, which lists the scripts. **The corpus is
RPA, empirically, not just by the engine's declaration.** Run 1's design decision is confirmed by measurement.

**Raw finding — the language filter.**

```
kept                  190  (65.1%)
short                  96  (32.9%)
dropped: undecidable    6  (2.1%)
dropped: contrast       0
```

⚠ **ZERO paragraphs are English-dominant.** The prompt's expectation (bal 37.4% Persian/Urdu, bar 24% German,
ht 15.1% French, su 12.9% English) does **not** reproduce here, and that is worth recording as a negative:
Wp/mww is translated FROM English rather than padded WITH English, so the contamination is at the WORD level
(untranslated proper nouns and the odd English adjective — `occupying`, `romantic comedy`, `superseded`) and
never at the paragraph level. A paragraph filter is the wrong instrument for that, and no paragraph filter
would have found it.

The filter row for `hmn` was added anyway, because the measurement is only re-runnable if the filter exists,
and because the 96 short lines it drops are headings and list fragments that would otherwise pad the sample
tier.

**Artifact.** `covered 24/36 cells`, 73 hard + 40 sample. `EMPTY: fractions clock ordinal-native rate
ordinal-range ampersand iteration calendar sports-time version-dot ordinal-caps native-terminator`.

**Implication.** The corpus is honest but tiny (190 paragraphs, ~14,700 tokens). Rules must be sourced
word-by-word, and the corpus diff cannot carry its usual weight.

---

## Run 3 — 2026-08-12 19:50 — the defect list, probed rather than assumed

**Command.** `phonemize(form, "hmn")` over every shape the corpus attests.

**Raw finding — what the engine did BEFORE this layer.**

```
Pejxeem - 146.270.033 neeg.   → …ʔi˥ puə̯˩ pˡau̯˥ cau̯˧˩̤ ʈau̯˧ .  ʔɒ˥ puə̯˩ ça˧ cau̯˩̰ .  pe˥…   THREE numbers, two SENTENCE BREAKS
23,822,747                    → nẽ˩ ᵑɡau̯˩̰ pe˥ , ʝi˩̰ puə̯˩ …               three numbers, two comma PAUSES
8,46 lab                      → ʝi˩̰ , pˡau̯˥ cau̯˧˩̤ ʈau̯˧ la˥              a pause inside one quantity
2.9 lab                       → ʔɒ˥ . cuə̯˥˧ la˥                            a FULL STOP inside one quantity
60%.                          → ʈau̯˧ cau̯˩̰ .                               the % SILENT
5-10%                         → t͡ʂi˥ kau̯˩̰                                 two bare cardinals, hyphen and % gone
$10 lab                       → kau̯˩̰ la˥                                   the $ SILENT
US $ 46,330                   → ʔu˩ pˡau̯˥ …                                 `US` read as the Hmong syllable *us*
6 mus rau -50 ° C             → ʈau̯˧ mu˩ ʈau̯˧ t͡ʂi˥ cau̯˧˩̤ C              sign silent, ° silent, `C` RAW IN THE IPA
145 km                        → …t͡ʂi˥ km                                   `km` RAW IN THE IPA
357.021 km2                   → pe˥ puə̯˩ … . nẽ˩ ᵑɡau̯˩̰ ʔi˥ km ʔɒ˥        `km` raw AND the `2` read as the NUMBER *ob*
187 km²                       → …km                                         `km` raw, `²` dropped
1438-1806                     → two bare cardinals, no connective
21st / 19th / 13th            → … st  ·  … th                               the suffix RAW
GDP · OECD · WTO · UN         → GDP · OECD · WTO · UN                       RAW, ×54
II                            → ʔɒ˥                                         ✓ roman already digits upstream
```

**⚠ THE TONE-LETTER HAZARD, MEASURED RATHER THAN ASSERTED — AND IT IS ALREADY LIVE IN THE ENGINE.**
`syllableToIpa("km")` strips the final `m` **as a tone letter** (creaky low), leaves onset `k` with an EMPTY
rime, fails the rime lookup and returns the string raw. So the engine does not merely fail to read `km`; it
parses the unit's second letter as a TONE and then gives up. The same happens to `th` in `19th` (onset `th`,
empty rime) and to `st` in `21st`. In RPA every word ends in a letter that some rule may claim, and here the
CONVERTER itself is the rule that claims it.

**Implication for rule design, stated once and applied throughout.**

- **No one-letter unit key, at all.** Traps 28/46 say a one-letter key is unsafe even on a clean corpus; in
  RPA the exposure is worse, because the letter it would claim is a tone. Measured over this corpus:
  digit-adjacent one-letter tokens are `n` ×1 (the `802.11n`-shaped `N. M.` coordinate) and nothing else, so
  a one-letter key would buy **zero** readings and cost the whole class. Declared: none.
- **No suffix rule on digits (traps 14/15).** Hmong is isolating and writes no bound case suffix; the
  corpus's only digit-plus-short-token shapes are `21st`/`19th`/`13th`, which are ENGLISH ordinals left in
  the translation, not Hmong morphology.
- **Every rule that touches a letter must carry `(?<![\p{L}\p{M}])` AND `(?![\p{L}\p{M}])`**, because
  trimming one letter off an RPA word changes its TONE, i.e. produces a different word rather than a
  malformed one.

---

## Run 4 — 2026-08-12 20:05 — sourcing, and the sentence that settled the currency

**Commands.** `sources.ts --lang hmn`, `corpus-words.ts --lang hmn --words …`, plus web search.
⚠ **`attest.ts` CANNOT BE RUN FOR THIS LANGUAGE.** It probes `<lang>.wikipedia.org`, and Run 1 established
that no Hmong Wikipedia exists at any code. There is no weaker wiki tier to fall back on either: the whole of
Wp/mww is already IN the corpus this layer was measured on, so a probe against it would be the corpus
answering itself — a self-fulfilling haystack, which the playbook ranks below no haystack.

```
[NONE] letter-names     espeak does not ship this language at all
[NONE] decimal-point    no _dpt, no _., no manifest word
[NONE] scale-names      ° occurs, neither scale name anywhere
```

**Raw finding — what IS sourced.**

| slot | word | evidence |
|---|---|---|
| percent | **`feem pua`** | corpus ×3, all three in the slot after a spelled-out number: `ntau tshaj rau feem pua` (more than six percent), `cuaj caum-xya feem pua` (ninety-seven percent), `peb caug xya feem pua` (thirty-seven percent). Independently in the Minnesota Dept. of Education *English–Hmong Dictionary of Special Education*. Literally "part of a hundred". POSTPOSED, which all three attestations fix. |
| currency `$` | **`duas`** | ⚠ the corpus DEFINES it: *"Lub cim rau **duas** yog ib daim ntawv loj S, pierced los ntawm ib los yog ob txoj kab ntsug: **$**."* — "the symbol for the dollar is a large letter S, pierced by one or two vertical lines: $". A sentence that names the sign and the word together is stronger evidence than any count. `Ib duas yog ib hom txiaj` ("a dollar is a kind of currency") fixes the position: number BEFORE the noun. |
| range connective | **`mus rau`** | the corpus's own, written BETWEEN two numerals: `6 mus rau -50 ° C`, `Lub Xya hli ntuj 1 mus rau 25 ° C`, `5% mus rau 6%`. ×29 in the artifact overall. |

**Raw finding — what is NOT sourced, each with the check that refused it.**

- **No kilometre word.** `km` ×10 in the corpus and it is written as the SYMBOL every time. `kilaumitas`,
  `kilumitas`, `kislumitas`, `kilomitas` ×0 everywhere; the *English–Hmong Daw phrasebook* has no measurement
  entry; espeak ships no Hmong. What the corpus DOES attest is `mais` ×3 = MILE (`242,500 square mais`,
  `peb caug mais ib teev` — thirty miles an hour), which is a different unit and cannot stand in for one.
- **No degree or scale word.** ° ×6. `sources.ts` reports `scale-names [NONE]`, and nothing follows `°` in
  this corpus but the bare letter `C` or `N`.
- **No minus/plus word.** Three signed numbers, all temperatures (`-50 ° C`, `-71,2 ° C`, `+45,4 ° C`).
- **No equals word.** `npaug` ×2 and both are *sib npaug* = "balance/equilibrium" (the vestibular system),
  not arithmetic equality. Trap 37: the bare token is a lead and the sense is the finding.
- **Initialisms are structurally blocked**, not deferred by taste: `core/initialisms.ts` exists and ~30
  languages wire it, but it is a NO-OP without a `letterName` table and espeak ships no Hmong
  (trap 16 checked — the seam exists, the DATA does not). `GDP` → `GDP` raw, ×54, stands.

---

## Run 5 — 2026-08-12 20:20 — the separator question, which is the largest defect and nearly went wrong

**Question.** Which of `,` and `.` is this corpus's decimal mark, and which is its grouping mark?

**Command.** counts over the 190 Hmong paragraphs.

**Raw finding — IT IS BOTH, IN THE SAME CORPUS.**

```
comma + exactly 3 digits (grouping)  11   23,822,747 · 46,330 · 10,000,000 · 260,000 · 242,500 · 3,466 …
comma + 1–2 digits      (decimal)     8   8,46 lab · 63,8 lab · 81,9 lab · 90,5 lab · 9,85 lab km2
                                          +45,4 ° C · -71,2 ° C · 116,6 ° C
dot + exactly 3 digits  (grouping)    3   146.270.033 neeg · 17.125.187 km² · 357.021 km2
dot + 1–2 digits        (decimal)     6   2.9 lab · 2.7 vam · 66.0 lab · 10.3 lab · 2.5 roob · 2.2 (pH)
```

⚠ The split is not random and it is not noise: the **European** convention (dot-grouping, comma-decimal) is
confined to the articles translated from Russian and German — Russia's `146.270.033` population and
`17.125.187 km²` area, Germany's `357.021 km2`, Austria's `8,46 lab`, France's `63,8`/`81,9` — while the
**Anglo** convention (comma-grouping, dot-decimal) is in the articles translated from English. Both are
verifiable against the outside world: 17,125,187 km² and 357,021 km² are Russia's and Germany's real areas,
and 146,270,033 is Russia's 2015 population. So the tail LENGTH is a sound discriminator and the mark is not.

**Implication.** The de-grouping rule must key on `separator + exactly three digits`, for BOTH marks, and the
decimal rule must key on `separator + one or two digits`, for both marks. A rule that assigns one mark to one
job — which is what every other language in this tree does — would be wrong for a third of this corpus in
whichever direction it was written. This is the one place the evidence changed the rule's SHAPE rather than
its counts.

---

## Run 6 — 2026-08-12 20:40 — writing the rules; before/after on every gate

Baselines emitted BEFORE any edit (playbook §"working concurrently", rule 2):

```
npx tsx tools/normalization/corpus-diff.ts emit --lang hmn --corpus mined:hmn --out …/hmn.before
  → emitted 92 utterances
npx tsx tools/referee-eval/eval.ts hmn
  → raw exact 455/455 (100.0%) · folded backbone 455/455 · symbol accuracy 100.0%
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/hmn.jsonc --lang hmn
  → DROP percent ×7 · DROP degree ×4 · DROP currency ×4 · DROP math-sign ×3 · DROP minus ×2 · DROP exponent ×2
```

(Results after the layer landed are appended in Run 7.)

---

## Run 7 — 2026-08-12 21:15 — the gates, before and after

| gate | before | after |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 3,806 passing | 3,806 + 12 new hmn tests passing; `onnx-optional` times out at 5s under load and passes alone (4.5 s) — discounted |
| `referee-eval.ts hmn` | raw exact **455/455 (100.0%)**, folded backbone 455/455, symbol accuracy 100.0% | **identical, 455/455** — no regression. Expected: the referee is single-syllable RPA and contains no digits or symbols, so this layer cannot touch it. Worth running anyway, because a rule that bit a tone letter off an RPA word WOULD show here. |
| `corpus-diff` DROP | 14 | **5** |
| `corpus-diff` utterances changed | — | **32 / 92 (34.8%)** |
| `mine.ts scan` | DROP percent ×7 · degree ×4 · currency ×4 · math-sign ×3 · minus ×2 · exponent ×2 | DROP **minus ×2 · exponent ×2** (deliberate) · ACCEPTED-CLASS math-sign ×3 · ACCEPTED-CLASS degree ×2 · **REDUNDANT** currency ×1 |
| `review.ts --lang hmn` | `[FAIL] normalizer missing` | 9 ok, **2 FAIL — `sign classes: DROPPED minus exponent` and the matching artifact-scan line**; both are genuine sourced refusals and stay RED (trap 24). `sourcing: all 3 high-traffic words attested`. |
| `sources.ts --lang hmn` | letter-names NONE · decimal-point NONE · scale-names NONE · percent/currency/minus/equals/exponent `chk?` | unchanged data; `review.ts` now answers the four `chk?` lines — percent and currency READ, minus and exponent refused |
| `derive-normalization.py` + `build.py` | `1 cell(s) differ` | `0 cell(s) differ`; `test/languageCatalogue.test.ts` passes |

**The currency line moved from `DROP` to `REDUNDANT`, and that is the right answer rather than a lucky one.**
The instance is the definitional sentence — `Lub cim rau duas yog … : $.` — which names the word AND the sign,
so the correct reading says it once. Playbook trap 12 exactly, arrived at by the gate independently.

**Read the sampled changes, not just the counts.** All 32 were read. Every one is one of: a grouped number
becoming ONE number instead of three separated by sentence breaks or comma pauses; a decimal losing its
spurious full stop; `%` gaining `feem pua`; `$` gaining `duas`; `US` ceasing to be read as the Hmong syllable
*us*; a year span gaining `mus rau`; the scale letter `C` leaving the IPA. The sharpest one:

```
9,85 lab km2   before  … la˥ km ʔɒ˥ tʰiə̯˥ …      the `2` of km2 read as the CARDINAL *ob*
               after   … la˥ km      tʰiə̯˥ …
```

**Two failures found by the gates rather than by reading, both recorded because both are lessons.**

1. **The roman-numeral test called `engine.text()` and reported a working seam as broken.** `core/roman.ts`
   is applied in `registry.ts` WRAPPING `text()`, so a test that calls the engine directly never sees the
   conversion. Re-asserted through `phonemize` and it passes: `II` → *ʔɒ˥* (`ob`). This is trap 16's
   "verify it end-to-end, not in the layer" reproducing itself inside one session.
2. **`test/hmong.test.ts` already existed** — the golden file is named after the LANGUAGE, not the code — so
   the new block was appended, never written over.

**What is NOT in `test/accepted-silent.test.ts`'s pinned list, and why.** That list pins
`ACCEPTED_SILENT` — the per-INSTANCE span table. hmn needs no span entry: its two accepted classes
(`degrees`, and the `plus`/`equals` behind the coarse `math-sign`) are accepted at CLASS level through
`ACCEPTED_SIGN_SILENCE`, and `acceptedSignClass` resolves all five instances, which the scan confirms
(`ACCEPTED-CLASS math-sign ×3`, `ACCEPTED-CLASS degree ×2`). Adding `hmn` to the pinned list with no entry
behind it would fail that test's `toEqual`, and would be exactly the "entry that can no longer fire" the file
warns against.

---

## Run 8 — 2026-08-12 21:30 — the negative results, kept

Four things that did NOT work, recorded so nobody repeats them:

- **`attest.ts` is unusable for hmn.** No wiki exists to probe, and the only one that does (Incubator
  Wp/mww) is already the corpus, so probing it would be the corpus answering itself.
- **The kilometre word was found and then declined.** `attest.ts --after`-style slot searching (trap 40) on
  the corpus produced `kis lus mev` in `…rau Papua - Tshiab Guinea - tsuas yog 5 kis lus mev`, and the figure
  checks out (Boigu Island to PNG really is ~5 km). It is still one hit in one article in a
  machine-translated wiki, and its two-word tail `lus Mev` is attested TWICE IN THE SAME CORPUS meaning
  **Spanish** (`Mev (español) yog ib hom lus Romance`, `cov lus Mev Netherlands`). No dictionary, phrasebook
  or web search corroborates it. So `km` still reaches the IPA raw ×10 — ⚠ and **no leak class can see that**,
  because a Latin-letter residue in a Latin-script language looks exactly like a word (trap 6). It took a hand
  probe.
- **The spaced hyphen was measured and then left alone.** ×53, and most are apposition dashes that a pause
  would suit — but `Papua - Tshiab Guinea` is ONE NAME with a spaced hyphen inside it, and one clause uses
  both senses. A guard alternative with a live counter-example is a misfire generator (trap 9).
- **`npaug` looked like the equals word and is not.** ×2, both *sib npaug* = "balance/equilibrium", in a
  sentence about the vestibular system. Trap 37's shape: a real word, healthy count, wrong sense.

And one that is worth stating positively: **the corpus's own definitional sentence for `$` is better evidence
than anything `attest.ts` could have returned**, because it names the sign and the word together. A wiki that
is too small to have a search index can still contain the one sentence that settles a rule.

---

## Run 9 — 2026-08-12 21:20 (the kilometre word: Run 8's refusal, revisited and OVERTURNED)

**Question.** Run 8 recorded `kis lus mev` as found-and-declined. The refusal was correct on the evidence it
had. Is there evidence it did not have?

**What Run 8 saw, restated so the reversal can be judged.** `km` ×10 after a digit / ×13 as a token, written
as the symbol every time and reaching the IPA RAW. Slot-searching the corpus (trap 40) produced exactly one
candidate — `…rau Papua - Tshiab Guinea - tsuas yog 5 kis lus mev`, Boigu Island to PNG, which really is
~5 km. Declined on three grounds: one hit in one article of a machine-translated wiki; no outside
corroboration; and, decisively, its two-word TAIL is attested twice in the same corpus meaning **Spanish**
(`Mev (español) yog ib hom lus Romance`, `cov lus Mev Netherlands`, `Mev` ×4 = Spain/Spanish throughout).

### ⚠ The decomposition was a COINCIDENCE, and that is the transferable lesson

`kis lus mev` is not `kis` + `lus mev`. It is a **three-syllable RPA rendering of *kilomèt*** (French, via
Lao ກິໂລແມັດ), spelled the way RPA spells any foreign polysyllable — one syllable at a time, each with a
legal onset, rime and tone letter: *ki · lo · me*. Read as morphemes it looks like "Spanish"; read as a
transliteration it is the loanword.

⚠ **Trap 37's decomposition check is NOT VALID AGAINST A LOANWORD** — a syllabic loan has no morphemes for
the tail test to bite on, so the test cannot return a useful answer and its "failure" carries no
information. New entry for the playbook. The practical consequence: **a slot search must be finished by a
dictionary, not by a corpus concordance.** Run 8 stopped at the concordance because its own header records
that `attest.ts` cannot be run for this language (there is no Hmong Wikipedia to probe) — which is true, and
which made a plain web search the only remaining route rather than an optional extra.

### What settles it: an OUTSIDE source, which is exactly what Run 8 went looking for and did not find

A first-year Hmong language textbook (*1st Year Hmong Book 1 — Koj Xyaum Hais Lus*), **Unit 5C, "Tham txog
sij hawm mus thiab deb li cas" / "Talking About Time and Distance"**, carries the word twice, in the two
forms that matter most. Both verified in the page's RAW text, not via a summarizer:

```
kis lus mev – kilometer                      ← an EXPLICIT ENGLISH GLOSS, in the unit's own vocabulary list
B: Deb li ntawm 218 tawm kis lus mev.        ← IN THE SLOT, in the unit's dialogue
   "It's about 218 kilometres away."
```

A gloss list is a dictionary entry in all but binding, and this is the **"sense you have READ"** the bar
demands — the source itself says what the word means. This is not `Komma` attested ×24 as a verb, nor `ናቕፋ`
×5 as a town: nothing here has to be inferred from a count.

**Tally: three instances in the slot across TWO INDEPENDENT SOURCES** (the textbook's dialogue, the
textbook's gloss, the corpus's Boigu sentence), one of them a definition. That is at least the evidence
`feem pua` shipped on in Run 4, and the definition is the stronger half of it.

### ⚠ Negatives kept, because they bound the claim

| source | result |
|---|---|
| Glosbe en→hmn `kilometer` | "Currently, we have no translations for **kilometer** in the dictionary" |
| Heimbach, *White Hmong–English Dictionary* (1969, ~4,900 entries) | **no metric entry at all** — full text searched, `kilomet` ×0 |
| davecurtis.net English–Hmong Daw phrasebook | `kilomet` ×0, `kis lus` ×0 |
| espeak | ships no Hmong |
| `attest.ts` | still unusable — no Hmong Wikipedia exists to probe |

The word is real and **thinly documented online**. That is why a corpus concordance alone could not reach
it, and it is why the refusal was reasonable rather than careless.

### Word order: POSTPOSED, and every instance agrees

`218 tawm kis lus mev` · `5 kis lus mev`, and the corpus's own symbol order `145 km deb`, `(784 km)`,
`9,85 lab km2`. **No preposed hit anywhere.** So the rule does not reorder: the symbol is swapped for the
word where it already stands, which also means it has no operand to put back (trap 10 does not arise).
This matches `feem pua` and `duas`, and is the exact opposite of the Mooré kilometre landed in the same
batch, which is head-initial — the two languages were sourced independently and disagreed, which is the
point of doing it per-language.

### ⚠ Put through the engine's own g2p BEFORE being declared

This file's central hazard is that in RPA the final consonant letter IS the tone, so a word cannot be
declared on the page alone:

```
phonemize("kis lus mev", "hmn") → ki˩ lu˩ me˧˦          three clean syllables, nothing raw
phonemize("kis","lus","mev")    → ki˩ · lu˩ · me˧˦      each parses as onset + rime + tone
phonemize("10 km", "hmn")       → kau̯˩̰ ki˩ lu˩ me˧˦   ← was: kau̯˩̰ KM
```

`lus` is an ordinary corpus word (×many). **No letter of the declared string reaches the IPA unread** —
which is the check `km` itself fails, and the whole reason the word was needed.

Guards verified: `koom`, `kaum`, `kev` untouched; a bare `km` with no figure near it is deliberately left
alone here (that shape belongs to the shared tier's bare-unit path, not to this file).

### The exponent stays refused, and the REASON has narrowed

The header used to say "a squared word needs a head noun and there is no sourced unit noun to head". The
second clause is now **false** — `kis lus mev` is the head noun. What remains true is the first: no Hmong
word for *squared* is attested in the corpus, the textbook, Glosbe or Heimbach. So `km²`/`km2` (×2) emits
the bare unit and the squared-ness is dropped. ⚠ hmn REMAINS **not** an accepted silence for `exponent` and
`review.ts` stays RED on it (trap 24). Stated rather than silently edited, because a narrowed reason that
looks like an unchanged one is how a refusal quietly becomes unearned.

---

## Run 10 — 2026-08-12 21:35 (the gates, and one golden whose expected value changed)

| gate | before | after |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 242 files / 3,851 passing | **242 files / 3,851 passing + 2 new hmn tests** |
| `referee-eval.ts hmn` | raw exact **455/455 (100.0%)**, folded 455/455, symbol 100.0% | **byte-identical, 455/455** |
| `corpus-diff` utterances changed | — | **5 / 92 (5.4%)** |
| `corpus-diff` DROP | 5 | **5 — UNCHANGED** |
| `mine.ts scan` | DROP minus ×2 · exponent ×2 · ACCEPTED-CLASS math-sign ×3 · degree ×2 · REDUNDANT currency ×1 | **identical, class for class** |
| `review.ts --lang hmn` | 2 FAILING (`sign classes: DROPPED minus exponent`, artifact scan) | **identical, 2 FAILING** |
| `sources.ts --lang hmn` | 3 NONE / 3 chk? | **identical** |

⚠⚠ **THE SAME HEADLINE AS THE mos RUN, INDEPENDENTLY REPRODUCED: every gate except corpus-diff's
utterance count is byte-identical across a change that repairs 5 utterances.** There is no `unit` sign
class — every leak counter in this repo is keyed on a SIGN (`%`, `$`, `°`, `−`, `²`, `&`) and `km` is two
ASCII letters. Run 8 predicted exactly this ("NO LEAK CLASS CAN SEE IT … it took a hand probe", trap 6);
this run confirms it from the other side, on a language whose referee is a **perfect 455/455** and stayed
perfect. A green board was fully compatible with `km` reaching the IPA ×13.

`referee-eval hmn` is worth running anyway and byte-identical IS its pass condition: it is 455 single-syllable
RPA words with no digit and no symbol, so it cannot see this layer — but a rule that bit a TONE LETTER off
an RPA word would show up there immediately. It did not.

### All 5 changed utterances were read. Every one is the intended repair.

```
(362 km) rau            -  … ʈau̯˧ cau̯˩̰ ʔɒ˥ KM ʈau̯˧ ʂa˥ …
                        +  … ʈau̯˧ cau̯˩̰ ʔɒ˥ KI˩ LU˩ ME˧˦ ʈau̯˧ ʂa˥ …
145 km deb              -  … pˡau̯˥ cau̯˧˩̤ t͡ʂi˥ KM de˥ …
                        +  … pˡau̯˥ cau̯˧˩̤ t͡ʂi˥ KI˩ LU˩ ME˧˦ de˥ …
9,85 lab km2            -  … ʝi˩̰ t͡ʂi˥ la˥ KM tʰiə̯˥ …          the magnitude sits INSIDE the measure phrase
                        +  … ʝi˩̰ t͡ʂi˥ la˥ KI˩ LU˩ ME˧˦ tʰiə̯˥ …
17.125.187 km²          -  … ʝi˩̰ cau̯˩̰ ça˧ KM . …
                        +  … ʝi˩̰ cau̯˩̰ ça˧ KI˩ LU˩ ME˧˦ . …
```

The Austria border-lengths paragraph alone accounts for 8 of the 13 tokens (`362 · 91 · 366 · 330 · 430 ·
35 · 164 · 784 km`), which is why one utterance carries most of the repair.

### ⚠ ONE GOLDEN'S EXPECTED VALUE CHANGED, and it is the right change

`test/hmong.test.ts`, the ASCII-exponent test:

```
-  expect(normalizeHmong("9,85 lab km2")).toBe("9 8 5 lab km²");
+  expect(normalizeHmong("9,85 lab km2")).toBe("9 8 5 lab kis lus mev");
```

**Justification.** The old expectation ended in a bare `km²` — the unit reaching the IPA raw — and that was
correct *at the time*, because Run 6 had sourced no unit noun and the test was pinning the `km2`→`km²` fold
in isolation. The fold still happens (it is what stops the `2` being read as the cardinal *ob*, the `za`
`810km2` bug); what changed is that the head noun is now read. The `²` is **still** dropped and hmn is
**still** not an accepted silence for `exponent`, and the test's comment now says so explicitly rather than
pointing at Run 8's refusal. No other golden in the tree moved.

The test's stale comment — "No unit word exists for hmn (see normalize.ts on why `kis lus mev` was
declined)" — was rewritten in the same edit. A comment that outlives the decision it explains is how a
reversal gets lost.

### The negative that is no longer the deliverable, and the one that is

Run 8's kilometre bullet was recorded as a kept negative. **It is now superseded and should be read as
history, not as current state** — the word is declared. The negative that survives and is worth keeping is
the *method* one: a corpus concordance could not settle a loanword, trap 37's tail test was structurally
incapable of answering, and only an outside pedagogical source could close it. The three dictionaries that
came back empty (Glosbe, Heimbach, the Daw phrasebook) are kept in Run 9 for the same reason — they bound
how well documented this word is, and they explain why one textbook had to carry the weight.
