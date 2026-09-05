# Umbundu (umb) normalization — investigation log

Chronological. Each run records the command, the question it was meant to answer, the RAW finding, and what
that implied for the next step. Negative results are kept: three of them are the round's most useful output.

Corpus: FLEURS `umb_ao`, **2,111 rows → 1,493 unique utterances** (column 3, cased and punctuated).
⚠ There is **no mined artifact** for this language and `mine.ts scan` cannot run, so every count below was
taken by hand over the deduplicated text and is EXHAUSTIVE rather than sampled.

---

## Run 0 — 2026-08-16 — baseline

```
npx tsx tools/normalization/corpus-diff.ts emit --lang umb --corpus umb_ao --out <scratch>/base.json
npx tsx tools/referee-eval/eval.ts umb
```

**Question.** Where does this language start?

**Raw finding.** `emitted 1493 utterances`. Self-compared, the baseline is
`DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 8 · THROW 0`, and the eight DROPs
resolve to `percent ×6 · ampersand ×1 · exponent ×1`.

`referee-eval.ts umb` **threw**: `Error: no referee config for "umb"`. That gate does not exist for this
language and cannot regress.

**Implication.** DROP=8 is low — recent wiki-sourced rounds opened at 63–130 — and it says nothing about the
defect that turned out to be the largest here, because a grouping mark read as a sentence break is
byte-visible in the IPA and invisible to every leak class. Do not read 8 as "nearly done"; read the corpus.

---

## Run 1 — 2026-08-16 — the engine, probed on attested forms

```
npx tsx -e 'import { phonemize } from "./src/index.ts"; console.log(phonemize("…","umb"))'
```

**Question.** What does the engine actually produce for the shapes the corpus writes?

**Raw finding** (abridged; every input is a corpus string):

```
3.850 km²        → tatu . ovita ecelãla lakwi atãlo km      "three. eight hundred fifty" + raw km
1.400 k’omanu    → mosi . ovita vikwãla komanu              a full stop inside the number
14,7 k’oloh…     → ekwi la kwãla , epandu vali …            a phrase break inside the number
8% tunde         → ecelãla tunde                            the sign silent
Eci kwapita 11:00, omanu → … ekwi la mosi , zelo , omanu    a phrase break inside the clock
20h30            → akwi avali h akwi atatu                  a bare letter inside the figure
2-3 km           → vali tatu km                             endpoints fused, no pause
35ºW             → akwi atatu la vitãlo w                   stranded compass letter
90º F (32ºc)     → akwi ecea f akwi atatu la vali t͡ʃ        the Celsius ⟨c⟩ read as /t͡ʃ/
AUD$45           → aud akwi akwãla la vitãlo                the sign silent
B&Bs             → b bs                                     the sign silent
lyakulῖhiwa      → ljakul hiwa                              THE WORD IS SPLIT AND A LETTER DELETED
```

**Implication.** The last line is the one to chase: it is not a symbol defect at all. Everything else is the
expected inventory. The grouping dot is the highest-count defect (20 groups) and DROP cannot see it.

---

## Run 2 — 2026-08-16 — the character census, and a Greek letter in a Bantu language

```
grep -o '[^A-Za-zÀ-ÿ0-9 ]' uniq.txt | sort | uniq -c | sort -rn
python3 -c "... Counter(ch for ch in txt if ch.isalpha() and ord(ch)>127) ..."
```

**Question.** What marks and letters does this corpus contain, and in what proportion?

**Raw finding.** The letter census, complete:

```
ã 678 · ĩ 369 · ñ 300 · õ 296 · ẽ 278 · é 58 · á 41 · â 40 · ó 34 · ũ 31 · Á 22 · í 22 · ç 18
ῖ 10  ← U+1FD6 GREEK SMALL LETTER IOTA WITH PERISPOMENI
ú 8 · Í 8 · ê 8 · º 7 · Ñ 2 · ô 2 · Ĩ 2 · ö 1 · ğ 1 · ş 1 · ă 1 · É 1 · Õ 1
```

