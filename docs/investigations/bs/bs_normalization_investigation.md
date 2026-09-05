# Bosnian (bs) text normalization — investigation log

Bosnian is the round the fleet had been saving for **trap 55** (*your closest sibling is a hypothesis, not a
source*). It has not one treated sibling but TWO — `src/languages/serbian/normalize.ts` (12 rules) and
`src/languages/croatian/normalize.ts` (14 rules) — and `bosnian.ts` already borrows Serbian's `phonemizeWord`
outright, which makes "copy the sibling" maximally tempting and maximally cheap to do wrong. The deliverable of
this round is therefore not the layer; it is the **re-measurement table** in Run 4.

⚠ THE CORPUS IS FLEURS ONLY. There is no `tools/corpus/mined/bs.jsonc` and none was created. Everything below
is measured over the **1,976 deduplicated utterances** of
`$ASR_ALIGN_ROOT/corpus/fleurs_transcripts/data/bs_ba/{train,dev,test}.tsv`, column 3 (the cased,
punctuated text). `mine.ts scan` is not applicable and was not run; `review.ts --lang bs` reports
`artifact tracked … missing`, which is expected and is not a failure of this round.

FLEURS is read-aloud news and is numerically SPARSER than a wiki dump. Baseline DROP is 10 where recent
wiki-sourced rounds opened at 63–130. A small DROP is not "nearly done": DROP counts symbol-drop classes only
and is blind to a grouping dot read as a sentence break, which is this language's single largest defect.

---

## Run 1 — 2026-08-16 — baseline, and the engine probed on every shape

**Commands.**

    npx tsx tools/normalization/corpus-diff.ts emit --lang bs --corpus bs_ba --out /tmp/bs-base.json
    npx tsx tools/referee-eval/eval.ts bs
    npx tsx tools/normalization/review.ts --lang bs

**Question.** What does the engine do today, and what instrument do I actually have?

**Raw finding.**

- `emit` → `emitted 1976 utterances`. Baseline leak summary: **DROP 10**, DIGIT 0, SLOT-GAP 0, RAWMARK 0,
  ZERO-WIDTH 0, RAW-CAPS 0, THROW 0.
- `referee-eval.ts bs` → **usage error**. `bs` is not in the tool's language list at all; there is no Bosnian
  referee dataset in the tree. **The referee gate is VACUOUS for this language, not green** — recorded here so
  nobody later reads its absence as a pass.
- `review.ts --lang bs` → `[FAIL] normalizer  src/languages/bosnian/normalize.ts missing`. Nothing else runs
  until the file exists.

**Engine probes** (`createBosnian().text(…)`, verbatim corpus strings). Every line below is a defect:

    6.387 km (3.980 milja)      ʃest . trista osamdeset sedam km  tri . deʋetsto osamdeset miʎa
                                — the GROUPING DOT is a clause break and the number is torn in half
    u januaru 2017. godine      dʋije xiʎade sedamnaest . ɡodine
                                — the ordinal reads as a CARDINAL plus a spurious sentence boundary
    između 06:30 i 07:30 sati   izmed͡ʑu ʃest , trideset i sedam , trideset sati
                                — the colon is clause punctuation; the clock reads as two numbers and a pause
    3,50 m                      tri , pedeset m          — decimal comma is a pause; `m` leaks RAW
    19.500 km²                  deʋetnaest . petsto km   — grouping dot AND the ² dropped in silence
    6x6 cm                      ʃest ʃest t͡sm            — ⚠ `cm` READ AS A WORD (c→/t͡s/), trap 56
    200 funti (90kg)            dʋjesta funti deʋedeset kɡ  — `kg` read as a word, not leaked
    480 km/h (133 m/s; 300 m/h) km x … m s … m x         — ⚠ the `/` is dropped and `h` is READ as /x/
    30 °C … 90 °F               trideset t͡s … deʋedeset f — degree dropped, scale letter read as a phoneme
    40 % stanovništva           t͡ʃetrdeset stanoʋniʃtʋa  — `%` silently gone
    30 $ ili 10 $               trideset ili deset       — `$` silently gone
    Arts & Sciences             arts st͡sient͡ses          — `&` silently gone
    29¾ sa 24½ inča             dʋadeset deʋet sa dʋadeset t͡ʃetiri  — both vulgar fractions gone
    7–2 · 120-160 · 10-60       sedam dʋa · sto dʋadeset sto ʃezdeset · deset ʃezdeset — the span fuses
    1970-ih                     xiʎadu deʋetsto sedamdeset ix — cardinal + a bare suffix as a word
    356. godine p.n.e.          … p . n . e .            — three spurious breaks and three letter names
    npr. / tj. / itd. / Dr. /
      str. / br.                npr . / tj . / itd . / dr . / str . / br . — leak + a break each
    35°Z                        trideset pet z           — the compass letter read as /z/
    trupe SAD-a                 trupe sad a              — ⚠ reads as the ADVERB *sad* ("now"), trap 56
    B&amp;B                     b amp , b                — the HTML entity, unfolded

**Implication.** The DROP counter sees the `%`, `$`, `&`, `°`, `²` and the fractions — ten of them, which is
the whole of the baseline 10. It does **not** see the grouping dot, the ordinal period, the clock colon, the
range dash, `cm`→/t͡sm/, `kg` as a word, `h`→/x/ or `SAD-a`→*sad*. Those are the majority of the damage and
every one is trap 56 shaped: a defect that produces a plausible READING. Sizing the classes has to be done by
hand against the transcripts, which is Run 2.

---

## Run 2 — 2026-08-16 — the class census, and three counts the brief had slightly wrong

**Command.** A hand tabulator over the deduplicated transcript column, one regex per class.

**Question.** How large is each class, in Bosnian, in its own writing?

**Raw finding** (occurrences, not utterances, over 1,976 utterances):

