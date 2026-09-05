# U+2212 MINUS SIGN — reading the sign the fleet drops

**The premise.** U+2212 is defined by Unicode as the arithmetic minus operator, it is visually distinct from
the hyphen, and no keyboard layout produces it without effort. Whoever typed it meant a minus. That makes it a
*stronger* signal than the ASCII hyphen this fleet already reads in dozens of languages — so a language that
reads `-5` as a negative and drops `−5` is not being careful, it is being inconsistent.

**The concern, stated once and then worked around rather than used as an excuse.** The character's identity
tells you the author meant a minus SIGN. It does not tell you the structure of the expression the sign sits in,
and this repo's own corpus proves the gap: `×10 −31 kg` is a negative EXPONENT flattened by mining, `90 −120
مېتىر` is a range someone typed with the wrong dash, and `занҳо −76,2` is an apposition dash. All three are
U+2212, none of them is "minus N". So the premise licenses reading the character; it does not license reading
it *anywhere*. The trigger still has to be measured per language.

## Run 1 — how many engines drop it — 2026-08-25 11:40

Probe: `phonemize("−5", code)` against `phonemize("5", code)` for all 193 registered codes, and the same for
`-5`, to separate "no minus reading at all" from "reads the hyphen, drops U+2212".

```
110  read U+2212 already
 83  DROP U+2212
      ├─  9  read the ASCII hyphen — a MINUS WORD and a rule already exist
      └─ 74  drop both — no leading-minus reading at all
```

The nine: **af, az, ca, cy, ff, ga, ha, kk, kmr**. Each has a sourced minus word already in the reading
(*minus*, *mənfi*, *menys*, *minws*, *usta*, *lúide*, *rashin*, *минус*, *negatîf*) and a rule whose character
class was simply written `-`. This is the set an earlier sweep (#955) declined on the grounds that U+2212 has
zero attestation in all nine mined corpora and adding it would be invention. **That refusal is what the premise
above overturns**: the evidence for the character is the character, and the cost of being wrong is asymmetric —
dropping a minus INVERTS the value.

## Run 2 — the nine, done — 2026-08-25 11:55

Changed `-` to `[-−]` in one character class per language (kazakh twice: its `°C` arm consumes the number
before the general sign rule runs; kurmanji inside its temperature rule, which is the only place kurmanji
claims a minus at all). **Every guard is untouched** — leading position only, so a range and a negative
exponent are still refused by the lookbehind.

```
             −5 °C              1838−1917       10−19       5 − 3
  af    mˈinœs fˈəif …          (silent)        (silent)    (silent)
  …     all nine now match their ASCII-hyphen reading exactly
```

Verified: 60 languages byte-identical, 12,000 golden rows, 0 differ. U+2212 occurs **0 times** in af.tsv and
ha.tsv, which is the point — the change is inert on every corpus the fleet has and only adds a reading for
text those corpora never sampled. af and ha are the only two of the nine with a C# port; both mirrored.

**Found in passing, NOT fixed here (pre-existing, and not a U+2212 fault):** Kazakh reads `-0.5` as
*nʏktˈe bˈes* — "point five", with the leading zero AND the sign both gone. `−0.5` does the same because the
dot-decimal rule at step 8 consumes the number before the sign rule runs. Kazakh writes decimals with commas
(`-0,5` reads correctly, *mˈəjnws nˈøɫ bʏtˈɪn bˈes*), so this is the dot arm treating a decimal point as a
figure separator. Separate fault, separate fix, TS-first.

## Run 3 — reading the 31, and the count lying again — 2026-08-25 12:10

Of the 74 with no minus reading, **31 attest U+2212 in their mined corpus**. That set was the evidence-backed
work item #955 deferred. Dumped every instance with 40 characters of left context and read them rather than
counting them — the discipline that killed the last fleet-wide rule, applied before building this one.

**It changes the answer for 14 of the 31.** A leading-position rule `(?<![\p{L}\p{Nd}])[-−](\d+)` fires on all
of these, and is wrong on every one:

| shape | languages | example | why the guard misses it |
|---|---|---|---|
| negative EXPONENT, space-separated | cdo, my, jv, ki, hy, wuu, yo | `×10 −31 kg`, `s −2`, `g·mol −1` | the char before `−` is a SPACE; the lookbehind only sees one character back, so the base `10`/`s`/`mol` is invisible to it |
| RANGE typed with a minus | ug, st, bar | `90 −120 مېتىر`, `1865−1866` | ug writes the range SPACED, so the digit-lookbehind that catches `1865−1866` does not catch `90 −120` |
| APPOSITION dash | tg | `занҳо −76,2` ("women — 76.2") | indistinguishable by form from a genuine `амҽхак −4,6 м` |
| the sign NAMED, not applied | haw, ti | `ka lawenahelu (−)`, `disorder − እዚ` | not before a digit — inert, no rule needed |
| genuine but SPACED from its digit | tl, mos | `singil ng − 1 / 3`, `+5 − 2` | `[-−](\d)` requires adjacency; these stay silent either way |

**The remaining 18 are genuine and worth reading** — ab, ak, bar, bo, hak, ht, hy, ilo, ky, ltg, mos, mt,
nan, pcm, rw, tn, yo, za. (An earlier draft of this list said 17 and dropped **mos**, whose single instance
`n yɩɩg −1 °C la 2 °C` is as genuine as any of them. bar, hy and yo are MIXED — each has genuine leading
negatives alongside a range or an exponent — and are counted here because the genuine instances are real,
not because the language is clean.) Almost all are temperatures or elevations: `−173 °C`, `−12.71 м`,
`−154m`, `−89 °C (−129 °F)`, `−27.2 °C`, `−6.0 °C`, `−20 and 30 °C`.

**Three are CONTESTED and get no rule without their own decision:** `ee` (a judo weight CLASS, `−63 kg`,
where "minus 63 kg" is a register question rather than an arithmetic one), `tg` (four of seven instances are
apposition dashes — *занҳо −76,2*, "women — 76.2" — indistinguishable by form from a genuine leading
negative), and `wuu` (one genuine `m = −1` against three space-separated exponents).

**⚠ AND NONE OF THE 18 HAS A MINUS WORD.** Checked every manifest and engine file: not one declares `minus`
or `plusMinus`. That is the actual cost the #955 deferral named, and it is unchanged by the premise — the
character tells you a minus is meant, it does not tell you what this language CALLS one. Each needs a sourced
word before a rule can be written, which is per-language attestation work, not a sweep.

**Next:** source the minus word for the 18, one language at a time, and pair each with the trigger its own
corpus supports (a unit or degree sign follows, in almost every genuine instance) rather than the bare
leading-position guard that the exponent and range shapes above defeat.

## Run 4 — the symmetry probe, which found what the grep could not — 2026-08-25 12:35

After editing the nine, a grep for a remaining ASCII-only minus arm returned nothing. That was not enough.
Replaced it with a BEHAVIOURAL sweep: 16 shapes × 9 languages, asserting `phonemize("−X") === phonemize("-X")`.
Six asymmetries, and the grep had missed every one.

**One was mine.** Kurmanji has FOUR minus arms, not one — a temperature rule, a bare-degree rule, a
`pile`-phrase rule and a string-START rule — and the first pass fixed one. Worse, the `pile` arm carries a
NESTED hyphen inside its own lookahead (`(?=(?:\s*û\s*-?\p{Nd}+…)?…pile)`), which exists so a coordinated pair
reaches BOTH operands. Widening the outer class and not the inner one produced exactly the failure that
lookahead was written to prevent:

```
  heta −24 û −30 pileyan   →   … bˈiːst ˈuː t͡ʃˈɑːr ˈuː nɛɡɑːtˈiːf sˈiː …   the FIRST sign gone
