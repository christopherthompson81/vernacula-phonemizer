# Fleet symbol audit — three recurring defects, measured across all 162 mined artifacts

Three defects were each found BY HAND in one language over the last six rounds. Each looked like it could be
a fleet-wide property rather than a local one, so each was re-measured across every shipped
`src/languages/*/normalize.ts` and every `tools/corpus/mined/*.jsonc`. **The measurement tables are the
deliverable.** Two of the three audits are clean negatives, and saying so with numbers is the point — a
defect that recurs three times and then stops recurring is only known to have stopped if somebody counted.

Scope note: nothing in the mining pipeline was changed and nothing was re-mined. `catalogue.tsv`,
`languages.db` and `docs/normalization_playbook.md` were not touched.

---

## Run 1 — 2026-08-16 — audit A: the composite currency mark, fleet-wide

**The defect.** `src/core/normalizeSymbols.ts` builds every currency key inside a letter boundary:

```
const wordCont = d.unspacedScript ? "\\p{sc=Latn}" : "\\p{L}";
const CUR = `(?<![${wordCont}${markCont}])(?:${curKeys})(?![${wordCont}${markCont}])`;
```

so a sign that a LETTER runs into is never matched. This is trap 64's nastiest property: **the sign is not
dropped, it is never seen**, so no leak gate and no `DROP currency` report fires. `US$185 billons` reads as a
bare number with no currency noun anywhere and nothing anywhere says so. Three languages needed the
composite-key fix by hand (an, skr, kaa); the question is how many more do.

**The question the run answers.** For every language that declares a `currency` key, how often does its own
mined corpus write a currency sign with a letter glued directly to its left, and is that composite already
declared?

**Command.** `node .scratch/auditA2.mjs` — resolves each mined code to its `src/languages/` directory through
`src/registry.ts` (the same resolver `review.ts` uses), keeps only languages whose `normalize.ts` declares
`currency`, and scans the artifact's JSON string literals for `[\p{L}\p{M}]+<sign>` followed by a digit,
space or end.

⚠ **The first cut of this scan was wrong and the wrongness is worth recording.** It matched
`[\p{L}]{1,5}\s?<sign>`, i.e. it allowed a SPACE between the letters and the sign, and reported 46 languages
and hundreds of hits — `menen $`, `ahası $`, `no $`. Every one of those is the ORDINARY, WORKING case: a
space is not a letter, so the lookbehind is satisfied and the sign matches fine. Only ZERO-space adjacency
can trip the guard. The corrected scan is the table below.

### Table A — currency-declaring languages whose corpus glues a letter to a sign

51 languages declare `currency`; 34 have at least one glued instance.

| lang | hits | glued forms | already declared? |
|---|---|---|---|
| jv | 15 | US$×9 AS$×6 | ✅ both |
| kmr | 15 | US$×1 + 14 code fragments (`false$`, `dtrue$`, `GUAGE$`) | ✅ US$; the rest are not currency |
| si | 13 | US$×11 CN¥×1 PPP$×1 | ✅ US$; ¥ undeclared entirely |
| nso | 11 | US$×7 GB£×4 | ✅ US$; **£ declined on the record** |
| mad | 9 | US$×6 AS$×1 S$×1 HK$×1 | ✅ US$/AS$; **S$/HK$ declined on the record** |
| skr | 9 | US$×9 | ✅ (fixed by hand, round N-2) |
| ilo | 7 | US$×7 | ✅ |
| yo | 7 | US$×7 | ✅ |
| ceb | 6 | US$×5 AUD$×1 | ✅ both |
| km | 6 | US$×3 SGD$×1 CN¥×1 + 1 Khmer-glued | ✅ US$/CN¥; `unspacedScript` covers the Khmer one |
| so | 6 | US$×6 | ✅ |
| su | 6 | AS$×5 US$×1 | ✅ both |
| nan | 5 | US$×3 M$×1 ₫×1 | ✅ US$; M$/₫ undeclared |
| **pnb** | **5** | **US$×3** + `تقریبا€`×2 | ❌ **NOT DECLARED — fixed in run 2** |
| gan | 4 | 4× Han-glued `$` | ✅ `unspacedScript` |
| gn qu st ta te | 3 each | US$ | ✅ |
| wuu | 3 | Han-glued `£`/`$` | ✅ `unspacedScript` |
| kn lo mg mi sq wo | 2 each | US$ (+ mg `R$`×1, mi `AUD$`×1) | ✅ US$ |
| ab | 1 | `B£`×1 (a Brixton pound in one Abkhaz sentence) | ❌ but see below |
| bar ml or **sat** | 1 each | US$ / **HK$** | ✅ US$ · ❌ **sat HK$ — fixed in run 2** |
| hak | 1 | Han-glued `$` | ✅ `unspacedScript` |
| **ig** | **1** | **US$×1** | ❌ **NOT DECLARED — fixed in run 2** |

