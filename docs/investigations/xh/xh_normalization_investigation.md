# Xhosa (xh) text normalization — investigation log (#562)

Worktree `norm-work/xh-work`, branch `norm-xh-562`. Corpus: FLEURS `xh_za`, **column 3** (cased original),
1,509 unique utterances after dedup. Artifact: `tools/corpus/mined/xh.jsonc` (already committed).

---

## Run 1 — 2026-08-02 — baselines, before touching anything

**Question.** What are the pre-change numbers I have to hold, and what does the engine already do wrong?

```
npx tsx tools/normalization/corpus-diff.ts emit --lang xh --corpus xh_za --out /tmp/claude-1000/xh/xh.before
  → emitted 1509 utterances
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/xh.jsonc --lang xh
  → DROP degree ×2 · DROP currency ×2 · DROP math-sign ×1 · DROP minus ×1
npx tsx tools/normalization/review.ts --lang xh
  → [FAIL] normalizer  src/languages/xhosa/normalize.ts missing
npx tsx tools/referee-eval/eval.ts xh
  → wikipron xho_latn narrow: symbol accuracy 98.4% (874 words)
  → epitran xho-Latn:         symbol accuracy 96.3% (874 words)
```

Raw finding: the `DROP currency ×2` is the one the playbook names — `leUS$30` / `i$10`, both a `$` glued to
a Xhosa **concord prefix**, which the shared tier's deliberate letter-boundary guard cannot match.

**Implication.** Referee is the invariant to prove UNCHANGED; the scan has four DROP lines to account for;
there is no normalizer at all, so every rule is new.

---

## Run 2 — 2026-08-02 — tabulate column 3, then probe the engine on every shape

`cut -f3 train.tsv | sort -u` → 1,509 lines. Counts (occurrences, not lines):

| shape | count | notes |
|---|---|---|
| digits, any | 328 lines | |
| **concord-prefix + hyphen + digits** | **310** | `ngo-` ×62, `eziyi-` ×30, `ye-` ×16, `eyi-` ×13, `ezingama-` ×12 … 85 distinct prefixes |
| comma-grouped thousands | 28 | + `eziyi-2,3 miliyoni` = a decimal COMMA ×1, + `Novemba 26,2008` = a date comma ×1 |
| space-grouped thousands | 6 | `6 500`, `10 000`, `100 000`, `17 000`, `55 000`, `1 000` |
| dot decimals | 11 | 1.5 ×3, 2.2, 12.8, 14.7, 3.7, 2.8, 1.2, 3.50, 6.34, 1.1, + `4.2-3.9` |
| colon clocks | 12 | incl. 3 written with a SPACE after the colon (`10: 00`, `11: 00`, `8: 30`) |
| dot clocks | 2 | `12.00 GMT`, `15.00 UTC` |
| sports times | 3 | `4: 41.30`, `2: 11.60`, `1: 09.02` — must NOT be claimed |
| a.m./p.m. | 5 | all adjacent to a clock |
| ranges | 13 | 7 ascending spans, 3 scores (5-3, 7-2, 26 - 00), 1 season (1995-96), 1 decimal span, 1 stray `-40` |
| currency signs | 12 in 9 lines | `$` ×8, `¥` ×3, `£` ×1; `US$` ×3, `AUD` named ×1 |
| percent | 4 | tier already reads it |
| units | mm ×8, km ×9, cm ×2, mi ×2, m ×2, km² ×1 | only `km` declared today |
| rates | km/h ×6, mph ×3, m/s ×1, kph ×1, Mbit/s ×1 | |
| degrees | 2 | `+30°C`, `35°W` |
| signs | `+` ×2, stray `-` ×1 | |
| English ordinal suffix | 9 | 15th ×2, 16th ×3, 17th ×1, 17th-century, 18th, 60th |
| era markers | 6 | `BCE` ×4, `BC` ×2, `B.C.E.` ×1 |
| dotted abbreviations | 14 | `U.S.` ×2, `U.S` ×2, `U.S.Geological` ×1, `B.C.E.` ×1, `Jr.` ×4, `Mnu.` ×2, `N.Wayne` ×1, `St.` ×1 |
| all-caps initialisms | **112 tokens / 74 forms** (102/71 net of the era markers and Roman `II`) | US ×8, II ×5, BCE ×4, UTC ×3, UN ×3, MRI ×3, AOL ×3 … |
| fractions | 1 | `1/5 intshi` |
| slash as "or" | 9 | `kunye/okanye` ×2, `iiyadi/iimitha`, `ipolisi/iikopi` … |
| ampersand | 2 | `Arts & Sciences`, `iiB&amp;B` |
| exponent | 1 | `km²` |
| version dot | 1 | `802.11n` (+ `Figure 1.1.`) |