| class | count | note |
|---|---|---|
| `N.` + lowercase word | **208** | of a `N.`-total of 222 |
| grouping dot `1.234` | **47** | brief said 34 |
| unit km/m/mm/cm/kg/GHz/… | 49 | across 37 utterances |
| colon clock | **19** | brief said 17 |
| rate with `/` | 16 | `km/h` ×7, `m/s`, `m/h`, `mi/h`, `Mbit/s`, `milja/sat` |
| dotted abbreviation | 18 | `itd.` ×7, `Dr.` ×4, `npr.` ×3, `tj.`, `str.`, `br.`, `i dr.` |
| decimal comma | 16 | |
| hyphen + case suffix | 13 | all `NNNN-ih` decades |
| numeric range | 13 | |
| `SAD` / `SAD-a` | 17 | `SAD-a` ×10, bare `SAD` ×5–6 |
| percent | 4 | |
| ASCII `x` between digits | 4 | `6x6 cm`, `56x56 mm` |
| currency `$` | 3 | ⚠ all POSTPOSED: `30 $`, `10 $`, `45 miliona AUD$` |
| exponent `²` | 2 | `19.500 km²`, `3.850 km²` |
| degree `°` | 2 | `+ 30 °C`, `35°Z` |
| era | 2 | both `p.n.e.`, both preceded by a written `godine` |
| plus | 2 | `+ 30 °C`, `UTC+1` |
| vulgar fraction | 2 | `29¾`, `24½` |
| ampersand | 1 | and it is `&amp;`, the HTML entity |
| dot-written clock | **1** | and see below — it is not the shape Serbian's rule matches |
| `=` `<` `>` `÷` `±` `×` | **0** | not one instance of any |
| space grouping `1 234` | 0 | |
| zero-width | 0 | Croatian's step 0 has nothing to do here |
| `a/b` fraction slash | 0 | |

**Three corrections to the brief, all confirmed by re-reading the instances.**

1. Grouping dot is **47**, not 34.
2. Colon clock is **19**, not 17 — and the extra ones matter, because the 20th candidate is
   `pobjedu od 26:00 protiv petoplasirane Zambije`, a **football score**, correctly refused by the `2[0-3]`
   hour guard. The ilo trap is present in miniature and the sibling guard survives it.
3. The dot-written clock is `predstavila svoj izvještaj u 12.00 GMT` — and **Serbian's dot-clock rule requires
   a WRITTEN hour noun** (`(?=\s*(?:сати|часова|sati|časova))`). This instance is followed by `GMT`. So
   Serbian's rule fires **zero** times in Bosnian, not once. The correction runs in the same direction as the
   brief's point but is sharper than the brief stated it.

**Implication.** Both siblings' machinery is aimed at the right classes but the arithmetic-sign half of
Croatian's file (`=`, `<`, `>`, `÷`, `±`) has NOTHING to match in this corpus, and shipping it would be
unmeasured rules. Those five become `ACCEPTED_SIGN_SILENCE` entries. `×` is also ×0 as a glyph, but ASCII `x`
is ×4, so `multiply` IS declared — the tier's own note says an unhandled `x` reads as a letter name, and here
it does not even do that: it is dropped.

---

## Run 3 — 2026-08-16 — the ordinal licensors, and the union that is still not enough

**Command.** Tally every lowercase word that follows a `N.` in the corpus.

**Question.** Does either sibling's closed LICENSOR list cover Bosnian?

**Raw finding** — 32 distinct followers over the 208 instances:

    125 godine     11 stoljeća     7 septembra   7 jula      6 vijeku    6 avgusta
      4 vijeka      4 januara      4 marta       3 stoljeću  3 godini    3 i
      2 godinu      2 novembra     2 oktobra     2 ili       2 do        1 mjesto
      1 dana        1 kategorije   1 godina      1 dodan     1 februara  1 juna
      1 husarska    1 najvećim     1 gol         1 glasanjem 1 savjetovao
      1 pukovniju   1 zemlja       1 za

- **Croatian's list licenses 0 of the 39 month instances.** Its months are the Croatian-national set
  (`srpnja`, `rujna`, `kolovoza`, `listopada`, `siječnja`…). Bosnian writes the **international** set —
  `jula` ×7, `septembra` ×7, `avgusta` ×6, `januara` ×4, `marta` ×4, `oktobra` ×2, `novembra` ×2,
  `februara` ×1, `juna` ×1. Not one Croatian month name occurs anywhere in the corpus.
- **Serbian's list licenses 0 of the 14 `stoljeć-` instances.** Serbian carries `veka`/`veku`/`vek` and
  `vijeka`/`vijeku` but no `stoljeće` at all. Bosnian uses **both** century words side by side, in the same
  sentence: `vrhunac između 10. i 11. stoljeća i 14. stoljeća` beside `iz 17. vijeka`. `stoljeć-` ×14 vs
  `vijek-` ×10 — the two are near-equal here, which is a fact about Bosnian and not about either sibling.
- **The UNION still leaves 11 instances.** `i` ×3, `ili` ×2, `do` ×2, `dodan`, `glasanjem`, `savjetovao`,
  `za` — every one of them a YEAR with `godine` ELIDED (`Godine 1990. dodan je na spisak`,
  `Tokom izbora 1976. savjetovao je Cartera`, `od 1995. do 1996. godine`). Croatian's step 7b exists exactly
  for this and it ports; Serbian has no such rule.