**⟨ῖ⟩ is the ONLY non-Latin letter in the entire corpus**, ×10 across 8 word types:
`akwῖ ×2 · okupitῖla ×2 · lyakulῖhiwa · lyukulῖhiso · ekulῖho · catῖla · lavῖ · uvῖ`.

It is the GREEK TWIN of Umbundu's own ⟨ĩ⟩ U+0129, and it renders identically. The corpus writes both
spellings of the same words: `akwĩ ×12 / akwῖ ×2`, `okupitĩla ×3 / okupitῖla ×2`. `akwĩ` is TEN.

The mark census: `. 1720 · ’ 1711 · , 1478 · - 322 · ( 100 · ) 99 · “ 82 · ” 73 · : 43 · ; 20 · / 15 ·
– 12 · ' 12 · ῖ 10 · ? 8 · º 7 · % 6 · ! 5 · … 3 · ¾ 1 · ² 1 · ½ 1 · $ 1 · & 1`.
**`°` U+00B0 is ×0. `+ − × ÷ ± = < >` are ×0, all eight.**

**Implication.** This is trap 61 in mirror image — Chuvash types the Latin twins of its Cyrillic letters;
Umbundu types the Greek twin of its own Latin one. `umbundu.ts`'s TOKEN is bounded to `\p{Script=Latin}`
(deliberately, to route foreign script to `core/scripts.ts`), so a Greek letter ENDS the word: the run is
split in two and the letter itself vanishes. **No gate sees it** — nothing DROPPABLE hunts is dropped, no
raw mark survives, and both halves are well-formed Umbundu syllables, so the output reads as words (trap
56). One fold row, no vocabulary, and the census proves the blast radius is exactly those 10 characters.

Negative kept: `°` is absent. Any degree rule ported from a sibling would fire on nothing.

---

## Run 3 — 2026-08-16 — the three-digit test, and it is unanimous

```
python3 ctx.py '\d+\.\d+' 45      # 25 hits
python3 ctx.py '\d,\d' 50         # 12 hits
```

**Question.** Which mark groups and which decimates?

**Raw finding.** Every dot inside a figure has EXACTLY three digits after it —
`1.400 · 40.000 · 400.000 · 11.000 · 22.500 · 24.000 · 1.600 · 3.000 · 100.000 · 30.000 · 55.000 · 1.000 ·
17.500 · 17.000 · 6.387 · 3.980 · 2.400 · 3.850 · 5.000.000 · 6.500` (20 groups).
Every comma inside a figure has ONE or TWO —
`14,7 · 1,5 · 2,3 · 38,48 · 3,7 · 2,8 · 2,2 · 163,52 · 790,19 · 3,50 · 1,5` (12). **Not one comma groups.**

The five dotted runs that are NOT groups are `802.11n` (a Wi-Fi standard), `ociluvyavya 1.1` (a section
number) and the three sports times below — all of which have one or two digits after the dot, i.e. the
exact-`\d{3}` group is itself the discriminator and no separate version guard is needed in the local rule.

**Implication.** Portuguese convention, unambiguous. De-group the dot as a whole number (trap 63);
neutralise the comma. There is no decimal word to speak (Run 6).

---

## Run 4 — 2026-08-16 — the colon is a clock eleven times and a stopwatch three

```
python3 ctx.py ':' 45             # 43 hits
python3 ctx.py '\d{1,2}:\d{2}' 40 # 14 hits
```

