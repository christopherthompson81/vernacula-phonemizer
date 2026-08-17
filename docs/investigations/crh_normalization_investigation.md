# Crimean Tatar (crh) normalization — investigation log

Picked as the largest remaining untreated corpus with a mined artifact — **35,437 paragraph segments** —
and for the densest `abbrev` cell in the fleet relative to size: **17,218**, i.e. one abbreviation every
other segment. Also a live test of the two-script question: crh is written in both Latin and Cyrillic.

`tools/corpus/mined/crh.jsonc` — crh.wikipedia dump, 630 retained segments.

Corpus-wide: `latin-in-native` 34,974 · `abbrev` 17,218 · `digit-run` 13,132 · `year` 13,109 ·
`ranges` 1,145 · `dotted` 623 · `decimals` 451 · `signs` 208 · `ordinal-latin` 157 · `units` 144 ·
`percent` 87 · `clock` 72 · `era-marker` 62 · `fractions` 54 · `degrees` 25 · `rate` 11 · `currency` 4.

## Run 1 — 2026-08-16 — what the engine does today

```
"+3 – +4°C"            → üç dört c        both signs, the span and the degree gone; ⟨C⟩ read as [d͡ʒ]
"–1,8°C"               → bir , sekiz c    the EN-DASH minus gone, the decimal comma a pause
"69 %"                 → altmış doquz     the sign gone
"0,7%-ine"             → sıfır , yedi ine ⚠ and the case suffix left stranded
"$ 1 580"              → bir beş yüz seksen   the space-grouping unread, the sign gone
"$38.765"              → otuz sekiz . yedi yüz altmış beş   the DOT read as a full stop
"14 125 adadan"        → on dört yüz yirmi beş adadan       ⚠ the number split in two
"m.e. 753 senesi"      → m . e . yedi yüz elli üç senesi    the era letter-by-letter, two false pauses
"30° ve 46° ş.e."      → otuz ve qırq altı ş . e .          the coordinate abbreviation likewise
"5109 ± 1 m"           → beş biñ yüz doquz bir m            the ± gone, the unit raw
"2 m³/sn"              → eki m sn                           the rate unread
"1891 – 1938"          → biñ sekiz yüz doqsan bir biñ …     the span fused into one run
"600—700 biñge"        → altı yüz yedi yüz biñge            likewise, with an EM-dash
```

## Run 2 — 2026-08-16 — ⚠ THE TWO-SCRIPT PREDICTION HOLDS, BUT IN THE MARKUP RATHER THAN THE PROSE

Crimean Tatar has two official scripts, so the Tatar/Papiamento shape was the obvious hypothesis. It is
wrong about the prose — the retained text is Latin throughout — and right about something else: the wiki
runs MediaWiki's **language converter**, and the dump has left its exemption syntax in place.

```
Suv (-{H 2 O}-, digidrogen oksidi) - şeffaf, qoqusı olmağan, 0° -{C}- araretinde buzlağan
Qırğız tili (öz adı -{кыргыз тили, кыргызча}-, قىرعىزچا) – türkiy gruppadan bir tildir
Afğanistan ( – -{Afġānistān}-, د افغانستان اسلامي امارت – -{Də Afġānistān Islāmī Imārat}-)
«-{Enel}-», «-{Eni}-» ve «-{Telekom İtaliya}-»
```

`-{…}-` marks a run that must NOT be transliterated when the reader switches script — chemical formulae,
foreign names, other languages' own spellings. ⚠ **`core/markup.ts` already strips the delimiters and keeps
the content**, so this needed no rule; recording it as a negative result, and as the reason the seventeen
`-{` instances are not a defect.

⚠ **The Cyrillic that IS present is Russian, not Crimean Tatar** — thirty-one segments of bibliography
("Газета «Ленин байрагъы» от 22 февраля 1962 года", "Энциклопедический словарь Брокгауза и Ефрона"). ⚠
Except for one character: the DEGREE SCALE LETTER. `+24°С` and `+4°С` in the Yalta climate paragraph use
U+0421 CYRILLIC CAPITAL ES, exactly as Karakalpak's did one round earlier. Two unrelated Turkic corpora,
the same confusable, the same place.

## Run 3 — 2026-08-16 — ⚠ EVERY DASH DOES TWO JOBS, AND THE CODEPOINT SETTLES NOTHING

Karakalpak, one round earlier, had a clean split: the em-dash was the copula and never the minus. Crimean
Tatar has no such split — each mark does at least two jobs:

| mark | minus | range | copula |
|---|---|---|---|
| `-` HYPHEN | `-6 °C` | `520-590 mm` · `63-68 %` | — |
| `–` EN-DASH | `–1,8°C` · `–1,4°C` | `+3 – +4°C` · `1891 – 1938` · `+22 – +28°C` | — |
| `—` EM-DASH | — | `600—700 biñge` | `Yaltanıñ iklimi — Aq deñiz tipindedir` · `arareti — +2,8 °C` |

**Implication** the discriminator is POSITION, not codepoint, and the fleet's existing guard already
expresses it: `(^|(?<!\d)[\s(])[-−–]\s?(\d)`. A digit before the dash makes it a range; a non-digit before
makes it a minus. `1891 – 1938` and `+3 – +4°C` are declined by the `(?<!\d)` alone.

⚠ **BUT THE FLEET'S STEP ORDER HAD TO BE INVERTED.** Every layer in this sweep runs SIGNS before RANGES, so
a minus is not eaten by the span rule. Here the endpoints are themselves SIGNED — `+3 – +4°C`,
`+22 – +28°C` — so the range rule must run FIRST and must accept a sign in its lookahead, or the span is
lost the moment `+4` becomes a word. Running signs first and ranges second reads `+3 – +4°C` as two
unrelated temperatures.

## Run 4 — 2026-08-16 — ⚠ `=` IS MARKUP, ELEVEN TIMES OUT OF ELEVEN

The cleanest refusal of this sign the sweep has produced — not "mostly not an equation" but never one:

```
PlotArea = left:50 right:20 top:25 bottom:30          ScaleMajor = unit:year increment:5000 start:0
ScaleMinor = unit:year increment:1000 start:0         ScaleMajor = gridcolor:darkgrey increment:250
preload=Template:Standard content for new page        == Bağlantılar ==
```

Eight EasyTimeline chart directives, two MediaWiki URL parameters and one section heading. ⚠ The
EasyTimeline sense is a RECURRENCE — Aragonese produced six of them one round earlier — which makes chart
markup a fleet-level property of dump-sourced artifacts rather than a quirk of one wiki.

