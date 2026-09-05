# Scottish Gaelic (gd) normalization — investigation log

Picked for the same reason Bashkir was: the playbook makes a **specific, testable prediction**. Trap 14
names Celtic as where the mutation hazard bites next — Welsh's range rule was wrong on 12 of its 18 corpus
ranges because the connective `i` triggers soft mutation — and gd's artifact carries **3,521 ranges**. That
is a better reason to pick a language than "next by size", and this time **the prediction was falsified**,
which is the most useful thing in this log.

`tools/corpus/mined/gd.jsonc` — gd.wikipedia dump, 49,150 paragraph segments, 31/35 cells.

## Run 1 — 2026-08-16 — what the engine does today

```
"6,000 duine"  → ˈa ʃˈiə , ɲˈjɔɲə ɲˈjɔɲə ɲˈjɔɲə   ← "six , zero zero zero"
"12.5 km"      → …ɣˈaː jˈiaːk . ˈa kʰˈɔːəkʲ km     ← the dot a FULL STOP, `km` a cluster
"70 %"         → ʃˈɛxkət̪                          ← the sign dropped
"19mh linn"    → …n̪ˠˈɯː tʲˈiaːk v lʲˈiɲ           ← the ordinal suffix as a bare consonant
"1d" "2na" "3s" "5mh" → …t̪ / …n̪ˠˈa / …s̪ / …v
"£20"          → fˈiçət̪                           ← dropped
"20 °C"        → fˈiçət̪ kʰ
"5²" "10 km²"  → the power gone
"srl." "no. 5" → unread
"BBC" "SNP"    → pk / s̪n̪ˠp
```

## Run 2 — 2026-08-16 — the prediction, and what the dashes actually are

**Command** printed the context of all 70 `\d[-–—]\d` matches.

**Raw finding** — not one is a measurement span:

- **ISO dates inside BBC citations**: `BBC Naidheachdan 2016-12-31:`, `2019-05-06:`, `2016-07-19:`,
  `2018-10-30:` — gd.wikipedia cites BBC Naidheachdan constantly and always with an ISO date.
- **ISBNs**: `3-89940-263-4`.
- **Football scores**: `6-0` ×7, `6-1` ×5, `5-0` ×4, `2-1` ×4.

**Implication** No range rule is written. A Welsh-shaped one would have been a pure misfire generator
(trap 9) — it would have read every BBC citation date and every scoreline as a span. The prediction was
worth testing; the answer is no, and the counted answer is what makes the refusal safe to ship.

⚠ **And the separator convention is the ENGLISH one**, which inverts every other layer written in this
sweep. Gaelic writes the **comma as the thousands separator** and the **dot as the decimal point**:

| grouping | decimal |
|---|---|
| `6,000 duine` · `210,000` · `65,000` · `130,161` · `9,984,670 km²` · `2,727,300 km²` | `0.94%` · `9.81` · `3.2 daoine` · `−224.2 °C` · `12.5 km` |

`32.976.026` also occurs, dot-grouped, so the three-digit test is applied to **both** marks. A layer copied
from the language next door would have had both of them backwards — and the engine, reading the comma as
clause punctuation, was turning `6,000 duine` into *a sia , neoni neoni neoni*.

⚠ **The ordinal splits around its noun**, and that is this language's defining rule. Gaelic's teens are a
CIRCUMFIX: the head goes before the counted noun and `deug` after it. The corpus writes `19mh linn`,
`18mh linn`, `12na linn`, `11mh linn`, `6mh linn`, and gd.wikipedia states the shape outright —

> 'S e an t-Samhain **an t-aona mìos deug** den bhliadhna. ("November is the eleventh month of the year.")

A rule that merely replaces the figure cannot express that. It has to consume the following noun and
re-emit it with `deug` behind it — and re-emit it **verbatim**, because the noun carries the lenition the
writer already applied (trap 10).

## Run 3 — 2026-08-16 — sourcing, and one word that is right in the wrong sense