**Question.** How many colons are actually clocks? (Often none are — ilo's were UTC offsets and scripture.)

**Raw finding.** 43 colons. 29 are ordinary quotative or list colons (`wapopya: “…”`, `Visangiwa
k’olonepa vivali:`). 14 have the `\d{1,2}:\d{2}` shape, and they split:

- **11 CLOCKS** — `1:15 lyomẽle · 11:00 · 07:19 k’akukutu (21:19 GMT) · 9:30 · 8:46 lyomẽle · 11:20 ·
  22:08 · 10:00 · 10:00-11:00 MDT`
- **3 SPORTS TIMES**, all in one sentence: `isoka 4:41.30, itito vali la 2:11.60 … 1:09.02 k’olominutu`
  (a competitor is named between them) — a downhill result in minutes and hundredths, not a time of day.

**Implication.** A bare `\d{1,2}:\d{2}` rule fixes 11 and breaks 3. The discriminator is the hundredths
tail, so the right guard is `(?!\.\d)` — narrow, and specifically NOT `(?![\d.,])`, which would decline
every clause-final clock (trap 58). The writer supplies the hour word where they want one (`k’akukutu`),
so only the colon is spent and the figures stay figures.

---

## Run 5 — 2026-08-16 — the en-dash is a clause dash, not a range and not a minus

```
python3 ctx.py '–' 55                        # 12 hits
python3 ctx.py '\d ?- ?\d|\d-|-\d' 50        # 10 hits
```

**Question.** Which of the three dashes is a minus, which a range, which a copula? (kaa's em-dash was a
COPULA ×30 and reading it as a minus would have been wrong every time.)

**Raw finding.** `—` U+2014 is **×0**. `–` U+2013 is ×12 and **eleven set off an apposition in running
prose**: `yosimbu yalwa – olopintula vyosimbu vilekisa…`, `kayakwatele ongusu yalwa – okuti ocimunga
c’ofeka oyo lika unyãli wavo`, `The Antlanta jornal – constutyon`. The twelfth, `eyulo liwa lyasoka
26 – 00`, is a SCORE. A spaced ASCII `-` does the same job twice more.

Every real range is written with a **TIGHT hyphen and no spaces**: `35-40 mph`, `56-64km/h`, `120-160
metelo`, `2-3 km`, `1644-1912`, `1000-1300 d. C.`, `5-3`, `7-2`, `10:00-11:00` — 9 of them. Plus
`Covid-19`, a designation whose hyphen is correctly silent.

**Implication.** kaa's finding reproduced in a different mark and a different sense, and the discriminator
here is SPACING rather than shape. Neither `–` nor a spaced `-` is in `clausePunctuation`, so 12 pauses
were simply being LOST (trap 17: a mark that should be a pause and instead vanishes is in scope). Spaced →
comma; tight → range. The range's left guard must reject a preceding LETTER, which is what declines
`Covid-19`.

---

## Run 6 — 2026-08-16 — the contact-language question, answered with instances

```
grep -oE '[0-9](,[0-9]+)?[ ]?[A-Za-zãẽĩõũñ]{1,12}' uniq.txt | sed -E 's/^[0-9](,[0-9]+)?[ ]?//' | sort | uniq -c
python3 ctx.py '\d ?(x|mph|h|mm|Km|polegada|N|p|milya|libras|pés|GP|Ta|UTC)\b' 60
```

**Question.** Does Umbundu write its OWN measure words beside a figure, or Portuguese ones? (The nci round
found Spanish in every slot; do not assume either way.)

**Raw finding.** **Portuguese, in every measure slot the corpus fills:**

```
Ciyongwiwa ombomba inene ikwete 100 pés (38,48m)                   ← feet
Olosatelite … okulema calwa 1.000 libras (454 kg)                  ← pounds
Etimba lyakonomwisi … lyatenda 6 polegada lyelupuko                ← inch
ovipepe vipitĩla olo 105 milhas k’ekukutu (165 Km/h)               ← miles
Opelikula isangiwako lyo 35 mm (36 la 24 mm negativo)              ← negative
yikala kolo 4 ale kolo 5 porcento kolomala vosi yo america         ← percent
Ocipama cafetika kolo 20h30, otembo yocitumãlo (15h00 UTC)         ← Portuguese clock
Okupisa 1966 … (1000-1300 d. C.) … olonjimbi vyalima 5000 a. C.    ← Portuguese era
```

…and the NOTATION is Portuguese too (Run 3). **But the SYNTAX is not**, and this is the part that decided
what the layer emits: the figure comes FIRST and the noun follows, in every instance — `120-160 metelo`,
`22.500 vyondolale`, `5 kwenda 100 k’olondolale`, `4 ale kolo 5 porcento`, `17.500 milya k’ekukutu`.

**Implication.** Two consequences, opposite in sign. (a) The percent word to declare is the loan
`porcento`, and it is attested ×1 in exactly the right slot. (b) `unitPrefix`/`currencyPrefix` exist
because "a measure noun heads its phrase in Bantu" — the Swahili order — and **this corpus refutes that in
every instance**. The tier's DEFAULT postposition is correct and both flags stay unset (trap 55: the
sibling is a hypothesis).

