# ka (Georgian) normalization — investigation log

Chronological. Each run: the command, the question, the RAW finding, what it implies next.
Negative results and dead ends are kept deliberately.

## Run 1 — 2026-08-14 13:54 — baseline emitted before touching anything

    npx tsx tools/normalization/corpus-diff.ts emit --lang ka --corpus mined:ka --out /tmp/.../ka.before
    → emitted 452 utterances

Question: is a "before" reading captured while the tree is still clean (fan-out rule 2)?
Finding: 452 utterances emitted. `FLEURS` is unset, so `mined:ka` is the corpus. Note it emitted
452 while the artifact carries 453 segments (253 hard + 200 sample) — one duplicate or empty row
collapses; `compare` pairs by SOURCE TEXT so that is not a problem.

Implication: safe to start editing.

## Run 2 — 2026-08-14 13:56 — what the corpus actually contains

Artifact: `tools/corpus/mined/ka.jsonc`, ka.wikipedia dump, **1,025,770 paragraphs**, 33/35 cells
covered, 253 hard + 200 sample segments. It is the largest artifact in the tree.

Whole-corpus counts from the artifact's own `counts` block (these are dump-wide, not artifact-wide):

    digit-run 487929 · year 486946 · latin-in-native 234137 · abbrev 167110 · initialism 120685
    ranges 93177 · roman 70296 · decimals 54471 · letter-name 54162 · grouped 41173
    exponent 28815 · dotted 26906 · signs 24575 · percent 17136 · clock 13912
    era-marker 6492 · ampersand 6793 · fractions 4837 · signed-number 3303 · rate 3252
    degrees 2988 · arithmetic 2230 · currency 1376 · ordinal-latin 1262 · units 133
    ordinal-native 0 · calendar 0 (lexical cells, no term list) · iteration 4 · ordinal-range 1

Tabulated over the 453 artifact segments (`grep`-style, python, counts are artifact-local):

| shape | count | examples |
|---|---:|---|
| digits + hyphen + Georgian suffix | **59** | `1900-იან`, `2000-მდე`, `100-ზე`, `25-ე`, `8-ჯერ`, `4719-ს` |
| — `-იან(ი)` decade adjective | 13 | `90-იან წლებში`, `1920-იანი წლების` |
| — `-მდე` "up to" | 9 | `2000-მდე`, `140-მდე`, `37 000-მდე` |
| — `-ზე` "on/at, than" | 8 | `1000-ზე მეტი`, `03:14:08-ზე` |
| — `-ე` ORDINAL | 6 | `179-ე`, `25-ე`, `41-ე` |
| — `-ს` dative | 5 | `83 500-ს`, `$4719-ს`, `210–ს` |
| — `-ის` genitive | 5 | `Fortune 500-ის`, `ლბ1-ის` |
| — `-დან` ablative | 4 | `1895-დან 1906 წლამდე`, `1,5-დან 6 %-მდე` |
| — `-ჯერ` "times" | 2 | `8-ჯერ`, `2-ჯერ` |
| — `-წლიანი` / `-კაციანი` compound noun | 2 | `12-წლიანი`, `120,000-კაციანი` |
| — `-დაახლ` / `-ძვ` **NOT a suffix** | 4 | `549/546-დაახლ.ძვ.წ. 480` — a RANGE DASH before an abbreviation |
| `მე-N` ordinal CIRCUMFIX | 7 | `მე-5`, `მე-13`, `მე-18` |
| percent (incl. suffixed) | 100 | `5 %`, `2%`, `82%-ით`, `98 %-მა`, `4 %-ს`, `54 %-ის` |
| degrees | 40 | `12 °C`, `2 °C-მდე`, `25 °C-იდან`, `12 °C-ია`, `0 °C-ს` |
| ranges (dash between digits) | 112 | `1972-1985`, `1995–2003`, `408 - 355`, `520- 450` |
| space-grouped thousands | 45 | `5 000`, `37 000`, `83 500`, `51 242`, `1 900 000` |
| comma+3 digits (grouping) | 7 | `5,837,213`, `1,300`, `$4,719` |
| comma+1–2 digits (decimal) | 105 | `1,5`, `0,3`, `48,7 %`, `$529,9 მილიარდი` |
| dot+1–2 digits (decimal) | 37 | `4.52`, `21.32 %`, `0.01` |
| clock `h:mm(:ss)` | 12 | `15:00`, `03:14:08-ზე`, `21:39:42`, `8:04` |
| currency | 25 | `$25 მილიონი`, `€4,9 მილიარდი`, `$316 მლრდ`, `$51 242-ს` |
| units after a digit | 102 | `500 მმ`, `1 კმ`, `560 მ`, `1000 კვტ`, `2 მლნ`, `15 ათ.` |
| exponent | 31 | `კმ²` ×25, `სმ³` ×2, `მ²` ×1 |
| rate (slash) | 14 | `კაცი/კმ²` ×7, `კმ/სთ`, `კვტ/სთ`, `ცენტი/აკრზე` |
| dotted abbreviations | 280 tokens | `ძვ.წ.` 13 + `ძვ. წ.` 8, `ე.წ.` 4 + `ე. წ.` 3, `წ.` 6, `წწ.` 5, `მლრდ.` 9, `ათ.` 7, `გვ.` 2, `მ. შ.` 2, `სხვ.` 3, `დ.` 13, `გ.` 14 |
| Roman numerals | 211 | `XX`, `XVIII`, `XIX` … + `C` ×75 (which is the CELSIUS letter, not a numeral) |
| `‰` | 1 | `210–ს ‰` |
| `№` | 1 | |
| `&nbsp;` entity residue | 45 | `&nbsp;°C` — stripped upstream by the markup pass, verified in Run 3 |