**What the engine produced, verbatim** (`phonemize(x, "xh")` on the pre-change tree):

```
eziyi-3,850     → ɛz̤ˈiːji kʼutʰˈaːtʰu , amakʰˈuːlu asib̤ˈɔːz̤ɔ …   comma → SENTENCE-grade pause, two numbers
eziyi-12.8      → ɛz̤ˈiːji iʃˈuːmi nambˈiːni . isib̤ˈɔːz̤ɔ          dot → full stop mid-number
ngo-1:15 a.m.   → ŋɡ̤ˈɔː kʼˈuːɲɛ , iʃˈuːmi nanɬˈaːnu ˈaː . m .      colon pause + TWO more from a.m.
ngo-12.00 GMT   → … iʃˈuːmi nambˈiːni . ikǃˈaːnd̤a ɡ̤mtʼ            :00 → "iqanda" (= EGG, the zero word)
leUS$30         → lˈɛːus amaʃˈuːmi amatʰˈaːtʰu                     the $ DROPPED
i$10            → ˈiː iʃˈuːmi                                      the $ DROPPED
ne-¥2,500       → nˈɛː kʼuɓˈiːni , amakʰˈuːlu amaɬˈaːnu            ¥ undeclared → DROPPED
+30°C           → amaʃˈuːmi amatʰˈaːtʰu kǀ                          ° dropped, C → a CLICK
35°W            → amaʃˈuːmi amatʰˈaːtʰu nanɬˈaːnu w                 ° dropped, bare [w]
480 km/h        → … iikʰilɔmˈiːtʰa h                                the /h as a bare letter
133 m/s         → … m s                                             raw letters
300 mph         → … mpʰ                                             raw cluster
35 mm           → … mm                                              raw cluster
3,850 km²       → kʼutʰˈaːtʰu , … kʼm                               comma pause + raw km, ² gone
1/5 intshi      → kʼˈuːɲɛ kʼuɬˈaːnu ˈiːɲt͡ʃʼi                        slash dropped
6 500           → isitʰand̤ˈaːtʰu amakʰˈuːlu amaɬˈaːnu               "six five hundred"
18th            → iʃˈuːmi nɛsib̤ˈɔːz̤ɔ tʰ                            the English suffix as [tʰ]
U.S.            → ˈuː . s .                                         two sentence breaks
B.C.E.          → ɓ . kǀ . ˈɛː .                                    three sentence breaks + a click
UMnu. Costello  → ˈuːmnu . kǀɔstʼˈɛːllɔ                             abbreviation dot as a full stop
B&amp;B         → ɓ ɓ                                               the entity dropped
120-160         → ikʰˈuːlu … ikʰˈuːlu …                             no joiner
DNA/NHC/GMT/MRI → d̤nˈaː / nhkǀ / ɡ̤mtʼ / mrˈiː                      vowel-less clusters
```

**Implication.** Fourteen distinct rule families. The concord-prefix shape (~330) is the language's
defining orthography and — importantly — the engine already reads it *acceptably*: the hyphen is dropped
and the prefix is emitted as its own word, which is what the writing separates it as. Nothing to do there,
and inventing an agreement on the numeral would be trap 14 (agreement cannot be applied to digits). See Run 4.

---

## Run 3 — 2026-08-02 — sourcing every word I would emit

The whole risk in this layer is asserting a Xhosa word. `espeak-ng` **has no Xhosa at all** — and no Zulu:

```
ls /home/chris/Programming/espeak-ng/dictsource/ | sed 's/_.*//' | sort -u
  → ab af am an ar as az ba be bg bn bpy bs ca chr cmn crh cs cv cy da de el en eo es et eu fa fi fo fr
    ga gd gn grc gu hak haw he hi hr ht hu hy ia id io is it ja jbo ka kaa kk kl kn ko kok ku ky la lb
    lfn lt lv mi mk ml mn mr ms mt mto my nci ne nl no nog om or pa pap piqd pl ps pt py qdb qu quc qya
    ro ru rup sd shn si sjn sk sl smj sq sr sv sw ta te th ti tk tn tr tt ug uk ur uz vi xex yue
  (xex = Xextan, a constructed language. No xh, no zu.)
```

