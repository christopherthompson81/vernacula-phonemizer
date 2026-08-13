# RAW-LATIN leaks in jv, mos, kmr, ak, sn — investigation

The `RAW-LATIN` detector (`rawLatinIn`, commit `9a3626c`) reports a raw ASCII run that the SOURCE typed and
the IPA still says, verbatim, with no vowel letter in it. Five languages that already HAVE a normalization
layer are in scope here. The question this log answers is not "how do we make the counter go down" but
"what IS each run", one hit at a time.

## Run 1 — 2026-08-13 07:34

**Command.** `npx tsx probe-rlscope.scratch.mts`, then a per-hit dump of the same detector over each
language's mined artifact printing the run, ±70 characters of source, and the resulting IPA.

**Question.** What is every one of the 67 hits, actually?

**Raw finding — the baseline.**

```
jv    15 hits / 250 lines   pp:3 mg:3 lsp:2 nd:1 km:1 kn:1 tmr:1 mdpl:1 pm:1 ft:1
mos   15 hits / 234 lines   th:10 st:2 ml:1 pdf:1 ft:1
kmr   13 hits / 251 lines   hwd:3 pp:2 fvt:1 mg:1 dl:1 tr:1 qf:1 rw:1 dt:1 sm:1
ak    12 hits / 198 lines   km:7 ft:1 php:1 lb:1 fr:1 vs:1
sn    12 hits / 241 lines   hr:3 hrs:3 pm:2 ft:1 pp:1 ksn:1 msk:1
```

Read hit by hit, these are **six** different problems, not one:

**(a) English ordinal tails and bibliographic residue, inside lines that are not in the target language
at all.** This is the largest single population in the group and none of it is a defect of the layer.

* `mos th:10` — every hit is the English phrase *"…th Parliament of the 4th Republic of Ghana"* or a
  wiki-project page title carrying it. Two of the ten lines are pure English metadata
  (*"Wikidata items must have the Position held (P39) property set…"*). Mooré writes no `Nth`.
* `mos st:2` — `(1st ed.)`, both inside an English bibliographic citation of an English book.
* `mos pdf:1`, `jv pp:3`, `kmr pp:2`, `sn pp:1`, `ak vs:1` — citation apparatus. jv's three `pp.` are all
  inside *Journal of Chemical Physics* references; kmr's two are *International Journal of Kurdish
  Studies*; sn's is *Zambezia*; ak's `vs.` is an English album title (*Tinchy Stryder vs. Maniac*).
* `jv nd:1` — the line is `Lambers, H., Chapin, F.S. III and Pons, T.L. 1998. Plant Physiological
  Ecology. … 2nd compltely revised edition`. The run is the `nd` of **2nd**: an English ordinal, in an
  English sentence, misspelling included.
* `kmr fvt:1` — `li ser fvt` in an article about Sweden translated from a Scandinavian source; `fvt.` is
  the Norwegian/Danish *før vår tidsregning* ("before our era"), the foreign counterpart of the
  `berî zayînê` this layer already declares. Foreign residue, not a Kurmanji abbreviation.

**(b) URL and markup residue.** `kmr tr/qf/rw/dt/sm` are five runs from ONE line, and that line is a bare
library-catalogue URL with a percent-encoded query string
(`…/default_tr/qf$003dLANGUAGE$002509Dil…$0026rw$003d0$0026…`). `ak php:1` is
`//tw.wikipedia.org/w/index.php?title=…`. Not prose in any language.

**(c) Genuine units the layer can and should read.**

* `jv mg:3` — milligram, four separate corpus instances in a nutrition table (`14 mg kalsium`,
  `49 mg saben 100 g`, `80-100 mg saben dina`, `1,1&nbsp;mg besi`). The layer declares `g`, `kg`, `mm`,
  `cm`, `km`, `l`, `ha` and NOT `mg`. A missing key.
* `sn hr:3 / hrs:3` — `(8hr)`, `(8hrs)`, `06:00hrs`. The layer declares `hr`/`hrs` as **rate
  denominators** only (`awa`, the `/h` slot), so a bare count of hours has no key at all.
* `kmr mg:1 / dl:1` — `10 heta20 mg/dl`, a blood-chemistry concentration. `mg` is undeclared; `dl` is
  undeclared as a denominator.

