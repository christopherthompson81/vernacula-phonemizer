# Kamba (kam) text normalization — investigation log

Chronological. Each run records the command, the question it was meant to answer, the RAW finding, and what
that implied for the next step. Negative results are kept; they are most of the value here, because this
language has the thinnest sourcing haystack the sweep has met so far.

Target: `src/languages/kamba/normalize.ts`. Corpus: FLEURS `kam_ke`, no mined artifact.

---

## Run 1 — 2026-08-16 — the baseline, and the shape of the ground

    npx tsx tools/normalization/corpus-diff.ts emit --lang kam --corpus kam_ke --out <scratch>/base.json
    npx tsx tools/normalization/corpus-diff.ts compare --before base.json --after base.json
    npx tsx tools/referee-eval/eval.ts kam
    npx tsx tools/normalization/review.ts --lang kam
    cut -f3 {dev,test,train}.tsv | sort -u | wc -l

**Question.** Where does this language start, and how big is the corpus really?

**Raw finding.**

    emitted 1992 utterances
    DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 11 · THROW 0
    referee: raw exact 0/5 · folded backbone 5/5 (100.0%) · symbol accuracy 100.0%
    review: [FAIL] normalizer  src/languages/kamba/normalize.ts missing
    4,505 rows → 1,992 unique cased utterances

**Implication.** DROP=11 is low, and the brief is right that it says nothing about the classes that matter.
RAWMARK=0 in particular is a *false comfort*: a raw `km` in the IPA is Latin letters, not a "mark", so it
never reports. The referee is 5 words and cannot move — it is a floor, not a gate. Read the corpus by hand.

---

## Run 2 — 2026-08-16 — the codepoint census, and a finding nobody was looking for

    python3 — collections.Counter over every non-alphanumeric and every non-ASCII character in uniq.txt

**Raw finding — punctuation.** Twenty-three distinct non-alphanumerics in the whole corpus:

    .  2272   ,  1941   '  846   ()  159/157   “”  151/149   -  105   :  45   ;  29   /  20
    ?  11     ’  8      !  8     $  6   …  6    "  4   %  3   +  2   ~  2   £  1   °  1   &  1

⚠ **No en-dash, no em-dash, and `= < > × ÷ ± ‰ ¥ €` are all ×0.** So Karakalpak's em-dash-as-copula and the
whole arithmetic cluster cannot arise here, and six sign classes are closed by absence in one command.

**Raw finding — non-ASCII, and this is the round's real result.**

    ĩ U+0129  5126      ũ U+0169  3883
    î U+00EE   237      û U+00FB   151      í U+00ED  35   ú U+00FA  31   ì U+00EC  2

⚠ The tilde letters are written with a CIRCUMFLEX or an ACUTE **454 times**. In Kamba the tilde marks vowel
QUALITY (⟨ĩ⟩ = /e/, ⟨ũ⟩ = /o/), so this is not a typographic nicety — it is the ATR contrast.

**Implication.** Measure the blast radius before assuming it is noise, and check what the engine does with
⟨î⟩ today (Run 3). This is trap 61's "where to look for the next one" landing on the very next language.

---

## Run 3 — 2026-08-16 — the confusable is a silent wrong reading, 312 times

    python3 — every word token carrying [îíìûúù], with counts
    npx tsx probe2.mts — phonemize each bad spelling beside its correct twin

**Raw finding.**

    263 distinct words · 312 tokens · 91 of 1,992 utterances (4.6%)
    nthî(7) îla(6) kîla(4) nûndû(3) maúú(3) kûu(3) îngî(3) nyûmba(2) íúlú(2) andû(2) mûno(2) twî(2) …

    nthî  → ⁿði    vs  nthĩ  → ⁿðe          andû → aⁿdu   vs  andũ → aⁿdo
    íúlú  → iulu   vs  ĩũlũ  → eolo          maúú → mauu   vs  maũũ → maoː   (length lost too)
    wîyoo → wijɔː  vs  wĩoo  → wɛɔː          Katî → kati   vs  Katĩ → kate

⚠ **Every one of the 263 is an ordinary Kamba word** — several are among the commonest in the language — and
**not one is a foreign name.** The corpus's foreign-diacritic words are a disjoint set: `Gürses`, `Müslüm`,
`São`, `Asámi`, `Erdoğan`, `Erkoḉ`, none of which carries a confusable.

**Implication.** This is the Turkmen half of trap 61: both letters are Latin, the token class is Latin, so
nothing splits, nothing is dropped, and DIGIT / SLOT-GAP / RAWMARK / DROP are all blind. Fix it locally in
`normalize.ts` behind an "every other letter is one this alphabet uses" guard, per that trap's own
prescription — **not** by adding ⟨î û⟩ to the grapheme table, which would assert that the circumflex is a
Kamba letter and would misread a genuine foreign spelling.