```

A sign silently dropped from half a coordinated phrase — the value inverted on one operand and not the other.
Fixed; the sweep is clean for kurmanji now.

**Five are pre-existing defects on the HYPHEN path that the symmetry probe exposed, where the U+2212 reading
is the CORRECT one.** Recorded here, not fixed — each changes existing golden readings and needs its own
per-language measurement.

- **`1, -2` reads as a RANGE in ff, ga and ha.** The range rule is `(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)`, and
  `[\d,]*` lets the number swallow its own trailing comma, so a comma-separated LIST of negatives becomes
  `1 zuwa 2` ("one TO two"). Confirmed directly: `ha: "1, -2" → ɗˈa˥ja˥ , zˈu˥wa˩ bˈi˥ju˥`, and `"5, -3, -4"`
  reads the first as a range and the second as a minus. U+2212 escapes it only because it is deliberately NOT
  in the range class.
- **`GMT-00:43` fuses the initialism into the number in cy and ga** — `tʲˈeːn̪ˠɑːⁱdʲ`, one token from `T` and
  `00`. The hyphen is removed without leaving a boundary. `T-00` alone is fine, so it is the interaction with
  the initialism path.

**A judgement call recorded rather than taken:** U+2212 is not in any RANGE class either, so `1838−1917` is
silent where `1838-1917` reads as a range. Reading it as a range would serve the lifespans and page spans
(#955 counted 18 such instances) and mis-serve the flattened exponents (`×10−19`) in the same set. The premise
this work rests on — U+2212 means the arithmetic operator — argues for minus semantics, not range semantics,
so silence stays. Noted as an open option, not a gap.

## Run 5 — the minus word, sourced against each language's own wiki — 2026-08-25 14:05

Candidate words supplied for all 18. Probed every one with `tools/normalization/attest.ts`, in the
temperature/degree register the corpus instances actually sit in, and READ the examples.

### ⚠ First, a correction to Run 3's list: SEVEN of the 18 already read U+2212

Run 3 classified engines by `phonemize("−5")`. That is the wrong probe for a language with a NARROW,
measured trigger — several claim a minus only before a degree or a percent word, and refuse a bare number on
purpose. Re-probed across four shapes (`−5`, `−5 °C`, `−5 m`, `−5 %`):

```
  bar  hak  hy  ky  mt  rw  tn     read U+2212 already, and symmetric with the hyphen
```

Their readings, and this is the finding that reshapes the remaining work — **not one uses the subtraction
verb**:

```
  bar  −5 °C → minus fimf ɡ̥rɑd̥ kelsius              the loanword, preposed
  mt   −5 °C → mɪnus ħamsa ɡradɪ t͡ʃɛlsju             the loanword, preposed
  hy   −5 °C → minus tɑsnhinɡ t͡sʰelsiusi ɑstit͡ʃɑn    the loanword, preposed
  ky   −5 °C → minus on ʁrɑdus                        the loanword, preposed
  rw   −5 °C → doɡeɾe selisijusi ɡatanu munsi ja zeɾu   "below zero", POSTPOSED
  tn   −5 °C → dikirii t͡sa kɪlkius … kwa t͡ɬasɪ χa lɪfɪla   "below zero", POSTPOSED
  hak  −5 °C → … laŋ˩˩ ha˦˦ …                          零下, "below zero"
