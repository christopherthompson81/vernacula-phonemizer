# Oromo (om) text normalization — investigation log (#562)

Chronological. Each run: the command, the question, the raw finding, the implication. Negative results kept.

## Run 1 — 2026-08-02 — the BEFORE baseline, emitted before any edit

```
npx tsx tools/normalization/corpus-diff.ts emit --lang om --corpus om_et --out /tmp/om.before
→ emitted 1218 utterances → /tmp/om.before
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/om.jsonc --lang om
→ DROP currency ×4 · DROP percent ×3 · DROP degree ×1 · DROP math-sign ×1
```

Question: what does the engine drop outright? Finding: exactly the four classes the fleet scan predicted —
Oromo has no symbol tier at all. Implication: `makeSymbolNormalizer` must be added, and every word it emits
must be sourced (§5e; the Fula defect).

## Run 2 — 2026-08-02 — what the corpus writes (om_et, column 3, 1,218 unique utterances)

| shape | n | examples |
|---|---|---|
| digit + GLUED enclitic | ~35 | `1994tti` `2010’tti` `5’tti` `500tti` `30tu` `15tu` `2020f` `10if` `7ttan` `2,243n` `3n` `27tiin` |
| digit + `-ffaa` ORDINAL | 24 | `16ffaa`×4 `18ffaa`×3 `1ffaa`×2 `15ffaatti`×2 `190ffaa` `60ffaadha` `11ffaan` `17ffaaf` `8ffaadhaa` `2ffaa’ti` |
| comma-grouped | 28 | `783,562` `24,000` `US$11,000` `2,243n` `10,000` `6,500` |
| dot-decimal | 14 | `2.3` `6.34` `3.7` `1.5` `12.8` `1.1.` (+ `12.00 GMT`, `15.00 UTC`, `802.11n`) |
| range / score | 14 | ranges `1644-1912` `1894-1895` `1418-1450` `1995-96` `100-200` `120-160` `328-820` `35-40` `56-64` `2-3` `2-5`; scores `26-00` `5-3` `7-2` |
| clock (colon) | 8 | `11:00` `11:20` `07:19` `09:19 GMT’tti` `8:46 a.m.` `8:30 tti` `1:15 a.m tti` `10:00` |
| currency | 5 | `Biliyoona $2.3` `US$11,000` `haga $22,500` `$ 1000` `miiliyoona £27tiin` |
| percent | 3 | `88%` `93%` `3%` |
| units | 8 | `mm 5` `mm 36` `mm 24n` `km 6,387` `km 2-3` `165km/h` `300,948 sq mi` ×3 |
| degrees | 1 | `35°W` |
| math sign | 1 | `=` (`tajaajilu =kan`, a stray typographic dash) |
| era marker | 1 | `D.K.D 5000` |
| dotted abbrev | 8 | `Dr.` `Jr.`×4 `N. Wayne` `kkf.` `fkn.`×2 (+ ~40 SENTENCE-FINAL periods that must not be claimed) |
| fraction | 1 | `inchii 1/5` |
| `&amp;` | 1 | `B&amp;B’ootaan` |

Two orthographic facts that shape every rule:

1. **Oromo is head-initial for measure phrases** — the corpus writes the NOUN BEFORE the number:
   `paawundii 200`, `mm 5`, `km 6,387`, `iskuweer kiloometiiri 783,562`, `daqiiqaa 3`, `sa’aatii 24`,
   `parsantii 3 hanga 5`, `doolaara US biiliyoonotaan`, `miliyoona 2.3`. So the tier needs
   `percentPrefix` + `currencyPrefix`, and units must be emitted BEFORE their number, not after.
2. **Enclitics are written glued to the DIGITS** (`1994tti`, `16ffaa`, `2,243n`) — trap 14 (agreement cannot be applied to digits). The digit
   becomes words in the tokenizer, downstream of this layer, so the suffix must be attached to the WORD.

A NEGATIVE result: `\d,\d{1,2}(?!\d)` → **0 instances**. Oromo here follows the English convention
(comma = thousands, dot = decimal); there is no comma-decimal to read.

## Run 3 — 2026-08-02 — probing the CURRENT engine (verbatim before-readings)

```
npx tsx <probe over every attested form>   # phonemize(form, "om")
```