---

## Run 7 — 2026-08-16 — `º` is three different things, and one of them is a degree

```
python3 ctx.py '[$²½¾&şğăº]' 60
```

**Question.** `°` is ×0 (Run 2) — so what is the `º` U+00BA doing, and is it the confusable degree sign
three recent rounds each found?

**Raw finding.** ×7, and it is **four different things**:

```
DEGREE  ×3   ocipepe catatu camwiwa la 35ºW
             o uya ya pitila 90º F (32ºc)          ← BOTH scales, and the Celsius letter is LOWERCASE
ORDINAL ×2   Utumisi unene wo 10º yaswalãli vo-Itália        (the Italian 10th Army)
             Kolone lya Turquia vilinga 37º ofeka linene lyo lwali lulo  (the 37th largest country)
NUMERO  ×1   layevo wakulĩhiwa nda “cosmonauta Nº 11”
TYPO    ×1   ya mamako 240º km la kukuto
```

**Implication.** A `°`-shaped degree rule ported onto this codepoint would be wrong **four times in
seven**. And the two arms that would separate them are both blocked: a `[CF]` scale class reads the
Fahrenheit and misses the lowercase Celsius, while `[CFcf]` would then claim the ⟨c⟩ of any word. Moot in
any case — **no degree word is sourceable** (Run 8) — so `º` is left entirely alone. It is not in the
`degree` DROPPABLE class either, so nothing is being silenced by that decision.

---

## Run 8 — 2026-08-16 — the sourcing tiers, and there are none

```
npx tsx tools/normalization/sources.ts --lang umb
ESPEAK_NG=<espeak-ng checkout> npx tsx tools/normalization/sources.ts --lang umb
npx tsx tools/normalization/attest.ts --lang umb --words "porcento,metelo,kilometelo,…"   # 42 words
curl -s -o /dev/null -w "%{http_code}" "https://umb.wikipedia.org/w/api.php?…"
```

**Question.** What can this language's vocabulary be sourced FROM?

**Raw finding.** Every tier is absent, and the absences are each a positive measurement:

```
sources.ts   [NONE] letter-names    espeak does not ship this language at all   (no umb_list in dictsource/)
             [NONE] decimal-point   no _dpt, no _., no manifest word
             [NONE] fraction-series fraction occurs, no series to compose from
             [ · ]  scale-names     no ° in the corpus
eval.ts      no referee config for "umb"
attest.ts    umb.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence
curl         umb:000        (no connection at all)     incubator.wikimedia.org:200   (same network, same second)
```

Umbundu is still in Wikimedia **Incubator**; there is no umb.wikipedia to probe.

**Implication.** This is not trap 51's floor, it is the ABSENCE of the route. The haystack for every word
this layer emits is 1,493 sentences, and the sourcing rule that follows is the strict one: what the corpus
does not say, the layer does not say either.

---

## Run 9 — 2026-08-16 — the corpus glosses its own notation, and hides a `tere` trap in plain sight

