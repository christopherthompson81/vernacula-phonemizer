# Luo (luo) — C# port investigation

⚠ This log was written during the REVIEW of #1221, not alongside the port. The port itself shipped without
one, which is why the runs below are numbered from the review's own work; what the PR recorded of its own
process is folded into Run 1 so the record is in one place.

## Run 1 — what the port itself reported

`src/languages/luo/` — `luo.ts`, `manifest.ts`, `numbers.ts`, `normalize.ts` — mirrored into
`csharp/Vernacula.Phonemizer/Languages/Luo/`. A greedy longest-match g2p over 36 graphemes, the decimal
composer with the gi→g- elision, and a nine-step normalizer that prices each refusal. `LuoTests.cs` ports
`test/luo.test.ts` at 83 tests.

⚠ **THE PORTING BUG THE GATE CAUGHT.** The decimal step's `[...frac].join(" ")` needs `Js.CodePoints(frac)`:
C#'s `string.Join(sep, string)` does not split a string into its characters, so `3.50` read *nukta 50*
rather than *nukta 5 0*. Fixed in the port and pinned.

⚠ **AND THE GAP IT DECLARED.** The PR states there were no FLEURS `luo_ke` transcripts on its build machine,
so **the corpus-wide differential never ran** — the evidence was the 200-row golden plus the ported
off-golden probes. That is the gap this review exists to close.

## Run 2 — 2026-08-31 11:05 — rebase, and the conflict

The branch conflicted with main. The conflict was `Bootstrap.cs` and it was entirely the registration block's
indentation: main had just had `Lithuanian` and `LuleSami` re-indented from 8 spaces to the block's 12 (a
defect introduced by the lv/lt/smj merges), and this branch still carried the 8-space form plus its own
`Luo` line. Resolved to main's corrected form with `Luo` in alphabetical position after `LuleSami`.

    parity -- luo    200/200 byte-identical
    LuoTests         83/83

## Run 3 — 2026-08-31 11:20 — THE CORPUS DIFFERENTIAL THE PORT COULD NOT RUN

FLEURS `luo_ke` **is present on this machine** — 2,742 transcript rows across the three splits. Folded with
the golden and de-duplicated:

    1,662 unique texts · normalizer 0 differ · full engine 0 differ

**The declared gap is closed.** There is no mined or attest artifact for luo, so FLEURS plus the golden is
the whole of the available real text, and both engines agree on all of it.

## Run 4 — 2026-08-31 11:35 — the walks the port's evidence did not include

    exhaustive g2p                                         216,404 words   0 differ
      (all 1–3-letter words over the 26 letters + ⟨'⟩, all 4-letter over the 21 that carry a rule,
       EVERY multigraph in every slot against every other — ⟨ng'⟩ vs ⟨ng⟩ is the pair that makes the
       greedy longest-match order load-bearing — and the conservative ⟨i⟩+{a,e} GLIDE exhaustive over
       every consonant that can precede it and every letter that can follow)
    astral / lone-surrogate fuzz, norm + word + text        35,691 rows    0 differ
    five digit families × 10 operand frames (\d vs \p{Nd})     105 rows    0 differ
    numbers, 0–20,000 exhaustive + magnitude seams + non-finite 20,052 rows 0 differ

## Run 5 — 2026-08-31 11:50 — the key-order question, decided rather than argued

`GRAPHEME_KEYS` is length-sorted in both engines — TS `sort((a,b) => b.length - a.length)`, C#
`OrderByDescending(k => k.Length)` over a `Dictionary` — which is the same shape that had to be checked in
the Kyrgyz review one PR earlier. Dumped both arrays and compared: **identical order, all 36 keys**. The C#
comment already carries the correct reasoning (equal-length keys cannot both match one position, so their
relative order is immaterial), and the dump confirms it rather than relying on it.

## Run 6 — 2026-08-31 12:00 — seam gates, widened 48×

The shipped golden is 200 rows, so the seam gates see 5,397 tokens. Golden-swapped a **218,171-row**
reference built from the corpus and the walks, ran every gate on both engines, restored:

    parity        218,171 rows byte-identical, 0 differ
    provenance    tokens 259,962/259,962 (100.0%)
    ipaspans      255,924/255,924 (100.0%), 0 spans that do not cover what was emitted
    poison        0 sites
    TS twins      5397/5397 and 4925/4925 on the shipped golden, 0 bad spans, 0 poison

## Run 7 — 2026-08-31 12:10 — leak and culture sweeps

**Output leak sweep over the 218,171 readings:** zero double spaces, zero digits surviving into a reading.

⚠ One row flagged as a stringified `null` — `"null" -> "null"` — and it is a FALSE POSITIVE of the sweep's
own regex, checked rather than assumed: Luo's ⟨n⟩ ⟨u⟩ ⟨l⟩ map to [n] [u] [l], so the four-letter walk word
`null` genuinely reads as `null`. Recorded because a sweep that cries wolf is worth knowing about.

Eighteen inputs give an empty reading: fourteen are words of only ⟨'⟩, which is meaningful only as part of
⟨ng'⟩ and denotes nothing alone, and four are mathematical bold digits, outside the token classes. Both
correct and TS-identical.

**Culture and ordering sweep:** two hits, both correct — the `OrderByDescending` verified above, and
`string.Join(" ", Js.CodePoints(frac))`, which is the code-point split the port's own bug fix introduced. No
`ToLower`/`ToUpper`, no culture compare, no build warnings.

## Outstanding

Nothing found. Fleet: **171 languages byte-identical, 33,339 rows, 5,241 C# tests**; the TypeScript side is
untouched by this PR.