```

So the real gap is **11 languages**: ab, ak, bo, ht, ilo, ltg, mos, nan, pcm, yo, za.

### The sourcing result: 0 of 11

| lang | candidate | verdict | what the examples actually say |
|---|---|---|---|
| tn | `ntsha` | ×23 / 3 arts | **"to emit"** — *di ntsha digase* "they emit gases", *go ntsha gase ya carbon dioxide*. The Fula `hakkunde` shape exactly. |
| rw | `gukuramo` | ×15 / 9 arts | **"to extract"** — *gukuramo umutobe* "extract juice", *gukuramo karubone* "carbon extraction". |
| yo | `ìyọkúrò` | ×6 / 4 arts | **"removal"**, physical — gas removal, water removal (*evaporation*). `òdì` ×28 is "opposite" (*òdì kejì*). |
| ht | `mwens` | ×16 / 11 arts | **the COMPARATIVE** — *mwens pase* "less than", *pi plis oswa mwens*. The kurmanji `kêm` refusal. `negatif` ×2 is the adjective (*negatif chaje*). |
| mt | `naqqas` | ×8 / 6 arts | **"reduced"**, past tense — *naqqas il-kontroll*. And `minus` ×1 is **`Privilegium Minus`, a Latin charter title**, not Maltese. |
| ilo | `negatibo` | ×12 / 6 arts | **the ADJECTIVE** — negative coefficient, *gram-negatibo* bacteria. Modifies a noun, never a numeral. |
| bo | `འཐེན` | ×23, unspaced | **"to pull"** — *ཐ་མག་འཐེན་པ* "to smoke", drawing a bow, pulse terminology. |
| hy | `հանած` | ×10 / 7 arts | set subtraction — *"Asia is Eurasia **minus** Europe"*, *"plus or **minus** a leap second"*. Real, wrong slot. |
| ab, ak, ilo, ltg, pcm, za, nan, hak | all candidates | **×0** | absent outright. `nan`/`hak` are written in ROMANIZATION on their wikis, so the Han forms cannot hit. |

**⚠ THE SUPPLIED WORDS ARE DICTIONARY-CORRECT AND SLOT-WRONG, AND THAT IS THE WHOLE FINDING.** Every one of
them is a real word meaning "to subtract". None of them is what a reader says in front of a number. The
distinction is not pedantry: `ntsha`, `gukuramo`, `ìyọkúrò` and `naqqas` are TRANSITIVE VERBS OF REMOVAL that
take an object, so emitting one before a numeral produces "emit six point zero degrees". The seven languages
that already work prove what the slot actually wants — the loanword *minus*, or a postposed "below zero".

**Second round, with the corrected target** (`lábẹ́ òdo` / `ìsàlẹ̀ òdo` for yo, `anba zewo` for ht,
`baba ngem ti sero` for ilo, `mīnus` / `zam nullis` for ltg): **all ×0**. These are small wikis and the
phrasings are guesses. Stopped there rather than continuing to try spellings until one returned a hit —
probing variants until something attests is how invention gets laundered into evidence.

**Where this leaves the 11.** They need a source this repo cannot reach by wiki search: a speaker, a
maths textbook, or a corpus with spoken temperatures. Until then the sign stays dropped, which INVERTS the
value and is the worse failure — but a confidently wrong word in the slot is not an improvement on it, and
"emit six degrees" is what the available candidates would produce.

## Run 6 — silence is not the safe option, but only a word that MEANS negative buys the trade — 2026-08-25 15:20

Challenged on Run 5's conclusion: a dropped minus INVERTS the value, so silence is probably worse than a
dictionary-correct word that is not attested in the slot. That is right, and this repo already agrees with
it — kurmanji ships `negatîf` on exactly that reasoning, with the register caveat in the file, and
`defects.ts` carries a `minus` DROP gate so a silent sign is tracked rather than accepted.

**But Run 5 ran two different failures together, and only one of them supports silence.**

| class | candidates | does emitting it buy the trade? |
|---|---|---|
| **A — means "negative", wrong register** | `negatibo` (adj.), `mwens` (comparative), `hū` 負 | **Yes.** A listener gets "negative", which is the fact that would otherwise be lost. |
| **B — means something else entirely** | `ntsha` "emit", `gukuramo` "extract", `ìyọkúrò` "removal", `naqqas` "reduced", `འཐེན` "pull" | **No.** "emit six degrees" does not tell anyone the temperature is below zero. Nothing is recovered. |

Class B is not a register problem, it is a different word. And the languages those candidates belong to —
tn, rw, mt — already read the sign anyway (Run 5's correction), so the question was moot for all three.

**Tibetan is the sharpest case and it is a REFUSAL, confirmed by the user as an antiquated term.**
`མོ་གྲངས` "female number" is the traditional name for a negative, but ×17 of its ×19 modern instances are
census counts — `ཕོ་གྲངས་༤༩༧༨༩༥༡དང་མོ་གྲངས་༥༢༤༥༤༡`, "male count 4,978,951 and **female count** 524,541".
Emitting it would misread demographic sentences, which Tibetan text is full of.

### Shipped: three languages that read no minus at all now read U+2212

| lang | word | evidence | strength |
|---|---|---|---|
| `nan` | ⟨負⟩ / *hū* | **the corpus glosses its own sign**: `(2000 kg) × (−10 m/s) = 20000 kg⋅m/s, hū-hō tāi-piáu hong-hiòng` — "the MINUS SIGN represents the direction". Plus `hū-chū-jiân-sò͘ (−1, −2, −3, ...)` in the integers article. | strong |
| `ilo` | `negatibo` | ×12/6 arts, ×2 as `negatibo a numero` in a maths list of number kinds. The ADJECTIVE — not a record of what a reader says. | caveated |
| `ht` | `mwens` | ×569 comparative, the direct reflex of French *moins*. **Never once digit-adjacent.** Concept sourced, construction inferred — the kurmanji shape. | caveated |

**⚠ U+2212 ONLY IN ALL THREE, AND THAT IS WHAT MAKES A CAVEATED WORD DEFENSIBLE.** The ASCII hyphen keeps its
existing refusal, because the hyphen is where the hazards live: Haitian's ~36 BCE years (`etabli nan -509`),
Ilocano's 103 UTC offsets, POJ's own compounding (`hū-hō`), ISBNs, page spans, EasyTimeline offsets
(`shift:(-10,5)`). Claiming only the character that can *only* be the operator costs nothing that was ever
read correctly and removes the whole class.

**⚠ EVERY RULE CARRIES A SECOND LOOKBEHIND: `(?<!\p{Nd}\s)`.** This is Run 3's exponent finding turned into a
guard. `×10 −31 kg` is 10⁻³¹ with the superscript flattened by mining, and a leading-position lookbehind
cannot see it — it looks ONE character back, finds a space, and fires. Seven languages in this fleet's
corpora write an exponent exactly that way.

Min Nan needed two arms and the placement mattered: arm (a) looks ahead for a unit/degree/percent, arm (b)
takes a bracket, comma or line start (`(−1, −2, −3, ...)` — the comma is in the class because the second and
third members have nothing else to their left, and claiming only the first would sign one of three). Placed
after the degree rules it silently failed on `溫度 −5 °C`, because step 3 had already spent the `°` that arm
(a) looks for — trap 39 again.

**An existing test was pinning the defect.** `test/ilocano.test.ts` asserted `−224 °C` reading as *224 °C*.
Same corpus sentence, a temperature wrong by 448 degrees, expected verbatim. Updated.

**Still unsourced — 8 of the 11:** ab, ak, bo, ltg, mos, pcm, yo, za. bo is a refusal on evidence; the other
seven returned ×0 on every candidate, so there is no word to caveat, only one to invent.

## Run 7 — the alternates I skipped, and one of them was a whole language — 2026-08-25 16:05

Challenged on Run 5/6: each language came with SEVERAL candidate words and I had probed the primary plus my
own guesses. Correct — and the gaps were not evenly distributed.

**⚠ MOSSI WAS NEVER PROBED AT ALL.** Not one attest call for `mos` in Run 5. It was carried in the
"×0 / absent" column of that table on no evidence whatsoever. Probed now (`yãk`, `yãk n yiis`, `minus`):
genuinely ×0 — the conclusion survives, but it was not a finding until this run, it was an assumption
wearing a finding's clothes.

**⚠ AND `comot` — pcm's PRIMARY candidate — WAS NEVER RUN EITHER.** I probed `minus`, `negativ`,
`negativ nomba` and `bilo zero`, all my own guesses, and skipped the word actually supplied. ×0, along with
`commot`.

### Every named alternate, now probed

| lang | alternates run this round | verdict |
|---|---|---|
| mos | `yãk`, `yãk n yiis`, `minus` | all ×0 |
| pcm | `comot`, `commot` | ×0 |
| yo | `àmì ìyọkúrò` ×0; **`yọ kúrò` ×2** | physical removal — *methane tí a kò yọ kúrò*, "methane not removed" |
| bo | `འཐེན་རྟགས` ×0, `འཕྲི་འཐེན` ×0; **`འཕྲི` ×9/5** | **the genuine arithmetic verb**, quoted from an arithmetic primer: *"འབྲི་བགྲང་སྣོན་པ་རང་གི་གཡས། སྒྱུར་བགོད་འཕྲི་བ་གཡོན་ལ་རྩོམ"* — writing, counting, ADDING from the right; multiplying, dividing, SUBTRACTING from the left. The OPERATION, not the sign. |
| ab | `ашәыхра`, `аӡәыхра`, `минус белгиси`, `аминуси` | all ×0 |
| ltg | `atjimšona`, `atjimsona` | ×0 |
| ak | `yi firi mu`, `te firi mu`, `ntefiri` | all ×0 |
| za | `gienj` ×0 — **but `gemj` ×3, and the spelling was mine to get wrong** | see below |
| ht | `siy mwen` ×0; `soustraksyon` ×9 | the operation noun, in real maths prose (*adisyon, soustraksyon, miltiplikasyon ak divizyon*). One example corroborates the register: *"espesyalman le itilize **nonm negatif**"*. Ships `mwens` regardless. |
| hak | `fu` ×43 romanized | **the romanization trap** — every hit is a different morpheme: `Fu-ho̍k-sṳ` 副學士, `fu-sṳn-miàng` 富, `fu-siông` 互相, *"Kîn-chi-ho̍k chṳ̂ fu"* 經濟學之父. None is 負. hak reads the sign already. |

Moot but run for completeness, all on languages that ALREADY read the sign: tn `ntsho` ×26, rw `gukuraho`
×25, bar `oziang` ×5, mt `tnaqqis` ×102, ky `алуу белгиси` ×1, ilo `panangkissay` ×5. Every one is a
subtraction noun or verb; none would improve a language reading "below zero" or "minus" today.

### ⚠ ZHUANG: THE SPELLING WAS WRONG, THE WORD IS A HOMOGRAPH, AND THE SENTENCE PROVES THE NEED

`gienj` is ×0; Standard Zhuang spells it **`gemj`**, which attests ×3/2. Reading them:

```
…ndaeng, bak, naengbak, rwz, naeng, gemj, rizndaeng, heuj caeuq hangz…     a list of FACIAL PARTS — CHEEK
…sang daemq raemx haij bi gemj 1m … Bi 2007, gemj daengz -420m…            the VERB "to decrease"
```

One instance is the noun **cheek**; the other two are "to decrease". Emitting it for a leading sign gives
*cheek four hundred eighteen metres*. Refused — and this is the clearest case yet that a wrong-sense word
does not buy the trade, because a homograph does not even fail quietly.

**And the same sentence is the best evidence in this whole investigation that za NEEDS the reading.** It is
the Dead Sea's elevation: `sang daemq Haijdai dwg -418m … gemj daengz -420m` — below sea level, written with
an ASCII hyphen, twice, in ordinary prose. Zhuang's single U+2212 instance understated the gap.

**Nothing changed in any engine.** Eight languages remain unread — ab, ak, bo, ltg, mos, pcm, yo, za — and
every named candidate for each is now probed rather than assumed.

## Run 8 — three routes, no word, and the accounting was the thing that was wrong — 2026-08-25 17:10

Pressed again: for the remaining eight the outcome is still silence, and silence inverts. Ran the two routes
I had not tried, and then fixed what they exposed.

### Route 2 — concept-first (`tools/normalization/concept.ts`), which I should have used from the start

The word-first search asks "does this word occur?" and needs a candidate. The concept-first one asks what a
language CALLS a thing, via Wikidata labels and interlanguage links. Run for **minus sign** (Q10764194) and
**negative real number** (Q200227) across all eight:

```
       minus sign   negative number      article in that wiki
  ab   —            —                    no article, either concept
  ak   —            —                    no article
  bo   —            —                    no article
  ltg  —            —                    no article
  mos  —            —                    no article
  pcm  —            —                    no article
  yo   —            —                    no article
  za   —            —                    no article