### ⚠ The negative result that shapes the whole layer: `2011 წელს` is NOT a bound suffix

The task brief flagged `2011 წელს` as a glued-suffix hazard (trap 15). Counted: **312 instances of
`\d{3,4} <year-noun>`** (`2014 წლის` ×10, `1991 წლის` ×9, `1992 წელს` ×4 …) — and every one is a
SPACED, fully-spelled Georgian NOUN (წელი "year", declined: წლის gen, წელს dat, წლებში loc.pl,
წლიდან abl). A Georgian numeral used attributively before a noun does **not** decline; the NOUN
carries the case. So this shape is already correct: the digits read as a plain cardinal and the noun
phonemizes as an ordinary word. **No rule needed, and writing one would be a misfire generator.**

This is trap 15 answered in the negative for this language, and it matters because it is the single
highest-count numeric shape in the corpus (year 486,946). The bound-suffix problem in Georgian is
confined to the HYPHENATED form, which is what the 59 instances above are.

## Run 3 — 2026-08-14 13:57 — probe the engine (step 2: the defect list)

    npx tsx .probe/p.ts '<form>' …    (a throwaway harness over phonemize(f,"ka"))

RAW output — what the engine produces TODAY, before any layer exists:

    100-ზე მეტი   → asi zɛ mɛtʼi                    the postposition as a FREE WORD
    2000-მდე      → ɔɾi atʰasi mdɛ                  ditto; and the numeral keeps its nominative -ი
    90-იან წლებში → ɔtʰχmɔt͡sʰdaatʰi ian t͡sʼlɛbʃi    -იან as a free word
    მე-5 ადგილზე  → mɛ χutʰi adɡilzɛ                the circumfix's მე as a word + a CARDINAL
    25-ე დღე      → ɔt͡sʰdaχutʰi ɛ dʁɛ               cardinal + a bare vowel ე
    8-ჯერ         → ɾva d͡ʒɛɾ                        two words where Georgian has one
    5 %           → χutʰi                           % DROPPED  (17,136)
    82%-ით        → ɔtʰχmɔt͡sʰdaɔɾi itʰ              % dropped AND the suffix free-standing
    12 °C         → tʰɔɾmɛtʼi sˈiː                  ° dropped, C read as ENGLISH "see"  (2,988)
    2 °C-მდე      → ɔɾi sˈiː mdɛ
    1,5           → ɛɾtʰi , χutʰi                    decimal comma → a CLAUSE PAUSE  (54,471)
    4.52          → ɔtʰχi . ɔɾmɔt͡sʰdatʰɔɾmɛtʼi      decimal dot → a clause pause
    5 000         → χutʰi nuli                      "FIVE ZERO"  (41,173 grouped)
    1 900 000     → ɛɾtʰi t͡sʰχɾaasi nuli            "one nine-hundred zero"
    5,837,213     → χutʰi , ɾvaas … , ɔɾas t͡sʰamɛtʼi   three numbers and two pauses
    1972-1985     → atʰas … atʰas …                 hyphen dropped, no joiner  (93,177 ranges)
    15:00         → tʰχutʰmɛtʼi , nuli              the COLON reads as a pause  (13,912)
    03:14:08-ზე   → sami , tʰɔtʰχmɛtʼi , ɾva zɛ
    $25 მილიონი   → ɔt͡sʰdaχutʰi miliɔni            $ DROPPED  (1,376)
    1/3-ს         → ɛɾtʰi sami s                    slash dropped  (4,837)
    500 კმ²       → χutʰasi kʼm                     ² DROPPED and კმ reaches the IPA as /kʼm/
    5 სმ³         → χutʰi sm
    120 კმ/სთ     → as ɔt͡sʰi kʼm stʰ
    25 მლრდ.      → ɔt͡sʰdaχutʰi mlɾtʰ .            "billion" as the cluster /mlɾtʰ/ + a false pause
    15 ათ.        → tʰχutʰmɛtʼi atʰ .
    ძვ. წ. 480    → d͡zv . t͡sʼ . ɔtʰχas ɔtʰχmɔt͡sʰi  the era marker as two clusters + two false pauses
    ე. წ. სახელი  → ɛ . t͡sʼ . saχɛli
    გვ. 12        → ɡv . tʰɔɾmɛtʼi
    210 ‰         → ɔɾas atʰi                       ‰ dropped
    № 5           → χutʰi                           № dropped
    +30 / −500    → ɔt͡sʰdaatʰi / χutʰasi           both signs dropped
    XX საუკუნის   → ɔt͡sʰi saukʼunis                the registry's roman pass gives 20 → a CARDINAL
    XVIII საუკუნე → tʰvɾamɛtʼi saukʼunɛ             (Georgian reads a century as an ORDINAL)
    A&B           → ˈə bˈiː                         & dropped (the Latin run is hosted out)
    1 &nbsp;°C    → ɛɾtʰi sˈiː                      the entity IS stripped upstream — not our problem

