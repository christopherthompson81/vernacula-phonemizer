# mg (Malagasy) text normalization — investigation log

Corpus artifact: `tools/corpus/mined/mg.jsonc` — mg.wikipedia dump, **282,192 paragraphs**, 440 mined
segments (240 hard + 200 sample). No FLEURS corpus; espeak does not ship Malagasy. Referee: wikipron
`mlg_latn` broad (human, 187 words), 78.6% — a small referee, and a broad/narrow mismatch the engine's own
header already documents.

---

## Run 1 — 2026-08-11 — is this corpus bot-generated? (the Cebuano question, asked first)

mg.wikipedia is one of the large template-built wikis, so this had to be settled before writing any rule.
Reading the SAMPLE tier — a uniform stride, therefore the real distribution:

```
Ny INSEE dia mampiasa …                             ×14   French-commune boilerplate
Ny laharam-pehintaniny ary ny …                     ×10   coordinate filler
I Biermont dia kaominina ao amin'ny fivondronan'i Compiègne, ao amin'ny departemantan'i Oise …
Savana dia kaominina malagasy ao amin'ny distrikan'i Vohipeno …
1902 : Francis A. Pratt — injeniera, mpamorona            year-list entries
```

**75 of 200 sample segments are template stubs — 37.5%.**

⚠ **But the HARD set is clean: 1 template line in ~240.** That is not luck. `mine.ts` selects
ADVERSARIALLY, and the stubs are formulaic and low-variety, so the selector prefers the messier human
prose. This is the **opposite** of the Sundanese case, where the contamination was pattern-rich and
dominated the hard set (playbook §0b), and the opposite of Cebuano, where there was no human tier to
prefer. So: the rules are written from human Malagasy, the corpus diff is read knowing a third of its lines
are boilerplate, and **the dump-wide counts are quoted only where the shape is not template-specific** —
`degrees` 23,806 and `decimals` 48,778 are overwhelmingly the commune coordinate stubs.

**Implication.** Mine-and-write is safe here; the ceb decision (throw the wiki away) is not needed.

---

## Run 2 — 2026-08-11 — two cells that are not what their names say

**`ampersand` 30,267 is an HTML ENTITY.** Of the 83 `&` in the mined segments, **68 are `&nbsp;`** and only
15 are a real ampersand. It is French typography — the thin space before `%` and inside numbers
(`45&nbsp;%n' ny vahoaka`, `6&nbsp;% ny PIB`). Trap 2, arriving in a cell name rather than in a grep.

**`quote-letter` 150,822 is not a defect at all.** It is Malagasy orthography: `amin'ny`, `ao amin'`,
`isan'ny` — the apostrophe is a genitive linker on more than half of all paragraphs. Nothing to do.

---

## Run 3 — 2026-08-11 — Malagasy groups thousands with a SPACE

The largest repair here, and it had **no symptom any gate could see**. Malagasy follows the French
convention throughout:

```
1 540 metatra · 830 900 ny teraka · 531 200 ny maty · 49 827 km · 384 403 km · 3 474 km
18 900 € · 100 000 $ · 1 000 000 $ · 1 270 000 · 41 700 · 299 792,458 km/s
```

**×33 in the mined segments with no counter-example.** A space is the ordinary word separator, so `1 540`
simply read as TWO NUMBERS — *ˈiraj dimaⁿdzˈatu*, "one, five hundred". No leaked character, no dropped
symbol, no stray pause: nothing for `mine.ts scan`, the leak classes or the DROP test to report. The same
silent value-destruction as Lao's grouping comma, in a different disguise.

The guard that keeps a YEAR out is the group width: in `1947 250` the first run is four digits, so the
`\d{1,3}` plus the digit lookbehind rejects it.

**And the comma is the DECIMAL at every width**, so the group-size rule the last three languages used does
not apply:

```
space + 3 digits   ×33  THOUSANDS
comma + 1–2        ×54  decimal
comma + 3           ×7  decimal STILL — 6 of 7 (1,429 kg/m³ · 299 792,458 km/s · 247,941 kilometatra
                        toradroa). Only `$ 30,000` is a group, imported with the dollar sign.
period + 3          ×8  MIXED — populations and money are thousands; the rest are coordinates
period + other     ×53  decimal — the bot coordinate stubs (44.8358333333)
```

⚠ **The period needed a discriminator and the corpus supplied its own**: every period-decimal that is not a
thousands group is a coordinate and **carries a `°`** (`4.175°`, `1.609°`, `47.536°`, `44.872°`), while the
thousands are populations and money (`25.000fmg`, `30.000 eo ho eo`, `isam-ponina dia 5.196`). 3 of 3
thousands right, 4 of 5 decimals right; the miss is `~1.666 km`, a miles-to-kilometres factor, ×1.

