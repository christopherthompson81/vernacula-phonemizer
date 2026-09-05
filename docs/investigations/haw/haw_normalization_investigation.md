# Hawaiian (haw) normalization — investigation log

Picked as the largest genuinely untreated corpus left in the fleet — **7,735 paragraph segments**. (`ps` is
bigger but already has a layer; its catalogue row is a macrolanguage stub.) Polynesian: a thirteen-letter
alphabet, the ʻokina and the macrons, and a vocabulary that borrows its technical terms by *sound* rather
than by spelling — which turns out to be the round's whole story.

`tools/corpus/mined/haw.jsonc` — haw.wikipedia dump, 646 retained segments.

Corpus-wide: `latin-in-native` 7,726 · `digit-run` 3,111 · `year` 3,105 · `abbrev` 1,796 ·
`initialism` 979 · `ordinal-latin` 521 · `decimals` 452 · `ranges` 343 · `signs` 260 · `roman` 179 ·
`percent` 149 · `clock` 78 · `currency` 71 · `dotted` 66 · `units` 61 · `degrees` 17 · `fractions` 12 ·
`rate` 8 · `era-marker` 5.

## Run 1 — 2026-08-16 — what the engine does today

```
"he 100% ma luna"        → he hoʻokahi haneli ma luna          the sign gone
"435,036 km"             → ʻehā haneli … , … km                the grouping comma a pause, the number split
"3,200 klm (1,988 mil)"  → ʻekolu , ʻelua haneli klm …         and both unit abbreviations raw
"13,796 kp (4,205 m)"    → … kp … m                            likewise
"9–13 °C (48–55 °F)"     → ʻeiwa ʻumikūmākolu k …              the span fused, the degree gone, ⟨C⟩ a letter
"-19.7˚C"                → ʻumikūmāiwa . ʻehiku k              the minus gone, the dot a full stop
"$2.5 biliona kālā"      → ʻelua . ʻelima piliona kālā         the sign gone, the dot a full stop
"1½"                     → ʻekahi ʻekahi ʻelua                 ⚠ the vulgar fraction read as 1 1 2
"ma 28°25′ʻĀ, 178°20′K"  → … the degree, the prime and the compass letters all silent
"PlotArea = left:50"     → plokalea lepk , kanalima            EasyTimeline chart markup
```

## Run 2 — 2026-08-16 — ⚠ THE COORDINATE IS GLOSSED AGAINST ITS OWN NOTATION, EVERY TIME

The richest degree attestation the sweep has found. The Northwestern-Hawaiian-Islands articles write the
symbolic coordinate and then spell it out in the same parenthesis — six times over, one per island:

```
Aia ʻo ia ma 28°25′ʻĀ, 178°20′K
  (ʻiwakāluakūmāwalu KĒKELĒ ʻiwakāluakūmālima MINUKE … ʻĀKAU lakikū … KOMOHANA lonikū)
```

That single sentence sources `kēkelē` ×37, `minuke` ×32 **and** the compass words. ⚠ **And it is where the
COMPASS LETTERS come from: `ʻĀ` is *ʻākau* (north) and `K` is *komohana* (west)** — not N and W. A layer
ported from any Latin-script neighbour would have looked for the wrong letters entirely, and matched
nothing.

⚠ **`H` IS DELIBERATELY NOT CLAIMED.** It would be ambiguous between *hema* (south) and *hikina* (east),
and the artifact shows only the two letters above. Guessing the fourth arm is exactly the shape trap 9
warns about.

⚠ **AND THE DEGREE SIGN HAS A CONFUSABLE HERE TOO** — `°` U+00B0 in `25°`, `9–13 °C`, `28°25′`, but
`˚` U+02DA RING ABOVE in "ʻO ka wela maʻamau no Eureka, Nunavut, o **-19.7˚C** i **-19.9˚C** ai ʻole
**38.4˚F**". Third round running with a confusable in this slot: Karakalpak and Crimean Tatar both wrote
the scale LETTER in Cyrillic; this one moves the SIGN.

## Run 3 — 2026-08-16 — ⚠ THE UNIT ABBREVIATIONS ARE HAWAIIANISED AND UNGUESSABLE