```

Only **subtraction** exists, and only for four: bo `འཕྲི་རྩིས།`, yo `Ìyọkúrò`, za `Gemjfap`, nan `Kiám-hoat`
— the OPERATION, which is the distinction this tool's own header is built around (Hindi's `जोड़` is addition,
`धन` is the plus SIGN, and only the second belongs in `+5`).

### Route 3 — the gloss hunt, which is how tn/nan/kmr were actually found

Setswana's reading was never composed; it was FOUND, as a sentence writing both forms:
*"degree Celsius tse di kwa tlase ga lefela di le thataro ntlha botlhano (−6.5 °C)"*. So I searched each of
the eight wikis with `insource:` regex for a signed number and read the surrounding prose.

**Every hit is the digit form. Not one wiki glosses its own minus.** ab's are planetary temperatures
(`(−173 °C)`, `(−108 °C)`, `(−43 °C)`) and an SI-unit table; ltg's are the two already known; mos's are a
climate table; pcm's is Uranus; bo's include an algebra article writing `−0 = 0`, `−(−a) = a` — the sign in
formulae, never spoken.

**⚠ AND COMPOSITION IS NOT AVAILABLE EITHER.** "Below zero" looks composable — `zam` (ltg, ×16), `laj` +
`lingz` (za, ×19/×34) all attest. But Setswana's phrase is `kwa tlase **ga** lefela`, with a connective
between the parts that having the two words would never supply. Assembling a phrase is a claim about the
language's syntax, and getting it wrong produces something that is not the language.

### ⚠ WHAT WAS ACTUALLY WRONG: YORUBA'S SILENCE WAS EXEMPTED, NOT REPORTED

`ACCEPTED_SIGN_SILENCE` quiets the gate for a class where *no reading is shippable at all*, argued in the
language's own file. Its header warns: **"'no rule yet' is a TODO and must keep failing. Adding a real gap
here to quiet the gate is exactly the wrong use of it."** Yoruba's `minus` entry was doing precisely that.

The entry argued that a digit-flanked dash in Yoruba is a RANGE — **true of the hyphen and the en dash**,
3,378 and 4,159 of them between digits, with `sí` read on 1,427 instances and glossed twice by the corpus.
It says nothing about U+2212. And yo.wikipedia carries **81 U+2212 instances**; many are infobox UTC offsets,
but a parenthesised-degree probe returns seven articles whose Yoruba PROSE carries genuine negative
temperatures — `ìwọ̀n otútù àròpín ti −47.6 °C (−53.7 °F)`, `−38 °C (−36 °F)`, `−39.8 °C (−39.6 °F)`,
`−65 °C (−85 °F)`. Those are not ranges, nothing reads them, and the operand inverts.

**Exemption removed. `review.ts --lang yo` now prints `minus -5 DROPPED` — a hard fail.** That is the
principle made operational: the gap is a TODO, so it fails until a word is found.

Latgalian's entry stays, because it argues the whole class and states the price (*"Daugpils's record low
reads as +43"*) — but it is now strengthened with the exhausted word search (`minus`, `mīnus`, `atjimt`,
`atjimšona`, `zam nullis`, `nulle` all ×0; no Wikidata label, no article for either concept), so it is an
argued refusal rather than a TODO in disguise.

### The enlarged accounting

Two languages' need is bigger than the mined corpus showed — the same lesson twice, that a small mined
sample understates a class:

* **yo** — 5 instances mined, **81** on the wiki, with genuine prose temperatures.
* **za** — 1 U+2212 mined, but the Dead Sea sentence writes `-418m` and `-420m` with an ASCII hyphen in
  ordinary prose, so the real population is elevations below sea level as well.

**Still eight, and now for a stated reason rather than an untried one:** three independent routes — every
named candidate probed, both concepts absent from Wikidata and from every one of the eight wikis, and no
gloss sentence anywhere in their own text. There is nothing to read the sign with that would not be invented.
What changed is that the silence is now reported rather than exempted.

## Run 9 — Yoruba, taken on its own — 2026-08-25 17:50

`yọ kúrò` / `yọ` offered again as the Yoruba minus. Rather than re-probe the word, went to the seven
articles the sign actually occurs in and read their PROSE. Three findings, and together they close Yoruba.

**1. The corpus's own negative-temperature prose contradicts the subtraction verb.** Yoruba does write about
sub-zero temperatures, and when it does it reaches for a LOCATIVE or a COMPARATIVE, never for `yọ`:

```
ìwọ̀n otútù tó wà ní ÌSÀLẸ̀ −50 °C            "temperatures that were BELOW −50 °C"
iwọn otutu kekere ti o KERE JU ti −38 °C     "a low temperature of LESS THAN −38 °C"
ìwọ̀n otútù tó LỌ SÍLẸ̀ ní oṣù January        "the temperature that WENT DOWN in January"
```

So `yọ` is not merely unattested in the slot — the slot is occupied, by a different construction. And `yọ`
is a high-traffic verb with several senses (remove, emerge, sprout, be slippery); emitted before a numeral it
forms a bare VP that reads as an imperative — *yọ mẹ́tàdínlógójì dígírì*, "remove thirty-eight degrees".

**2. No Yoruba article glosses its own minus.** Pulled the full text of the four articles carrying negative
temperatures (`Ìgbì ooru Antarctica ti ọdún 2024`, `Ìgbì òtútù ilẹ̀ Yúróòpù ti ọdún 2006`, `Ìkún omi Zadar ti
ọdun 2017`, `Oju-ọjọ Milwaukee`). Every temperature is the DIGIT form — `−47.6 °C (−53.7 °F)`, `−39.8 °C`,
`−65 °C`, `-26 °F (-32 °C)`. Not one is spelled out.

**3. ⚠ AND THE COMPOSABLE PHRASE IS A HOMOGRAPH.** Both halves of "below zero" are well sourced here —
`ìsàlẹ̀` "below" in a temperature sentence above, and `òdo` "zero" glossed against the digit in the corpus's
own scoreline `góòlù mẹ́rin sí òdo (4–0)`. But the only attestation of the two together is:

```
… tó tó ìdá méjì nínú mẹ́ta sí ÌSÀLẸ̀ ODO Niger      "…two-thirds of the way DOWN the river Niger"
```

`odo` is RIVER and `òdo` is ZERO, distinguished only by tone marks that half of running Yoruba omits. A
composed *ìsàlẹ̀ òdo* would be heard as **"downriver"** — the Zhuang `gemj`/"cheek" failure again, in the
language this fleet ports to C#.

**What is actually missing for Yoruba is the FRAME, not the vocabulary.** Both content words are sourced.
What no route here can supply is how a speaker joins them in front of a figure — Setswana's answer turned out
to be a postposed relative clause (*dikirii tse di kwa tlase ga lefela di le thataro ntlha botlhano*), which
is not something the two words predict. The answerable question is not "what is the Yoruba for minus" but
"how does a Yoruba speaker say `−47.6 °C` aloud, as a whole phrase".

## Run 10 — Yoruba reads it, and the term came from the article, not the word list — 2026-08-25 18:40

`yọ kúrò` / `yọ` offered again inside a full spoken phrase. Checked the phrase against the engine first, and
**two of its five slots are wrong in ways this repo can prove**:

```
  "…mọ́kànlélógójì…"    the engine renders 41 as exactly that. −47.6 needs mẹ́tàdínláàádọ́ta (47).
  "…àmì-ìdáná…"        ×0 on yo.wikipedia. Yoruba's decimal word is `àti dásímà`, already in the
                       manifest on 18 unanimous corpus instances, and the engine already reads
                       47.6 as `mẹ́tàdínláàádọ́ta àti dásímà mẹ́fà`.
