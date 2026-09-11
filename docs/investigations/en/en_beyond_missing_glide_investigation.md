# en: `beyond` has no /j/, and it is the only ordinary English word that doesn't

Noticed while reading a TTS rendering of running prose — `beyond` came out *bɪˈɑnd*, "bee-ond", with the /j/
missing entirely. Unlike the variant questions in `docs/investigations/en/en_copula_was_vowel_investigation.md`
and `docs/investigations/en/en_ative_face_vowel_investigation.md`, this is a missing SEGMENT: GenAm /bɪˈjɑnd/ has an obligatory
consonantal /j/, and there is no attested reading without it.

## Run 1 — 2026-09-11 11:08 — the cause, and why no rule could rescue it

```
beyond    lex=bɪˈɑːnd      arp=B IH0 AA1 N D
```

CMUdict has no `Y` phone. Every other /j/-bearing word in the lexicon spells it explicitly:

```
yonder    jˈɑːndɚ       Y AA1 N D ER0
million   mˈɪɫjən       M IH1 L Y AH0 N
union     jˈuːnjən      Y UW1 N Y AH0 N
familiar  fəmˈɪɫjɚ      F AH0 M IH1 L Y ER0
behavior  bᵻhˈeᶦvjɚ     B IH0 HH EY1 V Y ER0
```

`beyonce` is the cross-check that settles it: CMUdict already gives that word its `Y`, so the lexicon renders
`bɪjɔːnsˈeᶦ` — the same `bɪj` onset from the same spelling. `beyond` was the outlier inside its own spelling
family, which is what a dictionary omission looks like and what a convention would not.

So it is a plain dictionary omission, not a convention. The engine's ʲ-hiatus rule cannot cover it either:
`englishArpabet.ts:121` fires only for `IY` before another vowel (`create → kɹiʲˈeᶦt`), and `beyond` has
`IH0`. And even if it did fire, the consuming app's renderer DELETES `ʲ` (`KokoroFormat`'s `("ʲ", "")`, which
matches misaki for the `iə` hiatus cases), so only a real `Y` phone survives to the TTS. The fix has to be the
segment.

## Run 2 — 2026-09-11 11:10 — is it alone? two scans, the first one useless

**First scan, too loose.** Words with ⟨y⟩ between two vowel letters whose ARPABET lacks `Y`: **741 hits**, and
essentially all false positives — `allayed`, `annoyed`, `player`, `bayard`, where ⟨y⟩ is part of a vowel
digraph ⟨ay/oy/ey⟩ and no /j/ is expected. The heuristic tested spelling alone and told us nothing.

**Second scan, keyed on the actual signature**: ⟨VyV⟩ spelling AND a vowel-vowel hiatus in the ARPABET AND the
main stress on the second of the two vowels — i.e. ⟨y⟩ began that syllable. **70 hits**, and reading them is
the result:

```
beyond      B IH0 AA1 N D     <- the only ordinary English word
coyote      K AY0 OW1 T IY0   correct, no /j/
loyola      L OY2 OW1 L AH0   correct
payola      P EY2 OW1 L AH0   correct
cheyenne, guyana, riyadh, sotomayor, toyotas, murayama, santayana, sukiyaki, …
```

Everything else is a proper noun or a transliteration, most of which genuinely have no /j/. So this is a
one-row fix and not a family — worth the second scan to establish, since the first would have suggested a
sweeping change over 741 words.

## Run 3 — 2026-09-11 11:12 — the fix, and an honest note on audibility

Edited the ARPABET and regenerated the IPA through `makeArpabetToIpa`, keeping the lexicon's byte-exact
reproducibility from `g2p-dict.tsv` intact (re-measured after: 117,479 reproduced, 0 differ, 100.00%):

```
beyond   B IH0 AA1 N D  ->  B IH0 Y AA1 N D        bɪˈɑːnd  ->  bɪjˈɑːnd
```

en-GB inherits the fix through the same row (`bɪjˈɒnd`), and it is correct there too. Sentence-medial the
word de-accents as before (`ɪt ɪz bɪjɑːnd ðˈæt .`). No golden test or fixture pins the word.

`npm run typecheck` clean; `npm test` 294 files, 5799 passed / 5 skipped.

**Negative result on audibility.** Before/after WAVs through the consuming app's TTS were judged
INDISTINGUISHABLE by the reporter. The two renderings are genuinely different audio (distinct checksums, a
50ms length difference), so the synthesis is real — the model simply glides the `ɪ→ɑ` hiatus on its own and
manufactures an approximation of the missing /j/. The change is therefore correct but inaudible in this voice
and context. It is kept because the phoneme string is what other consumers (alignment, a different TTS, a
different voice) read, and a missing segment is wrong regardless of whether one model papers over it — but no
one should expect to hear a difference.