So the sources available are: the xh corpus (token-matched), the two xh referee lists (876 words), the
language's own `xhosa.jsonc`, and — for the measure nouns no corpus records — the **HSRC/Molteno
*MATHEMATICS Grade 1–3 English/isiXhosa Dictionary*** (`nicspaull.com/…2018-maths-dictionary-isixhosa-proof-3.pdf`),
which is a published bilingual glossary, not my invention. Found this way:

| word | means | source (verbatim) |
|---|---|---|
| `iipesenti` | percent | corpus ×3 (+ `pesenti` ×2, `leepesenti`, `neepesenti`) |
| `iidola` | dollars | corpus: *nakwiidola zaseMelika*, *iidola ezizibhiliyon zaseMerika* |
| `iidola zaseMelika` | US dollars | corpus, verbatim: *nakwiidola zaseMelika* |
| `iiponti` | pounds | corpus, verbatim: *Iiponti zaseBritane* |
| `iikhilomitha` | kilometres | corpus ×7 (`neekhilomitha`, `zeekhilomitha`, …) |
| `iimitha` | metres | corpus ×2; HSRC: *metre/metres → imitha/iimitha* |
| `iisentimitha` | centimetres | corpus: *ziisentimitha*; HSRC: *centimetre → isentimitha* |
| `iikhilogram` | kilograms | corpus ×1; HSRC: *kilogram → ikhilogram* |
| `iimayile` | miles | corpus ×3 (`yeemayile`, `imayile`, `kwiimayile`) |
| `ngeyure` | per hour | corpus ×6, verbatim in *iikhilomitha ezingama-17,500 ngeyure* |
| `ngomzuzwana` | per second | corpus ×2, verbatim in *imayile eziyi-8 ngomzuzwana* |
| `amaqondo` | degrees | corpus ×2: *amaqondo angaphezulu kwe +30°C*, *kumaqondo obushushu* |
| `entshona` | west | corpus: *yanyikima entshona yeMontana* |
| `kusasa` | a.m. | corpus ×3, and **adjacent to a clock**: *ngentsimbi ye 9:30 kusasa*; HSRC: *am – amaxesha akusasa* |
| `emva kwemini` | p.m. | corpus, verbatim: *ngoLwesithathu emva kwemini*; HSRC: *pm – amaxesha asemva kwemini* |
| `ukuya ku` | to (range) | corpus ×6 (`ukuya ku` ×4, `ukuya ku-` ×2) + `ukuya kutsho kwi-` ×2 |
| `kunye` | and (&) | corpus ×195; HSRC: *plus → kunye* |
| `Mnumzana` | Mr | corpus, verbatim: *U Mnumzana u Reid* |
| `izikwere` | squares | HSRC, verbatim: *Izikwere ezahlulwe zangamaqhezu* |
| `na-`→`ne-` fusion | connective | `xhosa.jsonc` own `numbers.na`: `isithandathu`→`nesithandathu`, `ithoba`→`nethoba` (na+i→ne, na+a→na) |

**Two words are COMPOSED, not attested, and are flagged as such:**

- `iimilimitha` (mm ×8). The corpus itself supplies the productive pattern with two independent
  witnesses — `iikhilomitha` and `ziisentimitha` — plus the bare `iimitha`. isiXhosa Wikipedia search for
  *iimilimitha*: "There were no results matching the query". Composed, low risk (an SI prefix on an
  attested stem), stated in the PR.
- `iiyeni` (¥ ×3). Same `ii-` class-10 loan-plural pattern as `iidola`/`iiponti`/`iipesenti`; a currency
  proper-noun transliteration, so there is no wrong *meaning* available. Declared so the ¥ is not
  swallowed; flagged for the reviewer to strike.

**Three things I looked for and did NOT find — recorded so nobody repeats the search:**