- **Croatian's "what the list was leaving behind" additions RECUR verbatim in Bosnian**: `mjesto` (`190.
  mjesto`), `kategorije` (`oluja 4. kategorije`), `najvećim` (`7. najvećim otokom`), `husarska`/`pukovniju`
  (`britanska 11. husarska pukovnija`). ⚠ This is a property of FLEURS, not a coincidence: **FLEURS is a
  PARALLEL corpus**, so hr_hr and bs_ba are translations of the same source sentences. A sibling tabulation
  over FLEURS therefore transfers unusually well — and a sibling tabulation over a WIKI dump (Serbian's) does
  not. That asymmetry is worth naming, because it is the mechanism behind which sibling held.
- Bosnian-only followers the union misses: `dana` (`1. dana mjeseca`), `gol` (`60. gol u sezoni`),
  `zemlja` (`37. zemlja po veličini`).

**Implication.** The list that ships is: Croatian's non-month entries + the INTERNATIONAL months (Serbian's,
which are also Bosnian's) + `stoljeć-` (Croatian's, absent from Serbian) + `vijek-` (in both) + three new
Bosnian followers. Neither sibling's list alone is usable and the union alone is not sufficient; the elided-year
rule (Croatian 7b) is what closes the tail.

---

## Run 4 — 2026-08-16 — THE DELIVERABLE: every sibling rule re-measured against Bosnian

Rule by rule through both files. `held` = the shape occurs in Bosnian, in the same form, and the sibling's
guard fires correctly on it. `diverged` = the shape occurs but the sibling's rule is wrong about it here.
`absent` = the shape does not occur in Bosnian at all.

### Serbian (`src/languages/serbian/normalize.ts`) — 12 numbered rules

| # | rule | verdict | the count that decides it |
|---|---|---|---|
| 0 | period de-grouping, two passes, exactly 3 digits | **held** | ×47, and the guard's exclusions are all live here: `802.11a/b/g/n` ×2, `12.00 GMT` ×1, and 222 `N.` ordinals all correctly untouched |
| 1 | multi-dot era marker + year-ordinal before it | **diverged** | era ×2, but BOTH are `NNN. godine p.n.e.` — the licensor is WRITTEN, so the year-ordinal arm has ×0 to claim. And the ekavian expansion *pre nove ere* is wrong for ijekavian Bosnian: `prije`. Also `p.n.e.!` needs the `!` arm Serbian folds into "keep the dot" |
| 2 | dot-written clock, gated on a written `sati`/`časova` | **diverged** | dot-clock ×1 and it is `12.00 GMT` — the gate matches ×0 of 1. The Bosnian clock is COLON-form ×19 |
| 3 | dotted abbreviations `itd/npr/tzv` | **diverged** | `itd.` ×7 and `npr.` ×3 hold, but `tzv.` ×0, and the list misses `tj.` ×1, `str.` ×1, `br.` ×1, `Dr.` ×4. Also the Serbian expansion of `npr.` is *na primer*; Bosnian is *naprimjer/na primjer* (the corpus itself writes `Naprimjer,` as a word) |
| 3b | signs `±`/`+`/minus with three guards | **diverged** | `±` ×0. `+` ×2 and both are *positive* (`+ 30 °C`, `UTC+1`) — the spaced `+ 30` form Serbian's `\+\s?(?=\d)` does claim. Bare minus ×0: every hyphen before a digit in this corpus is a range or a designation (`Il-76`, `COVID-19`, `A1GP`, `SAD-a`), so the rule is retained ONLY in the guarded shape and reads nothing |
| 3c | `=` `<` `>` `÷` | **absent** | ×0 / ×0 / ×0 / ×0 — refused in `ACCEPTED_SIGN_SILENCE` |
| 4 | degrees, C/F arm then bare arm | **diverged** | `°` ×2. The C/F arm holds on `+ 30 °C`. The bare arm is where it breaks: the second instance is `35°Z` — Bosnian west is **zapad**, `Z`, and Serbian emits the degree noun with no compass reading while Croatian's compass allow-list is `[NSEWnsew]`, which matches NOTHING here. This is the ast→an `W`/`U` finding, one language over |
| 5 | numeral + hyphen + case suffix, paradigm-verified | **held** | ×13, all `NNNN-ih`, and the generate-and-match guard resolves every one to the pl.gen ordinal |
| 6 | `Mbit/s` and `m/s` composed locally as *u sekundi* | **held** | `600Mbit/s` ×1, `133 m/s` ×1, and the construction is INDEPENDENTLY attested in Bosnian prose in this same corpus: `brzinom od 1,5 kilometara u sekundi` |
| 6b | numeric ranges → *do* | **held** | ×13. The known false positives are present and behave as Serbian says: `7–2` and `5-3` are SCORES, and *do* is a wrong-ish connective on a pair that was fusing anyway |
| 7 | the `N.` ordinal, closed licensor list, lowercase gate | **diverged** | the mechanism holds exactly (the lowercase gate leaves the 1 capital-follower and the 12 utterance-final `N.` alone); the DATA does not — see Run 3, Serbian licenses 0 of 14 `stoljeć-` |
| 8 | colon clock, cardinal hour + counted noun, 2-digit minutes | **diverged** | ×19 and the SHAPE is right — but 10 of the 19 are FOLLOWED by a written `sati`/`časova` that neither sibling consumes, so the hour noun is emitted TWICE (`22:08 sati.` → *dvadeset dva sata i osam minuta SATI*) |
| 9 | the shared symbol tier | **held**, with different data | units ×49; `funti` is the WEIGHT pound here exactly as Serbian's `€`/`£` note predicts (`teži 200 funti (90kg)`), so no currency beyond `$` |
| 10 | decimal comma → *zarez* | **held** | ×16 |
| 11 | `x`/`×` and `+` | **held** | ASCII `x` ×4 (`6x6 cm`, `56x56 mm`), `×` ×0 — Serbian's own note that the ASCII form is the one that matters is confirmed |

**Serbian: 7 held, 7 diverged, 1 absent** of 15 arms counted separately.

### Croatian (`src/languages/croatian/normalize.ts`) — 14 numbered rules

| # | rule | verdict | the count that decides it |
|---|---|---|---|
| 0 | zero-width strip | **absent** | U+200B/200C/200D/FEFF ×0 in bs_ba. Croatian's corpus had ×5; not ported |
| 1 | de-grouping + en-dash range between two dotted years before an era marker | **held / absent** | de-grouping ×47 held; the dotted-range-before-era arm ×0 |
| 2 | era `n. e.`, `p. n. e.`, `pr. Kr.`, `g.` elision | **diverged** | `p.n.e.` ×2 held in shape; `n. e.` standalone ×0, `pr. Kr.` ×0, `g. n. e.` ×0. Expansion must be ijekavian *prije nove ere* (Croatian already is) but Serbian's *pre* is not |
| 3 | `itd.` three arms | **held** | ×7, and the three-arm split earns itself: `itd.)` ×1 (`… pripovijedanje priča itd.)`) needs the KEEP-the-dot arm and `itd. Za sva mjesta` needs the consume arm |
| 4 | dotted capital RUNS `\p{Lu}\.(\p{Lu}\.)+` | **absent** | ×0 — no `A. B.` run anywhere in the corpus |
| 4 | lone initial `George W. Bush` | **held** | ×3 (`George W. Bush` ×2, `Johna F. Kennedyja`, `Lyndona B. Johnsona`). Misses `N. Wayne` (preceded by `NASA-e`, whose hyphen defeats the lookbehind) and `T. reks` (lowercase follower) |
| 4 | `Dr.` → *doktor*, case-INSENSITIVE (`giu`) | **diverged — and this one is a real misreading** | `Dr.` ×4 all genuine. But the `i` flag also matches lowercase `dr.`, and Bosnian's corpus has `(James i dr. 1995)` — the academic **et al.**, which Croatian's rule would read as *doktor tisuću devetsto devedeset pet*. The fix is one flag: case-SENSITIVE |
| 4 | `SAD-` → *Sjedinjene Američke Države* (nominative) | **diverged** | `SAD-a` ×10 and it is GENITIVE — the nominative expansion leaves the case suffix stranded. And bare `SAD` ×5–6 currently reads as the adverb *sad* ("now"), a trap-56 misreading Croatian's `(?=-)` guard cannot reach |
| 4b | prenominal ROMAN ordinals `I. svjetski rat` | **absent** | ×0. No `[IVXL]+\.` before a lowercase word in bs_ba at all |
| 5 | degrees C/F + compass `[NSEWnsew]` | **diverged** | see Serbian #4 — Bosnian west is `Z` and the corpus's one bare degree is `35°Z` |
| 6 | hyphen + case suffix | **held** | ×13. ⚠ Croatian's trailing guard is `(?![^\p{L}\p{M}]|.)` where Serbian's is a plain not-a-letter; Serbian's is the one that survives `1970-ih;` and `1970-ih.` |
| 7 | `N.` ordinal, closed list | **diverged (data)** | see Run 3 |
| 7b | bare YEAR ordinal with `godine` elided, 1000–2100, period kept only at a sentence end | **held, and it is the single most valuable import** | 11 unlicensed lowercase followers + the 1 capital follower (`sjeverno od grada 1770. S vremena…`) + 1 utterance-final year (`prijestolnicu Samoe od 1959.`). The exclusion list earns itself too: the 12 utterance-final `N.` include `COVID-19.`, `Il-76.`, `ragbi 7.`, `tipa 1.` and `rezultat bio 6:6.`, and the `1\d{3}|20\d{2}` range plus the `(?<![\d.,\-])` guard declines every one |
| 8 | colon clock with optional `h` suffix, 3-field pace guard | **diverged** | the `h` suffix is ×0 in Bosnian; the written `sati`/`časova` is ×10 and is what needs consuming instead |
| 9 | ranges → *do* | **held** | ×13, and the ordering constraint holds: `Između 10:00 - 11:00 sati` REQUIRES the clock to run first, or the range rule eats the clock's own digits |
| 9b | `milja/h`, `milja/sat` rate | **held** | ×1 — `vjetrovi (često 100-200 milja/sat)`, the same sentence shape, in the parallel corpus |
| 10–11 | tier, decimal comma | **held** | |
| 12 | fractions `¾`, `½`, `a/b` | **held / absent** | `29¾ inča sa 24½ inča` ×2 (the same parchment sentence); `a/b` ratio ×0 |
| 13 | `&`, `x`/`×`, `±`, `+`, minus, `=`, `<`, `>` | **mixed** | `&` ×1 and it is `&amp;` — handled by the tier's entity fold, but Croatian's `\s&\s` arm alone would not see it; `±` `=` `<` `>` ×0 |
| 13b | `÷` → *podijeljeno s* | **absent** | ×0 |

**Croatian: 11 held, 6 diverged, 6 absent** of 23 arms counted separately.

### The ratio

**Serbian 7 held / 15 arms = 47 %. Croatian 11 held / 23 arms = 48 %. Combined 18 held of 38 = 47 %.**

That is markedly WORSE than the ratios trap 55 records elsewhere (an→ast four of six, rn→rw seven of ten,
ceb→hil three of four), and the reason is structural rather than linguistic: **Bosnian is the union-and-neither
case.** It takes Serbian's LEXEMES (`hiljada`, `milion`, the international months, `stepen`) and Croatian's
IJEKAVIAN reflexes (`prije`, `dvjesta`, `stoljeće`, `mjesec`) and belongs wholly to neither list. The single
sharpest instance is in the ordinal table itself, before any rule runs:

    Serbian  ORD_HUNDREDS[2] = "dvestoti"   ✗ ekavian — Bosnian is ijekavian
    Croatian ORD_HUNDREDS[2] = "dvjestoti"  ✓
    Serbian  ordinalBase(1000) = "hiljaditi" ✓
    Croatian ordinalBase(1000) = "tisućiti"  ✗ wrong lexeme — Bosnian keeps hiljada

**Neither sibling's ordinal table is correct for Bosnian, and the correct one is one cell from each.** No count
surfaces this; it is visible only by reading both tables side by side, which is the an→ast `°U` finding
generalised.

**Implication.** The layer that ships is neither file. It takes Croatian's structure (7b, the fraction arm, the
lone-initial arm, the three-arm `itd.`), Serbian's `/s` rate composition and suffix guard, one cell from each
ordinal table, and four rules that are Bosnian's own: the `sati` consumption, the `Z` compass, the
case-sensitive `Dr.`, and `SAD-a`.

---

## Run 5 — 2026-08-16 — sourcing

**Command.**

    npx tsx tools/normalization/attest.ts --lang bs --words "<100 words>" > /tmp/attest1.txt

⚠ The playbook allows SISTER-STANDARD sources to attest for one another (hr/sr/bs are three standards of one
language, and `SISTER_STANDARDS` in `defects.ts` already declares the set). **Where that licence is used below
it is named.** The FLEURS bs_ba corpus is a stronger tier than the wiki and was checked first.

**Attested in the Bosnian corpus itself** — the strongest tier available here, and it covers the
high-traffic words:

    posto        `29 posto anketiranih`, `46 posto glasova`, `90 posto sunčeve svjetlosti`   — the PERCENT word
    dolara       `2,3 milijarde dolara`, `novčanice od 5 i 100 dolara`                        — the CURRENCY word
    metara       `dugi su 378 metara`, `Brod dug 100 metara`                                  — the metre noun
    metra        `Dva tornja izdižu se 83 metra u visinu`                                     — the 2–4 form
    kilometara   `brzinom od 1,5 kilometara u sekundi`                                        — and the /s RATE
    u sekundi    same instance — the Serbian rate construction, in Bosnian prose
    milja/milje  `15 milja sjeverno`, `3.980 milja`                                           — the mile noun
    na sat       `1,5 kilometara u sekundi (3000 milja na sat)`                               — the /h rate
    puta         `uspio je sedam puta preći most`, `više puta proći`                          — the MULTIPLY word
    stepeni      `Putnicima je podijeljena voda dok su čekali na temperaturi od 90 stepeni F` — the DEGREE noun
    sati/sata    `u 10:00 sati ujutru`, `22:08 sati`                                          — the hour noun
    minuta       `(10-60 minuta)`                                                             — the minute noun
    naprimjer    `Naprimjer, „učenje“ i „socijalizacija“…`                                     — the npr. expansion
    prije        `čim prije`, `prije najave odgode`                                           — ijekavian, vs sr *pre*
    hiljadu      `hiljadu godina starih ruševina`, `Zemlja hiljadu jezera`                    — vs hr *tisuću*

**Words REFUSED this round, and why** (each was a candidate and each is left unread rather than guessed):

- **`Farenhajta`** — refused as a WORD-CHOICE only after checking: `°F` is ×0 in the corpus (the one Fahrenheit
  instance is the spelled `90 stepeni F.`), so the scale name is carried on a sister-standard attestation
  alone. The C/F arm ships because `°C` ×1 is real, but the F branch is documented as sister-sourced.
- **bare `SAD`** — ×5–6, and REFUSED. The instances are locative (`u SAD živi`), accusative
  (`pretekla je SAD`, `Stigao je u SAD`) and a bare apposition (`savezna država SAD`); one expansion cannot
  serve three cases. This is Serbian's own `Св.` refusal, exactly. Only `SAD-a`, whose written suffix NAMES the
  case, is claimed.
- **`tzv.`** — Serbian declares it; ×0 in Bosnian. Not ported.
- **`jen` / `evro` / `funta` as CURRENCY** — `funti` ×2 and both are the WEIGHT pound
  (`Osoba koja na Zemlji teži 200 funti`), which is Serbian's documented `£` trap reproducing verbatim. `€`,
  `£`, `¥` are ×0 as signs. Only `$` is declared.
- **`kvadratni`/`kubni` position** — the squared word is declared and the CUBED word is NOT: `³` is ×0 and the
  corpus's one cubic quantity is written out as `120-160 kubnih metara`, i.e. the writer already said it.
  Declaring a cubed word would be a second naming.
- **`jednako` / `manje od` / `veće od` / `podijeljeno` / `plus minus`** — refused as CLASSES, ×0 signs each.
  Registered in `ACCEPTED_SIGN_SILENCE`.
- **`Sv.`, initialisms, letter names** — not attempted, per both siblings' headers.

⚠ **The examples were read, not the counts.** `sad` scores enormously in any Bosnian text tier and is the
ADVERB "now" in every instance — which is precisely why `SAD` must not be left to the g2p, and why the
expansion is claimed only in the case-marked `SAD-a` form. `marka`/`marku`, which Croatian licenses as ordinal
followers, are **×0** in the Bosnian corpus in any frame, so they are dropped from the ported list as an absent
shape rather than carried on the sibling's word.

⚠ **And two expansions turned out to be corpus-attested outright, which removes them from the
sister-sourced column entirely:**

    prije nove ere   ×3, SPELLED OUT — `hram je ponovo izgrađen 323. godine prije nove ere`,
                     `u 10. stoljeću prije nove ere`, `oko 10.000 godina prije nove ere`
    naprimjer        ×8, and Bosnian writes it as ONE WORD — `Naprimjer, „učenje“ i „socijalizacija“…`

The first is the strongest possible sourcing for an era expansion: the corpus contains both the abbreviation
`p.n.e.` and, in other utterances, the very words this layer rewrites it into. Serbian's ekavian *pre nove ere*
would have been wrong on all three.

---

⚠ **Two probe results that had to be read rather than counted, and one of them nearly shipped a
newspaper.**

- **`zarez` scores 27 tokens across 12 articles, and the FIRST FOUR EXAMPLES ARE A NEWSPAPER** — *Zarez* is
  a Croatian cultural fortnightly, and the hits are its infobox and its external-links section. The word is
  nonetheless the right one: examples 5 and 6 are the decimal-separator article itself, *"koristi decimalna
  tačka, dok se u ekonomiji koristi decimalni **zarez** pošto se u velikim brojevima tačkom razdvajaju po tri
  cifre"* — which attests the reading AND, in the same sentence, the period-grouping convention this layer's
  step 0 exists for. Had the examples not been read, a high count would have been mistaken for evidence and
  the evidence would have been a masthead.
- **`strana` scores 43/12 and its top examples are a VILLAGE in Istria.** The page sense (`str. 109`) is not
  what the probe found. `str.` is ×1 in the corpus; the expansion is carried on the standard grammar rather
  than on this probe, and it is recorded here as the weaker sourcing it is.
- **`pola` scores 45/11 and the examples are Marco Polo's genitive and the geographic POLE** (`Sjevernog
  pola`), not "half" — which is why the `½` reading is `i po` and not built from `pola`.
- **`Farenhajta` is ×1 in ×1 article**, and the one instance is exactly the slot
  (`temperaturu do 1⁄200 stepena Farenhajta`). `°F` is ×0 in the corpus, so the F branch of the degree rule
  is the weakest-sourced cell in the file and is labelled as such.
- `sedamdeseti` / `osamdeseti` came back **substring-only** — irrelevant, because the forms this layer emits
  are `sedamdesetih` (×30/20) and `osamdesetih` (×34/20), both attested.

---

## Run 6 — 2026-08-16 — the layer, and two defects the layer's own ordering created

**Question.** With the rules in, what is still wrong?

**Raw finding — three things the first draft got wrong, each caught by a probe rather than by a counter.**

1. **The `itd. Za` sentence boundary was still being eaten**, even after the follower guard was changed to
   `(?=[\p{Ll}\d(])`. Reason: the pattern carries the `i` flag (so a sentence-initial `Itd.` still matches its
   lowercase key), and **`\p{Ll}` under `i` matches uppercase too** — the exact trap Serbian's era rule
   documents from the other direction. The case test had to move into the callback. This is the second time
   in one file that a case discriminator in a lookaround was a no-op.
2. **A CLOCK RANGE loses its connective, and both siblings have the hole.** `Između 10:00 - 11:00 sati uveče`
   read as *između deset sati jedanaest sati* — the clock rule (which must run first) rewrites both endpoints
   into words, and the general range rule then has no digit on either side of the dash, so the dash is dropped
   outright. Fixed with a clock-to-clock span arm ahead of the clock rule (step 7c). ×1.
3. **The sourcing gate was reading ONE needle and reporting green.** `review.ts` said
   `all 1 high-traffic words attested` while the currency block was declared. Two independent causes, both in
   this file: the `$` key was written in TS object-shorthand (`$:`), which the gate's `/"([^"]+)"\s*:/`
   extractor cannot see; and a comment sat BETWEEN the two currency entries, which defeats the
   `,(?=\s*"[^"]*"\s*:)` split and collapses the block into a single entry keyed on `AUD$` — a string a
   folded haystack can never contain. Quoting the key and moving the comment above the field took the line
   from 1 needle to 3. ⚠ This is trap 57's shape exactly (an instrument failing toward false confidence) and
   it is a third door into the same blindness the gate's own header documents for helper-declared data.