⚠ **AND `+` IS A TEMPERATURE TWELVE TIMES OUT OF THIRTEEN.** `+3`, `+4`, `+24,6`, `+2,8`, `+23,8`, `+23,3`,
`+27,3`, `+11,2`, `+22`, `+24`, `+0,4`, `+0,3`, `+21,7`, `+23`, `+26`, `+15`, `+11`, `+19` — the climate
paragraphs. The thirteenth is a party abbreviation, `VF+` (South Africa's Freedom Front Plus), and it is
declined by the same digit lookahead Karakalpak needed for `C++`: a real sign always has a digit after it.

## Run 5 — 2026-08-16 — the colon, and the abbreviations

⚠ **THERE IS EXACTLY ONE COLON BETWEEN DIGITS AND IT IS A DOCUMENTARY RUNTIME** — `Belgesel, 00:17:00`,
inside a script-converter block. `clock` is 72 corpus-wide; zero times of day are in the retained text. No
clock rule is written.

The abbreviations are where this corpus's density lives, and two families matter:

```
ERA          m.e. 753 senesi  ·  m.e. 754/753 seneleri  ·  m.e. 36,000 senesine  ·  m.e. 496 senesi
COORDINATE   30° ve 46° ş.e. enlikleri ve 6° ğ.b. ve 36° ş.b. boyluqları arasında buluna
```

⚠ **And the corpus glosses both of them.** `milâttan evel VIII biñyıllıqta` and `milâttan evel III asırda`
spell out what `m.e.` abbreviates; and "araret **minus derecege** alçaqlaşuvınıñ ihtimalı bar" — *the
temperature may drop to MINUS degrees* — supplies the minus word and the degree word in one clause, in
prose, beside the paragraphs that write `–1,8°C`.

## Run 6 — 2026-08-16 — ⚠ THE MINUS HAS A WORD AND THE PLUS DOES NOT

`attest.ts --lang crh` over 39 words on a 35k-segment wiki, which is thin enough that several answers are
absences rather than counts: `foiz`, `procent`, `protsent`, `gradus`, `Selsiy`, `evro`, `eksi`, `nokta`,
`ülüş`, `enlik` and `boyluq` all score ZERO.

| word | × | what the examples show |
|---|---|---|
| `minus` | 3 | ⚠ ALL THREE the temperature slot — "gecede minus 16°С-ge yaqın ve kündüz minus 11°С" |
| `plüs` | 5 | ⚠ RUSSIAN FILM TITLES — "Plüs odin (Плюс один)", "Tri plüs dva (Три плюс два)" |
| `artı` | 9 | ⚠ the postposition "beyond/behind" — `deñiz artı departamentı`, `Evniñ artı bağça` |
| `yüzde` | 2 | ⚠ one TURKISH sentence, one "yüzde tırnaq yarası" (damage *on the surface*) |
| `faiz` | 8 | ✓ the percent slot — "(Ukraina mendanlığından **1 faizden az**)" |
| `derece` | 31 | ⚠ none a temperature: knucklebone ranks, "III derece nişan", "soñ derece müim" |

⚠ **The asymmetry is the finding, and it is a trap-53 result rather than an untidy one.** The minus has a
sourced word and the plus does not, so only the minus ships — and that is *correct*, because a minus
INVERTS its operand and a plus does not. `+24°C` reads as twenty-four degrees whether or not the sign is
spoken; `–1,8°C` does not.

⚠ **AND THE DEGREE WORD CAME FROM THE ARTIFACT, NOT THE BATCH.** `derece` failed the wiki check in exactly
the Fula way, and the mined corpus supplies it twice over: "araret **minus derecege** alçaqlaşuvınıñ
ihtimalı bar" for the thermal sense, and the time-unit article for the angular one — "Daqqa - bir saatnıñ
1/60-ine ve 60 saniyege teñ olğan zaman birlemidir (60 Saniye = 1 Daqqa, 60 Daqqa = 1 Saat). Aynı zamanda
1 **dereceniñ** 1/60-ini de ifade ete." One sentence defining `saniye`, `daqqa`, `saat` AND `derece`.

## Run 7 — 2026-08-16 — two gaps found after the first draft

⚠ **THE COORDINATE ABBREVIATION WOULD HAVE DOUBLED ITS OWN HEAD NOUN.** "30° ve 46° **ş.e. enlikleri** ve
6° **ğ.b.** ve 36° **ş.b. boyluqları**" — two of the three abbreviations are followed by the very noun they
expand to, so the full expansion reads *şimaliy enlik enlikleri*. The rule emits the adjective alone when
the writer has already supplied the noun (the Turkmen `+11° gradus` shape, third recurrence in this sweep).

⚠ **AND THE AUTHOR'S OWN `kvadrat` BREAKS THE TIER'S ADJACENCY.** "5 **kvadrat km** qaplağan", "10 biñ
**kvadrat km**-ge yaqın" — the exponent word the tier would emit is already there, written *between* the
figure and the unit, so `km` is no longer adjacent to a number and stays raw. Expanding just the unit
before the tier fixes it. The same shape, from the other side, is why `biñ` is declared as a magnitude.

⚠ **A trailing space in the magnitude expansion cost the unit.** `mln\s?\.` → `"million "` left TWO spaces
before `km²`, and the tier allows one — so `106,2 mln. km²` composed the magnitude and dropped the unit.
Consuming the following space fixes it; **the same latent bug was in the Karakalpak layer** committed one
round earlier and is fixed here too.

## Run 8 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 18→0 · `degree` 15→0 · `minus` 9→0 · `currency` 4→0 · `exponent` 27→6 ·
  LEAK `km` 35→2, `sm` 4→3, `mln` 1→0, `mlrd` 1→0. Residual, all read: the `~1,220` tilde approximation,
  the `-{H 2 O}-` chemical formula, `2 m³/sn` (a rate with no sourceable connective) and two `km` inside
  percentage clauses with no adjacent figure.
- **corpus diff** (baseline emitted from a pristine worktree at `b3ed6b4`): **158/414 utterances changed
  (38.2%), DROP 69 → 29**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW either side.
- **`review.ts --lang crh`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — six refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval crh`**: 38.9% raw / 94.4% folded / 98.9% symbol, before and after (an 18-pair referee).
- **`vitest`** 4,596 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **`2 m³/sn`** — a rate, and no connective is sourceable: Crimean Tatar expresses "per" with a case
  ending on the denominator (`saniyede`), which the shared tier cannot place.
- **`~1,220 000 km²`** — the tilde as "approximately". One instance, no word checked.
- **`5109 ± 1 m`** — refused because the plus half has no word; see the sign registry.
- **The plus sign generally** — twelve temperatures read without their sign. Harmless (a plus does not
  invert) but recorded, because a sourced word would improve them.
