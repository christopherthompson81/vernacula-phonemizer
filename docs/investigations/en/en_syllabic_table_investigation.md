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

    MISS → HIT  17      HIT → MISS  21

Every one of the 21 losses is a syllabic-import word where the referee writes a full `ɪ` — `acyl`,
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

**34 words losing a cluster /ɹ/ RP pronounces — 22 of them before this rebuild, 12 added by it.** The
trigger is the table; the defect is in the accent layer.

⚠ **AND `english-gb.ts` ALREADY RECORDED THIS EXACT BUG SHAPE**, for stress marks rather than syllabic
consonants: *"one optional mark cannot see the `iː` behind the pair and the ONSET CLUSTER `ɡɹ` lost its
/ɹ/, exactly as the missing vowel did."* A syllabic consonant is a nucleus in the same way. `CODA` now
treats `n̩`/`ɫ̩`/`m̩` as one, in both engines. The two guards that comment protects — `greedier` (the
`ˌˈ` run) and `acquiring` (the linking /ɹ/) — still hold.

    suite 6,147 · goldens 3 rows moved, 2 languages · parity 189 byte-identical
    en-GB  40,368 → 40,360 (52.9%, flat)   — −17 convention, +17 rhotic, −4 net, −4 outside the
                                              measured population
    en     wikipron 2,584 → 2,582 · moby-lexicon unchanged · epitran 17,465 → 17,418
    en-gb sets  cloth 706 → 708, palm 550, yod 856 — rebuilt, and `orangeade`/`orangeman` come BACK
                once the rhotic fix lands, which is why they are not a loss

⚠ **THE HEADLINE IS FLAT AT 52.9% IN BOTH DIRECTIONS AND SEES NONE OF THIS.** 17 repairs and 21
convention divergences in 76,284 words round to nothing, which is why the product was diffed
word-by-word — #1381's rule, and the lesson #1400 recorded when a flat headline hid 59 fixes.