Implications for the next step:

1. The **space-grouped thousand** is the worst single reading in the list — `5 000` → "five zero" —
   and it is 41,173 instances. It must be step 0, before anything reads a pause or a range.
2. The **glued suffix** family (59 artifact instances) is trap 14 exactly: the postposition/case
   ending reads as a free word because the digit only becomes words in the TOKENIZER. Georgian
   attaches these to the numeral WORD, and the numeral's final -ი is lost or changed before them —
   so the rule must wordify first, then attach. Needs the morphology sourced.
3. The `მე-N` / `N-ე` ordinal is a genuine **circumfix** and both halves are attested (7 + 6). It
   must be read as an ordinal word, not a cardinal.
4. `%`, `°C`, `$`/`€`, `²`/`³`, `‰`, `№`, `+`/`−` are all silent drops. `%` and `°C` are the two with
   real volume.
5. The roman-century question needs tabulating before ruling (trap 4): `C` ×75 in the artifact is the
   Celsius letter, so any roman rule must not be keyed on a bare letter.

## Run 4 — 2026-08-14 14:05 — sourcing (§5c/§5e), and the one class that has no source

    npx tsx tools/normalization/sources.ts --lang ka
    npx tsx tools/normalization/attest.ts --lang ka --words …   (five batches, cached in tools/corpus/attest/ka.jsonc)

