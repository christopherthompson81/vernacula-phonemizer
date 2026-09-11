# en: the `-ative` adjective takes FACE where its own stem-twin takes schwa

Reported from Kokoro output of running prose: `collaborative → kəlˈæbɚˌeᶦt̬ɪv`, i.e. "collabor-ATE-ive", where
the reporter expected the short vowel. Unlike the `was` report (`docs/investigations/en/en_copula_was_vowel_investigation.md`), this
is not a word with one wrong reading — both readings of `collaborative` are attested, and the dictionaries
that list both put the schwa one first and the FACE one second. So the question is not "which is correct" but
"is the lexicon's choice defensible", and the answer turns out to be no, for a reason that has nothing to do
with the variant: the lexicon contradicts itself.

## Run 1 — 2026-09-11 10:55 — the family, and the contradictions inside it

`collaborative` comes from CMUdict `K AH0 L AE1 B ER0 EY2 T IH0 V` — `EY2`, secondary-stressed FACE — and is
converted faithfully. Counting the whole `-rative` family in the lexicon:

```
-ative words overall:      FACE(eᶦ) 30   schwa(ə) 70   other 7
-rative words (the tight morphological family):   FACE 5   schwa 25
```

The minority is not distributed randomly. Checking each FACE row against its own stem-twin:

```
cooperative     FACE   koᶷˈɑːpɚˌeᶦt̬ɪv       collaborative   FACE   kəlˈæbɚˌeᶦt̬ɪv
uncooperative   schwa  əŋkoᶷˈɑːpɚət̬ɪv       corroborative   schwa  kɚˈɑːbɚət̬ˌɪv
operative       schwa  ˈɑːpɚət̬ɪv            deliberative    FACE   dᵻlˈɪbɚˌeᶦt̬ɪv
                                            degenerative    schwa  dᵻd͡ʒˈɛnɚət̬ɪv
```

`cooperative` and `uncooperative` are the same word with a negative prefix and disagree on the vowel. That is
indefensible whichever variant one prefers, and it is the finding that justifies acting — not the reporter's
ear, and not the 25:5 majority, though both point the same way.

Two further rows in the family are wrong in a way that is not a variant question at all:

- `transformative  tɹænsfˈɔːɹmɑːt̬ˌɪv` — from `M AA0 T`, an unstressed LOT vowel in `-mative`. Reads as
  "transform-AH-tive". Simply an error.
- Four rows carry a secondary stress on the FINAL `-ive` syllable, from `IH2 V`: `associative`,
  `corroborative`, `determinative`, `transformative`.

### Not touched, and why

`administrative`, `iterative`, `innovative`, `legislative`, `qualitative`, `native`, `creative` are FACE and
stay FACE — the FACE reading is standard in those, not an artifact, and each agrees with its own family.
The change is to rows that contradict a twin or are outright wrong, NOT to the `-ative` convention.

### Negative result: the referee again cannot settle it

`en.wikipron-eng-latn-us-broad.tsv` has no `collaborative` row, and its handful of neighbours split both ways
(`remunerative ɹ ɪ m j uː n ə ɹ ə t ɪ v` schwa, `separative s ɛ p ə ɹ e ɪ t ɪ v` FACE). As with `was`, the
referee's coverage of this vocabulary is too thin to corroborate. The internal-contradiction argument is
doing the work here precisely because the external evidence cannot.

## Run 2 — 2026-09-11 11:02 — edited the ARPABET, not the IPA, to keep the lexicon regenerable

