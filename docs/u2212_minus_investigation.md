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