**(d) Units with no word to give them — the honest refusals.**

* `ak km:7` — **all seven are `km²` or `km2`.** See Run 2; this is the answer to "ak declares `km` and
  still reports `km:7`".
* `jv km:1` — recorded here on the first pass as `132,000&nbsp;km²`, the same shape as ak's. ⚠ **THAT WAS
  WRONG AND IS CORRECTED IN RUN 4.** jv declares `persegi` and reads that figure correctly; the reported
  run is a SECOND `km` later in the same line, `864 jiwa sa-km²`, behind a hyphen-bound proclitic. The
  first-pass error came from printing context around the run's FIRST occurrence in the line instead of the
  one the detector matched — worth keeping, because the same mistake would misclassify any short run.
* `jv ft:1` — `1 m³/s = 35.51 ft³/s`, an imperial rate with a cube. `mos ft:1` — `1.73m(5ft 8in)`.
  `ak ft:1` — `(a ɛne 1739 ft yɛ pɛ)`. `ak lb:1` — `(7+1⁄2 lb)`. `sn ft:1` — `(3900 ft)`.
  `mos ml:1` — `85 kilometr (53 ml)`, and `ml` here is **miles**, not millilitres: 85 km = 52.8 mi.
  Every one is an imperial figure inside a parenthetical that GLOSSES a metric figure already given in
  the same sentence. sn's layer already states this refusal explicitly for `ft in oz mi`.

**(e) Abbreviations of the language's OWN words — expandable, if sourced.**

* `jv lsp:2` — `lsp.` = *lan sapanunggalané* ("and so forth", = etc.). Both hits are in Javanese prose.
* `jv kn:1`, `jv tmr:1` — `kn.` and `tmr.` are lemma labels quoted from Poerwadarminta's *Baoesastra
  Djawa*; the line is a dictionary entry transcribed into the article.
* `jv mdpl:1` — Indonesian *meter di atas permukaan laut*, in a Javanese sentence.
* `kmr hwd:3` — `hwd.` = *her wekî din* ("and so on"). Two hits sit in Kurmanji prose
  (`… gaomatrik û û hwd bi hevdû`, `… agirî û hwd bûn`), one in a parenthetical list
  (`C++, Python, Java...hwd.`). See Run 6.

**(f) A mention, not a use.** `sn ksn:1`, `sn msk:1`, `sn pm:2` are all in ONE three-sentence passage whose
subject IS the abbreviation: *"MSK - ari kubva pakuti 'masikati', saka panonzi 12pm tinoti
maguminembiri emasikati (12msk)"* — "MSK comes from *masikati*, so where it says 12pm we say twelve
noon (12msk)". The sentence defines the letters. Reading them as words deletes the lesson.
(The third member of the set, `6mdk`, is NOT reported: the engine reads its ⟨d⟩ as [ɗ], so the output
token is not byte-identical with the source and the differential correctly declines.)

**Implication.** Class (c) is the only population where the answer is "declare a key". (e) needs sourcing
before anything is written. (a), (b), (d) and (f) must stay visible or be accepted with the reason
attached — they are not repairable by this layer, and three of them (a, b, f) are cases where the CORRECT
reading of the line is the raw letters.

## Run 2 — 2026-08-13 07:38 — ak: why a DECLARED `km` still reports

**Command.** A count of every `km` token in ak's artifact, split by whether an exponent follows;
then `attest.ts --lang ak --words ahinanan,square --wiki tw` and `--wiki fat`.

**Question.** ak declares `km → kilomita` and reads `12 km` correctly. Why does the scan report `km ×7`?

**Raw finding.** The artifact writes `km` **19 times. 8 of them are `km²` or `km2`; the other 11 read
*kilomita* already.** So the leaking population is exactly the squared one, and the cause is not the
table — it is step 4's lookahead `(?![\p{L}\p{M}\d²³])`, a DELIBERATE refusal recorded in the file's own
header: *"NO SQUARE/CUBE WORD, so step 4 REFUSES a unit key followed by `2 3 ² ³` … reading `km²` as
*kilomita* would state an area as a distance."*

Then the refusal turned out to rest on a sourcing gap that has since closed. tw.wikipedia has a **km²
article** which glosses the word against the symbol twice:

> *"Kilomita ahinanan, agyiraehyɛde km2, yɛ beae a wɔsusuw"*
> *"ahinanan a n'afa horow tenten yɛ 1 no kɛse km yɛ kilomita ahinanan biako"*

`attest.ts` → `ahinanan` 20 tokens / 6 articles on tw, and fat.wikipedia uses it in running text in the
measure slot four separate times: *"kilomita ahinanan 77,360 (akwansin ahinanan 29,870)"*, *"kilomita
9,130 ahinanan"*, *"akwansin 2,000 ahinanan (5,200 km2)"*, *"kilomita asia ahinanan"*.
`square` is attested too and is NOT the candidate: every hit is a proper name (*Black Star Square*,
*Independence Square*) or English running text (*"2,511 square kilometers"*).

⚠ The four instances disagree about where the FIGURE goes and agree that the modifier follows the UNIT
NOUN. This layer already emits the figure first on its own attested grounds, so the arm appends the
modifier to the unit word and leaves the numeral where the file's existing evidence puts it.

**Implication for the fleet, which is the part worth carrying past ak.** *A declared unit that still
reports is a signal to look at the EXPONENT, not at the table.* The guard the rule could not reach was
not a bracket or an `&nbsp;` — it was the layer's own square/cube refusal, which is invisible from the
unit table and reads as a missing key from outside. One further instance (`973.78|km²`) was out of reach
for a different reason: a wikitext table pipe in the number-unit gap, the artifact's only `|`, folded to a
space alongside `&nbsp;` in step 1 on the grounds that the character is already silent.

`ak km 7 → 0.` Golden `test/akan.test.ts` "units" changed and is justified in place.

## Run 3 — 2026-08-13 07:41 — sn: the hour, and a units key that was measured WRONG

**Command.** Add `hr: ["maawa"], hrs: ["maawa"]` to shona.ts `units`; re-read the six affected artifact
sentences through the engine. Then move the reading into normalize.ts as a local step and re-read.

**Question.** `hr`/`hrs` are already declared as rate DENOMINATORS (`awa`). Is promoting them to `units`
the fix for the six bare-count hits?

**Raw finding — NO, and it broke two things at once.**

```
before   50 km/hr   → makiromita makumi maʃanu pa awa      (correct, attested)
after    50 km/hr   → makiromita makumi maʃanu pa maawa    ← REGRESSION
before   06:00hrs   → tan̤atu , zero hrs
after    06:00hrs   → tan̤atu , maawa zero                  ← "six, HOURS ZERO"
```

A `units` key is matchable as a denominator too — shona.ts's own `l`/`rita` note says so — so declaring
the head form silently replaced the attested rate word. And the tier has no way to decline the MINUTE
half of a 24-hour clock, so it attached the noun to `00`, which is a confidently wrong quantity where the
previous reading was merely raw.