Question: what may this layer actually say? RAW: **espeak does not ship Georgian at all** — the fleet's
usual phonetic fallback is unavailable, so the tiers are this corpus, `ka.wikipron-kat-narrow.tsv`
(20,896 entries) and ka.wikipedia.

Attested WITH the sense read (the citations are copied into normalize.ts's header):

| slot | word | evidence |
|---|---|---|
| `%` | პროცენტი ×29/9 | *"პროცენტი (ლათ. per centum — „მეასედი“; აღნიშვნა: %)"* — names its own sign |
| `‰` | პრომილე ×5/3 | *"პრომილე … აღინიშნება ‰ სიმბოლოთი"*, running `36 პრომილე` |
| `°C` | გრადუსი ცელსიუსი | *"ცელსიუსის გრადუსი (სიმბოლო: ° C)"* + running *"34 გრადუსი ცელსიუსი"* — word AND order |
| `°F` | გრადუსი ფარენჰაიტი | *"ფარენჰაიტის გრადუსი — ტემპერატურის საზომი ერთეული"*; ×0 here (trap 8's neighbour) |
| `$` `€` | დოლარი, ევრო | *"1995 წელს $380 მილიარდზე მეტი დოლარი"* — sign+word in one sentence, and it fixes the POSITION |
| `−` | მინუს ×18/12 | *"მინუს 22 გრადუსი ცელსიუსით"*; and THIS corpus writes *"დახრილობა — მინუს 7.2°"* |
| `+` `=` | პლუს, უდრის | one sentence gives both: *"„ორს პლუს ორი უდრის ხუთს“ (2 + 2 = 5)"* |
| `²` `³` | კვადრატული, კუბური | THIS corpus glosses them: *"1 Mm² აღნიშნავს ერთ კვადრატულ მეგამეტრს"*, *"426 კუბური სანტიმეტრი"* |
| `მმ` `კმ` `სმ` `მ` | მილიმეტრი … | the corpus glosses ⟨მმ⟩ in one paragraph (*"572 მილიმეტრს … (86 მმ)"*) |
| `წთ/სთ/წმ` | წუთი/საათი/წამი | one wiki sentence glosses all three: *"წუთი (წთ, min), საათი (სთ, h) … 1 სთ = 3600 წმ"* |
| `ძვ.წ.` `ახ.წ.` | ძველი/ახალი წელთაღრიცხვით | one hit carries both forms: *"თარიღდება ძვ. წ. I და ახალი წელთაღრიცხვით I-IV საუკუნეებით"* |
| `№` | ნომერი ×6/2 | *"ქიმიური ელემენტის რიგითი ნომერი"* |
| fraction | მესამედი / მეასედი / მეათედი | derived from the ordinal + -ედ, and VALIDATED where the answer is known: the derivation reproduces მეასედი and მეათედი, which the wiki states independently as the readings of % and ‰ |

### ⚠ The negative: the DECIMAL SEPARATOR word does not exist in any tier here

The word-first probes fail on sense, twice over (trap 37): `მთელი` ×19/6 is every time the INTEGER
(*"მთელი რიცხვები"*), `მძიმე` ×58/9 is every time "heavy" (*"მძიმე როკი"*, *"მძიმე მეტალი"*) — the
punctuation sense exists (*"მახვილისა (') და მძიმის (,)"*) but that is what the mark is CALLED.

So the probe was inverted to name the SLOT instead of a candidate (trap 40) — the two words a reader
would say around a decimal point:

    npx tsx tools/normalization/attest.ts --lang ka --words "ნული მთელი","ერთი მთელი","ორი მთელი","სამი მთელი","მთელი ხუთი"
      ნული მთელი   0  0  0  absent
      ერთი მთელი   0  0  0  absent
      ორი მთელი    0  0  0  absent
      სამი მთელი   0  0  0  absent
      მთელი ხუთი   1  1  0  attested   ← "მთელი ხუთი წუთისა" = a WHOLE five minutes. Wrong sense.

Zero, in the one probe shaped to find it. Implication: the word is not authored. But the refusal is not
neutral (trap 53) — the DEFECT is that the separator reads as a CLAUSE PAUSE, which is wrong under every
candidate reading, so step 12 replaces the separator with a SPACE and adds nothing. 142 artifact
instances, 54,471 dump-wide. Priced in the file header; the day a word is sourced, step 12 is one string.

## Run 5 — 2026-08-14 14:30 — first corpus diff, and TWO ordering bugs it caught

    npx tsx tools/normalization/corpus-diff.ts emit/compare --lang ka --corpus mined:ka
    → changed 212/452 (46.9%), DROP 106 → 22, RAWMARK 1 → 0

Question: what does the layer do to ordinary text? Reading the changes rather than the counts found two
defects that every unit probe had passed:

1. **THE MINUS VANISHED ON ALL NINE OF ITS TRUE INSTANCES.** `მინიმუმი - 32 °C.` read
   *minimumi ɔt͡sʰdatʰɔɾmɛtʼi ɡɾadusi t͡sʰɛlsiusi* — no *მინუს*. The sign rules were written LAST, and the
   minus guard is "a sign before a figure that is followed by `°`" — by then the degree rule had already
   spent the `°`. Same for `(-28 მ)`, whose unit had been consumed. **Trap 39 exactly**: a guard's evidence
   has a lifetime. Fixed by moving the whole sign block to step 2, above everything that spends a degree
   or a unit. All 12 measured negatives fire now, and the two ranges that end in `°C` are still ranges.
2. **`98 კაცი კმ²-ზე` READ AS *კაციკვადრატულ კილომეტრზე*** — two words fused. The exponent rule was
   `(\d…)?\s?(unit)([²³])`, and with the operand absent the `\s?` swallowed the word boundary and the
   replacement did not put it back (trap 10). Split into two arms, one with the operand and one without.

Neither was visible in a unit probe, which is the corpus diff earning its keep for the third time in this
document's history.

Also read out of the diff, and NOT this layer's business:
- `1 900 000` de-groups correctly and then `numbers.ts` composes *ერთი მილიონ ცხრაასი ათასი*, where the
  hundred multiplier should truncate before ათასი (*ცხრაას ათასი*). Pre-existing in the vigesimal
  composer, and strictly better than the *ერთი ცხრაასი ნული* it replaced. Left alone; recorded here.
- `V საუკუნეში` read as the ENGLISH letter name *vˈiː* — see Run 6.

## Run 6 — 2026-08-14 14:47 — review.ts, and three things it surfaced

    npx tsx tools/normalization/review.ts --lang ka

1. **`5 km` → *χutʰi ˈʊkm*.** The unit table was Georgian-only; digit-adjacent Latin is only 7 tokens in
   this corpus (`8GB`, `25 GB`, `9mm`, `10mm`, `900`/`2100 MHz`) and ⟨km⟩ is ×0 — but that is a fact about
   the corpus's orthography, not the language's vocabulary (trap 38), and the reading is a pronounceable
   non-word no leak class sees (trap 56). Added `km mm cm kg` as Latin aliases, MULTI-LETTER only, and
   labelled robustness rather than a measured repair (trap 22).
2. **`minus -5` DROPPED.** Re-measured rather than accepted: a sign GLUED to its figure after a space,
   bracket or string start is **14 instances, 12 true and 2 false**, and both false ones are
   `(1627 –1628)` / `(2014 –2017)` — year ranges spaced on the left and glued on the right, removed
   exactly by `(?<!\d\s)`. The remaining false-positive class (a value-introducing dash,
   `მაქსიმუმი – 760 მმ`) is SPACED after the sign every time. Widened; the class is now green and the
   elevation `-28 მეტრიდან`, whose unit is spelled so no `°` guard could see it, reads too.
3. **`V საუკუნეში` → *vˈiː saukʼunɛʃi*.** `core/roman.ts` line 172 declines every one-letter token —
   *"single letters are never worth the risk (I, V, X, C, D, M, L)"* — which is right for the fleet.
   ⟨V⟩ ×4 and ⟨X⟩ ×1 in this corpus are centuries. **Not fixed in core** (that would touch 191 languages);
   fixed locally, because the century NOUN is the disambiguator and it is language-specific. Restricted to
   I/V/X, since ⟨C⟩ is the Celsius letter ×75 here.

Two checks that came back NEGATIVE and are worth keeping:
- **The century rule cannot misfire on a plain count.** `grep` for a digit-sourced `\d+ საუკუნ` in the
  artifact: **0 instances**. Every one of the 58 is roman-derived, so the ordinal reading is unconditional.
- **Widening `=` to letter operands would be measurably wrong.** The probe form `x = y` reports DROPPED;
  every letter-operand `=` in this corpus is a formula (`E = mc²`, `A=Eკ2-Eკ1`), a bibliographic TITLE
  equivalence (`Lingua Latina = ლათინური ენა`) or Java source. 5 wrong, 0 right. Refusal confirmed.

## Run 7 — 2026-08-14 14:56 — final gates

    npx vitest run                → 245 files, 4241 tests, 1 fail: the catalogue's `normalization` cell
                                    for ka changed → regenerated with derive-normalization.py + build.py,
                                    green (expected, per the fan-out brief)
    npx tsc --noEmit              → clean
    npm run check:package         → ok — 982 files, no docs/ tools/ test/
    npx tsx tools/referee-eval/eval.ts ka
                                  → 20848/20894 (99.8%) folded backbone, 100.0% symbol accuracy.
                                    ⚠ UNCHANGED BY CONSTRUCTION, not by luck: eval.ts imports
                                    `phonemizeWord` from georgian.ts (line 109), so the ka referee never
                                    enters `text()` and this layer cannot move it. Said explicitly so the
                                    "compared against the pre-change run" box is not ticked on a number
                                    that could not have moved.
    corpus-diff                   → changed 214/452 (47.3%); DROP 106 → 19, RAWMARK 1 → 0
    mine.ts scan                  → percent 37→0 · degree 20→0 · exponent 19→0 · currency 16→0 (1 now
                                    REDUNDANT, which is correct — trap 12) · minus 10→1 · RAWMARK 1→0.
                                    Left: math-sign ×8 (the `×` refusal + formula/title `=`), minus ×1
                                    (`(1885-–1889)`, a doubled-dash year range where the drop is RIGHT),
                                    ampersand ×9 ACCEPTED-CLASS.
    review.ts                     → 2 FAILING, both deliberate: `sign classes` DROPPED
                                    ± = < > × ÷ , and `artifact scan` on the same. See the file header
                                    for what each costs; none is silenced.

Sample-tier reading (44 of the 200 ordinary-text segments changed): every change checked by hand. The ones
worth naming — `1995-2004 წწ.` was reading *t͡sʼt͡sʼ* and is now *წლები*; `29 კმ-ით` was *kʼm itʰ* (a raw
cluster plus a free-standing case ending) and is now *ოცდაცხრა კილომეტრით*; `3 389 მ` was *სამი სამას
ოთხმოცდაცხრა m* and is now *სამი ათას სამას ოთხმოცდაცხრა მეტრი*; `2 217 პარტიზანი` de-groups. No
regression found in the sample tier.