```
grep -oiE 'ndolale|euro|ominutu|kwenda|kilo[a-z]*|milimet[a-z]*|grau[a-z]*|selsiy[a-z]*|kwadrad[a-z]*|milya' uniq.txt
python3 ctx.py 'kilo[a-zãẽĩõũ]*' 45
python3 ctx.py 'Metro|metelo' 60
python3 ctx.py 'kukutu' 55
```

**Question.** Which of the words the layer needs are in the corpus, and — reading the examples rather than
the counts — in the right SENSE?

**Raw finding.**

| candidate | count | what the examples say |
|---|---:|---|
| `kwenda` | 733 | the ordinary coordinator "and". ✔ the ampersand word |
| `ondolale`/`ondolare` | 5 / 1 | `11.000 ko 22.500 vyondolale`, `5 kwenda 100 k’olondolale`. ✔ dollar |
| `euro` | 1 | `10 k’olohulukãyi vyovita yo euro`. ✔ euro — but `€` is ×0, so unusable |
| `(a/e)kukutu` | 12 | HOUR: `07:19 k’akukutu`, `elivala lyomẽle 10 k’akukutu`, and `105 milhas k’ekukutu` = per hour |
| `metelo` | 1 | `Luno wakwatele 120-160 metelo k’okulepa lyo-kombustivel`. ✔ metre |
| `porcento` | 1 | `kolo 4 ale kolo 5 porcento kolomala vosi yo america`. ✔ percent |
| **`kilo`** | **27** | **NOT ONE is a unit.** 25 are inside `efetikilo`/`kefetikilo` ("the beginning"); the 2 whole-token hits are the postposition `kilo lyomunda` / `kilo lyeve`, "on top of the hill / the earth" |
| **`Metro`** | **4** | **the SUBWAY and a newspaper** — `ndeci o MetroPlus lakãlu anene vyo Metro`, `Esapulo ya Metro ilingiwa no ko catalão` |
| `kilometelo` `quilometro` `kilograma` `milimetelo` `grau` `selsiyu` `Celsius` `kwadradu` | 0 | — |

**Implication, three ways.**

1. **The `kilo` line is the Fula-`tere` trap found inside the corpus rather than on a wiki** — a healthy
   count, a plausible sense, and zero instances of the thing needed. Had I taken the count as the finding,
   every kilogram in the fleet's largest untreated language would have read "the beginning".
2. `metelo` ×1 sits in FLEURS's **universal cubic-metre sentence** (trap 45) — and this translation
   supplies the NOUN and not the MODIFIER, exactly as `as`, `bg` and `xh` mangle the same sentence. So the
   metre is sourced and **the cube word is not**.
3. `k’ekukutu` "per hour" is attested ×3 and the hour noun ×12 — the DENOMINATOR of the rate, which is
   normally the missing half. It buys nothing, because `unitPer` needs both units declared and the
   numerator `km` has no word at all (trap 54, the `si` case). Recorded so nobody re-derives it.

---

## Run 10 — 2026-08-16 — after: the diff, read row by row

```
npx tsx tools/normalization/corpus-diff.ts emit  --lang umb --corpus umb_ao --out <scratch>/after.json
npx tsx tools/normalization/corpus-diff.ts compare --before base.json --after after.json --examples 80
```

**Question.** What did the layer change, and did it lose anything?

**Raw finding.** `changed 71/1493 (4.8%)`.

```
before  DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 8 · THROW 0
after   DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 1 · THROW 0
```

Token-multiset delta over the 71 changed rows:

```
LOST    . ×21   , ×22   zelo ×12   ovita ×9   ⟪DROP:percent⟫ ×6   m ×6   h ×2   akw ×2   okupit ×2
GAINED  , ×25   ohulukãji ×19   lovita ×9   polt͡ʃento ×6   metelo ×6   akwĩ ×2   okupitĩla ×2
```