---

## Run 4 — 2026-08-16 — the sourcing floor: no wiki, no espeak

    npx tsx tools/normalization/attest.ts --lang kam --words "asilimia,pasenti,ndola,paundi,…"
    npx tsx tools/normalization/sources.ts --lang kam
    ESPEAK_NG=/home/chris/Programming/espeak-ng npx tsx tools/normalization/sources.ts --lang kam

**Raw finding.**

    kam.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence.  [exit 3]

    [NONE] letter-names     espeak does not ship this language at all
    [NONE] decimal-point    no _dpt, no _., no manifest word — read the fraction digit-by-digit
    [NONE] fraction-series  fraction occurs, no series to compose from
    [chk?] percent-word / currency-word / unit-word / minus-word / ampersand-word
    espeak: NOT SHIPPED for this language · referee: 8 lines · corpus: 4506 lines

`espeak-ng/dictsource/` has `sw_list` and no `kam_*` of any kind. **Kamba has no Wikipedia** (it is in the
Wikimedia Incubator, which `attest.ts` cannot reach), so the wiki tier is not thin — it is absent.

**Implication.** This is trap 51's floor as a whole sourcing policy rather than as one refusal: the haystack
is the 1,992-utterance corpus and the repo's own 5-word referee, full stop. **Every word this layer emits
must be a token of this corpus, or it is not emitted.** That also means the "read the instances, not the
counts" discipline has to be applied to the corpus itself, since there is no second opinion available.

---

## Run 5 — 2026-08-16 — the contact-language question, answered against the neighbour

    grep the corpus for `asilimia`, `pasenti`, and for every token that follows a digit
    read src/languages/swahili/normalize.ts as a hypothesis (trap 55)

**Raw finding — the percent word.** `asilimia` **×0**. `pasenti` **×0**. `pesenti` **×0**. The token-after-a-
digit tabulation turned up `percenti` **×1**:

    "munini wa kyama kya Florida Republican wakeli enda mbee wa **46 percenti** ya kula"

⚠ It is the **English** borrowing, not Swahili's Arabic one, and it is **POSTPOSED** where swahili.ts
declares `percentPrefix: true`. A ported layer would have been wrong about the word *and* the position.

**Raw finding — the unit tier.** swahili.ts states *"There is not one abbreviated unit symbol (km, kg, m, mm)
in 1,938 utterances, so the shared `units` tier has nothing to match and is not declared."* In kam_ke:

    km/h ×4 · km2 ×2 · mm ×4 · mi ×3 · m ×2 · sq mi ×3 · cm ×1 · mph ×1 · m/s ×1 · Ghz ×2

**Raw finding — what DOES carry.** The measure noun heads its phrase, exactly as in Swahili:
`kilomita 1,600` · `mita 250` · `milimita 35` · `maili 8` · `ndola 30` · `yeni 2,500` · `inzi 6.34` ·
`ndikilii 35` · `sendimita 6` · `gram 28`. ⚠ And so does the MAGNITUDE — `milioni 45`, `milioni 1.5`,
`mbilioni $2.3`, `milioni £27` — which is why `magnitudes` is not declared: the tier's number-then-magnitude
hop has nothing to match in this corpus.

**Implication.** Three of the sibling's findings carry (word order, currency prefix, no noun-class agreement
rule) and three do not (the percent word, its position, and the refusal of the unit tier). That ratio —
roughly half — is exactly what trap 55 predicts and exactly what makes copying dangerous.

---

## Run 6 — 2026-08-16 — reading every instance of every mark

    python3 — every %, $, £, °, +, :, /, &, ~ and every hyphen, with 55 characters of context

