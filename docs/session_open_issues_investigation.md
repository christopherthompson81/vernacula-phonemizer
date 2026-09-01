# Closing the five filed findings from the C# porting sweep

Five items were filed rather than fixed during the shn/tt/mto/tk/hyw ports and the sk/cy reviews. This
records closing them, and the two places measurement changed the answer.

## 1 — The three missing `ManifestMappingTests` entries (not four)

⚠ **THE FILED LIST WAS STALE.** It named `CentralKurdish`, `Kabuverdianu`, `Luo` and `Umbundu`;
`CentralKurdish` already had an entry. Checked before writing rather than after.

Added the three. **All three pass on the first run**, so these were latent gate gaps, not live defects —
the same result the `gd` and `shn` entries gave. Exclusion lists derived per file rather than copied:
`kabuverdianu` excludes `language`/`name`/`script` (its C# type declares none of them), while `luo` and
`umbundu` declare those and exclude `provenance`/`convention` instead.

## 2 — `shan.ts:8`, the dead `foldNativeDigits` import

Removed. ⚠ And the comment beneath it was *also* misleading, which is why the import survived: it read
"Shan digits fold to ASCII up front (core/unicode.ts)", which a reader maps onto the import rather than
onto `normalizeShan`, where the fold has always been. Comment corrected to name the normalizer and to say
the import existed and was never called. Typecheck clean.

## 3 — `westarmenian`, the ⟨յո⟩→[œ] digraph that does not exist

Corrected in all three places that asserted it: the TS module header, `westarmenian.jsonc`'s own header
comment, and — the one that matters — the jsonc's **`provenance` string**, which is the field the
sourcing gate reads. All three now name what is really there (⟨իւ⟩→[ʏ] always, ⟨յու⟩→[ʏ]
post-consonant only) and state that ⟨յո⟩ falls out as [jo]. Nothing behavioural: no table ever mapped to
[œ], and the test file already pinned `յոթ`→`jotʰ`.

## 4 — `slovak/normalize.ts:132`, a substring call on the provenance seam

`feminine()` called `rewrite` on `words`, a freshly composed numeral — never the pipeline string. Changed
to a plain `.replace`, which `provenance.ts:342` shows is what the untraced path already is, so no
reading can move.

⚠ **MEASURED FIRST, AND THE MEASUREMENT SAID IT COSTS NOTHING TODAY.** `provenance.ts:349` shows a
non-pipeline subject takes the `tracked !== s` branch and *poisons* the mapping, which would have made
this a real provenance loss rather than a tidy-up. It does not fire:

    TS  tools/provenance-poison.mts    → 0 sites
    TS  tools/provenance-coverage.mts  → 39,540/39,540 (100.0%) across 189 languages
    C#  parity --poison                → 0 sites

The golden's only feminine-hour clock row (`21:19`) does not reach it. So the fix is the contract, not
the count — recorded that way rather than dressed up. `seam-parity` slovak moved 35/34 → **34/34, gap 0**,
and the fleet's disagreeing count dropped 24 → 23.

## 5 — `totontepecmixe.ts:31`, the dead `isVowel` — the only behavioural change

The scan's miss branch pushed `{ ph, vowel: false }` unconditionally while the file's own `isVowel` sat
unused, so `latinPhone`'s genuine VOWEL returns were invisible to the two passes that ask whether the
NEIGHBOUR is a vowel — the intervocalic ⟨d g⟩ lenition and the word-final ⟨v⟩ terminus.

Fixed TS-FIRST with a test, then mirrored to C#, per PORTING.md. **No golden was regenerated because none
moved**: `isVowel` is local to this file, `mto` has no golden of its own, and the fleet gate is unchanged
at 189 languages / 36,495 rows / 0 differ.

⚠ **AND THE MEASUREMENT CORRECTED THE FILED CLAIM.** The finding as filed said `å æ œ ø` and the accented
vowels were affected. Measured over 276 probes in the frames the two passes read, the letters that
actually change are **eight**: `â ã å æ î ô õ û`.

    aåda   aoːda → aoːða        aæv   aæv → aæf
    aæga   aæɡa  → aæɣa         aîda  aida → aiða

**`ø` and `œ` do NOT change**, because `isVowel`'s set is this language's own inventory — `aeiouæɨʌʊ` —
and neither is in it. That residual is disclosed in both test files rather than removed: widening the set
to cover them would be a claim about Totontepec Mixe phonology that no source here supports, on a
language whose referee is three ASJP headwords. Wiring the helper fixes what the helper knows.

The two-entry-point half of the finding stands as described: `Text()` nativises before the scan, so this
was reachable only through the exported `PhonemizeWord` — which the test files and referee-eval call.

## Verification

    npx tsc --noEmit                → clean
    npx vitest run                  → 290 files, 5,747 tests, all pass
    dotnet test                     → 6,475/6,475
    parity (fleet)                  → 189 languages, 36,495 rows, 0 differ
    parity --poison (fleet)         → 0 sites
    parity --provenance (fleet)     → 911,293/911,293 (100.0%)
    TS provenance-poison / coverage → 0 sites · 39,540/39,540 (100.0%)
    seam-parity                     → 23 disagree (was 24), 0 not yet ported