**Implication.** Two of the three were invisible to every counter — the corpus diff was identical before and
after fix (1), and green before and after fix (3). Only reading the probe output found them.

### Rules that are Bosnian's own, not either sibling's

    step 2   the abbreviation table (tj./str./br. added, tzv. dropped) + the callback case guard
    step 3   `Dr.` case-SENSITIVE, so the corpus's `i dr.` (et al.) is not read as a doctor
    step 4   `SAD-a` → the genitive expansion (trap 56: it was reading as the adverb *sad*)
    step 5b  the compass letters `S J I Z`
    step 7c  the clock-to-clock span
    step 8   consuming the written `sati`/`časova` after a colon clock
    tier     `multiply.by = "sa"`, `magnitudes`, the `AUD$` compound currency key
    table    ORD_HUNDREDS[2] = dvjestoti (hr) + ordinalBase(1000) = hiljaditi (sr); ENDINGS gains `m.ins`

---

## Run 7 — 2026-08-16 — trap 58: the range's second endpoint, and what a Bosnian year span actually reads as

**Command.** `npx vitest run test/clause-final-range.test.ts` (a fleet-wide CI test this round's own gates
never ran), then the corpus.

    FAIL  trap 58 — a range rule declined a clause mark:  bs 1990-1995. lost: pet

