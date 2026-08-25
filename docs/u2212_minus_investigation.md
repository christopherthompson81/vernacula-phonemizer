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