```

**But the phrase carried the real word, which no word-list round had produced: `alòdì`.** Probing it led to
yo.wikipedia's own article **`Nọ́mbà alòdì àti nọ́mbà adájú`** — "negative numbers and positive numbers":

> *"Nomba alodi ni awon nomba tiwonkere ju òdo lo fun apere -√2, **-1.44, -1**"*
> negative numbers are the numbers less than ZERO, for example −√2, −1.44, −1

**The term named beside its own operand** — the same gloss shape that settled tn (`kwa tlase ga lefela`
beside `(−6.5 °C)`) and nan (`hū-hō tāi-piáu hong-hiòng` beside `(−10 m/s)`). `alòdì` ×4/2, `nọ́mbà alòdì`
×2/1. The other sense is ordinary ("*alòdì sí ìwà ìbàjẹ́*", opposed to corruption) and a temperature is not
that context.

**⚠ `dín ní` IS REFUSED, AND IT IS WORSE THAN MERELY WRONG.** Offered in the same phrase, ×7 attested — and
every instance is Yoruba's SUBTRACTIVE NUMERAL frame: *márùn dín ní ọgọ́ta* is **55**, "five less than
sixty". A `dín ní` emitted before a figure would be parsed as part of the number.

Shipped: U+2212 only, leading, with the `(?<!\p{Nd}\s)` exponent guard this corpus needs (`1.98739x10 −21 s`).
Mirrored in C#, which matches Node on all six probe shapes. Parity holds — U+2212 is ×0 in yo.tsv.

**The hyphen stays refused, and now on Yoruba's own measurement rather than by inheritance:** all four
leading hyphens before a digit in the mined artifact are SPANS — `1897 -1957` (a lifespan), `1803 -1832`
(a reign), and the German century ranges `13.-15.` / `8.-12.` that escape the range rule because the dot
breaks its digit adjacency. Zero are negatives. The `minus` exemption is re-added for the hyphen with that
measurement, replacing the removed one that had exempted the whole class on a range argument that never
mentioned U+2212.

**Measured effect on the corpus, not just synthetic probes:** `review.ts --lang yo` artifact scan went from
`DROP minus ×3` to `×1`.

## Run 11 — Naija, where the English word IS the language's answer — 2026-08-25 19:20

Offered: a Naija speaker reads `−47.6 °C` as "minus forty-seven point six degrees Celsius" — English, because
an English-lexified creole code-switches for maths. Checked, and this one is well founded, for a reason
already sitting in the file:

**⚠ THE PRECEDENT IS IN NAIJA'S OWN TIER.** `naija.ts` declares `percent: ["percent"]` — the bare English
word, sourced from pcm.wikipedia's "85 percent" — and it reads as [pasɛnt] because the engine NATIVISES a
known English spelling through the English dict rather than spelling it out. `minus` takes the identical
route and comes out **[mainas]**, the ordinary Naija reflex of /ˈmaɪnəs/. The word is not being imported;
the language's own machinery is being used the way it already is for `percent`.

Attestation is ×1 and recorded as a lead, not a finding: pcm.wikipedia writes *"kolet loan for Sovereign
credit rating (of **BB minus**) fom fitch rating"* — the word in Naija prose, in the modifier sense, though
not before a numeral. What carries the rest is that the register around the sign is English-lexified
throughout — the corpus sentence holding the only U+2212 is *"get di lowes minimum **temperashor** of 49 K
(−224 °C; −371 °F)"* — and a creole whose maths vocabulary is its lexifier's has no competing native
candidate to be wrong about.

**⚠ AND THE HYPHEN REFUSAL IS THE CLEANEST MEASUREMENT IN THIS INVESTIGATION.** Of the ten leading hyphens
before a digit in the mined artifact, NINE are not negatives:

```
  U -20 Women's world cup   ·  onda -10 to onda -15 levu  ·  onda -17 team     AGE GROUPS  ×5
  (1999 -2000)              ·  Di 2017 -18 PGA tour                            ranges      ×2
  start:-750                ·  shift:(0,-5)                                    EasyTimeline ×2
  between -78.5C|F to 5.7C|F                                                   a NEGATIVE  ×1
