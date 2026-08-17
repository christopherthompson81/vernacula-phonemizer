# Karakalpak (kaa) normalization — investigation log

Picked as the largest remaining untreated corpus with a mined artifact — **63,415 paragraph segments** —
and for the most abbreviation-dense profile in the fleet: `abbrev` **11,575**, i.e. one in every 5.5
segments.

`tools/corpus/mined/kaa.jsonc` — kaa.wikipedia dump, 686 retained segments.

Corpus-wide: `latin-in-native` 62,942 · `digit-run` 25,547 · `year` 24,331 · `abbrev` 11,575 ·
`letter-name` 6,247 · `decimals` 5,443 · `ranges` 4,220 · `signs` 2,596 · `exponent` 2,486 ·
`dotted` 2,220 · `units` 1,943 · `ampersand` 1,816 · `clock` 1,773 · `percent` 1,542 · `quote-letter` 1,299 ·
`ordinal-latin` 596 · `signed-number` 286 · `fractions` 249 · `arithmetic` 242 · `degrees` 251 ·
`currency` 121 · `ordinal-caps` 120 · `rate` 93 · `scaled-currency` 78 · `era-marker` 30.

## Run 1 — 2026-08-16 — what the engine does today

```
"18,7% ke jaqını"        → on segiz , jeti ke jaqını      the DECIMAL COMMA a pause, the sign gone
"96%in suw menen"        → toqsan altı in suw menen       ⚠ and the CASE SUFFIX left stranded
"$100,000 investiciyası" → júz , nol investiciyası        the GROUPING comma read as a decimal, `000` → ZERO
"19,605,052 akciyanı"    → on toǵız , altı júz bes , …    the number in three pieces
"$1.65 milliard"         → bir . alpıs bes milliard       the decimal dot a SENTENCE BREAK
"4,4°C"                  → tórt , tórt k                  the degree sign gone, ⟨C⟩ a bare letter
"(-32-38 °C)"            → otız eki otız segiz k          both minus signs and the span gone
"saat 8:00 de"           → saat segiz , nol de            the colon a pause
"150 mm ge shekem"       → júz eliw mm ge shekem          the unit raw — LEAK RAW-LATIN km ×48
"21 mln. jılı"           → jigirma bir mln . jılı         the magnitude abbreviation raw, plus a false stop
"b.e.sh. 776-jılı"       → b . e . sh . jeti júz jetpis…  the era letter-by-letter, THREE false pauses
"2,02 g/sm3"             → eki , eki g sm úsh             the rate unread, the exponent read as a NUMBER
"Suyıqlanıw t-rası 323°" → suyıqlanıw t rası úsh júz…     ⚠ an abbreviation cut by a HYPHEN, not a dot
```

## Run 2 — 2026-08-16 — ⚠ THE EM-DASH IS A COPULA, AND READING IT AS A MINUS WOULD BE WRONG THIRTY TIMES

This corpus writes Russian-calqued prose in which `—` replaces the absent copula, and it does so in front
of numbers constantly (×30 in the retained text):

```
Ortasha jas — 31,3                     Transport jolı uzınlıǵı — 2 mıń km den artıq
Temirjollardıń uzınlıǵı — 3,9 mıń km   Afrikanıń dástúriy din wákilleri — 0,309%
Azerbaydjan — industrial-agrar mámleket        Íqlımı — ortasha, teńiz ıqlımı
```

⚠ **And the clinching instance carries both marks in one clause:**

```
yanvardıń ortasha temperaturası — 2 °C den -3 °C ge shekem
"the average January temperature IS from 2 °C to MINUS 3 °C"
```

The em-dash is the copula; the HYPHEN is the minus. **Implication** the fleet-standard sign rule
(`[-−–]`, hyphen / U+2212 / en-dash) is already right and must not be widened to `—` "for symmetry" — the
one-character generalisation that looks harmless would have read thirty "is" clauses as negative
quantities. And the range rule, which does include `—`, requires a DIGIT before the dash, which none of
these have.

⚠ **THE REAL MINUS IS PARENTHESISED AND DOUBLED**: `(-32-38 °C)` beside `(+40+45 °C)`, the Russian
convention for "from −32 to −38". A minus rule plus a range rule gets the first sign and loses the second.

## Run 3 — 2026-08-16 — ⚠ THE COMMA GROUPS AND DECIMATES, AND SO DOES THE DOT — IN THE SAME SENTENCE

Papiamento had the two conventions split by article and Aragonese by figure type. Karakalpak mixes them
*inside one clause*, which is the strongest form of "the codepoint settles nothing" the sweep has met:

```
qazaqlar – 70,18% , ruslar 18,42%, ózbekler 3,29%, ukrainlar 1.36%, uyǵırlar 1,48%, tatarlar 1,06%
                                                             ↑ one census list, one sentence, one DOT
biyikligi 33,02 sm diametri 46.99sm            ← and again, two measurements of one object
```

| mark | job | instance |
|---|---|---|
| `,` | DECIMAL | `18,7%` · `4,4°C` · `70,18%` · `33,02 sm` · `23,3 mlrd` |
| `,` | GROUPING | `$100,000` · `19,605,052 akciyanı` · `1,500 km` · `1/1,000,000,000,000` |
| `.` | DECIMAL | `1.36%` · `46.99sm` · `$1.65 milliard` · `9.25 million` · `391.04 milliard` |
| `.` | IP ADDRESS | `198.51.100.0/24` · `255.255.255.0` |
| `.` | DATE | `26.02.1994-j. №367/XII` |

The three-digit test decides the comma. The dot needs a different guard: an IP address is four dot-joined
groups and a date is three, so what identifies a decimal is that there is exactly ONE dot in the run.

## Run 4 — 2026-08-16 — ⚠ THE PERCENT SIGN TAKES A CASE SUFFIX, AND THE TIER CANNOT SEE IT

Turkic agglutination lands directly on the symbol, exactly as it did in Turkmen (`60%-ini`):

```
18,7% ke jaqını      50% ten 80% ke shekem      14% i jasaydı      96%in suw menen      4%in qurǵaqlıq
98% ke shamalası     7,84% ti qurap             85,7% (2015-jıl)
```

Both spellings occur — detached (`% ke`, `% ten`, `% i`, `% ti`) and attached (`%in`). The suffix has to be
claimed together with the sign, before the shared tier runs, or the sign is read and the suffix is left
behind as a bare syllable (`96%in` reads *toqsan altı in* today).

## Run 5 — 2026-08-16 — ⚠ `+` IS THE NAME OF A PROGRAMMING LANGUAGE

`arithmetic` is 242 corpus-wide, and `+` is ×25 in the retained text — of which about twenty are `C++`:

```
C++ tilin jaratıwshı · C++ kodı menen baylanıstırıladı · C++98 · C++03 · C++11 (14882:2011) · C++23
```

The remainder are `(+40+45 °C)` and `+15+20°С gradus` (paired positive temperatures) and two technical
spans written with a plus where Russian would write `÷` (`diametri 6+90 mm`, `diametri 3+8 mm`).