Claimed locally instead (normalize.ts step 7b, beside the `1.5m` case that is there for the same class of
reason), with the colon in the lookbehind. **`06:00hrs` therefore KEEPS ITS RAW `hrs` and stays
reported** — Shona has no attested 24-hour-clock reading (the layer's own NO CLOCK finding) and a visible
leak beats an invented one.

The noun itself needed no new sourcing: `maawa` 31 tokens / 16 articles, every readable example the time
unit (*"North pole inowana 24 maawa echiedza"*, *"kukotsira maawa manomwe kusvika masere (7-8)"*), and
the artifact's own maths lesson glosses the abbreviation against it in the next clause — *"panobhadhara
$60 pazuva (8hr). Kana akashanda 6 AWA anenge…"*, *"N anomirira AWA dzashandwa pazuva"*. That is the
`65kg` shape.

`sn hr 3 → 0`, `hrs 3 → 1` (the clock, deliberately).

## Run 4 — 2026-08-13 07:42 — jv: a missing SI key, and a residual the tier cannot reach

**Command.** `attest.ts --lang jv --words miligram,milligram`; then a re-read of the artifact.

**Raw finding.** `miligram` 40 tokens / 13 articles, in the measure slot after a figure (*"Kalium (K) 133
miligram"*, *"Fosfor (P) 12 miligram"*, *"Vitamin C 34,4 miligram"*) and DEFINED against the gram in
jv.wikipedia's gram article — *"1 miligram = 0.001 gram"*. The corpus writes the abbreviation six times
in one nutrition table. The attested spelling is taken over the one this file's ⟨è⟩ register would
compose: the metre words carry ⟨è⟩ because the wiki writes them that way, and the gram words do not for
the same reason. `milligram` ×2 (the Dutch double ⟨l⟩) is the loser.

⚠ Checked, not assumed: the same tables write `Magnesium (Mg)`, and the bare-unit path is EXACT CASE, so
the element symbol is untouched. `jv mg 3 → 0`.

**The residual `km ×1` is a different shape, and it is NOT `132,000&nbsp;km²`** — that one reads
*kilomèter persegi* correctly. Locating every `km` in the reported line gives:

```
kapadhetané wonten 864 jiwa sa-km².
```

`sa-` is a Javanese proclitic ("one/each") written bound with a hyphen, and the tier's unit key is
hyphen-bounded on the left precisely so a compound is not split — the same collision Shona's step 2
solves for `ye$150`. **Left reported.** Shona's local split exists on two instances; this is one, the
expansion of `sa-` in this slot is not sourced, and a rule built from a single hit is trap 9. Recorded
here so the next reader sees the shape rather than re-deriving it.

## Run 5 — 2026-08-13 07:40 — mos: measured over the Mooré subset, as the brief requires

**Command.** `filter-by-language.py --lang mos` over the 234 artifact lines, then the same detector with
each hit tagged by whether its line survived the filter.

**Raw finding.**

```
kept 174 (74.4%)   dropped: contrast 47 (20.1%)   dropped: undecidable 13 (5.6%)

  th    all:10  in-subset:7      st  all:2  in-subset:0
  ml    all:1   in-subset:1      pdf all:1  in-subset:0
  ft    all:1   in-subset:1
```

Reading the seven surviving `th` lines: they are MIXED — Mooré prose carrying an English proper name.
*"A yaa Ghana 4th Republic wã tẽnga taoor soab yʋʋm 2009"*, *"Manhyia North Constituency"*,
*"Gana Republikã Naas (4th Republic) Parlament Sen Paasra Nii (8TH Parliament)"*. The line is Mooré; the
RUN is inside an English span within it. So the filter is doing its job and the residue is intra-line,
which the filter cannot reach by construction.

**Negative result worth keeping: the fleet's existing foreign-span escape hatch CANNOT help here.**
`inForeignSpan` counts NATIVE-SCRIPT characters against Latin ones, and `mine.ts` sets `nativeRe =
undefined` whenever the dominant script IS Latin. So the mechanism that lets a Khmer sentence carry an
English clause without failing the gate is structurally unavailable to every language in this group — all
five are Latin-script. That is why `th`, `st`, `pp`, `pdf`, `php`, `vs`, `nd` are LEFT REPORTED rather
than accepted: there is no instrument here that can tell "English inside Mooré" from "Mooré", and
inventing a per-language string list for English ordinal tails would be the unit-abbreviation list that
Run 1 of the detector's own investigation already measured and rejected.

**Nothing is declared for mos.** `ml` is MILES (85 km = 52.8 mi), inside a parenthetical that glosses a
metric figure the sentence has already given; `ft` is `1.73m(5ft 8in)`, the same shape. sn's layer states
that refusal for `ft in oz mi` explicitly and mos inherits the reasoning. `mos 15 → 15`, all classified.

## Run 6 — 2026-08-13 07:44 — the abbreviations of the language's OWN words: two ties, no gloss

**Command.** `attest.ts --lang jv --words lsp,"lan sapanunggalané","lan sapiturute",lss`;
`attest.ts --lang kmr --wiki ku --words hwd,"her wekî din","û hwd"`; then an `insource:` search on each
wiki for the abbreviation written beside its expansion.

**Question.** `lsp` (jv) and `hwd` (kmr) are abbreviations of native phrases, not foreign residue. Can
either be expanded?

**Raw finding — NO, for the same reason twice.**

* jv `lsp` is attested 43 tokens / 20 articles, all of it USE (*"wong, kéwan, tuwuhan, lsp"*). Two
  candidate expansions are attested and effectively TIED: `lan sapanunggalané` 25/20 and
  `lan sapiturute` 23/20. Nothing on jv.wikipedia writes the abbreviation beside either
  (`insource:/lsp\.? \(lan/` → **0 hits**).
* kmr `hwd` is attested 40 tokens / 20 articles, always in the frame `… û hwd.`. `her wekî din` is
  attested 6/5 — and READING THE EXAMPLES sinks it as the expansion: every hit is a discourse adverbial
  ("likewise, also"), *"û her wekî din wênesaz, peykervan û hunermendên din"*, *"Her wekî din çemekî
  ku…"*, never a list-terminating "and so on". That is the Fula `hakkunde` shape — a real word whose slot
  is not the slot needed. `insource:/hwd\.? \(her wekî din/` → **0 hits**.

**Both LEFT REPORTED.** Two co-equal expansions with no gloss tying either to the abbreviation is not an
attestation, and picking by count would be trap 37. jv's `kn`, `tmr` (Baoesastra lemma labels quoted
inside an article) and `mdpl` (an Indonesian abbreviation in a Javanese sentence) are left with them.

**And kmr's `mg`/`dl` is a THIRD refusal, on a different argument.** `mîlîgram` is attested 5/5 — the
corpus's own sentence is one of the hits — but its single artifact instance is the rate `10 heta20 mg/dl`,
and `desîlître` is **×0** as a token (ku.wikipedia writes it spaced, *"bi qasi 1 desî lîtreye"*) while
`di desîlîtreyê de`, the circumfix this layer would need, is ×0. So the tier is right to decline a rate
whose denominator has no reading, declaring `mg` alone would be a key with zero readable instances
(trap 9), and the leak is semantically free anyway: the sentence has ALREADY said it in words —
*"Desîlîtreyek xwîna mirov 10 heta 20 mîlîgram (10 heta20 mg/dl)"*. The parenthetical is redundant.

## Run 7 — 2026-08-13 07:45 — ak's English foreign reader, probed rather than assumed

**Command.** `getPhonemizer("ak").text(w)` against `getPhonemizer("en").text(w)` for eight Latin runs.

**Question.** `registry.ts` builds ak as `createAkan((latin) => getPhonemizer("en").text(latin))`. If a
Latin run really reaches an English reader, a defect here hides as a plausible English word rather than
as gibberish, and the whole hit list has to be re-read with that in mind.

**Raw finding — the reader is DEAD CODE, confirmed empirically.**

```
February   ak→ febrwarj     en→ fˈɛbjəwˌɛɹi
square     ak→ skware       en→ skwˈɛɹ
hours      ak→ hwurs        en→ ˈaᶷɚz
Parliament ak→ parliament   en→ pʰˈɑːɹləmənt
```

`createAkan`'s body never references its `foreign` parameter; every Latin run goes through the Akan
`phonemizeWord`. The layer's header already recorded this and it still holds. So an ak defect surfaces as
Akan-ish gibberish, which is worse to listen to and BETTER for a scanner: it cannot masquerade as a
correct English reading. No hit in Run 1 needed re-classifying.

## Run 8 — 2026-08-13 07:47 — the defects.ts question, and where the counters land

**Question.** Which of the 67 hits should be ACCEPTED in `defects.ts` rather than declared or left?

**Raw finding — none of them, and the table says so itself.** The only per-language raw-Latin table is
`VOWELLESS_WORDS`, and its header states the boundary: an entry is *"a claim about the language's
PHONOTACTICS — that a particular vowelless string is a word or bound morpheme of the language"*, and
*"an entry naming a unit abbreviation would be a defect being silenced and belongs nowhere near this
table."* Every residual run in this group is an ABBREVIATION (`lsp kn tmr mdpl hwd ksn msk pm hrs`), a
foreign-language token (`th st nd pp pdf php vs fvt ml`), URL residue (`tr qf rw dt sm`), or a unit with
no word (`ft lb mg dl km`). Not one is a Mooré, Javanese, Kurmanji, Akan or Shona *word*. `defects.ts` is
therefore left untouched by this branch — the honest outcome, and the one that keeps every remaining hit
visible with its reason recorded here.

**Before → after, by language:**

```
          before                                      after
jv        15   pp3 mg3 lsp2 nd1 km1 kn1 tmr1 mdpl1 pm1 ft1     12   pp3 lsp2 nd1 km1 kn1 tmr1 mdpl1 pm1 ft1
mos       15   th10 st2 ml1 pdf1 ft1                           15   unchanged, all classified
kmr       13   hwd3 pp2 fvt1 mg1 dl1 + 5 URL runs              13   unchanged, all classified
ak        12   km7 ft1 php1 lb1 fr1 vs1                         5   ft1 php1 lb1 fr1 vs1
sn        12   hr3 hrs3 pm2 ft1 pp1 ksn1 msk1                   7   hrs1 pm2 ft1 pp1 ksn1 msk1
          ──                                                   ──
          67                                                   52
```

15 hits removed, all of them by giving a reader a word it did not have. The 52 that remain are the ones
where the raw letters are either the correct reading (a mention, a URL, an English span) or the honest
one (no sourced word). ⚠ `ak fr:1` is worth naming separately as the odd one out: it is
`wɔ fr3 no Atlético Madrid`, an ASCII substitution of Akan ⟨ɛ⟩ by a digit — `fr3` for `frɛ` — i.e. a
corpus spelling defect, not a normalization one.

## Run 9 — 2026-08-13 07:52 — the gates, and three runs the probe had not shown

**Command.** `mine.ts scan --lang X` and `review.ts --lang X` for all five; `corpus-diff.ts emit` from a
`git archive` of the parent commit into a scratch tree (no refs created) and `compare` against this tree;
`sources.ts --lang X` diffed against the same baseline; `tsc --noEmit`; `npx vitest run`.

**Raw finding — `mine.ts scan` reads MORE of the artifact than the probe does** (the probe reads the
`"text"` fields; the scan reads the hard set plus the whole sample tier), so it surfaces three runs the
Run 1 list does not have. All three fall inside classes already argued and none changes a verdict:

* `jv sms ×1` — *"Tilpun sèlulèr … SMS"*, an English initialism in a Javanese sentence. jv has no
  `letterName` table (`sources.ts` reports `[NONE] letter-names`), so it is the same sourcing block the
  layer already records for initialisms, not a units question.
* `mos lb ×1` and `kmr ft ×1` — imperial abbreviations in a metric-glossing parenthetical
  (*"kilogram … lb"*) and in an English sentence (*"triptych mural (45&nbsp;ft by 15&nbsp;ft)"*). Class
  (d) and class (a) respectively.

**corpus-diff, per language:**

```
ak    changed   7/237 (3.0%)   before/after both { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 26, THROW 0 }
jv    changed   3/448 (0.7%)   both { DIGIT 0, SLOT-GAP 1, RAWMARK 0, DROP 30, THROW 0 }
sn    changed   4/439 (0.9%)   both { DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 44, THROW 0 }
mos   changed   0/431          unchanged
kmr   changed   0/450          unchanged
```

14 changed readings in total against 15 removed hits — the arithmetic is right, because ak's `km²` and
`km2` co-occur on one line. **No defect counter moved in either direction**, which is the check that
matters: nothing was traded for the improvement.

**sources.ts, diffed line by line against the baseline:** exactly ONE line differs across all five —
`jv unit-word 8 → 9 unit word(s) in the symbol tier, all attested`. ak stays `[part] 3/4` (`milimita`,
pre-existing), sn stays `[part] 7/8` (`makirogiramu`, sourced outside the repo and recorded in shona.ts).

**review.ts:** every `[FAIL]` is pre-existing or deliberate — ak/sn/mos `sign classes DROPPED: minus`
(each layer records why no minus word is attested), and the `artifact scan` failures, which are the
residual RAW-LATIN hits this document classifies plus the same pre-existing drops. ak went 2 FAILING →
2 FAILING with `km` gone from the scan line; sn 2 → 2 with `hr` gone; jv 1 → 1 with `mg` gone.

`tsc --noEmit` clean. `npx vitest run`: **242 files / 3917 passed, 5 skipped**, one golden expectation
changed (test/akan.test.ts, the km² refusal) and justified in place.

**Final probe.** ak and sn have both left the top of the fleet list; mos, kmr and jv are unchanged or
reduced and every remaining hit is classified above.

```
mos 15   kmr 13   jv 12   ak 5   sn 7        (67 → 52)
```