1. **A Xhosa decimal-separator word.** Not in the corpus (`chaphaza` occurs only as the verb
   *-chaphazela* "to affect", ×8; the noun does not), not in either referee, not in `xhosa.jsonc`, not in
   espeak (absent), not in the HSRC Grade 1–3 dictionary (it has *inkqubo yedesimali* "the decimal system"
   and nothing for the point), and isiXhosa Wikipedia returns nothing for *ichaphaza / idesimali / ikoma*.
   → **No word is asserted.** The rule removes the separator and reads the fractional digits one at a
   time. The point is not spoken; it was not spoken before either — before, it was a full stop.
2. **A Xhosa letter-name table** (needed for `core/initialisms.ts`). espeak has no xh; the two referees are
   word lists with no letter entries; searching for isiXhosa *oonobumba* letter names returns pronunciation
   videos and no citable table. Without `letterName`, `core/initialisms.ts`'s `spellOut` returns
   `undefined` and the pass is a **no-op by construction** — so wiring it would change nothing. This is
   Swahili's situation verbatim (`swahili.ts`: *"the Swahili run found no source for them, so none is
   authored"*), not Slovak's. Deferred with the count: **102 tokens / 71 acronyms.**
3. **A Xhosa era phrase for BC/BCE.** The corpus has `Kristu`/`ubuKrestu` only in religious prose, never as
   a dating marker; `phambi kukaKristu` would be a three-morpheme phrase I assembled myself, and a web
   search for it found nothing citable. Deferred, count 6; the zero-invention half (stripping the interior
   dots of `B.C.E.` so it stops emitting three sentence breaks) IS done.

---

## Run 4 — 2026-08-02 — the noun-class concord, measured rather than assumed

**Question.** Does a rule in this layer need to make a numeral agree with its noun (trap 14 (agreement cannot be applied to digits))?

Xhosa writes the concord **explicitly, hyphenated onto the digits**: `ezingama-3000`, `eziyi-12.8`,
`abayi-93%`, `ngo-1957`, `ku-100-200`, `we-1683`, `imizuzu emi-3`, `iminyaka engama-250`. ~330 occurrences
over 85 distinct prefixes. The engine drops the hyphen, emits the prefix as its own word, and then the
cardinal — i.e. it reads exactly what is written, in the order it is written.

So **the concord is data in the text, not something to derive**, and the playbook's instruction applies:
where it is written, read it. Every rule below therefore leaves the operand as DIGITS, so the concord that
precedes it still lands on it and the shared tier can still see number–unit adjacency.

