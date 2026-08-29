# Raw invisible characters in source — a fleet sweep

Opened while porting `et`, where `grep` returned nothing on a 1,017-line file and `file(1)` called it
`data`. The cause was a **raw NUL byte** in a sentinel string. The question this log answers: is that one
file, or a shape the fleet repeats?

## Run 1 — 2026-08-30 ~08:30 — the sweep

Every `.ts` / `.mts` / `.cs` / `.mjs` / `.js` file under `src/`, `csharp/` and `tools/` scanned for
characters that are **invisible or control** when written raw — NUL and the C0/C1 controls, the zero-width
family (ZWSP, ZWNJ, ZWJ, word joiner, BOM), the bidi controls, the soft hyphen, the Private Use Area, and
the non-ASCII spaces (NBSP, NNBSP, thin space, …).

    533 raw invisible characters in code files — 404 outside comments

⚠ **DATA FILES WERE EXCLUDED ON PURPOSE.** `*.jsonc` manifests and the mined `batch-*.json` corpora carry
thousands of these — Khmer ZWSP ×5,215, Sinhala ZWJ ×1,978, Urdu RLM ×2,493 — and every one is *linguistic
content*. A ZWNJ in a Persian manifest is the language. The question here is only about SOURCE.

## Run 2 — the three files that are broken exactly like `et` was

`file(1)` classifies a file with a NUL as `data`, and **grep then skips it silently** — no match, no error,
no "binary file matches" unless the tool is configured to say so.

    src/languages/hakka/pfs.ts          3 raw NULs
    src/languages/khmer/khmerPerceptron.ts   1 raw NUL
    tools/gen/build-hak-pfs.mts         2 raw NULs

These are the same defect `et` had. Any mechanical review pass over them — a regex diff, a table
membership check, a "which constants did the port miss" sweep — returns **zero findings, silently**, and a
reviewer reports the file clean. Two of the three are on the Hakka path, which is not yet ported to C#.

## Run 3 — the sentinels that render as NOTHING, which may be worse

Seven Private-Use-Area characters (U+E000) sit in source as **lone marker constants**:

    src/languages/xiang/normalize.ts:119      const AGO = "";
    src/languages/gan/normalize.ts:307        const AGO = "";
    src/languages/nepali/nepali.ts:75         const SENTINEL = "";
    tools/normalization/mine.ts:77
    csharp/…/Languages/Nepali/Nepali.cs:37    private const string SENTINEL = "";
    csharp/…/Languages/Xiang/Normalize.cs:32
    csharp/…/Languages/Gan/Normalize.cs:70    private const string AGO = "";

⚠ **THESE DO NOT BREAK ANY TOOL, WHICH IS WHY THEY ARE ARGUABLY WORSE THAN THE NUL.** `const AGO = "";`
reads as the empty string. It is not — it is U+E000. Nothing flags it, `file` is happy, `grep` works, and a
reviewer diffing the TS `const AGO = ""` against the C# `const string AGO = ""` would call them **equal
even if one of them were genuinely empty**. That is a hole in precisely the mechanical method this batch
has been using to catch transcription defects.

The escape `""` is the same value and says what it is.

## Run 4 — the character classes, which are the bulk and are a lesser case

The remaining ~390 are invisible characters *inside a regex character class* — `[​‌‍﻿]` (ZWSP/ZWNJ/ZWJ/BOM)
and `[    ]` (space/NBSP/NNBSP/thin space) and the like. The brackets at least tell a reader that
*something* is in there, and the fleet is already inconsistent: many layers spell these as escapes and say
why in a comment (the "nso lesson", #1109), while others write them raw.

    invisible space  U+00A0 ×129   zero-width U+200C ×64   U+200D ×51   U+200B ×38   U+FEFF ×37
    invisible space  U+2009 ×19    U+202F ×18              U+2060 ×12   SOFT HYPHEN U+00AD ×8

Not proposed for a mass edit: it is a convention question across ~390 sites in dozens of layers, and the
escape-them convention is already documented where it matters most (the separator classes).

## Recommendation

Two changes, both behaviour-neutral, both one line each:

1. **The three NUL files** — write the NUL as `\0`. This restores `grep` and `file` on them, which is what
   makes every other review instrument work. `et` is already done, as part of #— (this port).
2. **The seven PUA sentinels** — write them as ``. This is the one that closes a real blind spot in
   the mechanical review method, because a raw PUA marker and an empty string are indistinguishable on
   sight and in a diff.

Neither is proposed for the character classes in run 4.