**Question.** Nothing is DROPPED here — the second endpoint flips from the cardinal `pet` to the ordinal
`pete` when a clause mark follows, so `1990-1995.` read *hiljadu devetsto devedeset* **do** *hiljadu devetsto
devedeset pete*. Which of the three readings is Bosnian's, and where does the mixed one come from?

**Raw finding — the corpus answers, and it answers twice.**

1. There are **5 year–year dash spans** in the 1,976 utterances and **four carry no ordinal period at all**:

       (AD 1000–1300).      (1894-1895), Qing vlada     (1469–1539) u 15. vijeku     (1644-1912) preuzele

   The fifth is `Ta abeceda je osmišljena 1444. godine … (1418-1450. godine)` — the period IS written on the
   second endpoint **and the licensing noun is written after it**. Not one instance in the corpus has a year
   span whose period is clause-final. So the ordinal reading of a span endpoint is licensed by **what
   follows the dot**, never by the dot alone — the identical discipline steps 4, 6, 10 and 11 already use.
2. And when it IS licensed, **both endpoints are ordinal**. The corpus writes the connective out longhand
   twice and marks both endpoints each time: `u sezoni od 1995. do 1996. godine` and `u 2015. ili 2016.
   godini`. A span is *of* those years and the elision governs the pair.