---

## Run 4 — 2026-08-11 — sourcing

| word | evidence |
|---|---|
| **`isan-jato`** percent | corpus ×5, POSTPOSED in all five (`Mitombo roa isan-jato isan-taona`, `ny 15 isan-jato ny vola`, `latsaky ny iray isan-jato`). ⚠ The wiki probe says `substring-only` ×19 — the hyphen splits it, trap 41 — so the corpus is the evidence |
| **`faingo`** decimal | the best-sourced decimal word in this sweep: mg.wikipedia's article on the comma **defines it and gives the numeric use with an example** — *"Ampiasaina koa ny faingo mba hanasarahana tarehimarika roa (ohatra: 2,3)"*. `faingo mihevaheva` glosses French *virgule flottante* |
| **`toradroa` / `toratelo`** | **both glossed against their symbols in ONE sentence** by the wiki's units article: *"ampiasaina ny metatra toradroa (m2) sy ny metatra toratelo (m3)"* |
| **`degre`** | corpus ×2 in the slot (`4.27471 degre`), wiki ×21 |
| `ariary` ×69 · `dolara` ×58 · `eorô` ×6 | the corpus puts the noun after the magnitude (`iray tapitrisa dolara`) — the tier's default |
| `latsaka` ×24 | ✗ **NOT the minus.** A comparative verb taking a whole clause — `tsy latsaka ny 8,5 %`, `latsaka 40 kilometatra atsimon'ny` — never an infix before a numeral. The Fula `hakkunde` shape |

⚠ **`toratelo` was very nearly declined as an invention.** It is transparently "three-fold" and looks
exactly like the word a composer would make up from `toradroa`. Probing it first is the whole difference
between reading a word and inventing one — and unread the cube was *worse than silent*, because the tier
claimed the unit and left the superscript glued to it (`kilaometatra³`), so `0,93 km³` read as plain
kilometres.

---

## Run 5 — 2026-08-11 — the minus is a BCE year, and the template is what writes it

`signed-number` is 15,177 in the dump, and **that count is the template**. Every one of the 22 mined
instances falls into three families, none arithmetic:

- **BCE years** from the ancient-biography stub — `Croesus … dia teraka ny 1 Janoary -596 ary maty ny
  1 Janoary -546`. "Born 1 January -596" means 596 BC.
- **negative coordinates** from the commune stubs — `-97.0602777778`, `-83.6138888889`, `-0.6408°`.
- **EasyTimeline chart markup** — `from:-5000 till:-3000`, `-30 align:center`, `-3200 align:right`.

Declined, with the class refusal in `ACCEPTED_SIGN_SILENCE` **and** the instance spans in `ACCEPTED_SILENT`.
⚠ Both are needed: `acceptedSignClass` tests whether the DROPPABLE regex matches a SINGLE CHARACTER, and the
minus regex is contextual (`[-−–](?=\p{Nd})` with two lookbehinds), so it can never match one. `tl` carries
the same pair for the same reason and the same BCE-year shape — the note in its entry is what pointed here.

---

## Run 6 — 2026-08-11 — the gates, and what only the diff could see

```
npx vitest run          233 files / 3,404 tests
npx tsc --noEmit        OK
mine.ts scan            no defects   (was 7 classes, 123 hits)
review.ts --lang mg     checklist clean
corpus-diff compare     changed 151/439 (34.4%), DROP 123 → 42
referee-eval mg         78.6% unchanged (word path; this layer is text-path only)
```

**Two findings came from reading the diff after every gate was green.**

**1. `taonjato faha 17°` is "the 17TH century", not seventeen degrees.** ⟨faha-⟩ is the Malagasy ordinal
prefix and the writer has used `°` as a raised ordinal marker. ⚠ It is **U+00B0, the real degree sign** —
U+00BA, the masculine ordinal indicator, is ×0 in this corpus — so no character test separates them and the
preceding `faha` is the guard. ×1 of 51 degree signs.

**2. The kilogram is `kilao`, not `kilograma`.** I had declared `kilao` on instinct; `units` is the one
class the sourcing gate **deliberately excludes** (playbook 5e, because kilogram and millimetre are absent
from every source in some thirty languages), so nothing would have caught a guess. Probed afterwards:
`kilao` ×32 across 20 wiki articles, `kilograma` ×0. The guess was right, and it was still a guess until
measured.