| input | before-reading | defect |
|---|---|---|
| `88% galche` | `sadːeːtːamˈiː sadːˈeːt ɡˈalt͡ʃe` | `%` dropped |
| `US$11,000` | `ˈus kˈuᶑa tˈokːo , zeːrˈoː` | `$` dropped; grouping comma → PAUSE; `000` → *zeeroo* |
| `Biliyoona $2.3` | `bilijˈoːna lˈama . sadˈiː` | `$` dropped; decimal dot → SENTENCE pause |
| `783,562 qabata` | `ᶑˈibːa tˈorba sadːeːtːamˈiː sadˈiː , ᶑˈibːa ʃˈan d͡ʒaːtamˈiː lˈama` | one number read as TWO |
| `jaarraa 16ffaa` | `d͡ʒaːrːˈaː kˈuᶑa d͡ʒˈaha fːˈaː` | the ordinal suffix as a standalone word `[fːaː]` — a word-initial geminate, impossible in Oromo |
| `1994tti` | `kˈuma ᶑˈibːa saɡˈal saɡaltamˈiː afˈur tːˈi` | the enclitic as a standalone `[tːi]` |
| `2020f` / `10if` | `… f` / `kuᶑˈan ˈif` | a bare `[f]`; `if` stressed as a word |
| `11:00 booda` | `kˈuᶑa tˈokːo , zeːrˈoː bˈoːda` | the colon became a clause pause; `00` → *zeeroo* |
| `Sa’aatii 8:46 a.m.` | `saʔaːtˈiː sadːˈeːt , afurtamˈiː d͡ʒˈaha ˈa . m .` | pause + `a.m.` letter-spelled with two more pauses |
| `12.00 GMT` | `kˈuᶑa lˈama . zeːrˈoː ɡmt` | dot-clock as a decimal-with-pause |
| `(1644-1912)` | `kˈuma ᶑˈibːa d͡ʒˈaha afurtamˈiː afˈur kˈuma ᶑˈibːa saɡˈal kˈuᶑa lˈama` | the range hyphen dropped, no joiner |
| `35°W` | `sodːomˈiː ʃˈan w` | `°` dropped, W as `[w]` |
| `(165km/h)` | `ᶑˈibːa d͡ʒaːtamˈiː ʃˈan km h` | the rate raw |
| `mm 5` / `300,948 sq mi` | `mː ʃˈan` / `… skʼ mˈi` | unit abbreviations read as Qubee letters — `mm` → the GEMINATE `[mː]`, `sq` → `[skʼ]` |
| `D.K.D 5000 tti` | `d . k . d kˈuma ʃˈan tːˈi` | era marker letter-spelled with two interior pauses |
| `Dr. Damadiiyan` / `kkf.)` | `dr . damadˈiːjan` / `kːf .` | interior sentence pause mid-sentence |
| `mm 5 (inchii 1/5)` | `… int͡ʃˈiː tˈokːo ʃˈan` | fraction read as two bare cardinals (trap 8 (zero corpus instances is not evidence of…)'s Uzbek `3/4`) |
| `-5` `+5` `A&B` `x = y` `5 < 6` `6 × 6` | `ʃˈan` `ʃˈan` `ˈa b` `tʼ j` `ʃˈan d͡ʒˈaha` `d͡ʒˈaha d͡ʒˈaha` | every sign class silently dropped |
| `qabxii 2:2 argachuun` | `kʼabtʼˈiː lˈama , lˈama` | NOT a clock (a British degree classification) — the clock rule must not claim it |

Implication: the two biggest classes by count are the ones no fleet scan reports — the glued ordinal
(24) and the glued enclitic (~35), i.e. trap 14 (agreement cannot be applied to digits), exactly as predicted for "anything whose preposition
governs a case".

## Run 4 — 2026-08-02 — sourcing every word before writing a rule (§5e)

Sources searched for each: FLEURS `om_et` col 3, `tools/corpus/mined/om.jsonc`,
`tools/referee-eval/referees/om.{epitran-orm,human-kaikki}.tsv`, `src/languages/oromo/*.jsonc`,
and `espeak-ng/dictsource/om_list` (91 lines, which turns out to carry a symbol table).

espeak's `om_list` symbol block, raw:

```
_dpt tuqa:      _. tuqa:     _& fi        _$ dollari:   _% parsanti   £ pawundi   € yuuroo
_< nixiqata     _> nica:la   _- hir'isu   + ida'u:      * astariiksii  = qixedha
```

| word | reading | evidence |
|---|---|---|
| `parsantii` | percent | corpus ×3 (`parsantii 3 hanga 5` — PREFIX, matching the head-initial order) + espeak `%` |
| `doolaara` | $ | corpus ×1 (`doolaara US biiliyoonotaan`) + epitran referee ×1 + espeak `_$` |
| `doolaara Ameerikaa` | US$ | both words corpus-attested (`Sorreesoota Ameerikaa`) |
| `paawundii` | £ | corpus ×5 + espeak `£`. **POS check: the corpus's five are the WEIGHT noun** (`paawundii 200 (kiiloo giraama 90)`); Oromo borrows one word for both senses, as English does. Stated rather than hidden. |
| `yuuroo` | € | espeak `€` only. € does not occur in the corpus, so it carries no reading (§5e's calibration) |
| `tuqaa` | decimal point | espeak `_dpt`/`_.` + corpus (`sirna tuqaalee` = punctuation dots, `tuqaa 76` = points) |
| `fi` | `&` | espeak `_&` + corpus ×hundreds |
| `wal qixa` | `=` | corpus ×1 (`hamma fi dheerinaan wal qixa`) + espeak `=` → *qixedha* |
| `hir’isuu` | `-` | corpus ×1 (`taarifa hir’isuu irratti`, verbal noun "reducing") + espeak `_-` |
| `ida’uu` | `+` | espeak `+` ONLY — **absent from the corpus and both referees**. Same verbal-noun POS as `hir’isuu`, and `+` has ZERO corpus instances, so it can affect no real reading. Recorded as the layer's weakest word. |
| `caalaa` + `xiqqaa` / `guddaa` | `<` / `>` | corpus ×46 / ×27 / ×many. espeak's *ni xiqqata* is a finite verb inserted between operands; Oromo's comparative is `A B caalaa xiqqaa` ("A smaller than B"), so the sourced PIECES are composed rather than espeak's word order copied (the Fula POS lesson) |
| `si’a` | `×` | corpus ×1 (`gati warqee si’a kuudhanii ol` = "ten TIMES the price of gold") — the multiplicative sense, and it precedes its number, which is the slot the rule uses |
| `hanga` | range joiner | corpus ×6 BETWEEN two numbers (`8 hanga 100`, `340 hanga 500tti`, `parsantii 3 hanga 5`, `100 hanga 250`, `10 hanga 15`, `US$11,000 haga $22,500`) — attested as an INFIX, which is the Fula check |
| `keessaa` | fraction "out of" | corpus ×106, incl. `filannoof dhihaatan 17,000 keessaa` = "out of 17,000" — denominator-first, which is why `1/5` becomes `shan keessaa tokko` |
| `daqiiqaa` | clock minutes | corpus ×4 incl. `daqiiqaa 3 dura` (noun before its number) |
| `ganama` / `galgala` | a.m. / p.m. | corpus ×5 / ×8, incl. `ganama keessaa 07:19`, `galgala keessaa 09:19` — the corpus's own way of marking the half-day |
| `dhaloota Kiristoos dura` | `D.K.D` | corpus ×3, verbatim (`dhaloota Kiristoos dura bara 10,000 keessa`) |
| `fakkeenyaaf` / `kan kana fakkaatan` | `fkn.` / `kkf.` | corpus ×7 / ×2 |
| `digirii` | `°` | corpus ×2 + epitran referee ×1. **POS check: both corpus instances are the ACADEMIC degree** (`digirii gita lammaffaa`); the angular/temperature sense is the same borrowing |
| `kaaba` `kibba` `bahaa` `dhihaa` | N S E W | all corpus-attested compass words |
| `kiiloomeetira` `meetira` `miiliimeetira` `kiiloo giraama` `maayilii` `inchii` `iskuweer` `sa’aatii` `sekoondii` | units | every one corpus-attested (`kiiloomeetira` ×2, `meetira` ×3, `miiliimeetirii` ×1, `kiiloo giraama` ×1, `maayilii` ×16, `inchii` ×2, `iskuweer` ×4, `sa’aatii` ×10, `sekoondiitti` ×1) |

**Could not source, and therefore NOT emitted:** the temperature scale names (Celsius/Fahrenheit — no
`selsi*`/`faaren*` token in corpus, referees, manifest or espeak), so `°C` reads *digirii N* and the scale
letter is left unread rather than guessed; Oromo LETTER NAMES for an initialism pass (espeak's `om_list`
does carry them — `a→a:`, `b→ba:`, `c→tS`a:` … — so the 64 corpus initialisms are a sourced follow-up, but
out of this layer's scope); `¥` (no source, and the sign never occurs).

## Run 5 — 2026-08-02 — where the numeral suffixes attach (the trap-14 morphology)

Question: when the layer converts `1994tti` to words, what does the enclitic attach TO? Mined the corpus
for every word beginning with a numeral stem:

```
tokkotti ×7  tokkootti ×3  lamatti ×2      → -tti after a VOWEL: bare concatenation
tokkoof ×6   jahaaf ×1     sadiif ×3  saddeetiif ×1  shananiif ×1 → -f LENGTHENS the final vowel / takes ii after a consonant
tokkoon ×7   lamaan ×9     sadiin ×2  shaniin ×1     saddeetiin ×1 → -n, same
tokkotu ×1   tokkootu ×1                              → -tu after a vowel: bare
afuri ×1  afurii ×1  kudhanii ×2                      → a consonant-final stem takes a linking i/ii
```

Ordinals, from the corpus's own spelled-out forms:

```
tokkoffaa ×3(+1 cap)  lamaffaa ×3 / lammaffaa ×8  sadaffaa ×4  afuraffaa ×2 / afraffaa ×2
shanaffaa ×3  jahaffaa ×1  torbaffaa ×2  saglaffaa ×1  saddeetaffa ×1  digdammaffaa ×1
```

The rule that fits all of them: **vowel-final stem → concatenate** (tokko→tokkoffaa, lama→lamaffaa,
jaha→jahaffaa, torba→torbaffaa); **final `ii` → `a`** (sadii→sadaffaa); **consonant-final → link `a`**
(afur→afuraffaa, shan→shanaffaa, sagal→sagalaffaa, saddeet→saddeetaffaa). The corpus's *lammaffaa*,
*saglaffaa*, *afraffaa*, *digdammaffaa* are the syncopated/geminated variants of the same forms; the
unsyncopated variant is attested for each of them too (*lamaffaa*, *afuraffaa*), so the rule emits the
regular one.

Implication: no ordinal TABLE is needed — the ordinal is composed from the existing cardinal, so it is
correct at 8, 10 and 190 as well as at the values the corpus happens to write (trap 13 (pin the rule's BRANCHES)'s constructive half).

## Run 6 — 2026-08-02 — a crash the de-grouping exposed (playbook step 3: is the defect in this layer?)

```
npx tsx <probe>   → TypeError: Cannot read properties of undefined (reading 'replace')
                    at link (src/languages/oromo/numbers.ts:24) ← TENS[78]
```

Question: why does `783,562` throw once the grouping comma is removed? Finding: `numberToWords` built its
thousands head with `below100(th)`, so any thousands count ≥ 100 indexed `TENS[⌊th/10⌋]` out of range. It
was unreachable before this change only because the tokenizer split a grouped number AT THE COMMA — the very
defect the layer exists to fix. Implication: fixed in `numbers.ts` (`below1000`), not papered over in
`normalize.ts`; the corpus has two such numbers (`783,562`, `291,773`) and both now read as one number.

## Run 7 — 2026-08-02 — enumerating the rule's BRANCHES (trap 13 (pin the rule's BRANCHES))

Ran every ordinal 1–30 plus 40…200, 1000, 1994, 2010 through the composer, and every enclitic over
1,2,3,4,5,8,9,10,11,20,30,100. Read the list. The interesting rows:

```
  8ffaa saddeetaffaa    9ffaa sagalaffaa   10ffaa kudhanaffaa   100ffaa dhibbaffaa
 16ffaa kudha jahaffaa 190ffaa dhibba sagaltamaffaa            1994ffaa kuma dhibba sagal sagaltamii afuraffaa
 -tti  tokkotti · lamatti · sadiitti · afuritti · shanitti · kudhanitti · digdamatti
 -n    tokkoon · lamaan · sadiin · afuriin · shaniin · saddeetiin · kudhaniin
 -f    tokkoof · lamaaf · sadiif · afuriif · shaniif · saddeetiif · kudhaniif
```

Every row that the corpus independently spells (tokkotti, lamatti, tokkoon, lamaan, sadiin, shaniin,
saddeetiin, tokkoof, sadiif, saddeetiif) matches it. No branch produces a form the corpus contradicts.
Negative result worth keeping: `-tti` after a consonant (*shanitti*, *afuritti*) is NOT attested anywhere —
it is the linking vowel of *afuri*/*kudhanii* applied to the suffix class the corpus only shows after
vowels. That is the layer's least-supported inference, and it is stated here rather than hidden.

## Run 8 — 2026-08-02 — the corpus diff, and the one defect only it could see

```
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/om.before --after /tmp/om.after --corpus om_et
→ changed 114/1218 (9.4%)
   before { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 8, THROW: 0 }
   after  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 0, THROW: 0 }
```

Read all 114 (not the 12 the tool prints). Every one is an instance of a documented step. THE ONE DEFECT:

```
SRC  Akkaataan Gootiikii jaarraa 10ffaa - 11ffaa fi jaarraa 14ffaa’ti …
  -  … kˈuᶑan fːˈaː  …
  +  … kuᶑanafːˈaː hirʔˈisuː kˈuᶑa tokːofːˈaː …          ← "the tenth MINUS the eleventh"
```

An ORDINAL RANGE, spaced. The mined artifact reports `ordinal-range: 0` for om, which is trap 8 (zero corpus instances is not evidence of…) exactly:
the cell's count is not evidence, and the shape exists. Two fixes: an ordinal-range rule
(`Nffaa - Mffaa` → *hanga*), and a variable-length lookbehind on the minus rule so a hyphen with a number
anywhere before it can never be a subtraction. Both are pinned in `test/oromo.test.ts`, including the
spaced descending score `5 - 3`, which must stay untouched.

## Run 9 — 2026-08-02 — the gates

```
npx tsc --noEmit                                   → clean
npx vitest run                                     → 200 files, 2685 tests, all pass
npx tsx tools/normalization/mine.ts scan --lang om → no defects (was: DROP currency ×4, percent ×3,
                                                     degree ×1, math-sign ×1)
npx tsx tools/normalization/review.ts --lang om    → checklist clean; sourcing: all 4 high-traffic
                                                     words attested (parsantii, doolaara, paawundii, tuqaa)
npx tsx tools/referee-eval/eval.ts om              → BYTE-IDENTICAL to main@aba9257
                                                     epitran 5334/5336 (100.0%), kaikki 49/51 (96.1%)
corpus-diff                                        → 114/1218 changed, every defect counter 0
```

Out of scope and left for a follow-up, with its source already found: the 64 corpus INITIALISMS (USA,
NBA, PTWC, ACMA, OHA, HJR-3) still read as Qubee letter runs — `PTWC` → `[ptʼwt͡ʃʼ]`. espeak's `om_list`
carries the full Oromo letter-name inventory (`a→a:`, `b→ba:`, `c→tS'a:`, `q→k'a:`, `x→t'a:` …), so an
initialism pass is sourceable; it needs `makeUnreadableTest` phonotactics and an acronym list, which is a
change of a different shape from this one.

## Run 8 — 2026-08-02, review before merge

Rebased onto `main`. Gates as submitted all reproduce: `review.ts --lang om` checklist clean, `mine.ts scan`
no defects, referee byte-identical, corpus diff 114/1218 with DROP 8 → 0.

### The class the layer was built for, in the spelling it did not look for

The layer's premise is trap 14 (agreement cannot be applied to digits) — the enclitic glued to the digits (`1994tti`, `16ffaa`, `2020f`) — and it
handles ~35 of those. Reading the corpus diff turned up `sa’a 1:15 a.m tti` still ending in a bare `tːi`,
which prompted the obvious question the implementation never asked: how often does this corpus write the
same morpheme **with a space**?

```
$ awk -F'\t' '{print $3}' om_et/*.tsv | sort -u | grep -cE '[0-9] (tti|ti|tiin|f|n)\b'
24
$ … | grep -ohE '[0-9] (tti|ti|tiin|tu|ttan|if|f|n)\b' | awk '{print $2}' | sort | uniq -c
      1 f      1 n      2 ti      1 tiin     19 tti
```

**24 unique utterances — more sentences than the glued form appears in.** `bara 1945 tti`, `hanga 100 tti`,
`sa’aatii 24 f`, `qabxii 2,207 n`, `$22,500 tiin`, `miliyyoona 2.8 tti`, `D.K.D 5000 tti`. And the reading is
the *same impossibility* the glued rule exists to prevent: a standalone `tti` is the word-initial geminate
[tːi], a standalone `f`/`n` a bare consonant. Detaching a bound postposition is a slip of the orthography,
not a word boundary, so the space is not evidence of anything.

Nothing flagged it. Not the mined artifact, not the scan, not the corpus diff, not the review checklist —
with the space, the text is a number followed by a short word, which is what every measure phrase looks
like. It was visible only by reading the changed utterances and noticing what had *not* changed.

Rule 14b, and two deliberate narrowings:

- **The spaced alternation is `tiin|tti|ti|f|n`, narrower than the glued `ttan|tiin|tti|ti|tu|if|f|n`** —
  exactly what was counted (trap 9 (a guard alternative with no attested…)). Leaving `tu` out is not bookkeeping: `tu` IS an Oromo word, the focus
  marker (`Caribe tu jiraata`), and only the absence of a space distinguishes the two. The corpus glues
  `tu` and never detaches it.
- **One space, no punctuation across it.** A clause break really does end the numeral phrase; `bara 1945,
  tti` is pinned untouched. `fi` is safe by construction — the trailing-letter guard rejects `f` + `i`.

Plus the half-day arm: step 5 consumes the meridiem and emits *ganama*, so in `sa’a 1:15 a.m tti` the
enclitic no longer has digits in front of it. Same regular morphology (vowel-final stem, short link). The
morphology is corpus-attested; this particular output form is not, which is the honest statement of it.

### A regression the corpus diff caught, from the fix itself

First measurement after 14b: 25 utterances changed, and one was wrong.

```
- safːisawːˈan ᶑˈibːa sadːˈeːt lˈama tukʼˈaː tˈokːo tˈokːo n
+ safːisawːˈan ᶑˈibːa sadːˈeːt lˈama tukʼˈaː tˈokːo tokːˈoːn      ← 802.11n
```

Step 8 spaces the version letter off the digits, so `802.11n` reaches pass 2 as `802 tuqaa 1 1 n` — a digit,
a space, an `n`, byte-for-byte the shape of the corpus's detached enclitic. The Wi-Fi standard's letter was
read as a case suffix. Fixed at the source: step 8 now sets the letter off with a HYPHEN, which the
tokenizer skips (it matches only letters, digits and clause marks), so the reading is unchanged and the
shape is no longer ambiguous — the same device Malay's `11-g` uses. Pinned in the tests.

Final delta vs the PR as submitted: **24 utterances, every one a standalone `tːi`/`tˈi`/`f`/`n` becoming an
attached enclitic, no other change.** Corpus diff 114 → **130/1218 (10.7%)**, all five classes still zero.

### Not fixed, and why

`12.00 GMT tti` still reads a bare `tːi`. The host is an INITIALISM, not a numeral, and Oromo initialisms
are the declared follow-up (64 instances, `PTWC` → `[ptʼwt͡ʃʼ]`); attaching the enclitic to `GMT` would give
`ɡmttːi`, which is worse than the gap. One utterance.

`°C`/`°F`: the `[CF]?` in step 11 CONSUMES the scale letter, so it is dropped, not merely left unnamed. The
code now says so plainly rather than calling it "unread". Confirmed unsourceable — no `selsi*`/`faaren*`
token in the corpus, either referee, the manifest, or espeak `om_list`. Zero corpus instances; the lesser of
two wrongs, since unconsumed a bare `C` reads as the Qubee ejective [t͡ʃʼ], a phoneme rather than a word.

### A cell that was tried and rejected

`mine.ts` gained nothing here. Every per-sentence regex for "a bound suffix written with a space" —
`\p{Nd} \p{Ll}{1,4}` and narrower — also matches `5 km`, `3 hari`, every measure phrase in every language,
so the cell reports COVERED everywhere and tells you nothing. The evidence for this defect is a
corpus-level statistic (the same morpheme appearing both glued and detached), which is not a shape a cell
can hold. Recorded as playbook trap 15 (the same bound suffix is also written with…) instead, with the grep that finds it in seconds.

### Gates after the fixes

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 201 files, **2698 tests, 0 failed** (12 new) |
| `mine.ts scan --lang om` | 107 lines, **no defects** |
| `review.ts --lang om` | **checklist clean**, all 8 checks |
| `corpus-diff` om_et | **130/1218 (10.7%)**, DIGIT 0 / SLOT-GAP 0 / RAWMARK 0 / DROP 0 / THROW 0 (DROP was 8) |
| `referee-eval om` | **unchanged**: epitran 5334/5336 (100.0%), kaikki 49/51 (96.1%) |

## Run 9 — 2026-08-03, the initialism deferral, closed

#602 deferred initialisms (64 instances) with the note that espeak's `om_list` "carries the full Oromo
letter-name inventory, so an initialism pass is sourceable". The new `tools/normalization/sources.ts` reports
`om` as **WIREABLE, not yet wired**, which is what brought it back — the deferral was correct at the time and
had simply never been actioned.

The table is read straight off `dictsource/om_list` lines 42–67, all 26 Qubee letters, as CV names:

```
b  ba:     c  tS`a:     q  k`a:     x  t`a:     n  na   ← short, the one exception
```

Transcribed back into Qubee so the g2p produces espeak's own phonemes, and round-tripped to prove it:
`baa`→[bˈaː], `caa`→[t͡ʃʼˈaː], `qaa`→[kʼˈaː], `xaa`→[tʼˈaː].

Oromo needs almost no lexical list, because it permits essentially **no complex onset**: the shared
phonotactic rule spells `DNA`, `GPS`, `GMT`, `FBI`, `MRI`, `TV` with no data entry at all. Ten entries cover
the vowel-initial readables (`us`, `uk`, `usa`, `usaf`, `ucla`, `uw`, `aol`, `oha`, `utc`, `wned`); `UNESCO`,
`ACTA`, `REM`, `ROV`, `SUV` are left as words.

### The ordering hazard, and why `ii` is the one to check

The vowel letter name for ⟨i⟩ is `ii` — and a standalone `ii` reads as **[lˈama], "two"**, because
`core/roman.ts` treats it as Roman II. That would put "two" at the end of every `MRI`. It does not, because
`normalizeRomans` is applied in `registry.ts` **wrapping** `engine.text()`, so it runs before this pass and
never sees an emitted letter name. Verified end-to-end and pinned:

```
seenaa II jedhu   ⇒ seːnˈaː lˈama d͡ʒˈeᶑu      the SOURCE Roman still reads as 2
MRI scanner       ⇒ mˈaː rˈaː ˈiː st͡ʃʼanːˈer   the EMITTED ii is the vowel
D.K.D 5000 tti    ⇒ ᶑalˈoːta kiristˈoːs dˈura … the era marker still expands, not DAA-KAA-DAA
```

### The enclitic rides the last letter name

Two corpus instances turned out better than expected. `GPS'f` and `CCTV'n` carry Oromo case enclitics on the
initialism, and because the pass spells the letters and leaves the enclitic in place, the dative and
instrumental land on the final letter name exactly as the orthography writes them:

```
GPS'f   ⇒ ɡˈaː pˈaː sˈaːʔf        "for G-P-S"
CCTV'n  ⇒ t͡ʃʼˈaː t͡ʃʼˈaː tˈaː vˈaːʔn
```

Still open and unchanged: `(NBA)n`, where the enclitic follows a closing bracket and so has no host — the
same orphan noted in Run 8 for `12.00 GMT tti`.

### Gates

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 201 files, **2800 tests, 0 failed** (2 new blocks) |
| `review.ts --lang om` | **checklist clean**, all 8 |
| `corpus-diff` om_et | **43/1218 changed**, DIGIT 0 / SLOT-GAP 0 / RAWMARK 0 / DROP 0 / THROW 0 — all 43 read |
| `referee-eval om` | **unchanged**: epitran 5334/5336 (100.0%), kaikki 49/51 (96.1%) |