**Raw finding.** The fleet is in far better shape than the three hand-fixes suggested. Of 34 languages with a
glued sign, **28 already declare the composite**, three are `unspacedScript` (where a Han or Khmer neighbour
is a token boundary by script change and the guard correctly lets the sign through), and the residue is small.

⚠ **The most useful negative result in this audit is that two languages had already CONSIDERED and DECLINED
the exact keys the scan flagged, in writing.** `src/languages/madurese/normalize.ts` says:

> `¥`, `S$` AND `HK$` ARE DELIBERATELY ABSENT. All three occur … and no Madurese name for the yen, the
> Singapore dollar or the Hong Kong dollar is attested in the corpus or on the wiki. `S$`/`HK$` cannot be
> reached by the bare `$` key anyway (letter-bounded), so they stay silent rather than guessed

and `src/languages/sepedi/normalize.ts` declines `£`/`GB£`/`€` because `diponto` is the MASS pound, not the
currency. **A scan cannot distinguish "nobody noticed" from "somebody decided"**, which is why these two are
reported as clean rather than fixed. The comments were already doing their job.

**Non-composite residue, reported and not fixed.** pnb's corpus also writes `تقریبا€ 132 ملین` ×2 — a €
glued to the ordinary adverb "approximately", a missing space in the source. That cannot be repaired with a
composite key (the preceding word is arbitrary running text), so it is recorded here and left alone.

**Implication for run 2.** Three languages have a non-zero count, no declaration, and no recorded decision:
pnb (×3), sat (×2), ig (×1). Probe each before touching anything.

---

## Run 2 — 2026-08-16 — audit A: three real losses confirmed, three keys added

**Command.** `npx tsx .scratch/probe.ts <lang> <corpus string>` on the exact strings from Table A.

```
pnb  "قیمت US$130 بلیئن ہے"
   -> qˈiːmət̪ jˈuː ˈɛs ˈɪkː sˈɔː t̪ˈiːɦ bəliːˈiːn ɦˈeː      ← "U", "S", then the bare number
sat  "ᱦᱚᱸᱠᱚᱝ HK$᱓᱒᱗ ᱵᱤᱞᱤᱭᱚᱱ"
   -> hɔ̃kɔŋ ˈeᶦt͡ʃ kʰˈeᶦ pe saj bar ɡel ejaj bilijɔn         ← English letter names inside Santali
ig   "totalled approximately US$170,000 and every"
   -> totalled appɾoksimatelj us puku otu naɾɪ na iɾi asaa …  ← no currency noun
```

All three lose the currency noun outright, and all three are the "never seen" shape — the corresponding
`$`-only string reads correctly in each language, which is what proves the guard and not the data is the
cause.

**The fix, and which sourcing case each one is.** The brief's rule: reuse the language's own `$` word where a
US/HK dollar simply IS that dollar; only add a NEW word with an attestation. **All three are the reuse case
and nothing new is sourced:**

| file | key added | word | case |
|---|---|---|---|
| `src/languages/punjabi/normalize.ts` | `"US$"` | `ਡਾਲਰ` | reuse — same word the `$` key already emits |
| `src/languages/santali/normalize.ts` | `"HK$"` | `ᱰᱚᱞᱟᱨ` | reuse — and on sat's OWN precedent, since its `US$` key already emits the plain generic dollar rather than a nation-specific phrase |
| `src/languages/igbo/normalize.ts` | `"US$"` | `dollar` | reuse — same word the `$` key already emits |

