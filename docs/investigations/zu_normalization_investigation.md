# Zulu (zu) text normalization — investigation log (#562)

Worktree `norm-work/zu-work`, branch `norm-zu-562`. Corpus: FLEURS `zu_za`, **column 3** (cased original),
1,478 unique utterances. Mined artifact `tools/corpus/mined/zu.jsonc` already in `main`.

---

## Run 1 — 2026-08-02 — baselines, before touching anything

**Question.** What do the four gates say about `main`, so that "unchanged" can be proved later?

```
npx tsx tools/normalization/corpus-diff.ts emit --lang zu --corpus zu_za --out $S/zu.before
  → emitted 1478 utterances

npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/zu.jsonc --lang zu
  → scanned 132 lines of tools/corpus/mined/zu.jsonc as zu
    DROP degree        ×2
    DROP minus         ×2
    DROP math-sign     ×1
    DROP currency      ×1     ku-US$11,000 kuya ku-US$22,500
    REDUNDANT currency ×1     ngokunikeza izigidi engu-AUD$45.

npx tsx tools/normalization/review.ts --lang zu
  → [FAIL] normalizer  src/languages/zulu/normalize.ts missing        (1 FAILING)

npx tsx tools/referee-eval/eval.ts zu
  → raw exact 0/1047 (0.0%) · folded backbone 1047/1047 (100.0%) · symbol accuracy 100.0%
```

**Implication.** The referee baseline is a clean 1047/1047, so any regression will be visible. The scan's
five lines are the defect shortlist the leak classes CAN see; the interesting defects are the ones they
cannot (see Run 3).

---

## Run 2 — 2026-08-02 — is the noun-class concord actually a trap-14 problem here?

**Question.** Zulu is agglutinative Bantu, so the brief's headline risk is trap 14: a rule that needs a
concord on a numeral cannot get one, because the digits only become words in the tokenizer.

```
perl -nle 'print for /(?<![A-Za-z])([A-Za-z]{1,8})-(?=[0-9])/g' zu.col3 | sort | uniq -c | sort -rn
  → 349 total. ngo 67 · angu 63 · ezingu 27 · lama 20 · engu 19 · Ngo 16 · kuka 14 · u 13 · ka 10
    · abangu 9 · ngu 8 · ku 7 · ngawo 6 · engama 4 · … · esingu 2 · ingu 2 · singu 1 · ungama 1
```

**RAW FINDING, and it is the whole design.** Zulu does not inflect the numeral; it writes a
**relative-concord + copulative prefix, hyphenated onto the digit run**, and that prefix is ALREADY IN THE
TEXT. 349 of the corpus's number occurrences carry it:

| written | class of the head noun | gloss |
|---|---|---|
| `amakhilomitha angu-1,600` | 6 (`ama-`) | kilometres which-are 1,600 |
| `abantu abangu-93%` | 2 (`aba-`) | people who-are 93% |
| `izigidi ezingu-2` | 8/10 (`izi-`) | millions which-are 2 |
| `iminyaka engu-40` | 4 (`imi-`) | years which-are 40 |
| `ngo-2007` | — (`nga+u-`) | in 2007 |

**Implication.** The concord agrees with the HEAD NOUN, not with the numeral, and the head noun is either
already written (349 cases) or is a noun **my own rule emits** (the minutes noun, the degree noun, a unit
noun). Either way the agreeing morpheme is determined by something the layer can see, and never by the
value of the digits. **So trap 14 does not bite for Zulu — provided no rule invents a concord for a noun
it did not itself put there.** That single constraint decides three things:

1. the numeral stays DIGITS in every rule (the tokenizer's `numberToWords` does the words);
2. percent / currency / plain units keep the shared tier's **postposed** order (`ingu-36 amamilimitha`),
   because the head-noun slot is already filled by the written prefix — prefixing the noun instead would
   produce a doubled copulative (`ingu-amamilimitha angu-36`);
3. where a rule DOES emit the noun itself (`nemizuzu engu-20`, `amazinga angu-35`), it may and must write
   the concord, because it chose the noun.

**Negative result worth keeping.** I first designed the units to follow the corpus's own order
(`amakhilomitha angu-1,600`), since 100% of the corpus's spelled-out measure phrases put the noun FIRST.
Reading the abbreviated instances killed it: they are almost all inside parenthetical conversions
(`(90kg)`, `(1,000 mi)`, `(30 m)`, `(56-64 km/h)`) or attributive (`Ifomethi ka-35mm`, `ingu-36mm
ububanzi`), where a noun-first rewrite either strands the prefix (`ka-amamilimitha angu-35`) or doubles the
copulative. Postposed is correct here *because* the prefix is already written.

---

## Run 3 — 2026-08-02 — probe the engine on every attested surface form

**Question.** What does `main` actually produce? (Playbook step 2 — the defect list is what the engine
emits, not what I assume.)

```
npx tsx probe.tmp.ts <every attested form>
```

RAW, verbatim:

```
"1,000"        → kʼˈuːɲɛ , i˥kǃˈaː˩nd̤a˥                       one , EGG  (iqanda = 0)
"755,688"      → … nanɬˈaːnu , amakʰˈuːlu …                    one number read as two
"angu-1.5"     → ˈaːŋɡ̤u kʼˈuːɲɛ . kʼuɬˈaːnu                    SENTENCE break inside the number
"angu-6.34"    → ˈaːŋɡ̤u i˩si˥tʰˈuː˩pʰa˩ . amaʃˈuːmi amatʰˈaːtʰu nˈaːnɛ   …and .34 read as "thirty-four"
"Ngo-11:20"    → ŋɡ̤ˈɔː i˥˩ʃˈuː˥˩mi˩ nˈaːɲɛ , amaʃˈuːmi amaɓˈiːli   colon → clause PAUSE
"u-5 mm"       → ˈuː kʼuɬˈaːnu mm                              RAW LETTERS in the IPA
"90kg"         → amaʃˈuːmi ajisiʃijaɡ̤alɔlˈuːɲɛ kʼɡ̤            kg → [kʼɡ̤]
"83 km/h"      → … amakʰilɔmˈiːtʰa h                           the /h read as the letter H
"3.850 km²"    → kʼutʰˈaːtʰu . … kʼm                           the ² killed the unit match entirely
"133 m/s"      → … m s                                          raw
"64 kph"       → … kʼpʰ                                         raw
"300,948 sq mi"→ … skǃ mˈiː                                     "sq" read with a CLICK [ǃ]
"600Mbit/s"    → … mbˈiːtʼ s                                    raw
"u-US$30"      → ˈuː ˈuːs amaʃˈuːmi amatʰˈaːtʰu                the $ DROPPED (US$ shadows the tier's $)
"ku-$2.3"      → kʼˈuː kʼuɓˈiːli . kʼutʰˈaːtʰu amad̤ˈɔːla      $ read, decimal broken
"35-40 mph"    → … amaʃˈuːmi amˈaːnɛ mpʰ                        no joiner, raw mph
"1418 – 1450"  → … (bare juxtaposition)                         no joiner
"+30°C"        → amaʃˈuːmi amatʰˈaːtʰu kǀ                       ° dropped, C → the CLICK [kǀ]
"35°W"         → … w                                            ° dropped
"1/5"          → kʼˈuːɲɛ kʼuɬˈaːnu                              "one five"
"u-U.S."       → ˈuː ˈuː . s .                                  TWO spurious phrase breaks
"1000 B.C."    → i˥ŋkʼu˩lu˥ŋɡ̤wˈaː˩nɛ˥ ɓ . kǀ .                 era marker letter-spelled, C → CLICK
"8:30 p.m."    → isiʃijaɡ̤alɔmbˈiːli , amaʃˈuːmi amatʰˈaːtʰu pʼ . m .
"amaB&amp;B"   → ˈaːmaɓ ɓ                                       HTML entity silently gone
"Arts & Sciences" → ˈaːrt͡sʼ skǀiˈɛːŋǀɛs                        the & DROPPED
"PBS" / "GDP"  → pʼɓs / ɡ̤d̤pʼ                                  vowel-less clusters
"II" / "Elizabeth II" → kʼuɓˈiːli / ɛliz̤ˈaːɓɛtʰ kʼuɓˈiːli      the registry already digitised it
```

**Implication — the click letters make this worse than in a Latin-script European language.** `c`, `q`, `x`
are clicks in Zulu, so an unread Latin letter is not a harmless consonant: `°C` reads [kǀ], `B.C.` reads
[ɓ kǀ], `sq mi` reads [skǃ mˈiː]. A dropped-letter defect here is *confidently wrong*, not merely missing.

Counts, all from column 3 of `zu_za` (1,478 utterances):

| class | count | probe finding |
|---|---|---|
| comma-grouped thousands | 34 | comma → clause pause, `000` → *iqanda* |
| dot-decimals | 20 raw / **14 real** | dot → SENTENCE break |
| comma-decimal | 1 (`ezingu-1,5`) | comma → clause pause |
| colon clock | 15 raw / **12 real** (3 are sports times) | colon → clause pause |
| dot/comma clock + TZ | 3 (`12,00 GMT`, `0230 UTC`, `15.00 UTC`) | dot/comma → break |
| ranges | **16** (13 spans, 3 scores/season) | no joiner |
| abbreviated units | 22 | raw letters |
| rate (`km/h`,`m/s`,`mph`,`kph`,`Mbit/s`) | 7 | denominator read as a letter |
| exponent (`km²`, `km2`, `mm2`) | 3 | unit match destroyed by the exponent |
| `sq mi` | 3 | `sq` → [skǃ] |
| currency signs | 9 real (+1 typo `endawe$ni`) | `US$` ×3 dropped; `AUD$` ×1 |
| percent | 4 | already read (`amaphesenti`) |
| degrees | 2 | ° dropped, scale letter → click |
| era markers | 6 (BCE ×4, BC ×1, B.C. ×1) | letter-spelled + pauses |
| dotted capital runs | 3 (`U.S.` ×2, `B.C.` ×1) + `W.` ×1 | spurious pauses |
| a.m./p.m. | 3 | `pʼ . m .` |
| ampersand | 2 (`&` ×1, `&amp;` ×1) | dropped |
| fraction | 1 (`1/5`) | "one five" |
| spaced dash (parenthetical) | **22** | dropped entirely — 22 lost pauses |
| all-caps initialisms | ~110 tokens / 70 acronyms | vowel-less clusters |
| prefix-hyphen-digit | 349 | see Run 2 |

---

## Run 4 — 2026-08-02 — sourcing every word the layer would emit

**Question.** Where does each emitted word come from? TOKEN-level (`grep -owE`), because Zulu writes long
spaceless words and a substring match would attest almost anything.

```
grep -owE '<word>' zu.col3 | wc -l
  amakhilomitha 3 · amamayela 10 · amamitha 2 · amafidi 2 · amaphawundi 1 · amasentimitha 1
  ngehora 6 · ihora 2 · amahora 3 · ngomzuzwana 2 · imizuzu 3 · imizuzwana 1
  amaphesenti 3 · skwele 3 · amazinga 5 · ingxenye 17 · entshonalanga 3 · enyakatho 6
  eningizimu 8 · empumalanga 4 · ekuseni 10 · ebusuku 7 · emini 6 · ntambama 1 · kanye 290
  ngaphambi 28 · kuka- 14 · amakhilogremu 0 · amamilimitha 0 · amadola 0 · Kristu 0 (as a token)
```

espeak has **no Zulu at all** — this is the trap-16 proof, not a feeling:

```
ls /home/chris/Programming/espeak-ng/dictsource/ | wc -l         → 439
ls /home/chris/Programming/espeak-ng/dictsource/ | grep -iE 'zul|^zu'  → (no output, exit 1)
find /home/chris/Programming/espeak-ng -iname '*zu*' -not -path '*/.git/*'
  → /home/chris/Programming/espeak-ng/android/res/values-zu        (an Android string resource)
```

The in-repo referee is `tools/referee-eval/referees/zu.epitran-zul-Latn.tsv` (1,053 lines) — a
*programmatic* epitran G2P output, so it corroborates PRONUNCIATION and carries no letter names, no
currency names and no measure vocabulary beyond what its word list happens to contain (`ihora`, `imayela`,
`isigidi`, `umzuzu` are there; `iphoyinti`, `ichashazi`, `amadola`, `amakhilogremu` are not).
`src/languages/zulu/tone.tsv` (1,060 lines, kaikki/Wiktionary) has the same four and no more.

**Implication, three decisions.**

- **`nemizuzu engu-N` for clock minutes is SOURCED COMPOSITION, not invention.** `imizuzu` ×3 and `umzuzu`
  (in tone.tsv *and* the referee) give the noun; the `na-` + `imi-` → `nemi-` coalescence is attested on
  15+ distinct class-4 lemmas in this corpus (`nemidlalo`, `nemithetho`, `nemikhumbi`, `neminyaka`,
  `nemizila`, `nemisebenzi`, `nemimoya`, `nemibuzo`, …); and the class-4 copulative concord `engu-` is
  attested on a digit run in `iminyaka engu-40`.
- **There is NO Zulu decimal-point word in any source.** Not the corpus, not the referee's 1,047 words, not
  the tone lexicon, and espeak has no Zulu. Per the standing rule (a wrong point word is worse than a
  missing one — Fula's `tere`) the dot is read as a boundary and the fractional digits are spoken
  individually. **Rejected candidate:** `nengxenye` ("and a part") for `.5`, on the Hausa `da rabi` model.
  The corpus's own 17 instances of `ingxenye` gloss it as PART, never HALF (`ingxenye yesithathu` = a
  third, `ingxenye enkulu` = a large part), so "one and a part" is not "one and a half". Dropped.
- **Initialisms: the seam exists, is checked, and is INERT for Zulu.** `src/core/initialisms.ts` is wired
  by 37 language files. Read it: `spellOut()` returns `undefined` the moment ANY letter has no name, and
  the caller then leaves the token alone — so with no `letterName` table the acronym branch is a literal
  no-op on all ~110 tokens. There is no Zulu letter-name table in espeak (none exists), the referee, or
  the corpus. Wiring the pass would change nothing except the dotted-initial handling, which this layer
  does directly and more legibly in four lines. Deferred WITH the measurement; same conclusion Swahili
  reached, and for the same verified reason.

---

## Run 5 — 2026-08-02 — settling each ambiguous reading from the corpus

**Range joiner.** `kuya ku-` ×6, and attested taking a DIGIT operand — `abantu abangu-8 kuya ku-100`,
`ku-US$11,000 kuya ku-US$22,500`, `kusukela ngomhla ka-24 Agasti kuya ku-5`. The `ku-` is class-17
locative and **invariant**, which is exactly why it is the right joiner: nothing about it has to agree with
the value of the digits (trap 14 cannot arise). Ascending-only, on Swahili's measurement: of the 16 `N-N`
shapes, 13 ascending ones are genuine spans (`1469–1539`, `1644-1912`, `1894-1895`, `1418 – 1450`,
`120-160`, `100-200`, `35-40`, `56-64`, `10 -11`, `3-5`, `2-5`, `2-3` ×2) and the 3 non-ascending are the
season `1995-96` and the scores `26 -00`, `5-3`/`7–2`. `4.2-3.9` (million years ago) is a genuine but
DESCENDING span and is deliberately left alone rather than mis-joined.

**Clock.** 12 real colon clocks; 3 sports times (`4:41.30`, `2:11.60`, `1:09.02`) excluded by requiring no
third `.dd` field. `10: 08` and `9: 30` put a SPACE after the colon — a `:\s?` is needed, and it is safe:
of the corpus's 43 colons, only those six match `: ?\d\d` and none is a clause colon. The hour NOUN is not
added (trap 12): every one of the 12 is already introduced by `ngo-`/`ngawo-`/`kuka-` ("at [the hour]"),
and the corpus writes the noun explicitly when it wants it (`ngehora lika-10 namuhla ekuseni`). a.m./p.m.
→ `ekuseni` ×10 / `ntambama` ×1, the corpus's own half-day words.

**Degrees.** `amazinga` ×5 ("degrees/levels", and `amazinga okushisa` = degrees of heat is the corpus's own
temperature phrase). Compass letters → the corpus's own direction words. `°C`/`°F` keep the scale name
untranslated — `Celsius` is unattested in every source, and the sentence carrying the only `°C`
(`amazinga okushisa angaphezu kuka-+30°C`) already says it is a temperature.

**Fraction** (×1, `u-5 mm (1/5 yintshi)`). `ingxenye ye<ordinal>` is the corpus's own fraction shape:
`ingxenye yesithathu` ×2 (a third), `ingxenye yesine` ×1 (a quarter). The 5–10 ordinals compose from the
same `yesi-` frame over stems already in `zulu.jsonc`. NB `ishumi` is class 5, so 10th is `yeshumi`, NOT
`*yesishumi` — which is why the table is explicit rather than derived (trap 13).

**Ampersand** → `kanye ne-`, attested ×13 in exactly that hyphenated-before-a-foreign-token shape
(`kanye ne-NPWS`), out of `kanye` ×290.

**Era markers** → `ngaphambi kukaKristu`. `ngaphambi` ×28, `kuka-` ×14, and `Kristu` as a STEM ×2 —
`ubuKristu` / `yobuKristu` ("Christianity"). Stem-level attestation is the honest description: `Kristu`
never appears as a bare token in this corpus.

---

## Run 6 — 2026-08-02 — ordering, and the one seam Zulu cannot use

**Question.** normalize.ts runs BEFORE the shared tier (`SYMBOLS(normalizeZulu(input))`, the Fula/Hausa
order). Which rules then destroy the number↔symbol adjacency the tier needs?

**Finding.** Only the decimal rewrite. Five instances sit against a tier symbol: `$14.7`, `$2.3` (currency
BEFORE), `12.8 km`, `2.2 km2`, `3.50 m` (unit AFTER). Per trap 14's second clause the decimal rule claims
them itself, in three ordered passes (currency-decimal, unit-decimal, plain decimal) — the same shape
Hausa uses at its step 7.

**The one tier gap, MEASURED and NOT fixed (`src/core` is the reviewer's call).** Zulu's rate is a single
agglutinated word: `nga-` + `ihora` → **`ngehora`**, attested ×6 as "per hour"
(`amakhilomitha angu-240 ngehora`, `yamamayela angama-105 ngehora`, `amamayela ayi-149 ngehora`).
`makeSymbolNormalizer` emits a rate as FOUR tokens, `${num} ${head} ${per} ${denominator}`, and requires
both `per` and the denominator word to be defined — so a two-token Zulu rate (`amakhilomitha ngehora`)
cannot be expressed in `unitPer`/`rateDenominators` without either a stray empty token or splitting
`ngehora` across two slots. The rate therefore stays LOCAL, which is the same call Korean (시속, a prefix),
Italian (`chilometri orari`, an adjective) and Polish (`na` + accusative) made. **Blast radius if it were
fixed in core:** it needs a new `ratePhrase`-style shape, i.e. a new field, not a bug fix — reporting, not
touching.

**What the tier DOES take.** `exponentWords: { squared: ["skwele"], position: "after" }` is exactly the
corpus's own order — `amakhilomitha skwele angu-783,562` ×3 — so the exponent needs no local rule. And
adding the multi-character keys `US$` and `AUD$` to `currency` fixes both currency defects with data
alone; the tier has supported multi-char keys since the Polish run.

---

## Run 7 — 2026-08-02 — implementation, gates, and reading the whole diff

See the PR body for the final gate numbers. Notes kept here:

- The de-grouping rule requires EXACTLY 3-digit blocks, which is what keeps the comma-clock `12,00 GMT`
  and the comma-decimal `ezingu-1,5` out of it. Both then get their own rule.
- The lone-capital-initial rule (`uJoji W. Hlathi`) was checked for the sentence-boundary false positive
  the shared pass documents: `perl -nle 'print for /\S+ [A-Z]\.(?=\s+[A-Z])/g'` finds **exactly one match
  in 1,478 utterances**, and it is the genuine initial. Zero sentence-final periods at risk.
- The spaced-dash rule is LAST, so the range rule has already claimed every dash between two numbers — the
  rugby score `26 -00` must keep its bare juxtaposition and must not gain a pause.

---

## Run 8 — 2026-08-02 — the corpus diff found a defect in MY OWN rule

**Question.** 101 utterances changed. Read every one — the playbook says both the lb and om reviews found
their worst defect here and nowhere else.

**RAW FINDING.** Two lines showed the de-grouping rule doing NOTHING where it should have:

```
SRC  … esingamaphawundi angu-1,000, futhi zihamba cishe ngamamayela angu-17,500 ngehora, …
     angu-17,500 → izinkulungwane ishumi nesikhombisa amakhulu amahlanu   ✔ fixed
     angu-1,000, → kunye , iqanda ,                                       ✘ UNCHANGED
SRC  … ngamaphuzu angu-2,220 nangu-2,207.
     angu-2,220  ✔ fixed        nangu-2,207. ✘ UNCHANGED
```

The trailing guard was Swahili's `(?![\d.,])`, copied verbatim. With the MARK in the class, a grouped number
that is immediately followed by its sentence's own comma or period does not match at all, because the
lookahead sees that mark.

```
perl -nle '$n++ while /(?<![\d.,])\d{1,3}(?:,\d{3})+(?!\d)/g;      END{print}'         → 34   (all grouped)
perl -nle '$n++ while /(?<![\d.,])\d{1,3}(?:,\d{3})+(?=[.,](?!\d))/g; END{print}'      → 6    (missed)
  abangu-9,000,  angu-1,000,  kuka-5,000,  nangu-2,207.  ngo-2,243,  ngu-100,000.
same shape on dot-decimals: 1.1.  → the interior dot survived as a pause                → 1    (missed)
```

**18% of the class, and the inconsistency is the tell** (trap 17's third bullet): right where the number
stands alone, wrong right where a clause boundary follows it. Fixed to `(?!\d)` for de-grouping and
`(?!\.?\d)` for the decimals; re-verified that the clause pause SURVIVES in all seven
(`angu-1,000, futhi` → `inkulungwane , futhi`).

**Not fixed, but measured, because one language / one branch.** `src/languages/swahili/normalize.ts` carries
the identical guard. Surveying every de-grouping rule in the repo: `cantonese` uses `(?![\d,])`,
`vietnamese` uses `(?!\d)`, and **swahili and zulu were the only two with the mark in the class**. Reported,
not edited.

**Three more defects found by reading my own output rather than the corpus:**

| found by | symptom | fix |
|---|---|---|
| probe of `+30°C` | `amazinga angu-30 C` — the retained scale letter still read as the CLICK [kǀ] | `°C` reads the bare degree phrase; `°F` keeps `Fahrenheit`, which has no click letter |
| probe of `4:41.30` | the clock rule correctly REFUSED the pace, and the colon then survived as a clause pause and `.30` split into "three zero" | a sports-time rule at step 5b, before the clock |
| probe of `3.50 m` | *kuthathu kuhlanu **iqanda** amamitha* — Zulu's zero word is `iqanda`, "egg" | trailing zeros stripped from the fraction (3.50 = 3.5); an interior zero is kept |

## Run 9 — 2026-08-02 — the review tool's two remaining lines

`review.ts --lang zu` failed `sign classes` on **minus plus equals less-than times**, all DROPPED. Corpus
counts: `=` 0, `<` 0, `>` 0, `×` 0, `÷` 0, `±` 0; `+` ×2; true negatives ×0 (both `-\d` hits are the score
`26 -00` and the century range `10 -11`). Every shipped language reads all five, so all five were sourced
from the corpus's own vocabulary rather than borrowed — see the step-14b comment for the counts. The
multiplication reading is the corpus's own idiom verbatim: `ingu-36mm ububanzi kuphindwe ngo-24mm ubude`.

The minus needed a SECOND lookbehind. Without `(?<![\p{L}\p{Nd}][  ])` the rule matched the ` -00` of the
rugby score and read it *ukukhipha iqanda*, "subtract zero" — a rule added for zero corpus instances
breaking one that exists. Pinned in the tests.

The tool's ordinary-text probe `5 000` also surfaced a class I had not counted: **space grouping ×1**
(`babalelwa ku- 100 000 abantu`), read as two numbers, *ikhulu iqanda* ("a hundred, zero"). Added, blocks of
exactly three digits only.

**The two artifact-scan lines that remain, argued rather than silenced.**

- `DROP math-sign ×1` — `amazinga okushisa angaphezu kuka-+30°C avamile`. The sentence's own `angaphezu`
  ("more than") IS the leading plus's meaning, so this is trap 12's REDUNDANT shape exactly: say it once, in
  the position the language puts it. Tried the alternative — letting step 14b claim the plus before the
  degree rule — and it produces `angaphezu kuka- no-amazinga angu-30`, two bound prefixes in a row and
  "more than AND 30 degrees". Worse. The `+` elsewhere IS now read (`UTC+1` → `UTC no-1`, verified in the
  corpus diff), so this is a context-specific redundancy, not an unread class.
- `DROP minus ×1` — `iwina ngo-26 -00 kalula`, a rugby score. Both candidate readings, "to" and "nil", are
  attested in no source available here, and the alternative I have (the subtraction verb) is confidently
  wrong. Left as the bare juxtaposition it has today — Swahili's decision for its 5 scores, and the same
  shape as the Burmese `DROP minus` the playbook cites as a correct non-defect.

## Run 10 — 2026-08-02 — final gates

```
npx tsc --noEmit                                              → clean
npx vitest run                                                → 201 files, 2745 tests, all passing (was 2744)
npx tsx tools/normalization/mine.ts scan --lang zu            → DROP math-sign ×1 · DROP minus ×1  (both argued above)
npx tsx tools/normalization/review.ts --lang zu               → every checklist line ok except `[ ?? ] sourcing  amadola`
npx tsx tools/referee-eval/eval.ts zu                         → 1047/1047 (100.0%), symbol accuracy 100.0% — IDENTICAL to Run 1
npx tsx tools/normalization/corpus-diff.ts compare            → changed 106/1478 (7.2%)
                                                                 DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · THROW 0
                                                                 DROP 5 → 1
```

**`[ ?? ] sourcing amadola`.** This word already ships in `main` as the tier's `$` reading; this branch adds
it to the new `US$` and `AUD$` keys. It is in no source the tool can check — not the corpus, the artifact,
the epitran referee's 1,047 words, the manifest, or espeak (which has no Zulu). The corpus writes a currency
sign ×9, so the reading is needed. `idola`/`amadola` is the class 5/6 loan, the same `ama-` + borrowing frame
as `amaphesenti` ×3, `amaphawundi` ×1 and `amakhilomitha` ×3, all of which ARE attested here. **Stated as an
assumption, not a source** — and it is exactly the residue the playbook describes as the right thing for
that prompt to report ("12 words in 9 languages, every one a currency borrowing the language plausibly uses
but no in-repo source records"), the same state Luxembourgish shipped `Yen` in.

**One thing I looked at and left alone, recorded because it is the largest single reading defect in the
language and it is NOT this layer's.** All 349 prefix-hyphen-digit forms emit the bound prefix as a
STANDALONE prosodic word with its own penultimate stress and length: `ngo-2007` → `ŋɡ̤ˈɔː iz̤iŋkʼuluŋɡ̤wˈaːnɛ …`
where `ngo-` should be unstressed and part of the following word's prosodic domain. The same is true of
every hyphen-prefixed FOREIGN word (`i-Manchester`, `e-Nagasaki`), which is the `latin-in-native` cell at
1,473 utterances. Fixing it means fusing the prefix with the following stem, i.e. Zulu morphophonology
(`ngo-` + `izinkulungwane` → `ngezinkulungwane`) in the WORD engine, not a symbol rewrite. Measured and
reported; deliberately out of scope.