Attested with the sense read: `sa cheud` ×7/4 ("Tha a' Ghàidhlig aig **deich sa cheud** duine",
"**10 sa cheud** dhiubh" — the figure and the word in one phrase) · `not` ×19, and the currency article
NAMES THE SIGN ("Punnd Sasannach (**GB£**, “**not**”)") · `ceàrnagach` ×26/20, and the corpus GLOSSES ITS
OWN ABBREVIATION in one sentence ("an fharsaingeachd de 551,695 **cilemeatair ceàrnagach (km²)**"), which
fixes the word AND its position, after the noun · `san uair` ×2 ("a bha air siubhal aig deich air fhichead
mile **'san uair**") · `diog` ×29, with the physics article reading the notation ("aonadan de meatairean
**anns an diog (m/s)**") · `agus mar sin air adhart` ×12/10 (the `srl.` expansion) · the ordinal series
`ceathramh` ×22 through `ficheadamh` ×12, and `deug` ×27.

⚠ **`ceum` is the Gaelic word for "degree" and all 43 of its attestations are the ACADEMIC degree** — "rinn
e ceum ann am matamataig", "Thug e ceum bho Oilthigh Uppsala". `ceum Celsius`, `ceumannan Celsius` and
`ìre Celsius` all score **0**. That is the Fula `tere` shape exactly: a real word in the wrong sense. The
358 degrees stay unread and visible to the RAWMARK gate rather than being told to say "university degree
Celsius".

⚠ **`ceudad` ×12 is the trap next to it** — it is the NOUN "percentage" ("an ceudad a b' àirde de
labhraichean"), not the reading of the sign, so `sa cheud` is what ships.

⚠ **`uiread` ×36 is the third** — the plausible candidate for `×` and "quantity/amount" in every hit
("'s e uiread neo-aithnichte" — an unknown quantity), never "times". The corpus's 10 `×` ARE genuine
arithmetic (`7 × ( 14 + 9 – 4) = (7 × 14) + …`, the distributive law), so the sign is real and the word is
not: refused.

⚠ **`eòro` scored 0 in every source and the sourcing gate said so.** `€` ×3 does occur — and the corpus's
own currency list writes it in the English form, in the same sentence that sources `not`: "Dolar (US$)
**Euro** Punnd Sasannach (GB£, “not”)". That is what ships.

⚠ **`=` ×50 is wiki markup.** The count looked like the richest sign class in the language and every
instance is a HEADING MARKER (`== Hallstatt agus La Tène anns an Roinn-Eòrpa ==`) or raw LaTeX
(`y = r sin(φ) sin(θ)`). Zero are equations in Gaelic prose.

**Initialisms are DEFERRED, not overlooked** — 5,349 corpus-wide, `BBC` ×27 in the retained text.
`core/initialisms.ts` needs a letter-NAME table, which is an orthographic fact this repo has no source for
here: `$ESPEAK_NG` is unset in this checkout, and Gaelic has two competing traditions (the modern
Roman-style names and the tree alphabet — ailm, beith, coll). Trap 16 says to check whether the seam
exists; it does, and the data does not. Recorded rather than invented.

## Run 4 — 2026-08-16 — one defect the probes found late

`3 s` — three seconds — read as *treas*, because the ordinal rule allowed a space between the figure and
its suffix and *treas* does end in ⟨s⟩. The corpus writes every one of these GLUED (`19mh`, `12na`, `3s`,
`1d`), so requiring that costs nothing and closes a class of misfire that would have hit every duration in
the language.

## Run 5 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 15→0 · `currency` 17→1 · `ampersand` 13→0 · `exponent` 17→1 ·
  `minus` 9→1 · `degree` 10→10 (the refusal above). Residual, all read: three bare `km²` with no adjacent
  number (`gach km²`, `duine/km²`), one `4πr²`, one `ft` in an English gloss, one en-dash inside
  `Maddrell (1877?–27 an Dùbhlachd, 1974)`.
- **corpus diff** (baseline emitted from a pristine worktree): **134/441 utterances changed (30.4%),
  DROP 95 → 36**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side. The changes are
  dominated by `, ɲˈjɔɲə` → `mˈiːlʲə` (the comma-grouping fix) and by the circumfix visibly moving:
  `ˈa n̪ˠˈɯː … v lʲˈiɲ` → `n̪ˠˈɯːjəv lʲˈiɲ … tʲˈiaːk`.
- **`review.ts --lang gd`**: green on every checklist item including `sourcing` and `sign classes` —
  the eight refused sign classes are registered in `ACCEPTED_SIGN_SILENCE` with their counts rather than
  left as bare DROPPED lines. Only the artifact scan is red, on the residuals above.
- **`referee-eval gd`**: **15.1% folded / 67.0% symbol, before and after** — unchanged, as expected for a
  layer that rewrites text and not the word g2p.
- **`vitest`** and **`tsc --noEmit`** clean.
