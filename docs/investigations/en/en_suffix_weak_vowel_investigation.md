# The unstressed-vowel classes, and which of them are defects

Run 18 of the kokoro comparison re-censused after #1325. `replace ə → ɪ` was the largest single edit
operation left, at 6,079 — gold writes a schwa where we write `ɪ`. The obvious reading is that we
fail to reduce.

## Run 1 — 2026-09-16 21:40 — asking a second referee, in both directions

misaki's gold is what Kokoro heard, not a phonetic authority, and the repo already ships an
independent one: wikipron (human transcriptions, en-US broad 4,558 rows and en-GB 76,284). The test
is what IT says at exactly the sites where we and gold disagree.

| class | sites | UK referee | US referee | |
|---|---|---|---|---|
| gold `ə` / ours `ɪ` | 6,079 | 82.3% **us** | 72.3% **us** | not a defect |
| gold `ə` / ours `ᵻ` | 3,186 | 78.7% **us** | 68.9% **us** | not a defect |
| gold `ɪ` / ours `ə` | 1,462 | **87.0% gold** | **82.4% gold** | **defect** |

⚠ **THE TWO LARGEST CLASSES ARE NOT DEFECTS.** Together they are 9,265 of the census's edit
operations — more than a fifth of everything left — and both referees say our reading is the better
transcription. misaki writes the weak vowel as `ə`; that is a notation, the same kind of thing Run 15
found for `ᵊ` (`-tion` as `ʃn̩` versus `ʃən`). Chasing them would make the canonical IPA worse to match
a convention.

⚠ **AND THE CLASS THAT REVERSES WAS SITTING AT #11 IN THE CENSUS.** Testing only the direction that
looks like under-reduction would have found nothing to do; testing both found the real one.

If matching misaki here ever turns out to matter for Kokoro's sake, it belongs in `KokoroFormat` as a
rendering fold — the way the word-final flap does — and it would need audio evidence, not a count.

## Run 2 — 2026-09-16 21:55 — the defect is three suffixes, and the obvious fourth is a trap

All 297 in-dictionary sites are `AH0`, and the words cluster:

    -ness  375    -ist  ~230    -sis/-osis/-esis/-ysis  ~230    -age  61    -less  34

`activist` is `AE1 K T AH0 V AH0 S T` — both unstressed slots are `AH0`, and the second is not a
schwa. The dictionary contradicts itself about it: **`abolitionist` read `…ʃənəst` and `abortionist`
`…ʃənɪst`**, the same suffix spelled two ways one row apart.

### Referee evidence, per family — and it splits them

    -ist    ɪ 131 / 135  (97.0%)     ə   4 ( 3.0%)
    -age    ɪ  85 /  95  (89.5%)     ə   4 ( 4.2%)
    -sis    ɪ  17 /  21  (81.0%)     ə   2 ( 9.5%)
    -ness   ɪ  14 / 100  (14.0%)     ə  81 (81.0%)   ← we are already right
    -less   ɪ  10 /  43  (23.3%)     ə  32 (74.4%)   ← we are already right

⚠ **`-ness` IS THE LARGEST FAMILY IN THE CLASS AND ADDING IT WOULD HAVE BEEN A REGRESSION.** Gold
writes `ɪ` in 375 `-ness` words and 34 `-less` words, which is what put them on the list; the referee
says `ə` decisively. And the en-GB referee leans TOWARD `ɪ` by construction — the weak-vowel merger is
less advanced in RP — so an 81% `ə` reading there is stronger, not weaker. 409 words.

### Two designs measured and rejected before the third worked

**As an `isBarredI` arm, yielding `ᵻ` — −486 exact, 0 gained.** That was the natural place: the
function exists to mark the weak vowel, and the referee writing `ɪ` is how the repo already reads
"not a schwa" (the `-es` arm's comment rests on exactly that). It is wrong here, and gold says why:
**gold HAS `ᵻ` and uses it** — 2,154 entries, `Christmases` `kɹˈɪsməsᵻz` — for the INFLECTIONAL
`-es`/`-ed`, and deliberately writes a full `ɪ` for `-ist`. The two families are different and the
reference keeps them apart. Words that already read `ɪ` were being pulled to `ᵻ`, which is where the
486 went.

**Re-basing every `AH0` before an `S` — +297 / −58.** The rule fired on the PREFIX: `assist`
(`AH0 S IH1 S T`) became *`ɪsˈɪst`, `aphesis` (`AE1 F AH0 S AH0 S`) marked both slots as *`ˈæfɪsɪs`
where gold has `ˈæfəsɪs`, and `Protestantism` re-based `-testant-`. All 58 regressions were that
shape.

**Re-basing the SUFFIX's own vowel — the last one — to `IH0`: +357 / −3.**

    exact vs gold   41,767 (46.71%) → 42,121 (47.11%)

The three remaining losses are `Carthage`, `Portage` and `parentage`, `-age` names where gold has a
schwa. A 725-word swing between the first design and the third, on what is nominally the same fix.

⚠ `-ism` IS NOT IN THE SET though it looks like it belongs: its vowel is `IH2 Z AH0 M`, so the S is
voiced to Z and the schwa before the M is a real schwa. Including it in the spelling test produced
only false fires.

### The survey agrees

`tools/english/en_weak_vowel_survey.mts`, which buckets the referee's vowel by the symbol we wrote:
the `ᵻ` bucket still sits between `ɪ` and `ə` (74.5% referee-`ɪ`, the shape that file exists to
protect), and the `ə` bucket's schwa rate rose 81.5% → 82.0% — schwas removed that were not schwas.
