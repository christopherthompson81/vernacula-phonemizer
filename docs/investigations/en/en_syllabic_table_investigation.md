# `en-syllabic.tsv` — the stale table, and the rhotic rule it exposed

## Run 1 — 2026-09-21 — regenerating, and why the referee goes DOWN

`en-syllabic.tsv` records which schwa+sonorant slots of a dictionary word are SYLLABIC. #1393's new
index guard found it 1,615 rows behind its generator and nine of its indices pointing at the wrong
phone; #1394 filed both.

    npx tsx tools/english/en_build_syllabic.mts <us_gold.json> --write

    before 3,231 words   after 4,835
      added   1,604      removed 0      index changed 9

⚠ **THE NINE CHANGED INDICES ARE EXACTLY THE WAIVED ROT**, and they move where the guard's comment
predicted for eight of them. The ninth is the one that comment said could NOT be hand-fixed:
`unreasonable` is `AH2 N R IY1 Z AH0 N AH0 B AH0 L`, which has two slots a reduced vowel before a
sonorant could mean, and the rotted index sat one step from each. **The generator settles it from gold
(index 9).** That is the argument for regenerating rather than repairing: the source knows and a reader
guessing does not. The waiver is deleted, not left behind.

### 1,613 shipped readings change, and they are the documented convention

    abbatial   əbˈeᶦʃəɫ  →  əbˈeᶦʃɫ̩        abutment  əbˈʌtmənt  →  əbˈʌtmn̩t
    accusal    əkjˈuːzəɫ   →  əkjˈuːzɫ̩          acetylide əsˈɛt̬əlaᶦd → əsˈɛt̬ə̆laᶦd

`ən`→`n̩`, `əɫ`→`ɫ̩`, and the onset case `əl`→`ə̆l`. The builder's own header is explicit that this
is **a convention import, not a derivation** — misaki's transcription choice, which Kokoro learned.

⚠ **SO THE REFEREE GOES DOWN, BY DESIGN, AND THAT IS NOT A REGRESSION.** wikipron marks a syllabic
consonant on 60 of 4,558 rows and disagrees with misaki systematically where both cover a word. The
en-GB product diff over the 2,782 affected referee words:

    MISS → HIT  20      HIT → MISS  21

⚠ 17 of the 20 gains came from the `CODA` fix alone; the three the LINKING fix added — `natural`,
`mineral`, `pastoral` — are the ones the first audit could not see. Every one of the 21 losses is a
syllabic-import word where the referee writes a full `ɪ` — `acyl`,
`pepsin`, `matins`, `eosin`, `nubbin`, `replevin`. ⚠ **AND IT IS NOT EXPRESSIBLE VIA `intentional`**,
which is single-character and positionwise: this divergence is a vowel DELETION plus a diacritic, the
same limit `en.jsonc` records for `A`/`a`. Those rows will count as failures permanently. The 3,231
words already in the table carry the same cost today; this adds ~21 more among referee-covered words.

## ⚠ AND EVERY ONE OF THE 17 GAINS IS A BUG THE TABLE EXPOSED RATHER THAN CAUSED

`children`, `neutral`, `nostril`, `migrant`, `moral`, `orange`, `parent`, `patron`, `quadrant`. A
syllabic mark REMOVES the vowel that followed a /ɹ/, and en-GB's `CODA` test — "an /ɹ/ not before a
vowel is a coda" — then read an ONSET CLUSTER as a coda and dropped it:

    children  t͡ʃˈɪɫdɹn̩ → t͡ʃˈɪɫdn̩      neutral  njˈuːtɹɫ̩ → njˈuːtɫ̩
    nostril   nˈɒstɹɫ̩  → nˈɒstɫ̩       migrant  mˈaᶦɡɹn̩t → mˈaᶦɡn̩t

⚠ **AND IT IS 51 WORDS, NOT THE 34 THIS RUN FIRST COUNTED.** My audit tested only the `CODA` rule; the
same missing nucleus defeats the two LINKING rules one step earlier, where an `ɚ`/`ɝ` before a syllabic
consonant falls through to the unconditional `ɚ→ə` and the onset /ɹ/ vanishes — `natural nˈæt͡ʃɚɫ̩`
came out `nˈæt͡ʃəɫ̩` against RP /ˈnætʃ(ə)rəl/, with `mineral`, `pastoral`, `squirrel`, `mayoral`,
`operant` and `photocurrent`. 13 more, all pre-existing. The trigger is the table; the defect is in the
accent layer, in three rules rather than one.

⚠ **AND `english-gb.ts` ALREADY RECORDED THIS EXACT BUG SHAPE**, for stress marks rather than syllabic
consonants: *"one optional mark cannot see the `iː` behind the pair and the ONSET CLUSTER `ɡɹ` lost its
/ɹ/, exactly as the missing vowel did."* A syllabic consonant is a nucleus in the same way. `CODA` now
treats `n̩`/`ɫ̩`/`m̩` as one, in both engines. The two guards that comment protects — `greedier` (the
`ˌˈ` run) and `acquiring` (the linking /ɹ/) — still hold.

    suite 6,147 · goldens 4 rows moved, 3 languages · parity 189 byte-identical
    en-GB  40,368 → 40,363 (52.9%, flat)   — +20 rhotic repairs, −21 convention divergences,
                                              −5 net once words outside the measured population settle
    en     wikipron 2,584 → 2,582 · moby-lexicon unchanged · epitran 17,465 → 17,418
    en-gb sets  −1 membership, +3: LOST `orangeade`, gained `moral`, `orange`, `quarrelsome`

⚠ **AND `orangeade` DOES NOT COME BACK, WHICH AN EARLIER DRAFT OF THIS RUN ASSERTED THAT IT DID.**
`orangeman` returned once the rhotic fix landed (`ˈɒɹn̩d͡ʒmn̩`); `orangeade` did not, and it regresses
from RP `ˌɒɹɪnd͡ʒˈeᶦd` to `ˌɔːɹn̩d͡ʒˈeᶦd` — it keeps its /ɹ/ but loses the CLOTH vowel.
⚠ **THE CAUSE IS A LIMIT OF THE SET BUILDER AND IS WORTH STATING SEPARATELY.** A word joins a set when
the EDITED form matches a referee variant OUTRIGHT. The referee has `ɒɹɪndʒeɪd`, our syllabic mark gives
`n̩` where it writes `ɪn`, so the fold cannot match **whatever the vowel is** — and a CORRECT `ɔː → ɒ`
edit is discarded on the strength of an unrelated mismatch. One word today, and the mechanism will
recur for any set member whose syllabic mark diverges from the referee.

⚠ **THE HEADLINE IS FLAT AT 52.9% IN BOTH DIRECTIONS AND SEES NONE OF THIS.** 17 repairs and 21
convention divergences in 76,284 words round to nothing, which is why the product was diffed
word-by-word — #1381's rule, and the lesson #1400 recorded when a flat headline hid 59 fixes.
