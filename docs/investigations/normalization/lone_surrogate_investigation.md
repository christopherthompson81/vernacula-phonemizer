# The lone surrogate — a hazard that surfaced four times

Chronological log of #1199 and the three findings that led to it.

## Why this doc exists

A **lone surrogate** — an unpaired UTF-16 half — is a perfectly valid JavaScript string and an invalid
Unicode code point. .NET's `string.Normalize` and `char.ConvertFromUtf32` both REFUSE one; JavaScript's
`normalize` and `toLowerCase` are indifferent. Every place the C# port normalizes or decomposes untrusted
input is therefore a latent crash where the TypeScript reads happily.

⚠ **AND IT IS INVISIBLE TO EVERY OTHER GATE.** No golden row in any language carries a surrogate half, so
parity, `--poison`, `--provenance` and `--ipaspans` all stay green while the engine throws. It has only
ever been found by a walk built for it.

⚠ **AND IT IS A DESIGNED-FOR INPUT, NOT A PATHOLOGICAL ONE.** A g2p that indexes UTF-16 code units hands
the halves of an astral character over ONE AT A TIME — which the Ewe, Irish and Kamba scans do on purpose,
and which `LatinPhones` documents in its own guard.

## Run 1 — 2026-08-30 12:45 — first sighting (ga, #1195)

Found by an astral/surrogate g2p walk during the Irish port review: U+1F600 and its two halves crossed
with the letters that decide the scan.

    PhonemizeWord("\ud83d")   TS: ""   C#: !!ERR A valid UTF32 value … (Parameter 'utf32')
    1,940 of 16,224 walk words threw

`Js.ToLowerCase` → `ApplyLowerExtra` rebuilt each position with `char.ConvertFromUtf32`. `NeedsLowerExtra`
admits EVERY high surrogate — it has to, so an astral cased letter reaches the `LOWER_EXTRA` table — so
every word carrying a half went through the slow path and threw. `IsCased`/`IsCaseIgnorable` had the same
hazard beside a Σ. Fixed by copying code units rather than round-tripping them through a code point.

## Run 2 — 2026-08-30 13:35 — the second sighting, and the issue (ilo, #1194 → #1199)

Same walk, different engine: `Ilocano.PhonemizeWord` normalized the raw word to build its lexicon key.

    PhonemizeWord("a\ud83d")   TS: "ʔˈa"   C#: !!ERR String contains invalid Unicode code points
    2,205 of 8,379 walk words threw

A fleet sweep sized it for the first time, from the SHIPPED entry point:

    C#:  193 languages × 5 probes:  100 threw, 715 ok   —  25 languages
    TS:  the same 25 × the same probes:  0 threw, 125 ok

Filed as #1199, and the shared `Js.Normalize` was written for it.

⚠ **THE FIRST VERSION OF THAT HELPER WAS ITSELF A DIVERGENCE**, caught by its own pin rather than by
review. `IsWellFormedUtf16(s) ? s.Normalize(form) : s` is wrong — JS still normalizes the WELL-FORMED
PARTS around an unpaired half:

    "\uD83Dé"           .normalize("NFC")  →  "\uD83Dé"     (not unchanged)
    "a\uD83Déb"          .normalize("NFC")  →  "a\uD83Déb"

The shipped body splits at each unpaired surrogate — every one is a starter, so it blocks composition
across itself — and normalizes each run alone. Verified against Node over a combinatorial fuzz of
surrogate halves, combining marks, precomposed/decomposed letters, Hangul and a singleton exclusion:
**7,239 strings, 0 differ, in both NFC and NFD**.

## Run 3 — 2026-08-30 13:40 — the third sighting was the shared core (kam, #1200)

An adversarial fuzz failed 48 rows on the NORMALIZE path — a surface the per-word fixes do not touch.
`Rewriter.Renormalize` opened with `s.Normalize(form)` on the **pipeline string**, so this threw from
`Phonemize()` for every engine whose normalize pass begins with a renormalization.

    before   193 languages × 5 probes:  100 threw  —  25 languages
    after                                16 threw  —   4 (chv fa qu sv)

**21 of the 25 languages were that one line.**

## Run 4 — 2026-08-30 14:05 — the sweep, driven by stack traces rather than by shape

181 `.Normalize(NormalizationForm…)` sites exist across the engine. ⚠ **A BLANKET REWRITE WOULD BE
WRONG**, and #1193 is the precedent: of its 11 same-shaped sites, 2 had to be left alone because changing
them would have introduced a divergence. The distinction here — is the receiver untrusted INPUT or
engine-composed OUTPUT — is exactly what static shape cannot decide.

So the sweep was **measured, not classified**. A probe exercised two surfaces with seven surrogate
probes each — the shipped `Phonemize()` over every code in `Registry.cs`, and every public static
single-string method on every `Languages.*` type, found by reflection so no engine could be missed — and
rewrote only the file:line a stack trace actually named. Iterated, because each round unmasks sites the
previous one shadowed:

    round 1   Phonemize(): 28 throws / 4 languages   ·  entry points: 620 throws / 68 sites
    round 2   Phonemize():  0                        ·  entry points:  81 throws /  9 sites
    round 3   Phonemize():  0                        ·  entry points:  28 throws
    round 4   Phonemize():  0                        ·  entry points:   0 throws / 0 sites

**76 sites in 60 files.** Every one was rewritten because a probe made it throw; nothing was changed on
inspection alone, so the composed-output sites — where the guard would be noise — are untouched.

## Run 5 — 2026-08-30 14:15 — the gate that can see it

`LoneSurrogateTests` walks EVERY registered language and EVERY public single-string entry point, because
the per-language ports are exactly where this shape comes back — it has now arrived in three separate
port PRs. The codes are read from `Registry.cs`'s own `case` labels rather than a hand-kept list.

⚠ **THE GUARD WAS VERIFIED TO FAIL**, not just to pass. Reverting the single `Renormalize` line:

    languages throwing on a lone surrogate: ab ak as bal bm chr crh ee eu he hmn ht ka kam ln pbt ps
                                            rup syl ug wo za
    Failed!  - Failed: 1

and with the line restored, it passes.

## Run 6 — 2026-08-30 14:20 — the gates

    dotnet test (full suite)          4,534 pass, 0 fail
    parity (ALL goldens)              162 languages, 31,564 rows, 0 differ
    npx vitest run (full suite)       290 files, 5,740 pass, 0 fail

`Js.Normalize` is `string.Normalize` on well-formed input — proven by the 7,239-probe differential — so
no reading moves, and the fleet gate confirms it.
