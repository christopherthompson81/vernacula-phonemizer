# Kikuyu (ki) — C# port investigation

Chronological log of the runs behind the ki port.

## Run 1 — 2026-08-30 17:25 — scope

    wc -l src/languages/kikuyu/*.ts csharp/goldens/ki.tsv
        85 kikuyu.ts · 24 manifest.ts · 386 normalize.ts · 20 numbers.ts · 85 e5xNumbers.ts
        200 ki.tsv (rows)

Niger-Congo Bantu (E51), the largest language of Kenya (~8M), Latin orthography. The Kikuyu-side
half of the E5x pair: the C# shared compositor already existed — the Kamba port (kam, #1200)
placed `E5xNumbers.cs` in the Kikuyu namespace to mirror the TS tree 1:1, and Kamba's
`Numbers.cs` already calls into it. This port slots in beside it: the language's own table,
engine and normalizer, reusing the existing module.

    csharp/goldens/ki.tsv (200 rows, wiki prose — ki has NO FLEURS corpus) exists, so the gate
    applies from the first run.

**The structure of the port:**

  * `Languages/Kikuyu/Kikuyu.cs` — the greedy scan (NFC first, then `Js.ToLowerCase`, then the
    length-descending grapheme keys, `LatinPhone` only on the miss branch) and the TOKEN regex,
    which is the Kamba one with the third apostrophe variant (`ʼ`) removed: Kikuyu's word group
    admits only `'` and `’`, and the pre-scan replace folds only the curly one.
  * `Languages/Kikuyu/Manifest.cs` — `kikuyu.jsonc` typed; all keys plain camelCase, so the
    loader's naming policy claims every one (pinned by `ManifestMappingTests.
    KikuyuManifestIsFullyMapped`).
  * `Languages/Kikuyu/Numbers.cs` — a two-line wrapper; the algorithm is the shared module.
  * `Languages/Kikuyu/Normalize.cs` — the 9 steps in TS order, every pattern through
    `JsRegex.Compile` verbatim, every pipeline replace through the `Rewrite` seam. Deliberately
    NO shared symbol tier: Kikuyu writes the measure/currency noun BEFORE its number in every
    corpus instance (`mita 200`, `dolari mirioni 4.35`), and the tier can only postpose — so the
    unit and currency readings live in the normalizer, in the language's own order.

**The hazard list, written before any code:**

  * The TS `numbers.ts` wrapper and this `Numbers.cs` must keep the `raw` argument (#1095): the
    E5x fallback degrades digit-by-digit and `raw` is the only source of the original digit
    string. The existing `E5xNumbers.cs` already carries it.
  * `E5xNumbers.cs` references `Numbers.DigitWord` (Core). The new `Kikuyu.Numbers` class in the
    SAME namespace shadows `Core.Numbers` for unqualified name lookup — the build would break on
    the shared module the Kamba port depends on. Caught by the first build, not the gate.
  * The dollar step's callback tests a 45-char window on BOTH sides of the match against the
    PRE-REPLACE string; the port snapshots `src7` before the `Rewrite`, the same shape the Kamba
    degree step uses. The three unit steps each need their own snapshot — the window is measured
    against the string as that step's `Rewrite` sees it.
  * ki is RULE-BASED ONLY (no ONNX tagger), so sync and async produce identical output; one
    registration, no `NeuralRegistry` entry.

## Run 2 — 2026-08-30 17:45 — the first gates

    dotnet build                                    clean (the two pre-existing warnings)
    dotnet test --filter Kikuyu                     57/57
    npx vitest run test/kikuyu.test.ts              24/24 (TS side untouched)

    dotnet run --project csharp/tools/parity -- ki  ki OK 200 rows · 0 differ

200/200 on the first parity run.

## Run 3 — 2026-08-30 18:00 — the widenings: mined corpus + off-golden probes

There is NO FLEURS corpus for ki and no ki.wikipedia dump beyond the mined artifact, so the
corpus-wide differential is the artifact the normalizer's own counts were measured on:
`tools/corpus/mined/ki.jsonc` (369 segments → 360 unique lines), the "hard" + "sample" sets
the TS header cites throughout.

    mined ki corpus (360 lines)
        C# sync      == TS   360/360   0 differ
        C# async     == TS   360/360   0 differ
        C# normalize == TS   360/360   0 differ
    off-golden probes (.probe/ki/probes.txt, 263 lines: every normalize arm plus its adversarial
        neighbour — all 12 substitute characters + the six acute stand-ins that must NOT fold,
        the decomposed-form inputs, the format-character strip, the four entity shapes + the
        case-folded ones, the exactly-three-digits test on both marks including 1,312,345,678,
        0,123 and the space-grouped twins, the ordinal suffix in both cases against 11De/5ths/
        a21st/21st2, the range joiner's ascending guard against the chess arm (+1 -3 =0), the
        birth-death lines, the clause-final `p 237–240.` and `1991-2009,`, the decimal-range
        refusal, the `10:00-11:00` shape (both engines read the inner `00-11` as a range — the
        pattern has no colon guard and the port reproduces the TS exactly), the percent's
        decimal-tail operand, the US$ arm, the trap-12 window on both sides (dolari/dollar/
        ciringi), the metre arm's split (802.11m refused, 802.11 m claimed), the cube/slash
        refusals, the multi-dot decimal refusals (11.3.42, 2013.07.27, 1.2.3.4), the full E5x
        ladder to 10¹², 2⁵³ and the non-safe-integer fallback arms, the g2p inventory, the
        İ length-changing lowercase, the modifier-letter apostrophe that Kikuyu does NOT fold,
        the quoted-word no-glottal case, the clause punctuation, the roman pre-pass)
        C# sync/async/normalize == TS   263/263   0 differ
    g2p ENUMERATED
        full 29-character word inventory, 1–3 letters      25,259 words   0 differ
        16 class representatives, 4 letters                65,536 words   0 differ
    numbers (the E5x ladder above, through the text path)   0 differ

Leak sweep over all 720 TS outputs: the only symbols outside the IPA inventory sit on 5 corpus
lines and are foreign-run readings routed to ported engines (ru/zh/ja/fa/hi/el) — no raw digit
or unread symbol from ki's own path. The corpus provably exercises the arms: 134 substitute
vowels (ű×66 ū×23 ī×37 û×9 î×6 ŭ×1 Î×1), 26 acute stand-ins (the refusal arm), 18 `%`, 20 `$`,
44 comma-grouped, 44 decimal runs, 35 ranges, 2 `°`, 1 `²` (the recorded known-wrong residual),
15 `&nbsp;`, 2 `&quot;`.

Zero throws on every side.

## Run 4 — 2026-08-30 18:10 — the seam gates, both engines

    parity --poison ki        0 sites (SUBSTRING 0, desync 0)
    parity --provenance ki    5433/5433 (100.0%) tokens mapped
    parity --ipaspans ki      4876/4876 (100.0%), 0 wrong spans
    provenance-poison.mts ki  0 sites
    provenance-coverage.mts --full ki   5433/5433 (100.0%)   ← identical to C#
    ipa-span-coverage.mts --full ki     4876/4876 (100.0%), 0 wrong   ← identical to C#
    seam-parity.mts           kikuyu 18 TS / 18 C# seam sites, 0 gap, 2/2 raw replaces
    patterns (TS AST vs C# source)      all 23 pattern+flag pairs byte-identical; the two
        TS-only literals are the de-grouping arms' inner replaces on matched groups, spelled
        `string.Replace` / `JsRegex.Replace` in the C# — the correct non-seam call.

The token counts match EXACTLY across the two engines.

## Run 5 — 2026-08-30 18:14 — the full gates

    dotnet test (full suite)          4,671 pass · 0 fail
    parity (ALL goldens)              165 languages, 32,164 rows, 0 differ
    npx vitest run (full suite)       290 files, 5,735 pass · 5 skip · 0 fail

The fleet total moved exactly ki's 200 rows; no other language's row moved.

## Notes for the record

  * The one build defect — `Kikuyu.Numbers` shadowing `Core.Numbers` inside the shared
    `E5xNumbers.cs` — is a consequence of the 1:1 mirroring rule (numbers.ts → Numbers.cs in
    the Kikuyu namespace) meeting a reference the Kamba port wrote before the Kikuyu namespace
    had its own `Numbers`. The fix qualifies the reference (`Core.Numbers.DigitWord`) rather
    than renaming the mirrored module.
  * ki is RULE-BASED ONLY: sync and async agree, one registration, no neural table.
  * The C# test file is the mirror of `test/kikuyu.test.ts` plus the lone-surrogate theories
    the #1199 sweep requires of every ported engine (PhonemizeWord, Normalize, shipped path);
    the shipped-path expectations are the TypeScript's own answers, measured rather than
    derived.
  * No defect found in either engine. Nothing filed, no TS-side fix needed — the TS suite is
    green and untouched.

---

# PR review (#1206)

## Run A — 2026-08-30 18:00 — **the highest-risk line is the one-liner in a SHARED module**

Rebased onto main (1 behind: #1204 quc). The port adds four files and changes one line in a fifth —
`Kikuyu/E5xNumbers.cs`, which **Kamba also uses**:

    - d == "0" ? T.Zero : Numbers.DigitWord(T.Units, d) ?? d
    + d == "0" ? T.Zero : Core.Numbers.DigitWord(T.Units, d) ?? d

⚠ **THE QUALIFICATION IS NECESSARY AND ITS FAILURE MODE IS BENIGN**, which is worth establishing rather
than assuming. Adding `Kikuyu/Numbers.cs` puts a `Numbers` class in the SAME NAMESPACE as `E5xNumbers`,
and a same-namespace type beats a `using`-imported one — so the unqualified reference would have rebound
from `Core.Numbers` to `Kikuyu.Numbers`. Checked: `Kikuyu.Numbers` has **no `DigitWord`**, so the rebind
is a COMPILE ERROR, not a silent switch to a different method. Good.

⚠ **AND KAMBA HAD TO BE RE-MEASURED ON THE ARM THAT LINE IS IN**, because parity cannot reach it — the
tokenizer's number group is `\d+`, so the digit-by-digit fallback only runs for a non-safe, negative or
non-numeric argument. Both languages, through the shared module, over 0…200,000 plus the magnitude
boundaries plus the fallback arms (`-1`, `1.5`, `NaN`, `abc`, `9007199254740993`, `1😀2`, `٠١٢`, a
30-digit run):

    kam  200,335 probes  0 differ
    ki   200,335 probes  0 differ

## Run B — 2026-08-30 18:10 — **the substitute class was spelled twice, and that is a drift**

The pattern diff came out 22 v 22 with one on each side:

    in TS, not in C#:  /,/gu                    — the de-group inner replace; the C# uses `m.Value.Replace(",", "")`
    in C#, not in TS:  /[űŰūŪûÛŭŬīĪîÎ]/gu       — the orthographic-substitute fold

The second is not a scanner artifact. **The TypeScript DERIVES that class from the table's own keys** —
``new RegExp(`[${Object.keys(SUBSTITUTE).join("")}]`, "gu")`` — while the C# hand-wrote the literal. They
agree today, character for character. They would stop agreeing the moment anyone adds a substitute: the
TS regex updates itself and a literal does not. That is the "a table spelled twice is a table that
drifts" argument this codebase makes everywhere else, and the fix is one line:

    JsRegex.Compile("[" + string.Concat(SUBSTITUTE.Keys) + "]", "gu")

Both engines dumped after the change, and the compiled forms are identical:

    TS  ["[űŰūŪûÛŭŬīĪîÎ]","gu"]
    C#  ["[űŰūŪûÛŭŬīĪîÎ]","gu"]

(A `Dictionary` preserves insertion order, so the derived class comes out in the same order `Object.keys`
gives — the classes are set-equivalent regardless, but identical is easier to diff.)

## Run C — 2026-08-30 18:20 — the differentials and the walks

⚠ **NO FLEURS FOR ki**, so the corpus-wide differential rides on the mined + attest artifacts.

    corpus (728 lines: 391 mined + 337 attest)              norm 0 · text 0
    g2p walk, 29-char alphabet, 1–3 letters                  25,327 words   0 differ
    astral + both surrogate halves × the letters, 1–3        11,109 words   0 differ
    adversarial fuzz, 930 hostile lines                      norm 0 · text 0
    leak sweep                                               0/728 and 0/930, both engines

⚠ The walk carries the twelve SUBSTITUTE characters explicitly, in isolation and in the corpus's own
words (`nyamű`, `mūndū`, `kūrī`, `Îri`, `gĩkűyű`, `ŭrĩa`). No walk over the ORTHOGRAPHIC alphabet reaches
them — they are precisely the characters the orthography does not have, which is why the fold exists.

## Run D — 2026-08-30 18:25 — the seam gates on a real corpus

A 26,879-row reference generated from the TypeScript over the corpus + walk + fuzz, swapped in for
`csharp/goldens/ki.tsv`, both engines' gates run, golden restored:

    parity ki                  26,879 rows OK, 0 differ
    parity --poison ki         0 sites      provenance 49,769/49,769   IpaSpan 46,850/46,850
    provenance-poison.mts      0 sites      --full coverage: 49,769/49,769 and 46,850/46,850
    seam-parity.mts            ki absent from the disagreement table (24 unported, down from 25)

The token counts match EXACTLY across the two engines.

## Run E — 2026-08-30 18:30 — the gates

    dotnet test (full suite)          4,720 pass, 0 fail
    parity (ALL goldens)              166 languages, 32,339 rows, 0 differ