⚠ **But it IS claimable, and the guard is one character: `C++` never has a DIGIT after the plus.** Every
real sign does. `plyus` ×14 is attested in exactly this sense ("stavkasin plyus yamasa minus funttaǵi 3
pensqa", "50% plyus bir akciya"), so the sign ships with a digit lookahead — and `C++`, `C++98`, `C++11`,
`C++23` all fall through untouched. ⚠ The PAIRED arm (`+40+45`) needs a second gate: without a following
degree sign it reads `6+90 mm` as *six plus ninety*, a defect this layer would have INTRODUCED (trap 56).

## Run 6 — 2026-08-16 — the colon, and ⚠ what `saat` mostly is NOT

`clock` is 1,773 corpus-wide. Six colon-between-digit segments in the retained text, three of them clocks:

```
CLOCK      saat 8:00 de belgilengen edi   ·   saat 12:13:05 de   ·   UTC waqtı menen 18:50:57 de
STANDARD   ISO/IEC 14882:2024   ·   C++11 (14882:2011)      ← five digits before the colon
TIMESTAMP  Vyetnam pop versiyası (01:05:25 – 01:09:50)
```

The hour bound declines the standard numbers on its own; the colon is spent and the figures are left as
figures, because the writer supplies `saat`.

⚠ **And `saat` itself is mostly not the clock word.** Of its nine instances only two introduce a time:
four are the ENERGY UNIT (`kvt/saat`, `gigavat/saat`, `kilovatt-saattan`, `Vt·saat` — kilowatt-hours), one
is "clockwise" (`saat tili boyınsha`), one is "per hour" (`saatına 400 dana`) and one is an Apple Watch.
That is why `kvt/saat` is expanded as a COMPOUND UNIT here and not as a rate with a "per" word.

## Run 7 — 2026-08-16 — sourcing, and one Fula case

`attest.ts --lang kaa` over 42 words: **38 attested, 4 absent** (`payiz`, `Selsiya`, `Farengeyt`, `pút`).

⚠ **`som` is the round's Fula case.** It scores ×14 and every single hit is FOREIGN TEXT — the Danish
"Smuk som et stjerneskud", the Swedish "Som jag är", the Brazilian "Som Brasil", a Norwegian geological
name. Not one is the Uzbek currency. The key is not declared.

⚠ **`noqat` ×31 is a MATERIAL POINT**, in the physics articles ("materiallıq noqat", "moddiy noqat hám
moddiy noqatlar sisteması") — and once a chickpea, in a list of legumes. With `pút` ABSENT there is no
sourceable decimal-point word, so the separator is neutralised rather than spoken (the Punjabi choice).

⚠ **`Selsiy` scores ×1** and the corpus writes the degree bare — "Yanvar ayiniń ortasha temparaturasi -5
gradus", "iyul ayinda bolsa +40 gradus". No scale word is emitted, which is also what makes `44,7°` and
`4,4°C` one rule.

⚠ **`procent` ×31 over `protsent` ×16 and `payız` ×7**, and the count is not the whole argument: all three
are in the right slot, but `protsent`'s examples are ALL from one bond-market article ("protsent
stavkası") while `procent` spreads across geography, agriculture and economics.

⚠ **`kvadrat` PRECEDES its unit** — "9,065,000 kvadrat kilometr", "har kvadrat kilometrge 214 adam" —
which is the opposite of every Romance layer in this sweep and is what `position: "before"` is for.

## Run 8 — 2026-08-16 — three gaps the first draft left, all found by re-reading the scan

⚠ **`mıń` SITS BETWEEN THE FIGURE AND THE UNIT**, and the tier's number-adjacency requirement cannot
bridge it: "86,6 mıń km²", "3 mıń km ge shekem", "2 mıń km den artıq", "83 mıń 858 km2". Twelve of the
residual `km` leaks were this one shape. Declaring `mıń` as a magnitude fixes all of them, because the
tier's unit arm already allows a magnitude between the two.

⚠ **THE MAGNITUDE ABBREVIATION'S DOT IS OPTIONAL, AND SOMETIMES THE UNIT FOLLOWS IT.** `9,5 mln adam` and
`$205,539 mlrd (2018)` have no dot; `139,2 mln.ga` puts the unit straight after one. Expanding `mln`/`mlrd`
BEFORE the tier turns the last into "139,2 million ga", which the tier's magnitude arm can then reach.

⚠ **AND A MAGNITUDE WORD AFTER A THREE-DIGIT GROUP MEANS IT WAS A DECIMAL.** `$205,539 mlrd` and `JIÓ
179,332 mlrd. AQSh dolların` are $205.539 and $179.332 BILLION. Three digits after the comma, so the
three-digit test says "grouping" — and is wrong, because *two hundred five thousand five hundred
thirty-nine billion* is not a quantity anyone writes. The magnitude lookahead settles it, and
`19,605,052 akciyanı` and `$100,000 investiciyası` carry no magnitude and stay grouped.

## Run 9 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 39→0 · `currency` 27→0 · `degree` 13→0 · `minus` 4→0 · `ampersand` 3→0 ·
  `exponent` 28→6 · LEAK `km` 48→2, `mln` 14→0, `mlrd` 12→0, `mm` 9→0, `sm` 3→2, `kg` 2→0, `kv` 2→0,
  `kvt` 1→0. Residual, all read: the `C++` occurrences the plus rule deliberately declines, the CIDR
  notation article's `db`/`std`, one `vs`, one English `pp.` citation and one `mkm`.
- **corpus diff** (baseline emitted from a pristine worktree at `e47464a`): **201/440 utterances changed
  (45.7%), DROP 130 → 36**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW either side.
- **`review.ts --lang kaa`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — six refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval kaa`**: 66.7% raw / 100.0% folded / 100.0% symbol, before and after (a ~12-pair
  Wiktionary referee — the numbers are stable, not strong).
- **`vitest`** 4,590 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **`8-12C`** — a temperature with no degree sign at all. One instance, and a rule matching `C` after any
  digit would produce a reading wherever a model number or table label ends that way (trap 56).
- **The dotted date and the IP address** — `26.02.1994-j.` and `198.51.100.0/24` still take clause pauses
  at their dots. The `-j.` is now read as `jıl`; the dots are not claimed.
- **`24,9 adam/km²` and `43,13 s/ga`** — rates whose NUMERATOR is not a declared unit (`adam` = people,
  `s` = centner). The shared tier's rate arm needs both sides declared.
- **`№367/XII`** — the number sign, ×1. `nomer` ×31 is attested but its examples are performance and
  entry numbers, so the issue-number sense is thin for a single instance.