Hawaiian borrows technical vocabulary phonetically, and the abbreviations follow the borrowed word rather
than the SI symbol:

| written | is | proof in the corpus |
|---|---|---|
| `klm` | *kilomika*, kilometre | `3,200 klm (1,988 mil)` · `10,432 klm²` · `1,545.4 klm²` |
| `kp` | *kapuaʻi*, foot | `13,796 kp (4,205 m)` — Mauna Kea, 13,796 ft = 4,205 m |
| `mil` | *mile* | `(1,988 mil)` beside the 3,200 km above |

⚠ **`klm` in particular is a letter-order no ported table can produce**, and it is the corpus's commonest
unit abbreviation. `km` and `m` also occur, so both spellings are declared.

⚠ **THE SQUARE MEASURE WORD FOLLOWS ITS UNIT** — `mile kuea`, `kilomika kuea`, `kapuaʻi kuea` — which is
the opposite of the Karakalpak and Crimean Tatar rounds either side of this one, where `kvadrat` precedes.

⚠ **AND THE CORPUS GETS ITS OWN UNIT WRONG.** `kapuaʻi` is *foot* everywhere it stands alone (`4,784
kapuaʻi ke kiʻekiʻe`, `5,243 kapuaʻi ka luna`), yet the island articles write "596.7 **kapuaʻi kuea**
(1,545.4 klm²)" for Oʻahu — which is 596.7 square MILES, not square feet. Four islands are described this
way. Recorded, not fixed: this layer reads the words the writer chose.

⚠ **THE RATE CONNECTIVE IS A TWO-WORD PHRASE**, and the corpus supplies it: "he ikaika loa ka makani
pāhili - he 118 **kilomika o ka hola** a ʻoi" — *118 kilometres per hour*. That is what makes `km/h` and
`mph` readable at all.

## Run 4 — 2026-08-16 — ⚠ THE CORPUS DEFINES ALL FOUR ARITHMETIC SIGNS, AND THAT IS WHY NONE IS READ

One sentence in the mathematics article is a complete sign glossary:

```
Ma ka makemakika, aia ʻehā hana maʻamau:
  ka huinahelu (+), ka lawenahelu (−), ka hoʻonui (×), a me ka māhele (÷).
```

*Four common operations: addition (+), subtraction (−), multiplication (×), division (÷).*

**And every one of those words is a NOUN FOR THE OPERATION, not a connective.** `4 huinahelu 5` would read
*four addition five*. The shared tier can only place a connective BETWEEN operands, so the glossary that
looks like a gift is in fact the argument for refusing all four. Same shape as chv's `тан`, skr's `برابر`
and kaa's `teń` — the fourth time in this sweep, and the first where one sentence supplies the whole set.

⚠ **THE MINUS REFUSAL COSTS, AND THAT IS THE CONTRAST WITH THE PREVIOUS ROUND.** Crimean Tatar refused its
PLUS at no cost, because a plus does not invert its operand. Hawaiian has to refuse its MINUS, which does:
`-19.7˚C` reads as positive nineteen degrees. `maina` and `mīnuke` are ABSENT from haw.wikipedia, `koena`
×18 is "the remainder/the rest of" in every example, `emi` is the verb "to decrease", and the integers
article names the CLASS rather than the sign ("nā helu piha **ʻiʻo ʻole**", non-positive integers) — an
adjectival phrase the tier cannot place. Registered with the price stated rather than papered over.

The other two `=`-family instances are not arithmetic at all: ten of eleven `=` are **EasyTimeline chart
markup** (`PlotArea =`, `ScaleMajor =`, `TimeAxis =`, `ImageSize =`) — ⚠ the THIRD language running for that
sense, after Aragonese and Crimean Tatar — and the second `×` is a CARTRIDGE DESIGNATION, `nā pōkā
7.62×39mm` in the Kalashnikov article.

## Run 5 — 2026-08-16 — ⚠ THE SCRIPTURE COLON IS A DIFFERENT CODEPOINT FROM THE CLOCK