So the answer is the coordinator's candidate **3** at the top level (conditioned on what follows), resolving
to candidate **1** in the licensed frame and candidate **2** at a clause end.

**Where the mixed reading came from — an ORDERING, not a guard class.** Serbian and Croatian both run the
range rule BEFORE the ordinal rules, so `1000-1300. godine` still has a digit on its right when the ordinal
fires; this file inherited that order. The cost is that by the time the elided-year arm runs, the dash its
own lookbehind `(?<![\d.,\-])` was written to reject is **gone** — the text already says `1990 do 1995.` —
so only the second endpoint was promoted. ⚠ The defect was **live in the corpus, not only in the probe**:
`(1418-1450. godine)` was reading as *hiljadu četiristo osamnaest do hiljadu četiristo pedesete*, cardinal
then ordinal. No counter sees a mixed reading (trap 56), and the corpus diff was identical before and after
the repair.

**The repair, three parts.**

- **New step 9**, ahead of everything that touches a range: a YEAR–YEAR span whose second endpoint carries
  the ordinal period **and is followed by a lowercase word** is claimed as a UNIT — both endpoints f.gen
  ordinal, joined by `do`, the dot consumed. This is the licensed frame, and it fixes the ×1 corpus instance.
- **The general range rule moves BELOW both ordinal rules** (now step 11b). Step 9 having taken the licensed
  span means the reason for the sibling ordering no longer applies, and the elided-year arm's dash guard now
  sees the dash it was written for. Residual: a NON-year range whose right endpoint is a licensed ordinal
  (`4-5. kategorije`) — ×0 in this corpus, so step 10's lookbehind is left alone rather than widened on
  nothing.
