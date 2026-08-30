# Kabuverdianu (kea) — C# port investigation

⚠ **THIS DOC WAS WRITTEN DURING THE PR REVIEW, NOT DURING THE PORT.** #1198 shipped without one, and its
verification section was three lines (`dotnet build`, 69 tests, `parity 200/200`). Everything below Run 1
is the review's own work; Run 1 reconstructs what the port did from its diff.

## Run 1 — 2026-08-30 (reconstructed) — what the port shipped

    wc -l src/languages/kabuverdianu/*.ts
        145 kabuverdianu.ts · 11 manifest.ts · 322 normalize.ts · 85 numbers.ts   (563 total)

Four modules plus `data/languages/kabuverdianu/kabuverdianu.jsonc`. No lexicon. The engine is a greedy
ALUPEC grapheme scan (digraphs ⟨dj tx nh lh rr⟩ first), Portuguese-creole nasalization (a coda ⟨n/m⟩
nasalizes the preceding vowel; [ŋ] before a velar, else absorbed), and accent-or-penult-or-oxytone stress.
`normalize.ts` is the shared symbol tier plus ten ordered steps; `numbers.ts` is the decimal cardinal
compositor with the ⟨sen⟩/⟨-sentus⟩ hundreds and 10⁹ as "mil milion".

The PR claimed: build clean, 69 xunit tests, `kea 200/200`, fleet 159 languages. All four re-verified.

## Run 2 — 2026-08-30 12:58 — rebase, and the checks the PR's claims did not cover

Rebased onto main (2 behind: #1194 ilo, #1195 ga). One `Bootstrap.cs` conflict, resolved keeping all
three registrations. Both projects build with 0 errors — which is the check that matters after a
`ManifestMappingTests.cs`-adjacent merge, since a naive keep-both has silently detached a `[Fact]`
attribute three times in this porting run.

    parity -- kea (after the rebase)   kea  OK  200 rows

`kea` HAS a FLEURS transcript (`kea_cv`, 1,931 unique sentences) and has NO mined or attest artifact, so
FLEURS is the whole corpus. The 200-row golden holds **114 distinct** texts.

## Run 3 — 2026-08-30 13:00 — the pattern diff, literal and dynamic

Source-scanned literals plus a RegExp-constructor hook on the TS side; reflection over the `JsRe` static
fields on the C# side. Every pattern the port compiles matches its TypeScript counterpart, flags included
— the three `degroup(mark)` templates, the two era markers, the number sign, the ordinal indicator, both
degree rules, the clock, the fraction, both range rules, the whitespace run, and the TOKEN.

⚠ Two of them are built inside the method on both sides (`degroup`, and the era pair), so neither a
source scanner nor field reflection alone sees them; they were read side by side.

## Run 4 — 2026-08-30 13:02 — **DEFECT 1: the digit fallback iterated CODE UNITS**

`Numbers.cs`'s out-of-range arm was:

```csharp
(raw ?? Js.NumberToString(Math.Abs(n))).Select(d => d >= '0' && d <= '9' ? ONES[d - '0'] : d.ToString())
```

which iterates a C# string — **UTF-16 code units** — where the TS spreads `[...raw]`, which yields **code
points**. Measured, before and after, against the TypeScript:

    before   NumberToWords(NaN, "1😀2")  =  "un \ud83d \ude00 dos"     ← two LONE SURROGATES
    after                               =  "un 😀 dos"                 ← the TS's own answer

**This is the class #1193 swept out of six languages three days ago**, reappearing in a port authored
alongside that sweep. Fixed to `Js.CodePoints(...)` + `Core.Numbers.DigitWord(...) ?? d`, the corrected
shape that sweep established. Pinned with TS-sourced values.

## Run 5 — 2026-08-30 13:04 — **DEFECTS 2 AND 3: two seam faults, both in the TYPESCRIPT**

The C# was right at both sites and the TypeScript was wrong — the reverse of the usual direction, and
worth stating plainly because the port silently "fixed" them by spelling them correctly rather than
reporting them.

**(a) A `rewrite` call on a MATCHED GROUP.** `normalize.ts:189` read
`head + rewrite(rest, /[    ]/gu, "")`, where `rest` is a captured group and never the
pipeline string. The C# used `JsRe.Replace`. The poison gate over a 3,748-row corpus:

    TS   distinct poison sites: 1  (SUBSTRING 1, desync 0)   111 hits at normalize.ts:189:16
    C#   distinct poison sites: 0

⚠ AND THE GOLDEN CANNOT SEE IT. `\d[ ]\d{3}` is ×0 in kea_cv — the TS's own comment says the space arm is
"robustness, not a repair" — so only a haystack that writes `5 000` on purpose reaches it. The shipped
poison gate over the 200-row golden reports 0.

**(b) An undeclared mutation of the pipeline string.** The last statement was
`return s.replace(/[^\S\n]{2,}/gu, " ")` — a plain `.replace`, where every other step uses `rewrite`. The
C# used `Rewrite`. Measured over the same corpus:

    TS   tokens 52,844/52,973 (99.8%)  — 129 tokens lost their input span
    C#   tokens 52,973/52,973 (100.0%)

Both fixed TS-side. Re-measured after: poison 0, provenance 52,973/52,973, IPA-span 47,497/47,497 —
the two engines now agree exactly. **Neither fix changes any output**: the TS reading over the 2,071-line
corpus is byte-identical before and after, on both the `norm` and `text` paths, and `kea` parity stays
200/200.

## Run 6 — 2026-08-30 13:06 — the differentials

One process per side, `clearForeignOov()` once, rows in order, code-unit transport.

    corpus  (2,071 lines: 1,931 FLEURS kea_cv + 140 probes)      norm 0 · text 0
    generated haystack (1,711 lines)                              norm 0 · text 0
    numbers (0…200,000 exhaustive + boundaries + stride to 10¹²
             + the fallback arms incl. an astral raw; 326,325)    0 differ

The g2p ENUMERATED:

    full 42-character NATIVE_CLASS alphabet, 1–3 letters       75,894 words   0 differ
    20 class representatives, 4 letters                       160,000 words   0 differ
    astral + both surrogate halves x the letters, 1–3          16,224 words   0 differ

⚠ The astral walk is the one that found a shared-core throw in ga and ilo. **kea does not have it**: its
only `Normalize` call is on COMPOSED IPA (manifest values plus ˈ/ŋ/ã/combining tilde), never on the raw
word, so there is nothing malformed to hand `string.Normalize`. Checked rather than assumed.

## Run 7 — 2026-08-30 13:08 — the seam gates on a real corpus, and the leak sweep

A 3,748-row reference generated from the TypeScript over the corpus + haystack, swapped in for
`csharp/goldens/kea.tsv`, both engines' gates run, golden restored (see Run 5 for the before/after).

    parity kea                 3,748 rows OK, 0 differ
    parity --poison kea        0 sites          provenance 52,973/52,973   IpaSpan 47,497/47,497
    seam-parity.mts            kea absent from the disagreement table

    leak sweep   corpus 0/2,071 · haystack 0/1,711, on BOTH engines

## Run 8 — 2026-08-30 13:10 — the adversarial fuzz

804 hostile lines — astral characters, lone surrogates, combining marks, control characters, eight other
scripts, the case-fold hazards in every unit slot, the ⟨ì ù⟩ the NATIVE_CLASS deliberately omits, extreme
digit runs, and a BMP sweep:

    norm: 0 of 804 differ      text: 15 of 804 differ

**All 15 contain a Tifinagh code point** — checked mechanically, the residue is empty. That is #1196
(Tifinagh routes to the unported `shi`; `Registry.PortPending` names it), not this port's.

## Read for correctness — notes, nothing filed

- **`two in DI`** (the TS digraph test) is a JS `in`, which is presence-only and includes inherited
  `Object.prototype` keys. The C# `TryGetValue` is presence-only too, and no two-character string is an
  `Object.prototype` property, so the two agree. Checked because `in` is the one JS operator whose C#
  translation can silently widen.
- **`word.toLowerCase().at(-1)`** is the last UTF-16 CODE UNIT, not code point; the C# `w[^1]` is the same
  thing. Faithful, and the astral walk covers it.
- **The two tests neither side had.** No test on either engine reached the space de-grouping arm or the
  digit fallback. Both are now pinned, in both engines, with values taken from the TypeScript.

## Run 9 — 2026-08-30 13:12 — the full gates

    dotnet test (full suite)          4,455 pass, 0 fail
    parity (ALL goldens)              161 languages, 31,364 rows, 0 differ
    npx vitest run (full suite)       290 files, 5,740 pass, 0 fail