**Raw finding — the colon is a clock barely half the time.** 14 colons between digits, EIGHT clocks
(`saa 11:00`, `Saa 1:15`, `Saa 8:46`, `saa 10:08`, `saa 11:35`, `Twi 11:20`, `09:19 p.m.`, `10:00-11:000`)
and six not: three downhill-ski SPORTS TIMES (`ndatika 4:41.30`, `2:41.60`, `1:09.02`), a self-glossed RATIO
(*"namba ikwatene ya **ratio**) ila yailwe ithwa yi **3:2**"*) and a UK DEGREE CLASS ×2 (*"akwete **2:2**
(ndikilii ya kilasi kya keli kya nthi)"*). The Ilocano lesson in miniature: a `\d:\d` rule would have claimed
six non-clocks for eight clocks.

**Raw finding — the dot does three jobs.** Decimal ×26; GROUPING ×1 (*"vinya wa aũme **2.400**"*, Washington's
2,400 men — three digits, so the same three-digit test that reads the comma reads it); and CLOCK ×4
(`saa 12.00 GMT`, `(15.00 UTC)`, `saa 9.30 sya kwakya`, `saa 11.00 kũvĩka`). The comma only ever groups (47).

**Raw finding — the hyphen.** 105, the only dash in the corpus. Fourteen between digits: nine ascending
spans, four scores/a truncated season (`6-6`, `7-2`, `26 - 00`, `1955-96`), one clock range. **Zero
negatives.** ⚠ And one instance of the shape no guard can reject — word · space · hyphen · digit:
*"Russia … **II -76** yithiitwe"*, the Ilyushin. Twenty more hyphens are SPACED parenthetical breaks.

**Raw finding — currency.** 7 signs, four shapes: `ndola $5` / `ndola $100` (the noun already written,
trap 12), `US$11,000 nginya US$22,500`, `AUD$ milioni 45` (sign, magnitude, number), `mbilioni $2.3`, and
`milioni £27`. The pound's only candidate word is `paondĩ` ×1 and it is the WEIGHT: *"syaĩna ũĩto wa **paondĩ**
1,000"*.

**Raw finding — degrees.** `°` ×1, `+30°C`, and the degree word `ndikilii` (×7) stands immediately before it.
`selsiasi` / `Celsius` / `Fahrenheit` are ×0.

**Raw finding — the range connective.** ⚠ The universal FLEURS sentence supplies it. English "35-40 mph
(56-64 km/h)" is rendered here as *"kĩlomita **35 kũthi 40** kĩla ĩsaa (kĩlomita **56 kũthi 64** kĩla ĩsaa)"*
— the translator wrote a connective where the source wrote a hyphen, twice, as a **bare infix between two
bare numerals**. The obvious competitor `nginya` (×55) is the wrong part of speech for that slot: both of its
numeric instances are governed by a preceding preposition (*kuma* US$11,000 nginya US$22,500; *kati wa* fiti
328 nginya fiti 820) and after a digit it means "up to" (*kiseve kya nginya 480 km/h*).

**Implication.** Every rule the layer needs is now sourced from the corpus, and three refusals are decided:
the minus (the Ilyushin shape), the plus (no word), the pound (wrong sense).

---

## Run 7 — 2026-08-16 — probing the engine on the attested forms

    npx tsx probe1.mts — phonemize 44 corpus-attested shapes through `phonemize(x, "kam")`

**Raw finding (before any rule).**

    kilomita 1,600  → kilɔmita emwɛ , maːna ðaⁿðato      ← ONE, pause, six hundred
    1,000 mi        → emwɛ , nɔti mi                     ← ONE, pause, ZERO, raw `mi`
    5,000,000 twi   → itanɔ , nɔti , nɔti twi
    kilomita 12.8   → kilɔmita ekomi na ele . ɲaɲa       ← a SENTENCE BREAK mid-number
    18% ya andu     → ekomi na ɲaɲa ja aⁿdu              ← the sign silently gone
    19,500 km2      → … km ele                           ← raw `km` AND the ² read as a NUMBER (trap 53)
    480 km/h (133 m/s; 300 mph) → … km h … m s , … mph   ← five raw abbreviations
    +30°C           → miɔᵑɡɔ etato tʃ                    ← degree dropped, ⟨C⟩ as a bare affricate
    B&Bs            → β βs                               ← the `&` merged two tokens
    saa 11:00       → saː ekomi na emwɛ , nɔti           ← a phrase break inside a time
    4x4             → iɲa z iɲa                          ← ⟨x⟩ read as /z/

**Implication.** The grouping comma is the highest-count defect (47) and DROP cannot see a single one of
them. The `km2` reading is trap 53's exact shape and it is already present, so declaring `km` *without*
`sikwea` would keep it. Order the layer with the tier FIRST (Hawaiian/Karakalpak) so `NOT_VERSION` still has
its dot when the one-letter `m` key runs.

---

## Run 8 — 2026-08-16 — the tier configuration, dry-run before wiring

    npx tsx tier.mts — `makeSymbolNormalizer(...)` alone over 24 corpus shapes

**Raw finding.**

    "ndola $5 na ndola $100"      → "ndola ndola 5 na ndola ndola 100"     ⚠ DOUBLED
    "AUD$ milioni 45"             → unchanged                              ⚠ no digit adjacent to the sign
    "300,948 sq mi"               → unchanged                              ⚠ two tokens, no ² to hang on
    "4892m." / "160km/h."         → "mita 4892." / "kilomita 160 kĩla ĩsaa."   ✓ clause-final is fine
    "3.7 mĩlĩonĩ"                 → unchanged                              ✓ the `\p{L}` guard saves it
    "802.11g" / "2.4Ghz"          → unchanged                              ✓ NOT_VERSION holds

**Implication.** Three local pre-passes are needed and each has its own reason: the tier has an "already said
it" suppression for PERCENT and **none for currency**, so the writer's `ndola` is consumed and put back by
`currencyPrefix` (trap 10); `AUD$ milioni` needs the sign claimed before a magnitude word; `sq mi` must be
emitted as WORDS and never rewritten to `mi²` (trap 54's one forbidden move).

⚠ Note the near-miss on `3.7 mĩlĩonĩ`: an ASCII-only trailing guard would have read those two characters as
`3.7 m` + `ĩlĩonĩ`, i.e. 3.7 METRES. The tier's `(?![\p{L}\p{M}])` is what declines it — trap 1/23 arriving
as a unit key rather than as a `\b`.

---

## Run 9 — 2026-08-16 — first corpus diff, and a defect the layer would have INTRODUCED

    npx tsx tools/normalization/corpus-diff.ts emit … --out after.json ; compare
    npx tsx review.mts — every utterance whose TEXT the layer changes, printed with context

**Raw finding.** `changed 188/1992 (9.4%)`, `DROP 11 → 4`, every other class 0 on both sides. Reading all 188:

⚠ **`II-76s` came out as a RANGE.** `core/roman.ts` runs in `registry.ts` *wrapping* `text()`, so by the time
this layer sees the Ilyushin it is `2-76s` and `2 -76` — an ascending digit–hyphen–digit pair in both cases,
which the range rule read as *ĩlĩ kũthi mĩongo mũonza na thanthatũ*. **That is a reading, and this layer would
have created it** (trap 56). Two guards fix it and neither costs a corpus range: a LETTER after the second
operand rejects `2-76s`, and a spacing BACKREFERENCE rejects `2 -76` (a span is spaced symmetrically or not
at all — `2-3`, `120-160`, `26 - 00` — never on one side only).

⚠ **`saa 10:00-11:000` was destroyed** until `:` went into both range guards: the rule matched at `00-11`.

⚠ **Ranges had to move ABOVE the decimal step.** `miaka 4.2- 3.9` is a DESCENDING span of millions of years;
spend its dots first and the rule sees an ascending `2- 3` and inserts a joiner the source never had. Run
above them, the lookbehind's `.` declines the whole thing. (hil's ceb ordering lesson, arriving again.)

---

## Run 10 — 2026-08-16 — trap 58 inside my own decimal rule

    grep -oE '[0-9]+\.[0-9]+\.' uniq.txt

**Raw finding.** Four clause-final decimals: `1.1.` · `2.3.` · `3.50.` · `6.5.` — and the first draft's
`(?![\d.])` trailing guard **declined every one of them**, leaving a false sentence break inside the figure:
*"sĩsya ĩvĩsa ya 1 . 1 ."*. That is trap 58 written into the very rule whose header cites trap 58 for the
de-grouping step three lines above — the same "the author had read the warning" shape the playbook records
for lt and mn.

**Fix and re-measure.** `(?!\d)(?!\.\d)` — exclude a dot that CONTINUES the number, not a dot as such. The IP
and `802.11.x` refusals are unaffected (a second dot is still followed by a digit).

    changed 190/1992 (9.5%)   DROP 11 → 4   DIGIT/SLOT-GAP/RAWMARK/ZERO-WIDTH/RAW-CAPS/THROW 0 on both sides

---

## Run 11 — 2026-08-16 — reading all 190 changes, and the four survivors

    npx tsx review.mts        (text changes, symbol-bearing)
    npx tsx review.mts fold   (text changes, confusable-fold only)
    grep DROP after2.json

**Raw finding — the four remaining DROPs**, each one a documented refusal:

    math-sign  "uvyuvu wa ndikilii +30°C"          the measurement plus (redundant; does not invert)
    math-sign  "saa 11:00 (UTC+1)"                  the offset plus (contentful; no word sourceable)
    minus      "Russia … II -76 yithiitwe"          a designation, not a negative
    currency   "kwa ndĩvi ya milioni £27"           the pound (only candidate is the WEIGHT `paondĩ`)

**Raw finding — the fold changes** are all Kamba words and no foreign name in the corpus was touched
(`Rodrigo Arias`, `Bishkek`, `Greenland`, `Lockwood Gardens`, `Oldsmobile`, `Gürses`, `São`, `Erdoğan` all
pass through unchanged).

**Raw finding — one imperfect reading, recorded rather than fixed.** *"syaanikite kuvita **milioni 2.2 km2**
mbaalini"* now reads `milioni sikwea kilomita 2 2` — the unit noun moves in front of its number, which is
Kamba's order, but the magnitude stays behind it, which is not. Before the change it read
`milioni ele . ele km ele` (a raw `km` plus a spurious NUMBER two), so this is strictly better and still not
right. See the backlog.

---

## Gates

| gate | before | after |
|---|---|---|
| `corpus-diff` DROP | 11 | **4** |
| `corpus-diff` DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW | 0 / 0 / 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0 / 0 / 0** |
| utterances changed | — | 190 / 1,992 (9.5%) |
| `review.ts --lang kam` — `sign classes` | DROPPED: minus plus plus-minus equals less-than greater-than divide | **ok, none dropped** |
| `review.ts --lang kam` — `sourcing` | — | **ok, all 2 high-traffic words attested** |
| `review.ts --lang kam` — `clause-final` | — | **ok, a trailing `.` or `,` loses no reading** |
| `review.ts --lang kam` — `artifact tracked` | FAIL | FAIL — **expected**: there is no `tools/corpus/mined/kam.jsonc` and none was fabricated to satisfy the gate |
| `referee-eval kam` | 0/5 raw · 5/5 folded · 100.0% symbol | **identical** |
| `npx vitest run` | — | 4,646 passed; **1 failure, `test/languageCatalogue.test.ts`, exactly one cell** (expected — regenerated centrally) |
| `npx tsc --noEmit` | clean | **clean** |

---

## Backlog surfaced, not fixed

1. **The magnitude between a number and its unit.** `milioni 2.2 km2` reads `milioni sikwea kilomita 2 2`.
   Kamba puts the magnitude BEFORE the number, so `magnitudes` (which the tier keys on number-then-magnitude)
   cannot express it, and `unitPrefix` moves the noun past the number but not past the magnitude. One
   instance here; the shape is the mirror of the lb case the playbook records under trap 17, and it wants a
   tier change rather than a local one, so it was not attempted.
2. **The dotted abbreviations are untouched and each is a false sentence break.** `p.m.` ×1, `a.m` ×1,
   `B.C.` ×2, `U.S.` ×1, `St.` ×4, `Dr.` ×4, `Jr.` ×4 — `p.m. GMT` reads *p . m . ɡmt*, two spurious pauses.
   Nothing was done because no Kamba reading is sourceable for any of them (the era phrase in particular:
   `Klisto` ×1 and `kilisito` ×1 are the only Christ-stems in the corpus, one of them adjectival —
   *kĩ kilisito*, "Christian" — and `sources.ts` rates the class `[part] … CHECK it is a bare noun, not a
   bound stem`). Collapsing the dots without a word would trade two false pauses for a garbage token.
3. **Era markers.** `BCE` ×4, `BC` ×1, `B.C.` ×2, `AD` ×1, all read as raw letters. Blocked by (2).
4. **Fractions.** `1/5 inzi`, and the mangled `inzi 293/4` / `inzi 241/2` (29¾ and 24½ inches, the space lost
   upstream). `sources.ts` reports `fraction-series [NONE]`; the corpus's one candidate denominator word,
   `nusu` ×10 ("half"), never stands beside a numerator.
5. **English ordinals inside Kamba text.** `1st`, `3rd`, `11th`, `12th`, `13th`, `17th` ×6, read as raw
   letters (`th` → ð). No Kamba ordinal series exists in the engine's number data.
6. **`Ghz` ×2** (`2.4Ghz`, `5.0Ghz`) reads as ɡhz. No frequency-unit word is attested anywhere for Kamba.
7. **The orthography is split in the corpus itself** — `kilomita` ×18 against `kĩlomita` ×10, `isaa` ×9
   against `ĩsaa` ×6, `maili` ×16 against `maĩli` ×5. This layer emits the more frequent member of each pair.
   Whether the tilde-full spelling should be preferred is a question for the manifest, not for this pass.
8. **`~` ×1** — `“~O/~o”`, inside a sentence about German umlaut notation. Not a `DROPPABLE` class and no
   reading is possible; recorded so the next reader does not spend a run on it.
9. **A Kamba Wikipedia would change several of the refusals.** kam is in the Wikimedia Incubator, which
   `attest.ts` cannot reach. If it graduates, the plus word, the pound, a decimal-point word and the era
   phrase are all worth re-asking — every one of them was refused on ABSENCE rather than on sense, which is
   the weaker kind of refusal (the Igbo lesson).
