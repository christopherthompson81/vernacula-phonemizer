# The secondary-stress clash rule, re-measured against the reference

The rule drops a `2°` whose syllable is adjacent to the `1°`. Its exception required a TRUE diphthong
(`AY`/`OY`/`AW`) in a CLOSED syllable, and its own comment records how that shape was arrived at:

    · every diphthong, any position   13,189 rows — far past the reported shape
    · +final nucleus only              2,684 rows — but `zorro`, `aalto`, `adolfo` over-articulate
    · +true diphthongs (AY/OY/AW)      1,113 rows — but `a priori`, which broke an existing test
    · +closed syllable                 1,024 rows — clean, whole suite green

Rows changed, and tests not breaking. **The reference was never asked.** Run 17 of the kokoro
comparison put a number on the cost: the rule drops a dictionary `2°` gold keeps on 2,383 of the
4,162 gold-covered sites it fires on.

## Run 1 — 2026-09-16 21:05 — a variant probe, with its validity checked first

Scoring a stress rule needs per-NUCLEUS patterns on both sides, and gold is IPA while the rule works
on ARPABET, so the alignment is the thing most likely to produce a confident wrong answer.

Guard: the probe reimplements the shipped rule as `v0_current`, and every word is DISCARDED unless
(a) the probe's per-nucleus pattern reproduces the shipped rendering exactly and (b) gold has the
same nucleus count. Before the discard, `v0_current` agreed with the shipped mark sequence on
**32,464 of 32,491 dict words (99.92%)**; the 27 exceptions are words resolved by another path
(function words, plural allomorphs, morph decomposition), not probe errors. **31,760 words** survive
both conditions and are what everything below is scored on.

### What gold actually does at a clash site

    final syllable, CLOSED    gold marks it  1,849 / 1,973   94%
    final syllable, OPEN      gold marks it    167 /   330   51%
    NOT the final syllable    gold marks it    918 / 1,973   47%

The middle row is not a coin flip once split by vowel — it is two populations:

| vowel | gold marks | | vowel | gold marks |
|---|---|---|---|---|
| `OY` | 10 / 10 (100%) | | `OW` | 22 / 104 (21%) |
| `AW` | 8 / 8 (100%) | | `IY` | 9 / 55 (16%) |
| `EY` | 65 / 71 (92%) | | `AA` | 5 / 15 (33%) |
| `AY` | 11 / 12 (92%) | | | |
| `AO` | 10 / 11 (91%) | | | |
| `UW` | 22 / 33 (67%) | | | |

**That split is exactly the distinction the original narrowing was reaching for and could not
express**: `airway` (`EH1 R W EY2`, gold `ˈɛɹwˌA`) against `zorro` (`Z AO1 R OW2`). CMUdict writes
`OW2` on an ordinary final `-o`, and marking it over-articulates — but a final `EY`/`AY`/`OY`/`AW` is
a real beat.

⚠ **AND CLOSED-FINAL HAS NO SUB-SPLIT TO FIND.** Checked, because the same trick that worked for the
open case should be tried on the closed one: gold marks `AY` 95%, `AE` 89%, `AA` 94%, `EH` 95%, `AO`
93%, `EY` 94%, `OW` 91%, `IY` 99%, `UH` 97%, `ER` 98% — flat across every vowel, and flat across
syllable count (2 nuclei 94%, 3 nuclei 78%, 4 nuclei 83%). Exempt it wholesale.

### Variants, by whole per-nucleus stress pattern against gold

| variant | matches gold | |
|---|---|---|
| as shipped — true diphthong + closed final | 26,461 | 83.32% |
| add `EY`/`UW` to the diphthong set | 26,652 | 83.92% |
| true diphthong, any position | 26,536 | 83.55% |
| **no clash rule at all** | 27,514 | **86.63%** |
| any vowel, closed final | 27,791 | 87.50% |
| **+ open final on the strong vowels** | **27,891** | **87.82%** |
| + also exempting non-final sites | 27,593 | 86.88% |

Two readings matter more than the winner. **The rule does real work** — deleting nothing scores
86.63%, below the widened rule, so the deletions it keeps making are right. And **non-final must stay
dropped**: exempting those too is worse (86.88% vs 87.82%), which matches the 47% measured directly.

### Shipped

Exempt a `2°` on the FINAL syllable when that syllable is closed, or when its vowel is one of
`EY AY OY AW AO UW`. Everything else is unchanged.

    exact vs gold   39,160 (43.80%) → 41,767 (46.71%)     +3,038 / −431, net +2,607

The largest single gain of this series — larger than the syllabic-schwa import (+2,053). 5,945
`accent-lexicon.tsv` rows regenerate.

### ⚠ The 431 regressions are irreducible, and that was checked rather than assumed

They are lexicalized compounds where gold declines to mark a second element it marks elsewhere:
`almost`, `ambush`, `anode`, `backbeat`, `bandsaw`, `birdshot`, and the `-field`/`-board`/`-ville`/
`-stone` place names (`Brentwood`, `Belmont`, `Brookfield`, `Bloomfield`).

Capitalization is NOT the discriminator — only 19% of the losses are capitalized against 4% of the
gains — and the closed-final table above shows no vowel or length signal either. Gold marks
`aardvark` and not `birdshot`, which are the same shape; that is the hand lexicon's own inconsistency
rather than a rule we are failing to find. 3,038 against 431 is the trade, and it is taken.

### `a priori` moved, and the test that pinned it was pinning a guess

The old comment cites `a priori` → `pɹaᶦˈɔːɹˌaᶦ` as the reason not to exempt open finals, and a test
titled "an open final syllable is not marked" held it. That test recorded a DESIGN CHOICE, not a
reported misreading. `priori` is `P R AY0 AO1 R AY2` — an open final `AY`, which gold marks 11 times
out of 12. The blanket claim is measured to be wrong; the test now records the vowel split instead.

### Closes a divergence pinned two PRs ago

#1323 found `airway`/`aircrew` losing their mark to this rule while measuring something else, and
pinned them as a known divergence rather than folding an unmeasured fix into that PR. Both are inside
the widened exception, and the test now records them as fixed.