- **The year arm's reject class gains the en dash and the em dash**: `[\d.,\-]` → `[\d.,\-–—]`. This is trap
  58's canonical shape restated for a rule whose trailing context is an ordinal arm rather than a lookahead
  class — the old class was right about `COVID-19.` and blind to `1990–1995.`, while the same corpus writes
  its spans with both dashes (`7–2`, `1469–1539`, `AD 1000–1300`).

**bs was NOT added to `NOT_YET_REPAIRED`.** The header rules that out: the allowlist is a backlog, entries
leave it by fixing the language, and "no corpus instances" is explicitly not an argument (trap 8). The
language was fixed instead.

**Implication.** The gate that caught this is one no per-language instrument runs — `review.ts`'s own
clause-final line reported `[ ok ]` throughout, because its two RANGE probes are declared ungated. That is
the third instrument in this round to fail toward false confidence (see Run 6), and the first to be caught
by CI rather than by reading output.

---

## Run 8 — 2026-08-26 — the C# port, and four defects the parity gate structurally cannot see

**Question.** Port `bs` to C# byte-identically, and — per `csharp/PORTING.md`'s bidirectional rule — read the
TypeScript for defects rather than only chasing diffs. The gate proves the two engines AGREE, so a bug both
reproduce passes it forever; everything below moved **0 of 200 golden rows**.

**Commands.**

    dotnet run --project csharp/tools/parity -- bs          # 200/200 on the FIRST run, before any fix
    npx tsx tools/gen_parity_goldens.mts bs                 # after each fix: 0 rows moved, every time
    # corpus-wide differential, cols 3+4 of the three bs_ba TSVs, deduped
    cat …/bs_ba/{dev,test,train}.tsv | cut -f3,4 | tr '\t' '\n' | sort -u   # 3,952 lines
    # both engines, both modes: TS `phonemize`/`phonemizeAsync` vs C# `Phonemize`/`PhonemizeAsync`

**Raw findings.**

1. **`¾` and `½` NEVER REACHED STEP 14.** `bs` was absent from `registry.ts`'s `VULGAR_FOLD_OPT_OUT`, and the
   shared fold (landed 2026-08-04, twelve days before this file) rewrites `¾` → ` 3/4` before any engine runs.
   bs has no `n/m` fraction rule, so the slash was dropped:

       (29¾ inča sa 24½ inča)   →  …dˈeʋet TRIː t͡ʃˈetiri ˈiːnt͡ʃa sa …t͡ʃˈetiri JˈEdan DʋAː ˈiːnt͡ʃa
       after the opt-out       →  …dˈeʋet I TRIː t͡ʃˈetʋrtine ˈiːnt͡ʃa sa …t͡ʃˈetiri I PO ˈiːnt͡ʃa

   ⚠ **THE REASON IT SURVIVED SEVEN RUNS IS THE TEST HARNESS.** Every test in `test/bosnian.test.ts` calls
   `createBosnian().text()` directly, which bypasses every pre-pass. The rule was green in its own suite and
   dead in the product. The new tests go through `phonemize()`.
   ⚠ The opt-out is a trade: the sixteen OTHER vulgar glyphs are now dropped rather than half-read. All ×0 in
   this corpus; hr/ca/mk and six more already make the same trade.

2. **#1059's `raw` never reached the wrapper.** `serbian/numbers.ts` threads `raw`; `bosnian/numbers.ts` did
   not declare it. `9007199254740993` read as *…dʋaː* — its NEIGHBOUR's answer, the double having rounded —
   and `1e21` as *jˈedan e dʋaː jˈedan*, four words for 22 digits. bs is off `ACCEPTED_LOSSY`. **hr still has
   it** and its call site strips `.`/`,` first, so hr's `raw` must be the stripped string.

3. **The era marker was the one word-keyed rule with a single script.** This file's own header states the
   digraphia invariant and DOTTED_ALT/LICENSOR/the degree scale all hold it. `п.н.е. у пожару` → *p . n . e .*
   Serbian ships both spellings already, so the fix is a transliteration and not a sourcing question.

4. **Backlog item 6 is now closed for the three WORD connectives.** The coordinated pair is claimed as a unit
   (step 9b), both endpoints in the WRITTEN licensor's slot:

       10. i 11. stoljeća     →  dˈeset . i jedanˈaestoɡ …      →  dˈesetoɡ i jedanˈaestoɡ stˈoʎet͡ɕa
       1. i 3. pukovniju      →  jˈedan . i trˈet͡ɕu …            →  pˈrʋu i trˈet͡ɕu pˈukoʋniju
       u 2015. ili 2016. godini → …petnaestE ili …šesnaestOJ    →  …pˈetnaestoj ˈili …ʃˈesnaestoj ɡˈodini

   ⚠ **THE YEAR HALF WAS A DIFFERENT DEFECT WITH THE SAME CAUSE, and Run 7 did not name it.** Step 11 claims a
   year but only knows the ELIDED *godine*, so it always emits f.gen; where the written licensor governs
   another slot the pair carried two cases for one construction. Run 7's own argument ("the elision governs
   the pair") is what settles it. The COMMA form (`11.,12., i 13. vijeku`) is still open — item 6 stands for
   that shape.

