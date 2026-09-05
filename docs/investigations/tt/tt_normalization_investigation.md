# Tatar (tt) normalization — investigation log

Picked as the **direct test of the Bashkir result**. `ba` was committed two rounds ago on the finding that
"the suffix on the figure is the whole language"; Tatar is its closest sibling (Kipchak Turkic, Cyrillic,
same suffixing morphology) and the largest untreated language left with a mined corpus (5M speakers). Trap
55 says the closest sibling is a **hypothesis, not a template** — so the question this log is built around
is *which parts of the ba layer transfer and which parts are Bashkir-specific*.

`tools/corpus/mined/tt.jsonc` — tt.wikipedia dump, 1,014,015 paragraph segments, 33/35 cells.

## Run 1 — 2026-08-16 — the corpus is TWO ORTHOGRAPHIES, and the hard-set lies about which one

Counting the script of every retained segment:

| tier | n | Cyrillic-dominant | Latin-dominant |
|---|---|---|---|
| `hard` (adversarial) | 257 | 91 (35%) | **163 (63%)** |
| `sample` (uniform stride) | 200 | **190 (95%)** | 10 (5%) |

**Raw finding** — tt.wikipedia carries a large body of articles written in **Zamanälif**, the Latin Tatar
orthography (`Xalıqnıñ tığızlığı 270 keşe/q km`, `1922. yılda`, `AQŞ'nıñ törle ştatları`). The
adversarial selector loves them, because the Zamanälif articles are the old hand-written ones and are dense
with figures, abbreviations and signs — so the hard-set reads as a **63% Latin** language.

**Implication** This is the artifact header's own warning (`"hard" IS NOT FREQUENCY-REPRESENTATIVE`) firing
for real, and it was very nearly enough to make me write the layer for the wrong orthography. The uniform
stride says Tatar-as-written is **95% Cyrillic**. The layer is written for Cyrillic.

⚠ **And Zamanälif is not merely a minority — it is unreadable to this engine anyway**, which is what makes
the refusal free. `tatar.ts` is a Cyrillic grapheme scan; Latin text falls to `core/foreign.ts`:

```
"2. yözdä"  → iˈke . jtsdˈʌ         ← `yöz` as [jts]
"AQŞ"       → ˈʌks                   ← English letter names
```

A Zamanälif ordinal-period rule would emit correct Tatar number words into a sentence whose every other
word is already garbage. Recorded and refused.

## Run 2 — 2026-08-16 — what the engine does with Cyrillic Tatar today

```
"1920 нче елда"   → …jeɡerˈme nˈɕe jelˈda   ← the ordinal suffix a separate word
"1 нче президенты" → ˈber nˈɕe …
"2005нченең"      → the suffix glued, unread
"22:30-га"        → the colon a clause pause, the suffix stranded
"13:23:58дә"      → three fields, no clock
"0,6 км"          → …ˈaltɨ , … qm         ← the comma a pause, `км` a cluster
"142 914 мең"     → three separate numbers
"б.э.к. 334 елда" → b . ˈe . q .
"XX йөз"          → (roman handled at the registry seam)
"66°30'"          → the sign and the prime both dropped
"95%"             → the sign dropped
"$100 миллион"    → the sign dropped
"№ 5"             → the sign dropped
"10 км²"          → the power dropped
```

## Run 3 — 2026-08-16 — the four things that are NOT the Bashkir shape

1. ⚠ **THE SUFFIX IS WRITTEN FOUR WAYS, AND ONLY ONE OF THEM IS BASHKIR'S.** `ba` writes the ordinal
   hyphenated (`1-се`) with near-total consistency. Tatar's retained text writes all of:

   | glued | hyphenated | **spaced** | hyphen + long form |
   |---|---|---|---|
   | `2005нченең` | `3-нче`, `4-нче`, `2009-нчы` | `1 нче президенты`, `1917 нче елда`, `1930 нчы елга`, `1912-1914 нче елларда` | `19-ынчы гасырда` |

   The **spaced** variant is the one a Bashkir-shaped rule (`\d+\s?-\s?suffix`) gets right by accident and
   the **glued** variant is the one it misses entirely. Both must be claimed, and claiming the spaced one
   means a bare space between a figure and a Cyrillic word is a candidate — which is why the suffix
   alternation is closed to the ordinal/case set rather than left as `SFX{1,5}`.