**The one rule that needs words is the clock**, and it needs them for exactly the trap-14 reason: the
minutes take the connective `na-`, which is a BOUND morpheme and cannot be glued to a digit run. So the
clock rule converts both operands to words itself and applies the fusion, using the fusion evidenced by
`xhosa.jsonc`'s own `na` series (na+i→ne: *ithoba*→*nethoba*; na+a→na: *amashumi*→*namashumi*). It then
claims the a.m./p.m. marker and the timezone in the same match, because after words-ification the tier can
no longer see them (trap 14 (agreement cannot be applied to digits)'s second clause).

`grep -oPE '[0-9] (na|ne|nga|ku|nge|ye)(?![a-zA-Z])'` on the corpus → **6 hits, and every one is a prefix on
the FOLLOWING token** (`ye-240 ye-km ngeyure`, `Inombolo-1 neye-2`, `ne-¥130,000`), never a detached suffix on
the preceding number. So trap 15 (the same bound suffix is also written with…)'s spaced alternation does not exist here — Xhosa never detaches the concord
from the digits, it always hyphenates — and no spaced alternative is admitted (trap 9 (a guard alternative with no attested…): a guard with no
attested instance is a misfire generator).

---

## Run 5 — 2026-08-02 — first full pass, and the one defect only the corpus diff could see

Wrote `normalize.ts` (15 numbered steps) and extended the tier in `xhosa.ts`. Then:

```
npx tsx tools/normalization/corpus-diff.ts emit  --lang xh --corpus xh_za --out …/xh.after
npx tsx tools/normalization/corpus-diff.ts compare --before …/xh.before --after …/xh.after
  → changed 95/1509 (6.3%);  DROP 5 → 1;  DIGIT/SLOT-GAP/RAWMARK/THROW all 0
```

**Read all 95, not the 12 the tool prints** — and #43 was wrong:

```
ne-¥130,000  →  ikʰˈuːlu amaʃˈuːmi amatʰˈaːtʰu ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a iijˈɛːni
                "one hundred and thirty  zero zero zero  yen"
```

Cause, and it is a two-rule interaction no probe would have shown: the de-grouping guard was `(?![\d.,])`,
so a grouped number followed by a **clause comma** (`¥130,000, yaye`) or a **sentence period** (`nayi-2,207.`)
declined to de-group — and the surviving comma was then read as a DECIMAL SEPARATOR by the
currency-decimal rule, which spelled the three zeros out one at a time. Two separate fixes:

- the guard only ever needed to reject a PARTIAL grouped match, which is `(?![\d]|,\d)`, not `(?![\d.,])`;
- a comma is a decimal separator only with a 1–2 digit tail — the discipline the plain decimal rule already
  had, now shared with the currency and unit decimal paths.

Re-ran: **98/1509 changed, DROP 5 → 1**, and the three extra changes are `2,250`, `2,243` and `9,000` — all
grouped numbers followed by a period or comma that had been declining to de-group for the same reason.

**Implication.** Both defects were invisible to unit probes and to the artifact scan, and visible only in a
change I would not have looked at if I had read the printed 12. Trap 3, again.

---

## Run 6 — 2026-08-02 — the review's sign-class gate, and calibrating against what actually ships

`review.ts --lang xh` reported `[FAIL] sign classes  DROPPED: minus plus equals less-than times`. Before
deciding whether that mattered, I calibrated it on six shipped layers:

```
npx tsx tools/normalization/review.ts --lang {sw,ha,lb,sk,om,mk}
  → sw: FAIL sign classes (DROPPED: minus plus equals less-than times), FAIL tests, FAIL artifact scan
  → ha, lb, sk, om, mk: [ ok ] sign classes  none dropped
```

So the five recent layers all read the arithmetic and relational signs even at zero corpus instances, on
#584's grounds (a phonemizer is handed arbitrary text, and a dropped sign is inaudible); only the oldest
Bantu layer does not. Sourced them from the **HSRC dictionary's own entry for each SYMBOL** — its `<` entry
literally reads *Isimboli/uphawu < luthetha encinane kunento ethile* — cross-checked against the corpus:

| sign | word | source | corpus tokens |
|---|---|---|---|
| `=` | `lilingana ne` | HSRC *Lilingana ne- (inani)* | 0 |
| `<` | `ngaphantsi kuna` | HSRC *ngaphantsi kuna-* | 13 + `kuna` ×16 |
| `>` | `ngaphezulu kuna` | HSRC *ingaphezulu kuna-* | 24 |
| `×` | `phindaphinda` | HSRC *phinda-phinda* | 1 (*esiphindaphindwe*) |
| `÷` | `yahlula` | HSRC *yahlula/ ukwahlula* | 0 |
| `+` | `dibanisa` | HSRC *plus → kunye / dibanisa* | 8 |
| `−` | `thabatha` | HSRC *minus → thabatha* | 6 |

`kunye` was rejected for `+` although the dictionary offers it: it is also the numeral **1**, so `UTC+1`
would have read *kunye kunye*.

**Two signed-number guards, each forced by a corpus instance rather than chosen:**

1. `grep -oPE '(?<![\p{L}0-9])(?<![\p{L}] )-[0-9]+'` over the corpus → **0 matches**. That is the guard the
   minus rule uses, and it is what declines the corpus's one ` -N`: `ebhudla kangange -40 mph`, whose
   English original reads *"winds blowing at 40 mph"* — a stray hyphen, not a negative. Reading it as
   *thabatha* would be confidently wrong. This is the Burmese `DROP minus` precedent verbatim.
2. The degree rule's sign capture had to be LETTER-GUARDED, and this was a live bug for about ten minutes:
   Xhosa's concord hyphen is indistinguishable from a minus, so `kwi-30°C` — an ordinary spelling — read
   *kwi thabatha amaqondo 30*, "in minus thirty degrees". Same family as trap 1 (`\b` is ASCII-defined): the pattern was wider than
   the orthography. Caught by writing the adversarial-neighbour test, not by the corpus (0 instances).

`review.ts` now reports **`[ ok ] sign classes  none dropped`**.

---

## Run 7 — 2026-08-03 — the final gates

```
npx tsc --noEmit                                          → clean
npx vitest run                                            → 201 files, 2744 tests, all pass (17 xh)
mine.ts scan --in tools/corpus/mined/xh.jsonc --lang xh   → DROP math-sign ×1 · DROP minus ×1
review.ts --lang xh                                       → 7/8 ok; artifact scan FAIL (the two above);
                                                            sourcing ?? = iiyeni
corpus-diff compare                                       → 98/1509 (6.5%); DROP 5→1;
                                                            DIGIT 0, SLOT-GAP 0, RAWMARK 0, THROW 0
referee-eval xh   (vs a pinned worktree of cd4004b)       → BYTE-IDENTICAL, md5 1e5f312e4c69fbb590a18047356d705a
                                                            98.4% wikipron / 96.3% epitran, unchanged
```

**The two residual DROP lines, argued from the instances rather than waved through:**

- `DROP math-sign ×1` — *kwinyanga zehlobo, amaqondo angaphezulu kwe +30°C aqhelekile.* The `+` is a
  POSITIVITY marker and the sentence already says it in words (*angaphezulu*, "above"), so the correct
  reading says it once: trap 12 (a REDUNDANT symbol is a permissible drop) exactly, where "no correct rule can escape the deletion test". Xhosa has no
  attested positivity word — the HSRC glosses are the addition operator — so the sign stays unread here
  while `+` in an operator position (`UTC+1`) is read. The differential test cannot see the difference,
  which is precisely what trap 12 (a REDUNDANT symbol is a permissible drop) documents.
- `DROP minus ×1` — the stray hyphen in *kangange -40 mph*, per Run 6. Any correct handling of a stray
  hyphen produces the same reading with and without it, so the flag is unavoidable and the evidence is the
  answer.

**The `??` sourcing line: `iiyeni`.** Composed from the corpus's own `ii-` class-10 loan-plural pattern
(`iidola`, `iiponti`, `iipesenti`, `iikhilomitha`, `iisentimitha`, `iikhilogram`) applied to the currency
name; attested in no source, and espeak has no Xhosa to consult. Declared so the corpus's three `¥` are not
swallowed, and flagged for the reviewer — `ha` and `lb` carry exactly this `??` for `yen`/`Yen`.

## Run 11 — 2026-08-03, review before merge

Rebased onto `main`. Every gate reproduces. The review pressed the 7-item "deliberately not done" list, the
two composed words and the two argued DROP lines. **No defect was found, and no code changed.** What
follows is the verification, because a deferral accepted without one is just a deferral repeated.

### The defect its sibling had, and this layer does not

Zulu (#606, reviewed an hour earlier) shipped a trap-12 doubling in exactly this rule: its corpus's only °C
sentence already said *amazinga*, and the rule added its own. The same construction here:

```
amaqondo angaphezulu kwe +30°C aqhelekile.
  → amaqondo angaphezulu kwe 30 aqhelekile.       ← ONE degree word
kwi-30°C                → kwi-amaqondo 30         ← emitted where the clause lacks it
empumalanga kwi-35°W    → … amaqondo 35 entshona
```

`saidBefore(full, off, "maqondo")` is already in the rule, on all four branches. The two sibling agents
diverged on the identical construction and this one got it right; the divergence is why reading the corpus's
own sentence — not the rule in isolation — is what catches this class.

Also consistent, and better than Zulu's: **neither scale name is emitted**, for C or F. Zulu keeps
`Fahrenheit` (no click letter) while dropping Celsius; here both are unnamed, because no Xhosa spelling of
either is attested and ⟨c⟩ is a click. Zero °F instances in both corpora, so either is defensible — but one
rule for both scales is the tidier claim.

### The era markers (6) — this is the more disciplined sibling

Both Nguni corpora are in the same state, and I measured both:

| | `ngaphambi` | `kuka` | `Kristu` |
|---|---:|---:|---:|
| xh | 27 | 19 | **1**, inside `zobuKristu` / `yobu Kristu` |
| zu | 28 | 14 | **2**, inside `ubuKristu` / `yobuKristu` |

The preposition and the concord are well attested in both. `Kristu` is attested in neither as a bare proper
noun — only as a **bound stem inside the class-14 word for Christianity**. Zulu composed
`ngaphambi kukaKristu` from those pieces and said so plainly; Xhosa refused. **Xhosa is right**: extracting a
personal name from an abstract-noun stem and putting it in a dating formula is a morphological inference, not
an attestation — the Fula `hakkunde` lesson (a word being real is not a word fitting the slot).

`BCE` therefore still reads `ɓkǀˈɛː`, which is blocked on the same missing letter-name table as the 102
initialisms. Dropping the marker instead would change 10 000 BCE into 10 000, so the cluster is the
least-bad reading. The zero-invention half is done: `B.C.E.` no longer emits three sentence breaks.

### Slash as "or" (10) — upheld, and the reason is measurable

The concern was that a blanket rule would read *kunye okanye okanye*. Confirmed: `okanye` is already on one
side in 3 of the 10, and one "instance" is `"Õ/õ"`, a glyph pair that is not an alternation at all. The
decisive check is whether the operands FUSE without the slash — they do not:

```
iiyadi/iimitha ezimbini  ⇒ iijˈaːd̤i iimˈiːtʰa ɛz̤imbˈiːni
ukuya / ukusuka eKapa    ⇒ ukʼˈuːja ukʼusˈuːkʼa ɛkʼˈaːpʼa
```

Two clean tokens with their own stresses — an under-read, not a leak. Malay left `ela/meter` alone on the
same reasoning. A pause was considered and rejected: it would be wrong for the glyph pair, and a slash is
not reliably a pause in speech.

### The two composed words, re-verified at TOKEN level

- **`iiyeni`** (`¥`, 3 instances). A substring grep makes this look sourced; it is not. The corpus's one
  apparent hit is **inside `yeNintendo`**. Genuinely unattested — and dropping the declaration deletes the
  currency from all three sentences (#584), so it ships as a stated assumption. Same position as lb's `Yen`
  and zu's `amadola`, and the third time this exact trade has come up in this batch.
- **`iimilimitha`** (`mm`). 0 attested — but the `ii-` + borrowing frame is (`iikhilomitha`, `iimitha`,
  `iikhilogram`), and this is the unit-borrowing class §5e excludes from the sourcing check by measurement.

### The two argued DROPs, verified

- **`DROP math-sign ×1`** — `amaqondo angaphezulu kwe +30°C`. The `+` is a positivity marker and the
  sentence's own *angaphezulu* ("above") already says it: trap 12 (a REDUNDANT symbol is a permissible drop). Reading confirmed correct.
- **`DROP minus ×1`** — `sineyona mimoya ebhudla kangange -40 mph`. The scan prints the head of the
  utterance, which reads as a different sentence than the note describes; it is the same one. The hyphen is
  a stray dash (the English source says "at 40 mph"), and it is correctly dropped rather than read as
  *thabatha*: `kʼaŋɡ̤ˈaːŋɡ̤ɛ amaʃˈuːmi amˈaːnɛ iimajˈiːlɛ ŋɡ̤ɛjˈuːrɛ`. The same sentence's two real ranges
  (`35-40`, `56-64`) do get `ukuya ku-`.

### The mandated currency fix, verified

```
leUS$30  ⇒ lˈɛː amaʃˈuːmi amatʰˈaːtʰu iid̤ˈɔːla z̤asɛmɛlˈiːkʼa
i$10     ⇒ ˈiː iʃˈuːmi iid̤ˈɔːla
```

Both glued-prefix shapes read, and `DROP currency` is 0.

### Gates

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 201 files, **2773 tests, 0 failed** |
| `mine.ts scan --lang xh` | `DROP math-sign ×1` · `DROP minus ×1` — both verified permissible above |
| `review.ts --lang xh` | 6 ok · `?? sourcing iiyeni` · `FAIL artifact scan` (the two argued DROPs) |
| `corpus-diff` xh_za | **98/1509 (6.5%)**, DIGIT 0 / SLOT-GAP 0 / RAWMARK 0 / **DROP 5 → 1** / THROW 0 |
| `referee-eval xh` | **byte-identical to main**, re-run on both: 787/874 (90.0%) · symbol 98.4% · epitran 701/874 (80.2%) |

All 98 changes read. They are ranges gaining `ukuya ku-`, `mpʰ` → *iimayile ngeyure*, `ˈaː . m .` →
*kusasa*, `Mnu.` → *umnumzana*, the English `th` suffix removed, `U.S.` collapsed, and — the largest group —
space-grouped thousands going from *ishumi iqanda* ("ten egg") to *amawaka ishumi*.