**What it implies.** The gate is blind to all four, and so is the corpus differential for three of them
(Cyrillic is ×0 in bs_ba, ≥2^53 digit runs are ×0, and the fractions are ×2 lines whose old reading was
merely *wrong*, not absent). Off-golden probes — 296 lines, one per arm plus the neighbour each arm must
decline — are what carried the weight, and the reading of their OUTPUT is what found the residuals now filed
in `docs/investigations/bs/bs_port_investigation.md` (the decimal count disagreement between the local `/s` rule and the shared tier; space
grouping; the round-thousand stranded pause; `km³`; U+2212 fusing a range).

**Gate after.** TS 5,503 pass / 5 skipped; C# 1,198 pass; parity **111 languages, 21,896 rows, 0 differ,
0 BLOCKED**. Corpus differential 3,952 lines × 2 modes and probes 296 × 2 modes, all byte-identical.

## Gates

| gate | before | after |
|---|---|---|
| corpus-diff DROP | 10 | 0 |
| DIGIT | 0 | 0 |
| SLOT-GAP | 0 | 0 |
| RAWMARK | 0 | 0 |
| ZERO-WIDTH | 0 | 0 |
| RAW-CAPS | 0 | 0 |
| THROW | 0 | 0 |
| `review.ts --lang bs` — sign classes | n/a (no normalizer) | **[ ok ] none dropped**; 5 INTENT (`plus-minus equals less-than greater-than divide`) |
| `review.ts --lang bs` — sourcing | n/a | **[ ok ] all 3 high-traffic words attested** (`posto`, `dolar`, `dolara`) |
| `review.ts --lang bs` — clause-final | n/a | **[ ok ] a trailing . or , loses no reading** |
| `review.ts --lang bs` — spelling → g2p | n/a | [ ok ] |
| `review.ts --lang bs` — artifact tracked | n/a | **[FAIL] `tools/corpus/mined/bs.jsonc` missing — EXPECTED**, bs is FLEURS-only and no artifact was created |
| `referee-eval bs` | **does not exist** | still does not exist — `eval.ts` has no `bs`. The gate is VACUOUS, not green, and cannot regress |
| utterances changed | — | 301 / 1,976 = **15.2 %** |
| `test/clause-final-range.test.ts` (fleet CI, trap 58) | **red on bs** | **green**, and `bs` is NOT in `NOT_YET_REPAIRED` — see Run 7 |
| `npx vitest run` | 4652 passing | **4653 passed, 1 failed** — `test/languageCatalogue.test.ts`, `1 cell(s) differ`, exactly the expected one-cell drift from adding a normalizer (regenerated centrally) |
| `npx tsc --noEmit` | clean | **clean** |

---

## Backlog surfaced, not fixed

1. **`802,11n` is a typo in the corpus** — the Wi-Fi standard written with a decimal COMMA
   (`Brzine od 802,11n`). The decimal rule now reads it as *osamsto dva zarez jedanaest n*. It read as
   *osamsto dva , jedanaest n* before, so nothing regressed, but neither reading is right and no guard can
   distinguish a typo from a decimal. ×1.
2. **`3136 mm2:864`** — an ASCII-squared unit (`mm2`) inside a ratio, in the aspect-ratio sentence. Reads as
   *milimetara dva , osamsto šezdeset četiri*. Trap 53 says an ASCII exponent must not be manufactured into a
   superscript, so it is deliberately left; the `:` ratio class is ×1 and unclaimed.
3. **`N. Wayne Hale Jr.`** — the lone-initial rule's lookbehind is defeated by the preceding `NASA-e`
   (the hyphen breaks `\p{Lu}\p{L}*\s`), and `Jr.` is unclaimed. ×1 each.
4. **`T. reks`** — an initial before a LOWERCASE word; the lone-initial rule requires a capitalised surname.
   ×1.
5. **`w`, `y`, `q`, `x` in foreign names** — `George W. Bush` loses the `W` entirely because those letters are
   in the tokenizer's Latin run but not in the Serbo-Croatian grapheme table. That is a `bosnian.ts`/g2p
   question, not a normalization one, and is out of this round's scope.
6. ~~**Coordinated ordinals sharing one licensor**~~ — **CLOSED IN PART, Run 8.** Step 9b now claims
   `N. (i|ili|do) M. <licensor>` as a unit, both endpoints in the written licensor's slot, both scripts. The
   COMMA form (`11.,12., i 13. vijeku`) still needs a different shape and remains open.
7. **`90 stepeni F.`** — Fahrenheit written as a bare letter after a SPELLED degree noun, with no `°`. ×1;
   claiming it needs a rule keyed on the noun rather than on the sign.
8. **`AUD$`** — declared as a compound currency key, but `45 miliona AUD$` puts a MAGNITUDE between the number
   and the sign. ×1.
9. **`UTC+1`** — reads as *UTC plus jedan*; the correct reading is an offset (*UTC plus jedan sat*). ×1.
10. **No Bosnian referee dataset.** `referee-eval.ts` has no `bs`. Every future bs round is missing the one
    gate that measures the g2p rather than the layer.
11. **`5 000` (space-grouped) reads as *pet nula*.** ×0 in this corpus, so no rule is written — but the
    shape is live in sibling standards and would arrive with any wiki artifact.
12. **`review.ts`'s sourcing extractor is defeated by an object-shorthand key and by a comment between two
    entries** (Run 6, finding 3). Worked around locally here; the extractor itself is a fleet-wide fix and is
    not attempted in a language round.
13. **No mined artifact.** `review.ts --lang bs` will stay red on the artifact line until a bs.wikipedia
    artifact is mined. FLEURS's 1,976 utterances are a thin ruler for the rare classes: `&` ×1, `¾` ×1,
    dot-clock ×1, era ×2.