2. ⚠ **NOT ONE `°` IN THIS CORPUS IS A TEMPERATURE.** All 10 are angular or geographic — `90°
   äyländerelgän` (a rotation), `0° Гринвич меридианы`, `360° panoramic`, `46°22′ N`, and four latitude
   readings (`66°30'`, `81°49'`, `77°43'`, `41°11'`). `ba`'s degree rule is a *Цельсий градусы* rule with a
   climate corpus behind it; Tatar's evidence licenses the bare `градус` and the prime `′` as *минут*, and
   licenses no scale name at all. The `°C` branch still ships (it is letter-gated and cannot misfire), but
   it ships as insurance, not as a measured need — and this log says so rather than letting the count imply
   otherwise.

3. ⚠ **THE CASE SUFFIX ATTACHES ACROSS AN ABBREVIATION'S FINAL DOT.** The geography article writes
   `т.к.нең 66°30'`, `т.к. нең 81°49'`, `т. к. нең 77°43'`, `к.к.нең 41°11'ында`, `кч. оз. ның 19°38'` —
   *төньяк киңлек* (north latitude), *көньяк киңлек*, *көнчыгыш озынлык*, each with a genitive hanging off
   the abbreviation in three different spacings. And `41°11'ында` puts a locative on the **prime**. This is
   trap 58's shape one level worse: the rule must survive not only a full stop but a full stop that is not
   a full stop and has a morpheme welded to its right.

4. ⚠ **THE BIBLIOGRAPHY IS RUSSIAN, NOT TATAR**, in quantity — `Учеб. для вузов.-4-е изд., испр.,-М,:`,
   `т. 5. — М.: „Советская энциклопедия“`, `№ 5. С. 49-52`, `15 000 экз.`, `г.Казань`. Same finding as ba's
   `г.` = *года*, and it is why `-е` and `-й` are excluded from the suffix alternation there. Tatar's own
   ordinal never ends in a bare `-е`; Russian's `4-е изд.` does, ×3 in the retained text alone.

## Run 4 — 2026-08-16 — sourcing, and the corpus glossing its own notation

`attest.ts --lang tt` over 53 words: **all 53 attested as TOKENS, zero substring-only**. Five of them come
back with the corpus doing the sourcing work outright:

- **`градус` names the sign AND settles run 3's finding**: "Градус билгесе ((°), Unicode: U+00B0, HTML:
  &deg;) — **почмакның** һәм…" — *of an ANGLE*. The word and the sense in one clause.
- **`квадрат` fixes the word, its POSITION and all three notations**: "**Квадра́т киломе́тр (км², кв. км,
  km²)** — мәйдан үлчәве берәмлеге".
- **`доллар` names its sign**: "1 доллар = 100 цент. Гадәттә **$** яки USD дип билгеләнә."
- **`тигез` stands beside its own formula**: "1000 м × 1000 м = 1 000 000 м² **га тигез**". ⚠ Note it
  governs the DATIVE there; this layer emits the bare nominative a reader says for `5 = 5`.
- **The era markers are glossed COMPLETE, all four expansions and both abbreviations in one sentence**:
  "Беренче ел башланганчы бетә торган заман — **безнең эрага кадәр, б. э. к., яки яңа эрага кадәр, я. э.
  к.**", and for the positive era "**Безнең эра (б. э.), яки яңа эра (я. э.)**". Nothing in step 1 is
  authored.
- **And `кырыгынчы` is attested in the exact slot the Roman policy needs**: "**XL (кырыгынчы) гасыр** —
  безнең эрага кадәр 3901 елдан…". That single title confirms the century reading, the ordinal form, AND
  the ⟨к⟩→⟨г⟩ lenition that `ordinalOf` derives. `меңенче` has its twin: "**1000 (меңенче) ел**".

⚠ **`Цельсий` ×28 is attested in the WRONG SENSE — every hit is the SURNAME.** "Магнус Николай Цельсий
(Magnus Nicolai Celsius; 1621—1679) — швед математик", and his four sons. That is the Fula `tere` shape,
with the mitigation that the man IS the one the scale is named for; so the word is right and only the
compound *Цельсий градусы* is a stated assumption. It ships because it is letter-gated and this corpus
contains no `°C` for it to be wrong about.