The flat lexicon reproduces byte-exactly from `g2p-dict.tsv` through `makeArpabetToIpa` (117,479 rows, zero
differ — measured while filing #1275). Hand-editing the IPA would have silently broken that property, so all
seven edits were made in the ARPABET source and the IPA rows were then REGENERATED through the converter:

```
collaborative    K AH0 L AE1 B ER0 EY2 T IH0 V      -> K AH0 L AE1 B ER0 AH0 T IH0 V
cooperative      K OW0 AA1 P ER0 EY2 T IH0 V        -> K OW0 AA1 P ER0 AH0 T IH0 V
deliberative     D IH0 L IH1 B ER0 EY2 T IH0 V      -> D IH0 L IH1 B ER0 AH0 T IH0 V
transformative   T R AE2 N S F AO1 R M AA0 T IH2 V  -> T R AE2 N S F AO1 R M AH0 T IH0 V
associative      AH0 S OW1 SH AH0 T IH2 V           -> AH0 S OW1 SH AH0 T IH0 V
corroborative    K ER0 AA1 B ER0 AH0 T IH2 V        -> K ER0 AA1 B ER0 AH0 T IH0 V
determinative    D IH0 T ER1 M IH0 N AH0 T IH2 V    -> D IH0 T ER1 M IH0 N AH0 T IH0 V
```

Regenerated IPA, and every stem-twin now agrees:

```
collaborative    kəlˈæbɚət̬ɪv        corroborative   kɚˈɑːbɚət̬ɪv
cooperative      koᶷˈɑːpɚət̬ɪv       uncooperative   əŋkoᶷˈɑːpɚət̬ɪv      operative  ˈɑːpɚət̬ɪv
deliberative     dᵻlˈɪbɚət̬ɪv        degenerative    dᵻd͡ʒˈɛnɚət̬ɪv
transformative   tɹænsfˈɔːɹmət̬ɪv    associative     əsˈoᶷʃət̬ɪv          determinative  dᵻtʰˈɝmɪnət̬ɪv
```

Round-trip re-measured AFTER the edit: **117,479 reproduced, 0 differ, 100.00%** — the property holds, which
is the point of having made the edits upstream of the converter.

Controls unchanged: `administrative ədmˈɪnəstɹˌeᶦt̬ɪv`, `iterative ˈɪt̬ɚˌeᶦt̬ɪv`, `innovative ˈɪnəvˌeᶦt̬ɪv`,
`native nˈeᶦt̬ɪv`, `creative kɹiʲˈeᶦt̬ɪv`.

A sentence of the reported shape (attributive `-ative` adjective before a noun phrase):

```
"given the nature of the collaborative design proposals."
  -> ɡˈɪvən ðə nˈeᶦt͡ʃɚ ʌv ðə kəlˈæbɚət̬ɪv dᵻzˈaᶦn pɹəpʰˈoᶷzəɫz .
```

`npm run typecheck` clean; `npm test` 294 files, 5799 passed / 5 skipped.

### Left open — CLOSED, see Run N+1 below

`associative əsˈoᶷʃət̬ɪv` has no /i/ glide — GenAm is /əˈsoʊʃiətɪv/ or /əˈsoʊsiˌeɪtɪv/. The CMUdict entry is
missing a whole segment, which is a different defect from the stray stress fixed here, and is out of scope for
this run. Recorded so it is not lost. **Filed as #1278 and fixed below.**

## Run 6 — 2026-09-11 13:19 — `associative` (#1278): which glide, and on whose evidence

The issue named `AH0 S OW1 S IY0 AH0 T IH0 V` as "the obvious candidate" but asked for it to be checked
rather than assumed, because two readings were on the table — restore the family's plain `S IY0`, or keep
the palatalisation and add the glide (`SH IY0`, the shape `appreciative` has).

**The referee cannot adjudicate.** No row for `associative` in either en-US or en-GB wikipron, and none for
`appreciative`, `initiative` or `associativity` either — the en-US set is 4,558 words and does not reach them.

⚠ **AND THE FAMILY ARGUMENT IS WEAKER THAN IT LOOKS**, which is why this needed checking. Merriam-Webster
lists `\ə-ˈsō-shē-ˌā-tiv, -sē-, -shə-tiv\` — the third variant is exactly what the lexicon already had,
so "a row that contradicts its own family with no variant reading to account for it" (the argument that
carried #1276) does **not** hold here. A variant reading does account for it. The question is which reading
to prefer, not whether the row is indefensible.

**espeak-ng settles it**, and it is the right instrument because it is what the consuming app is aligned to
(cited as the reference in #1268):

```
associative    ɐsˈoʊsiətˌɪv      ← S + glide
associate      ɐsˈoʊsɪˌeɪt
association    ɐsˌoʊsɪˈeɪʃən
appreciative   ɐpɹˈiːʃiətˌɪv     ← SH + glide (so the SH shape is real, just not here)
```

So the plain `S IY0` candidate is confirmed on an independent source AND matches the family; the `SH IY0`
alternative belongs to `appreciative`, not to this word. Applied to `g2p-dict.tsv` and regenerated:

```
associative   AH0 S OW1 SH AH0 T IH0 V  →  AH0 S OW1 S IY0 AH0 T IH0 V
              əsˈoᶷʃət̬ɪv                →  əsˈoᶷsiʲət̬ɪv
round-trip: 1 row changed, 117,479 sourced rows otherwise byte-identical
```

Family after: `associate əsˈoᶷsiʲət` · `associates əsˈoᶷsiʲəts` · `association əsˌoᶷsiʲˈeᶦʃən` ·
`associative əsˈoᶷsiʲət̬ɪv`. No `associatively`, `associativity` or `dissociative` row exists to follow.

⚠ **NOTICED, NOT FIXED:** `initiative IH2 N IH1 SH AH0 T IH0 V` has the same missing glide (espeak:
`ɪnˈɪʃiətˌɪv`), but Merriam-Webster gives `\i-ˈni-shə-tiv\` as the primary there, so the glideless reading
is the dominant one for that word and the family argument does not transfer. Left alone deliberately.