`clock` is 78 corpus-wide. The retained text's only colon between digits is a Bible reference —

```
(nānā iā ʻOihana Kahuna 8ː10-12 a me Pukaʻana 30ː29)
```

— written with **U+02D0 MODIFIER LETTER TRIANGULAR COLON**, not `:`. The clocks on the wiki are ASCII
("ka hola 12:18 ʻo Iune 26, 1997", "mai ka hola 12:00 awakea a ka hola 5:00 ahiahi"). So a rule keyed on
the ASCII colon reads every clock and can never touch a verse — the codepoint IS the guard, which is the
opposite of the situation in Crimean Tatar, where the codepoint settled nothing.

## Run 6 — 2026-08-16 — the separators, and one German figure

The convention is American: the comma groups (`435,036 km`, `371,657`, `3,849,674`, `9,970,610`,
`$100,000`, `3,200 klm`) and the dot decimates (`8.6/10`, `71.6`, `19.95`, `552.3 kapuaʻi kuea`,
`-19.7˚C`, `56.4 mika`).

⚠ **The one exception is a quoted German figure**: "He 138,070 mau mile kuea (Kelemānia: **357.600** km/h)"
— Germany's 357,600 km², with a European grouping dot *and* a mislabelled unit, inside a Hawaiian sentence
that groups with commas two words earlier. So the three-digit test is needed on the dot as well.

⚠ **And the guard also has to decline an IP ADDRESS**: `ua hoʻomaka ka IP address 18.55.6.215 mai ka
pūnaewele MIT`. A decimal is a run with exactly ONE dot.

⚠ **No decimal word is sourceable.** `koena` ×18 is "the remainder of" in every example and `pūʻiwa`-type
candidates score nothing, so the mark is spent rather than spoken — the Punjabi choice. The defect actually
being fixed is the false sentence break mid-quantity.

## Run 7 — 2026-08-16 — sourcing

`attest.ts --lang haw` over 33 words: **29 attested, 4 absent** (`kekele`, `kenikeni`, `maina`, `mīnuke`).

⚠ **`kekelē` without the first macron is a FULA CASE and `kēkelē` with it is not.** `kekelē` ×4 is the
ACADEMIC degree in every example ("kahi kekelē ma Applied Clinical Research", "ke kekelē laeʻula", "Nā
papahana kekelē"); `kēkelē` ×37 is the angular one, in the coordinate glosses above. One macron apart, and
the wrong one would have read every temperature as a diploma.

Read and rejected: `koena` ×18 (the remainder), `emi` ×24 (to decrease), `hapa` ×56 (part/half, but never
beside a figure in this artifact).

## Run 8 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 23→0 · `degree` 9→0 · `currency` 17→1 · `exponent` 12→0 · `ampersand` 5→0 ·
  LEAK `km` 22→1, `klm` 4→0, `kp` 1→0, `mph` 4→0. Residual, all read: the six minus signs (registered with
  their price), the EasyTimeline `=` block, `mm` ×3 with no attested Hawaiian word, one `ph`, and one
  currency inside an English film title.
- **corpus diff** (baseline emitted from a pristine worktree at `236af49`): **160/418 utterances changed
  (38.3%), DROP 81 → 20**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW either side.
- **`review.ts --lang haw`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — nine refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval haw`**: 79.6% raw / 98.9% folded / 99.8% symbol, before and after — on a 2,152-pair
  referee, the largest of the last six rounds.
- **`vitest`** 4,601 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The minus** — six instances, no word, and the refusal costs a reading. See the sign registry.
- **`1½`** — the vulgar fraction reads as *ʻekahi ʻekahi ʻelua*, one one two. `hapa` ×56 is attested but
  never beside a figure here, so `hapalua` is a construction rather than an attestation.
- **`°C` / `°F`** — the scale letter still reaches the g2p as a bare consonant. No Hawaiian Celsius or
  Fahrenheit name is attested on this wiki.
- **`kapuaʻi kuea` for square miles** — four islands described with the wrong unit noun. A corpus error,
  and correcting it would mean overruling the writer.
- **`mm`** ×3 — no attested Hawaiian millimetre word.