```

The age-group shape (`onda -20`, "under-20") is Naija-specific and would have been invisible to a
count. Claiming the hyphen misreads nine to fix one, so U+2212 only — measured for this language rather
than inherited from the others. Registered in `ACCEPTED_SIGN_SILENCE.pcm` with that measurement, so the
gate reports INTENT rather than a permanently red line.

**⚠ NOTED, NOT FIXED: `°C` IS STILL DROPPED IN pcm.** `47.6 °C` reads *foti sɛvin pɔint siks si* — the
degree sign gone and ⟨C⟩ read as the English letter name. pcm.wikipedia has seven digit-adjacent degrees
(`37.5°C`, `70°C`, `63°F`) and writes the noun as `temperazho` / `tempireshon`, but no DEGREE word is
sourced. Separate gap, separate sourcing — and the minus is worth reading without it, because a dropped
degree loses a unit while a dropped minus inverts the quantity.

**Six remain: ab, ak, bo, ltg, mos, za** — and bo is a refusal on evidence, not a gap.

## Run 12 — six phrases at once, graded against the engine — 2026-08-25 20:30

Whole-phrase readings offered for ab, ak, bo, ltg, mos and za. Graded each numeral and each content word
against what this repo already has sourced, the way the Yoruba phrase was graded. **The grades differ
sharply by language, and that is the useful part.**

| lang | numeral in the phrase | verdict |
|---|---|---|
| **ab** | `ҩынҩажәи быжьба` | **EXACT** match to the engine's 47 |
| **mos** | `piis naas la yopoe` | matches but for the engine's `a` (`pis naase la a jopoe`) |
| **za** | `siseiq cib caet` | the engine's 47 is `seiq cib caet`; an extra syllable |
| **bo** | `ཞེ་བདུན` | correct — but see below |
| **ltg** | `ketretdasmit septeņi` | **misspelled**; the engine's sourced form is `četrudesmit septeni` |
| **ak** | `aduonum a ɛtɔ so nkrɔn` | **WRONG — that is 59.** 47 is `aduanan nson` |

Abkhaz also matched on a SECOND independent slot: the phrase ends `Цельси иградус`, which is exactly the
`celsius` value already in `abkhaz.jsonc` from the full-wiki sweep.

### Shipped: ab

`минус` is ×0 on ab.wikipedia, and so is the a-prefixed `аминус`. It ships anyway, on the block's own
pattern rather than on a token: **every symbol word in `abkhaz.jsonc` is a bare Russian loan that the
full-wiki sweep did attest** — процент, градус, доллар, евро, фунт, километра, метра, квадрат. Abkhaz takes
its sign vocabulary from Russian unadapted, Russian's minus is минус, and ky and kk — same contact profile —
ship the same word on attestation. The cost of silence is measured: **eleven signed temperatures on
ab.wikipedia and every one a genuine negative** (`- 18, -19 °С`, `-18 инаркны -23°C`, `(-173°С)`, `−87 °C`,
`(−63 °C)`).

**⚠ AND `ахәҭаа` FROM THE SAME PHRASE IS REFUSED**, which is why grading the parts matters: it was offered
as the decimal point and it is ×11/8 meaning **"share / proportion"** — `рыхәԥса ахәҭаа — 14%`, `ацифратә
кьыԥхь ахәҭаа 9%`. It is `ахәҭа` ("part") inflected. Abkhaz's decimal stays unread.

### Held or refused, each for its own reason

* **bo — REFUSED.** The marker is `མོ་གྲངས`, already refused as the census term ("male count … female
  count …") and confirmed antiquated. The supplied string also carries an **Arabic letter پ (U+067E)** where
  Tibetan པ belongs, which is a generation artifact rather than a spelling.
* **za — HELD.** `Lingzha` ×0, as are `lingzhaj` and `lingz laj`. The parts attest (`lingz` zero ×34, `laj`
  below ×19) but the juncture is a syntax claim. ⚠ THIS ENTRY ORIGINALLY ALSO CITED `gemj`/"cheek", WHICH IS
  THE WRONG CANDIDATE — `gemj` was the EARLIER Zhuang proposal; this phrase proposes `Lingzha`, a different
  word entirely. See Run 14 for what the right candidate actually measures.
* **ltg — HELD, and the reason is a spelling one.** The phrase misspells the numeral this repo has sourced,
  so its Latgalian orthography is not something to take on trust for a word that is itself ×0 (`minus`,
  `mīnus`, `komats` all absent). Sister Latvian ships `mīnuss` on 1/1 — the route is real, but whether
  Latgalian writes `minus` or `mīnuss` is exactly the question the source got wrong elsewhere.
  ⚠ One useful find: **`gradi` ×6/3 IS attested** — a Latgalian degree word, for a different gap.
* **mos — HELD, on a specific doubt worth naming.** The phrase gives English `minus`, but Burkina Faso is
  **francophone** and a schooled Mooré speaker code-switches to French — `moins`, not `minus`. The supplied
  form looks like an artifact of an English-language prompt. Both are ×0 in Mooré prose anyway: `insource`
  finds `minus` once in an English EP title on a Kenyan musician's page and `moins` once inside a French
  URL — two foreign-text false positives, not attestations.
* **ak — HELD.** `mainɔso` and `dɛgrii` are ×0, and this is the language whose numeral the source got
  wrong by twelve. Ghana is anglophone so a nativised English `minus` is plausible on the Naija argument,
  but Akan has no `percent`-style precedent in its own file to ride on.

**⚠ A NEW SOURCE TIER, USED FOR THE FIRST TIME HERE: espeak's dictsource.** `lv_list` carries `± plusmi:nuss`
— which is where Latvian's `plusMinus` came from with 0/0 wiki tokens, a precedent this investigation had
not noticed. `ab_list` turns out to carry a whole sign block with Abkhaz names (`% ap_r'ocent_`,
`$ ad'ollar`, `+ acc_'aga`, `& amp_'ersand`), which independently corroborates the Russian-loan pattern —
though its `-` entry is the HYPHEN's name, not a minus reading. Worth sweeping for the languages still open.

**Five remain: ak, bo, ltg, mos, za.**

## Run 13 — a correction: homography is not the disqualifier I kept calling it — 2026-08-25 21:15

Challenged on why a homograph should disqualify a candidate at all. It should not, and I had been leaning on
it in three places. Unpicking what each refusal actually rested on:

**⚠ THE YORUBA ONE WAS SIMPLY WRONG.** I wrote that a composed `ìsàlẹ̀ òdo` "would be heard as *downriver*"
because `odo` is RIVER and `òdo` is ZERO, distinguished only by tone marks that half of running Yoruba omits.
But this layer EMITS the string, and it emits it toned:

```
  òdo  (zero)   →  o˩do˧
  odo  (river)  →  o˧do˧
```

Two different pronunciations, and the g2p produces the right one from the marks we write. The collision is a
problem for a human READING untoned Yoruba, not for what a phonemizer OUTPUTS. The refusal survives on the
other ground — the juncture is a syntax claim the two content words do not supply, and Setswana's turned out
to need a connective (`kwa tlase **ga** lefela`) — but the homograph half of the argument is withdrawn.

**⚠ THE ZHUANG AND TIBETAN ONES WERE MISLABELLED.** I called them homograph failures; they are MISSING-SENSE
failures, which is a different thing:

* `gemj` — Wiktionary gives ONE sense, **cheek**, from Proto-Tai \*keːmꟲ, and the corpus adds a Chinese-loan
  verb "to decrease" (`gemj daengz -420m`). Neither is a negative marker. That it also means cheek is
  incidental; what disqualifies it is that the sense we want is absent.
* `མོ་གྲངས` — the maths sense exists but is archaic, and the modern one (census "female count") is what a
  reader meets. Again a sense problem.

**Where homography DOES cost, and it is narrower than I implied:** when the competing sense is a
high-frequency FUNCTION word that captures the syntactic parse. Haitian `mwen` is the case — the 1SG pronoun,
so *mwen ven degre* parses as "I twenty degrees" with the sign never read as a sign. That is about parse
capture, not about two words sharing a spelling. (And it did not change an outcome: `mwens` shipped, not
`mwen`.)

**The general rule, corrected:** a phonemizer emits a PRONUNCIATION, so a same-sounding homograph costs
nothing the written form did not already cost — the listener does exactly the disambiguation a reader does.
Where the senses differ in tone or stress, it costs less than nothing, because we control the marks. Only a
function-word collision is worth refusing on.

None of the shipped decisions change. Two of the refusals keep their outcome on better-stated grounds, and
one argument is withdrawn outright.

## Run 14 — web-searching the four held, and closing espeak as a tier — 2026-08-25 21:40

**espeak is not a source for minus words, for anyone.** Swept its dictsource after Run 12 flagged it as
promising. Two results, and the second is the general one:

* **No dictsource exists at all for ak, bo, za or ltg** — the four still open. The tier is empty for them.
* For the languages espeak DOES ship, the `-` slot is the HYPHEN'S NAME, never a minus reading: lv
  `_- defise`, ka `_- tire`. It carries `+`, `%`, `$`, `&`, `=` — lv even has `± plusmi:nuss`, the entry
  Latvian's `plusMinus` came from — but a minus-sign word is absent across the board. Worth recording so
  nobody re-runs this tier for this class.

**Web search corroborated none of the four markers**, but returned two contextual findings worth keeping:

* **mos** — Burkina Faso has run bilingual French/Mooré primary classes since 1994, and there is a paper
  specifically on Mooré mathematical neologisms (*Procédés d'enrichissement du lexique mathématique en moore
  dans les classes bilingue français/moore au Burkina Faso*, ResearchGate — 403 to automated fetch). So a
  documented Mooré maths lexicon EXISTS and is reachable by a human; it also makes the supplied English
  `minus` less likely still, since the classes are French-medium.
* **ak** — Ghana's mathematics curriculum is English-medium (NaCCA primary syllabus, SHS curriculum), which
  supports the code-switch reading the Naija argument rests on, but supplies no Akan word.
* **za** — Wiktionary gives `gemj` exactly one sense, **cheek**, with a Proto-Tai etymology. That is an
  independent second source for the refusal.
* **ltg** — the Latgalian dictionaries exist online (`vuordineica.lv`, the LU and RTA projects) but none is
  queryable from here for this entry.

**Still five: ak, bo, ltg, mos, za** — bo refused, the other four held with a named next step each.

### Run 14b — Zhuang, on the candidate actually proposed — 2026-08-25 22:00

⚠ **I refused Zhuang by answering the wrong word.** `gemj` was the candidate in the FIRST batch of language
notes; the whole-phrase reading proposes **`Lingzha`**, which is not `gemj` and shares nothing with it. The
cheek etymology is irrelevant to it. Re-run against the right candidate:

* **`Lingzha` does not parse in Standard Zhuang orthography.** Final consonant letters carry TONE — `lingz`
  is *ling* + tone 2 (zero), `laj` is *la* + tone 3 (below, Wiktionary: "below; underside; bottom", antonym
  `gwnz`). A syllable written `ha` is tone 1 and is not the "below" morpheme; `laj` is. So the supplied form
  is malformed rather than merely unattested.
* **The grammatically motivated forms are ×0**: `laj lingz`, `lajlingz`, `lingz laj`, `lingzhaj`, `gwnz lingz`.
* **The parts are solid.** `lingz` ×34 — and the examples show BOTH senses cleanly: `Lingz … dwg cungj
  doenghduz nyamhcij` is the MONKEY, while `Bak lingz loeg(106)` is the zero of Chinese-style number names
  (百零六). The zero sense is well attested in exactly the numeral register. `laj` ×19.

So Zhuang is held on the JUNCTURE — which of `laj lingz` / `lingzlaj` / something else a speaker says — and
not on any collision. (`lingz` is itself a homograph with "monkey", and by Run 13's corrected rule that costs
nothing: same pronunciation either way, and context disambiguates exactly as it does in writing.)

## Run 15 — Zhuang: the phrase IS in our orthography, and that is what makes it checkable — 2026-08-25 22:40

Asked whether the supplied Zhuang phrase conforms to the orthography this engine reads. **It does** — Standard
Zhuang, the 1982 Latin orthography, which is what `zhuang.jsonc` declares and what the scanner implements.
It is not a different writing system (not the 1957 orthography with its ƨ/ɵ/ɯ letters, not Sawndip). So every
word in it can be parsed against the engine's own rules, and two of them do not survive that:

```
  Lingzha  →  liːŋ˨˦ haː˨˦     TWO syllables. ⟨z⟩ is a syllable-final TONE letter and never an onset, so
                               this can only be `lingz` + `ha`; it is not one word in this orthography.
  siseiq   →  θiː˨˦ θeːiː˧˥    a stray `si` before `seiq` (4). The engine's 47 is `seiq cib caet`.
  denj     →  teːn˨˦           well formed; a plausible 点 loan for the decimal, ×0 (a separate gap)
  du weiz  →  tuː˨˦ ʔɯiː˧˩     well formed; `du` is plausibly 度, `weiz` unidentified as Celsius
```

⚠ **AND ONE TONE LETTER AWAY IS A NUMERAL.** `haj` is **five** — `bak lingz haj` is 105 in the manifest's own
number names — so `lingz ha` sits beside `lingz haj`, "zero five", in exactly the register a minus marker
lives in. By Run 13's corrected rule this is NOT a refusal: the two differ in tone (`haː˨˦` vs `haː˥`), the
engine emits the marks, and a listener hears them apart. It is recorded as the reason the second syllable's
tone matters rather than as an objection.