The 21 lost `.` are the false full stops inside dot-grouped numbers; the `zelo`/`ovita` losses are the
`.000` groups that were being read as separate numerals. Net commas **+3** — the decimal commas and clock
colons come out, the clause dashes and ranges go in. A direct check for a lost SENTENCE pause returned
**0 rows**: no changed reading stopped ending in `.`/`?`/`!` when it had before.

One gain I had not counted: `Otambula eyulo lyolomapalo olimpiku … cisoka 100m kwenda` — an Olympic event
distance, correctly `ocita metelo`.

**Implication.** Ship. The one residual DROP is the `km²` exponent, refused whole and registered.

---

## Gates

| gate | before | after |
|---|---|---|
| `corpus-diff` DROP | **8** (`percent ×6`, `ampersand ×1`, `exponent ×1`) | **1** (`exponent`) |
| DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW | 0 / 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 / 0 |
| utterances changed | — | 71 / 1493 (4.8%), 0 sentence pauses lost |
| `review.ts` sign classes | — | **ok** — none dropped (5 classes registered in `ACCEPTED_SIGN_SILENCE`) |
| `review.ts` sourcing | — | **ok** — all high-traffic words attested |
| `review.ts` clause-final | — | **ok** — a trailing `.` or `,` loses no reading |
| `review.ts` artifact tracked | — | FAIL, **expected**: there is no `tools/corpus/mined/umb.jsonc` and none was fabricated |
| `referee-eval umb` | **N/A** — `no referee config for "umb"` | N/A, unchanged |
| `vitest` / `tsc --noEmit` | clean | clean (`test/languageCatalogue.test.ts` moves by one cell, regenerated centrally) |

---

## Backlog surfaced, not fixed

Each is a measured defect this round declined, with the reason and the count.

- **`E. U. A.` ×5** — *Estados Unidos da América*, spaced and dotted, reading as three letters with three
  false sentence breaks (`e . u . a .`). Blocked on a letter-name table, and espeak ships no `umb_list`, so
  `core/initialisms.ts` would be a no-op (trap 16 checked: the seam exists, the DATA does not).
- **`a. C.` ×2 / `d. C.` ×1** — the Portuguese era markers, `5000 a. C.` reading as `a . t͡ʃ .`. Blocked on
  an era phrase; `sources.ts` reports `no era marker in the corpus` because its detector does not know this
  spelling, which is itself worth fixing in the tool.
- **`802.11n` and `ociluvyavya 1.1`** — the version and section dots still read as full stops. Correctly
  declined by the de-grouping rule; a rule that spends them needs to not collide with the sports times,
  which share the shape.
- **The three sports times** (`4:41.30`, `2:11.60`, `1:09.02`) — deliberately unclaimed. A duration reading
  needs minute and second words in this frame, and `olominutu` ×4 is attested only as a bare noun.
- **`4x4` ×2** — the ASCII ⟨x⟩ reads as /z/ through the Latin fallback (`kwãla z kwãla`). Not a math sign
  (`×` is ×0); a vehicle designation, and a trap-56 reading rather than a leak.
- **`AUD$45` ×1** — `ondolale` ×5 IS sourced; the blocker is ORDER (this corpus writes the magnitude before
  the currency), and one instance does not buy id's `US$` wrong-slot risk. The word is recorded in
  `defects.ts` so the next round starts from it.
- **`km` ×14 / `km/h` ×22 / `mm` ×6 / `kg` ×6 / `mph` ×3** — reaching the IPA as raw letter clusters, with
  no word in any source. The rate's DENOMINATOR is sourced (`k’ekukutu`) and its numerator is not.
- **`º` ×7** — see Run 7. Needs a degree word AND a discriminator against the Portuguese ordinal; neither
  exists today.
- **The noun-class concord is dropped by the tier.** The corpus writes `22.500 vyondolale`, `k’olondolale`
  — the currency and unit nouns carry class prefixes that the tier's citation form cannot supply. Visible
  in `100 pés (38,48m)` → `… metelo` where a speaker would likely say `olometelo`. A per-language question,
  not a tier bug.