⚠ **ig's single instance is an ENGLISH sentence the ig wiki left untranslated** (`… victories in 2016
totalled approximately US$170,000`). That is evidence the NOTATION occurs in this artifact, not evidence
about Igbo register, and the code comment says so — otherwise a later reader would take it as an attestation
it is not.

**After the change:**

```
pnb -> qˈiːmət̪ ˈɪkː sˈɔː t̪ˈiːɦ ɖˈaːləɾ bəliːˈiːn ɦˈeː
sat -> hɔ̃kɔŋ pe saj bar ɡel ejaj ɖɔlar bilijɔn
ig  -> totalled appɾoksimatelj puku otu naɾɪ na iɾi asaa dollaɾ and eveɾj
```

**Gates.** Baselines were emitted from the pristine checkout BEFORE any edit.

| lang | changed | DROP before → after | DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW |
|---|---|---|---|
| pnb | 2/449 (0.4%) | **16 → 15** | 0 / 0 on both sides |
| sat | 1/441 (0.2%) | **45 → 44** | 0 / 0 on both sides |
| ig  | 1/459 (0.2%) | **43 → 42** | 0 / 0 on both sides |

DROP falls in all three and rises nowhere. Every hard-zero class is 0 before and after.

---

## Run 3 — 2026-08-16 — audit B: the trailing space in an abbreviation expansion — CLEAN NEGATIVE

**The defect.** In karakalpak (and originally crimeantatar) a rule replaced `mln\s?\.` with `"million "`,
leaving TWO spaces before the following unit. The tier's unit regex allows exactly one
(`(${NUM})${magAltU}\\s?(${unitAlt})`), so `106,2 mln. km²` composed the magnitude and dropped `km²`
entirely. The repair is for the pattern to consume the following whitespace.

**Step 1 — the naive grep, and why it was useless.** `node .scratch/auditB.mjs` looked for any `.replace()`
whose replacement string begins or ends with a space while the pattern does not consume the adjacent
whitespace. **1,425 candidates.** Almost all are `±` → `" plus minus "`, `&` → `" and "`, punctuation
squeezes — symbol-to-word rules whose extra space lands BEFORE a number, where the final whitespace squeeze
removes it and no downstream regex ever sees it. A scan that reports a quarter of the fleet is not a
measurement.

**Step 2 — the narrowed scan.** `node .scratch/auditB2.mjs`: TRAILING space only, replacement must contain a
letter (a word expansion, not a punctuation squeeze), deduplicated by (file, pattern, replacement).
**129 distinct candidates in 82 languages.**

**Step 3 — the karakalpak shape specifically.** The hazard only bites when the expansion sits BETWEEN the
number and the unit — i.e. a MAGNITUDE abbreviation. Grepping every `mln`/`mlrd`/`млн`/`млрд`/`тыс` rule in
the fleet:

```
crimeantatar:113  `${NOT_BEFORE}mln\\s?\\.\\s?`  -> "million "     ← already consumes the space
karakalpak:132    `${NOT_BEFORE}mln\\s?\\.\\s?`  -> "million "     ← already consumes the space
chuvash:175/177   млрд\.? / млн\.?               -> "миллиард" / "миллион"   ← no trailing space
uzbek:117         mln\.(?=\s+\p{L})              -> "million"                ← no trailing space
kyrgyz:365/367    (?<=\d\s?)млрд\.?              -> "миллиард"               ← no trailing space
tajik:237-241     (?<=\d\s?)млрд\.               -> "миллиард"               ← no trailing space
```

**Both known instances are already repaired in this checkout, and no other language in the fleet expands a
magnitude abbreviation with a trailing space at all.** The other four Cyrillic/Turkic languages that abbreviate
magnitudes emit the word with no trailing space, so the shape cannot arise.

**Step 4 — the decisive empirical test, because the reasoning above is not proof.**
`npx tsx .scratch/auditB4.ts` takes every one of the 129 candidates, finds REAL instances in that language's
own mined corpus where the rule's match is immediately followed by a space (the only way the double space can
occur), phonemizes the actual corpus sentence, then phonemizes the same sentence with that one space removed,
and diffs the two readings.

```
rules with real spaced instances: 31
sentence pairs phonemized:        73
readings that DIFFER:              3
```

**All three differences are artefacts of the test, not defects.** Deleting the space glues two words together
and changes the reading for that reason: `Arts &amp; Sciences` → `Arts &amp;Sciences` loses the coordinator
in fula, and mg's `35°C any` → `35°Cany` turns the following word into `kani`. In every one of the 73 pairs
**the real, spaced corpus form reads correctly.**

The near-miss population is worth naming because it looks like the defect and is not: `NN° C` with the sign
spaced from BOTH neighbours occurs in ba (`30° С-тан`), la (`20° C sit`), skr (`22 ° C`) and tk (`37 ° C,`).
Probed head-to-head against the tight `NN°C` form:

```
ba  "30° С-тан юғары"  -> uˈtɯð ɡɾɑdusˈtɑn juʁɑˈɾɯ     ≡ "30°С-тан юғары"
la  "20° C sit"        -> wiːˈɡɪntiː ˈɡradʊs ˈkɛɫsiʊs ˈsɪt   ≡ "20°C sit"
skr "22 ° C"           -> bˈaːiː ɖˈəɡɾiː sˈiːɳʈiː ɡəɾˈiːɖ    ≡ "22 °C"
tk  "37 ° C,"          -> oˈtuð jeˈdi ɡɾɑˈduθ θelˈθi ,       ≡ "37 °C,"
```

Identical in all four. The scale name is claimed by a `°`-anchored rule that runs before the unit tier, so the
double space never reaches a regex that cares.

**Result: audit B is a clean negative.** The defect existed in exactly the two languages it was found in, both
are fixed, and no third instance exists in the fleet. **Nothing was changed for audit B.**

---

## Run 4 — 2026-08-16 — audit C: EasyTimeline markup is a pipeline property, and five entries said otherwise

**The defect.** Aragonese, Crimean Tatar and Hawaiian each found EasyTimeline chart directives left in by the
dump extraction (`PlotArea =`, `ScaleMajor =`, `ScaleMinor =`, `TimeAxis =`, `ImageSize =`), plus MediaWiki
URL parameters. Each round said "this is a property of the mining pipeline, not of one wiki". Nobody had
counted it.

**Command.** `node .scratch/auditC3.mjs` — counts `=` and EasyTimeline directives **inside the `"hard"` and
`"sample"` arrays only**, which is the retained text the `defects.ts` entries claim to be measuring. (A first
pass counted every JSON string in the file, including the artifact's own metadata; the numbers below are the
retained-text ones, and they match the entries that quote a figure — haw's "×11, TEN are EasyTimeline" and
an's "×10, SIX are EasyTimeline" reproduce exactly.)

### Table C — EasyTimeline directives in retained text, per artifact

**123 directives across 25 of the 162 mined artifacts.**

| lang | `=` total | ETL | share | directives |
|---|---|---|---|---|
| st | 14 | 14 | **100%** | ScaleMajor×7 ScaleMinor×4 PlotArea×3 |
| haw | 11 | 10 | 91% | PlotArea×3 ScaleMajor×3 ScaleMinor×2 TimeAxis×1 ImageSize×1 |
| nya | 9 | 9 | **100%** | ScaleMajor×4 PlotArea×2 ScaleMinor×2 ImageSize×1 |
| crh | 14 | 8 | 57% | ScaleMajor×3 ScaleMinor×3 PlotArea×2 |
| ig | 10 | 7 | 70% | PlotArea×3 ScaleMajor×2 ScaleMinor×1 ImageSize×1 |
| an | 11 | 6 | 55% | ScaleMajor×5 PlotArea×1 |
| ast | 11 | 6 | 55% | PlotArea×2 ScaleMajor×2 ScaleMinor×1 ImageSize×1 |
| bpy | 17 | 6 | 35% | ImageSize PlotArea TimeAxis ScaleMinor ScaleMajor BackgroundColors ×1 each |
| ht | 17 | 6 | 35% | ScaleMajor×2 PlotArea×2 ScaleMinor×2 |
| mg | 10 | 6 | 60% | Period ScaleMajor ImageSize PlotArea DateFormat TimeAxis ×1 each |
| ltg | 14 | 5 | 36% | ScaleMajor×2 ScaleMinor×2 PlotArea×1 |
| nan | 16 | 5 | 31% | ImageSize×2 ScaleMajor×1 ScaleMinor×1 PlotArea×1 |
| nso | 8 | 5 | 63% | ScaleMajor×2 ScaleMinor×2 PlotArea×1 |
| kmr | 16 | 4 | 25% | ImageSize PlotArea ScaleMajor ScaleMinor ×1 each |
| za | 4 | 4 | **100%** | ScaleMajor×2 PlotArea×1 ScaleMinor×1 |
| bm | 15 | 3 | 20% | PlotArea ScaleMajor ScaleMinor |
| lg | 19 | 3 | 16% | PlotArea ScaleMajor ScaleMinor |
| oc | 15 | 3 | 20% | PlotArea ScaleMajor ScaleMinor |
| pcm | 3 | 3 | **100%** | ScaleMajor ScaleMinor PlotArea |
| tn | 14 | 3 | 21% | PlotArea ScaleMajor ScaleMinor |
| la | 150 | 2 | 1% | ScaleMajor ScaleMinor |
| mt | 12 | 2 | 17% | PlotArea ScaleMajor |
| gan | 18 | 1 | 6% | PlotArea |
| rw | 13 | 1 | 8% | PlotArea |
| tg | 15 | 1 | 7% | ScaleMinor |

MediaWiki URL parameters (`preload=`, `action=`, `title=`) add 12 more across crh, syl, ak, ti, ig, cjy, km.

⚠ **Five artifacts are 100% chart markup** — st, nya, za, pcm — plus haw at 91%. For those languages the
`=` sign as it appears in the artifact is not a fact about the language at all.

⚠ **Five of the 25 have no `ACCEPTED_SIGN_SILENCE` entry** (st, bpy, ltg, nso, pcm), so their markup was
never miscounted as evidence — there is no claim to correct.

### Which entries were checked, and the verdict on each

Cross-referencing the table against every `equals` entry in `tools/normalization/defects.ts`:

**Already correct and explicit — no change (13):** haw, crh, an, nya, za, ht, nan, kmr, gan, rw, lg, tn, bm.
Several name the directives verbatim and haw/crh/an already carry the "chart markup is a property of
dump-sourced artifacts, not a quirk of one wiki" note. Their counts reproduce exactly under an independent
scan, which is a real corroboration of the earlier rounds' arithmetic.

**Corrected in place (5)** — in each case the REFUSAL is left standing and only the evidence behind it is
fixed:

| lang | what it said | what the retained text actually contains |
|---|---|---|
| **mg** | "the mined `=` are spelling-article glosses" | ✘ **not one is.** 6 of 10 are EasyTimeline; the rest are a currency equivalence (`1 Ariary = 5 iraimbilanja`), an infobox field (`Halavany = 320 km`), `T = 1/f`, HTML residue |
| **ig** | "= is 1 digit-flanked and 24 leading in a 26 MB sample" — a dump-wide figure that says nothing about what the signs ARE | 7 of 10 are EasyTimeline, 3 are raw HTML attributes from an unstripped wikilink. **Zero in Igbo prose** — which strengthens the refusal |
| **ast** | "`=` ×0 in Asturian prose. The residual is a LaTeX fragment and a PIE root" | ✘ **neither named item contains a `=` at all** — they are residuals of other math signs. The 11 real ones: 6 EasyTimeline, a currency conversion, an ISBD parallel title, two glosses, `a·b = b·a` |
| **oc** | "`=` ×1 and it is inside a raw LaTeX fragment" | ✘ **×15, a fifteenfold undercount.** 3 EasyTimeline, 5 one repeated bibliographic segment, 2 dialect glosses, a Greek etymology, `Y = C + S`, and ⚠ **one genuinely digit-flanked instance the entry denied existed** — `1 € = 1,95583 novèl lev` |
| **mt** | "×12 … NOT ONE is arithmetic. Every instance is a GLOSS" | count right, claims wrong: 2 are EasyTimeline, and ⚠ **one IS arithmetic** — an election seat tally, `Siġġijiet - PN 26( +4 = 30)` |

The two that matter most are oc and mt, because in both the entry asserted a NEGATIVE ("zero are equations",
"not one is arithmetic") that the retained text contradicts. Neither instance is enough to source an operator
word — one foreign-currency peg, one parenthesised seat tally — so both refusals survive, but an entry that
overclaims is the kind of thing a later round trusts and should not.

⚠ **A finding NOT fixed, deliberately, because it is outside this audit's remit.** mt's `plus` entry
enumerates its ×10 as "six Greek etymology, three telephone country code, one sentence about the character".
Reading all ten: **five are phone codes, one is the sentence-about, two are the Greek etymology, one is a UTC
offset (`UTC+04:00`), and one is the same `+4` from the seat tally above.** The breakdown is wrong and the
"not one is an operator" claim has the same single counterexample as `equals`. This audit's remit was the
`equals` entries; the corrected `equals` entry now cross-references it so the next round finds it.

**Nothing in the mining pipeline was changed** — the directives stay in the artifacts. The correction is to
what the fleet BELIEVES about them.

---

## Run 5 — 2026-08-16 — the hard-gate inventory (measured, not fixed)

**Command.** `bash .scratch/reviewall.sh` — `npx tsx tools/normalization/review.ts --lang <code>` for all
**162** mined codes, then `node .scratch/gates.mjs` to pull the `sign classes` / `sourcing` / `clause-final`
checklist rows. All 162 produced a checklist; none was truncated.

### The headline numbers

| gate | `[FAIL]` | `[ ?? ]` | `[ ok ]` |
|---|---|---|---|
| **sign classes** | **50** | 6 | 106 |
| **sourcing** | **0** | **52** | 110 |
| **clause-final** | **0** | 6 | 156 |

⚠ **Two of the three hard gates are failed by NOBODY.** `clause-final` and `sourcing` are green or unresolved
fleet-wide; there is not a single `[FAIL]` on either. Every red gate in the fleet is `sign classes`.

### The 50 `sign classes` failures, with the dropped classes

```
ab    minus plus plus-minus ampersand equals less-than greater-than times divide
ak    minus                          am    minus plus-minus
as    plus-minus                     az    plus-minus
bar   minus                          bm    minus
bn    plus-minus                     bo    minus
cdo   minus                          ee    minus plus plus-minus equals less-than greater-than divide
ff    plus-minus divide              fi    plus-minus divide
gn    minus                          ha    plus-minus divide
he    minus                          hmn   minus exponent
ht    minus                          hy    minus plus-minus equals less-than greater-than times divide
ilo   minus                          ka    plus-minus equals less-than greater-than times divide
ki    greater-than degrees           kn    plus-minus
lg    minus degrees                  mad   minus
mn    minus plus                     mos   minus
mt    minus plus-minus less-than greater-than times divide
my    minus plus-minus               nso   minus plus plus-minus equals less-than greater-than times divide
om    plus-minus divide              pcm   minus plus plus-minus equals less-than greater-than times divide exponent degrees
qu    minus percent degrees          rn    minus
rw    minus                          sat   minus plus equals less-than greater-than times divide
shi   minus                          sn    minus
sq    plus-minus                     st    minus plus plus-minus equals less-than greater-than times divide degrees
syl   minus                          tg    minus equals
ti    minus plus                     tn    minus
ur    plus-minus                     wo    minus degrees
xh    plus-minus                     yue   plus-minus
za    minus                          zu    divide
```

**By class:** `minus` 35 · `plus-minus` 22 · `divide` 14 · `greater-than` 10 · `less-than` 9 · `equals` 9 ·
`times` 8 · `plus` 8 · `degrees` 6 · `exponent` 2 · `percent` 1 · `ampersand` 1.

**The distribution is the finding.** The overwhelming majority of the fleet's red is a SINGLE sign class in a
SINGLE language, and the dominant two — `minus` (30) and `plus-minus` (20) — are exactly the two the playbook
records as safest to leave silent: omitting a plus-minus is lossless, and most of the fleet's digit-flanked
dashes are date ranges rather than negatives. Only eight languages (ab, ee, hy, ka, mt, nso, pcm, st) fail on
six or more classes at once, and every one of those has a long, argued `ACCEPTED_SIGN_SILENCE` block — they
are red because the sweep's stance is that a sourcing gap with a reading still to find is a TODO and not an
exemption, not because nobody looked.

⚠ **The `sourcing` column is not a language-quality signal in this environment, and would be badly
misread as one.** All 52 `[ ?? ]` rows are the same shape:

> `ਡਾਲਰ` — in NO source (corpus, artifact, referee, lexicon; **espeak NOT consulted — `$ESPEAK_NG` is unset;
> wikipedia NOT probed** — try `tools/normalization/attest.ts`)

Two of the four evidence tiers were simply **not consulted** because `$ESPEAK_NG` is unset and no network
probe was run. The words involved are almost all the same handful of international loans (`dollar`, `yen`,
`pound`, `percent`) in 30-odd different orthographies — hi `डॉलर`, ko `달러`, el `δολάριο`, ta `டாலர்`,
zu `amadola`. **These are unresolved, not failed**, and re-running with `ESPEAK_NG` set and `attest.ts`
enabled would resolve most of them without any code change. Recorded here so a future round does not read 52
`[ ?? ]` as 52 defects.

### The touched languages, re-reviewed after the change

| lang | sign classes | sourcing | clause-final |
|---|---|---|---|
| pnb | `[ ok ]` none dropped | `[ ?? ]` `ਪ੍ਰਤੀਸ਼ਤ`, `ਡਾਲਰ` — the `$ESPEAK_NG` shape above, and **both words pre-date this change** (`ਡਾਲਰ` is what the `$` key already emitted) | `[ ok ]` |
| sat | `[FAIL]` minus plus equals less-than greater-than times divide | `[ ok ]` all 2 attested | `[ ok ]` |
| ig  | `[ ok ]` none dropped | `[ ok ]` all 3 attested | `[ ok ]` |

⚠ sat's `sign classes` red was verified to PRE-DATE this change: `git stash`ing the santali edit and
re-running produces the identical dropped list. `currency` is not among the dropped classes on either side,
which is the class this change touches. No gate moved in the wrong direction anywhere.

**Full-suite gates for the change:** `npx vitest run` — 248 files, 4,596 passed, 5 skipped, **0 failed**.
`npx tsc --noEmit` — clean.

⚠ A first `vitest` run showed 2 failures (`ajp` and `ar` in `referee-eval.test.ts`) and **both were 30-second
TIMEOUTS caused by the 162-language review sweep running concurrently on the same machine**, not by this
change. Re-run with the machine idle: `171 passed`, and the full suite green. Recorded because a timeout in a
referee test looks exactly like a real regression in the log.

---

## Standing conclusions

1. **Trap 64 is 82% closed and the residue is documented refusals, not oversights.** Of 34 languages whose
   corpus glues a letter to a currency sign, 28 already declare the composite, 3 are `unspacedScript`, and 2
   of the remaining had written down a decision to decline. Three genuine gaps existed and are now closed.
2. **The trailing-space defect did not generalise.** 129 candidate rules in 82 languages, 73 real corpus
   sentences phonemized both ways, zero readings lost. It was a two-language bug and both are fixed.
3. **Chart markup DID generalise, and further than any single round could see** — 123 directives in 25
   artifacts, five of them 100% markup. The three rounds that each called it "a property of the pipeline"
   were right, and the number is now on the record so no future round has to rediscover it.
4. ⚠ **The most transferable lesson is methodological: a scan cannot tell "nobody noticed" from "somebody
   decided".** Madurese and Sepedi both look like defects to `auditA2.mjs` and are neither. The only thing
   that separated them from pnb/sat/ig was reading the comment above the declaration. Any future fleet sweep
   that acts on a scan without doing that will "fix" a decision somebody made on evidence.