### Shipped: za

Clarified that `lingzha` is an adaptation of Chinese 零下 *língxià*. **The first half is verified in this
repo's own data:** `lingz` is the zero in `numbers.units`, and it is itself the Chinese 零 loan, load-bearing
in Zhuang number names (`bak lingz haj` = 105, `Bak lingz loeg` = 106 in the corpus). A language whose ZERO
is a Chinese numeral loan borrowing 零下 for the sub-zero reading is that same borrowing continued — the
Abkhaz argument in a different contact pair, and the corpus corroborates the wider habit with `gemj` < 减.

Stated as unverified: the word is ×0, and the second syllable's tone is a guess (`ha` is tone 1; 下 is
falling, so a real spelling might be `hah` or `haq`). Preposed, as 零下 is in Chinese.

**⚠ THE HYPHEN IS REFUSED HERE EVEN THOUGH IT CARRIES REAL NEGATIVES**, which is the opposite of the usual
reason and worth stating: za's genuine leading negatives are the Dead Sea elevations `-418m` / `-420m`,
written with the ASCII hyphen. But the hyphen is also the range mark this file's own era rule reads
(`259BC-210BC`, `551 BC – 479 BC`), and the two cannot be told apart. So the character that carries the
evidence is the one that cannot be claimed, and U+2212 — which carries one instance — is the one that can.

**Four remain: ak, bo, ltg, mos** — bo refused, the other three held.

## Run 16 — Akan: `Mainɔso` is nowhere, and the Naija argument does NOT transfer — 2026-08-25 23:10

`Mainɔso` searched directly. **×0 on ak.wikipedia and ×0 on the indexed web** — the query returns generic
English subtraction pages and a Japanese logic puzzle, nothing in any Akan or mathematics-education context.
Same for `mainoso` and `dɛgrii`. That is a clean negative on the word itself.

**⚠ AND THE ARGUMENT I HAD BEEN HOLDING IN RESERVE FOR AKAN IS WRONG.** I had noted that Ghana's maths
curriculum is English-medium, so a code-switched English `minus` might carry the Naija reasoning. It does
not, and Akan's own file says why: **Akan's percent word is NATIVE, and heavily so.**

```
  50%  →  ɔha mu ŋt͡ɕɪt͡ɕɛmu adwonum        `ɔha mu nkyekyɛmu` — "division of a hundred"
```

That word is 1,387 instances in tw and 215 in fat, and **893 of the corpus's 5,154 percent signs already
have it written in front of them**. Compare Naija, where the tier declares the bare English `percent`
because that is what pcm.wikipedia writes. The two languages resolve the same slot in opposite directions,
and Akan resolves it natively.

There is no English-nativisation path here either — the Naija reading works because that engine sends a
known English spelling through the English dict; Akan's `percent` comes out `perkent`, letter-wise, not
[pəsɛnt]. So an imported `minus` would be read as a foreign string, not nativised, and it would be against
this layer's documented pattern rather than consistent with it.

**Akan holds, and the next step is now specific:** it needs a NATIVE construction, the shape
`ɔha mu nkyekyɛmu` has — not a loan. (Its `$`/`€`/`£` and its ampersand are already deliberately silent for
related reasons.)

⚠ Also noted, not fixed: `−47.6 °C` reads `adwanan nson at͡ɕiri pɔ nsia k` — the degree sign dropped and ⟨C⟩
surfacing as a bare `k`. That is the third language in this run with an unsourced degree word (pcm, za, ak).

## Run 17 — the financial register, and a much worse problem it uncovered — 2026-08-26 09:30

Suggested: try the FINANCIAL register — a negative balance, a deficit — since banking and economics are
better covered on small wikis than mathematics is. Probed ltg/mos/ak for `negatīvs`, `negativs`, `mīnusā`,
`deficits`, `zauds`, `negatif`, `deficit`. **Almost all ×0**; the single hit is ltg `deficits` ×1, a noun and
not a sign reading. The idea is sound and cost nothing to test — but running it exposed why none of these
probes were ever going to return anything.

### ⚠ ak.wikipedia HAS ZERO ARTICLES

```
  ak     articles:        0        ← every Akan probe in this investigation measured NOTHING
  ltg    articles:    1,156
  mos    articles:    1,325
  pcm    articles:    1,655
  za     articles:    3,023
  tw     articles:    4,735        ← Akan's REAL live wiki
  ab     articles:    6,732
  tn     articles:    5,579        rw 9,903 · bo 8,113 · ilo 15,527 · yo 39,575 · ht 72,095 · nan 434,582
```

Every `absent` verdict I reported for Akan — `minus`, `mainɔso`, `ntefirimu`, `yi firi mu`, `negatif`,
`dɛgrii` — came from an **empty haystack**, and I read them as measurements. They were not. Akan's evidence
lives in the tw + fat dumps (35,517 segments, which is where its `ɔha mu nkyekyɛmu` percent came from), and
its live wiki is **tw.wikipedia**, reachable only by passing `--wiki tw` — which nothing prompted anyone to do.

**This reframes the whole negative-result column.** For ltg, mos, ak — and to a lesser degree pcm, za, ab —
a `×0` was never a measured refusal, only an unmeasurable one. It also retroactively justifies shipping ab,
za and pcm on in-language PATTERN arguments rather than waiting for attestation their corpora are too small
to supply.

### Akan, re-probed against the right wiki

```
  minus  ×1   ⚠ AN ENGLISH WORD BEING GLOSSED, not Akan usage:
              "wɔyi firii asɛmfua 'minus' mu a ɛkyerɛ \"less\"" — "derived from the word 'minus',
              which means 'less'". In quotes, in an etymology.
  zero   ×4   ⚠ THIS ONE IS REAL — Akan prose borrowing the English noun: "sen zero" (than zero),
              "bɛbɛn zero" (near zero), "coefficient of inbreeding no boro zero".
  ase    ×70  "under / below", the ordinary postposition.
```

So the two halves of a "below zero" exist and are attested in Akan prose. **Every composed form is still
×0** — `zero ase`, `ase zero`, `zero no ase` — and `hwee ase` ×2 is a trap, meaning "collapsed"
(*Chan Chan hwee ase*, and the Iron Curtain falling), not "below zero".

### Fixed: `attest.ts` now says how big the haystack is

The tool printed a `×0` from a 434,000-article wiki and a `×0` from an empty one identically. It now fetches
`siteinfo` and labels the header:

```
  ── yo.wikipedia.org — TOKEN attestation ──  (39,575 articles)
  ── ltg.wikipedia.org — … ──  ⚠ SMALL WIKI (1,156 articles) — an `absent` verdict is weak evidence…
  ── ak.wikipedia.org — … ──  ⚠ THIS WIKI HAS ZERO ARTICLES — an `absent` verdict here measures NOTHING.
                                 Pass --wiki <code> for the variety that has one.
```

That is the defence this tool was missing. Its header already warns that a token hit proves existence and
not fitness; it said nothing about what a MISS proves, and the answer turns out to depend entirely on a
number it was not printing.