⚠ **`секундына` ×31 is attested — and the corpus writes it BEFORE the numerator.** "тизлеге **сәгатенә** 720
чакрымга", "**сәгатенә** 150 км га кадәр", "Ул **секундына** 0.5 метр тизлек белән". The shared tier can
only put the denominator last, so `9,44 м³/с` reads *куб метр секундына* where the corpus would have written
*секундына 9,44 куб метр*. Morphologically correct, idiomatically inverted, and recorded rather than
declared fixed. (Basque's `unitPer: ""` is the shape being used; there is no Tatar "per" word to declare.)

## Run 5 — 2026-08-16 — the two classes that pattern-match as something else

**`=` is a GLOSS SEPARATOR, ×12 of 13.** Printing every one:

```
aba=«ölkän ir tuğan, abí»              an etymology entry
bik=«nıq»                              …and another
Cömratül-ğäqäbä (…) = Zur bağana       a translation glossary, ×4 in one list
Мәкам Ибраһим (…) = İbrahim mäqamı
Болгар елга = Болга сүз тезмәсеннән     a name derivation
أَ + ا = آ                              an Arabic ligature
29+191/360=29.5305555…                 ← the ONE arithmetic instance
```

So the `=` rule ships DIGIT-GATED and reads exactly the one. `тигез` is attested and would have been
**wrong on 12 of 13** without the gate. Same for `+`: its corpus instances are morpheme concatenation
(`aba` + `-ş` + `-ay`), and the digit requirement declines every one.

**The dot is a FIGURE REFERENCE, ×17 of 18 in the Cyrillic text.** `рәс. 12.1а`, `12.1б`, `12.2а` … — the
ophthalmology article's chapter.figure numbering, each with a Cyrillic enumerator glued to it. The others
are a date (`08.10.07`) and a ranking (`2.13. урыннар`). **Exactly one is a decimal** (`−2.88-гә`, the Mars
opposition). No dot-decimal rule is written; the comma decimal (33,800 corpus-wide) is the real one and the
tokenizer is taught to span it.

⚠ **AND THE FIGURE REFERENCES ARE WHAT VINDICATE THE CLOSED SUFFIX SET.** `12.1а`, `12.2б`, `12.2в`,
`12.2д` are a digit glued to a Cyrillic letter — precisely the shape step 4's glued branch matches. Bashkir's
open `SFX{1,5}` would have read every one as a declined numeral. The closed `CASE_SUFFIX` set rejects
⟨а б в г д е⟩ standing alone and leaves the reference untouched.

## Run 6 — 2026-08-16 — a shared-tier defect found by reading the output, not the gate

`9,44 м³/с` came out as *…куб метр* with a bare **[s]** hanging off it. The rate and the exponent are two
arms of ONE alternation in `core/normalizeSymbols.ts`, so a numerator carrying both took the exponent arm,
ended at the ³, and left `/с` outside the match. **The match succeeded**, which is why `DROP` never saw it.

Measured before touching anything: `[letter][²³]\s?/` is **26 instances across 10 mined artifacts** — ba ×8,
tt ×7, jv/mn/qu ×2, be/cdo/chv/lo/mt ×1 — essentially one notation, the river-discharge figure. After the
fix, every language that declares a rate at all (ba, tt, jv, qu) reads the denominator and none did before.
⚠ The rest still drop it, and that is a per-language DATA gap, not the regex: **be `55 м³/с` loses the unit
too**, because Belarusian never declared `м`. Recorded as a Belarusian backlog item, not claimed as fixed.

Written up as playbook **trap 60**, pinned by a core test in `test/normalize-multilang.test.ts`.

## Run 7 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 22→0 · `currency` 16→0 · `degree` 8→0 · `exponent` 8→1 · `minus` 2→1 ·
  `math-sign` 20→11 (the gloss refusal above). Residual, all read: the eleven `=` glosses, the googol
  `10¹⁰⁰` (a superscript run past ²/³), one hyphen inside a Russian bibliography line
  (`Учеб. для вузов.-4-е изд.`), and one Zamanälif RAW-LATIN leak.
- **corpus diff** (baseline emitted from a pristine worktree at `ee16964`): **191/456 utterances changed
  (41.9%), DROP 73 → 21**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang tt`**: green on every checklist item including `sourcing` and `sign classes` — the
  four refused sign classes are registered in `ACCEPTED_SIGN_SILENCE` with their counts. Only the artifact
  scan is red, on the residuals above.
- **`referee-eval tt`**: **14.5% raw / 50.7% folded / 84.3% symbol, before and after** — measured on both
  sides from the pristine worktree, and unchanged as expected for a layer that rewrites text and not the
  word g2p.
- **`vitest`** and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **be `55 м³/с` loses the unit as well as the denominator** — Belarusian declares no `м`. Run 6.
- **The rate reads denominator-last where Tatar writes it first** (*куб метр секундына* vs *секундына куб
  метр*). A tier limitation, not a data one. Run 4.
- **Zamanälif (Latin Tatar) is unread**, and the g2p is what would have to change first. Run 1.
- **`т.к.` / `к.к.` / `кч. оз.` with a genitive welded past their final dot** — five instances of a Tatar
  reading against an unmeasured count of Russian `т.к.` = *так как*. Run 3.
