# Urdu (ur) fraction-guard investigation (#1477)

The Urdu FRACTION rule (`src/languages/urdu/normalize.ts`, step 7) had lopsided guards, the shape Mandarin had
before #1487: the left lookbehind refused any `.` or `,`, the right lookahead only a digit or `/`. The fix gives
it Mandarin's mirrored guards: each side refuses a digit or `/`, a `.` with a digit beyond it (a decimal), and a
`,` with exactly three digits beyond it (a thousands group). Any other `,` is a list separator.

## Run 1 — 2026-10-09 21:05 — repro on the unfixed engine

Command: a scratch script that runs `makeUrduNormalizer(DEF.numbers)` and `phonemize(_, "ur")` over the probe
set, at base 65637ee3.

Question: does `1/2.5` read a fraction and a stranded `.5`, as the issue says? And what do the Arabic-Indic forms
and the separators U+066B / U+066C do? (Step 1 of the normalizer folds both digit forms and ٫ → `.`, ٬ → `,`, and a
digit-flanked ، before three digits → `,` before the fraction rule runs, so they share the ASCII behaviour.)

Raw finding (input → normalized → IPA):

```
"1/2.5"        آدھا.5                  ˈɑːd̪ʱɑː . pˈɑːnət͡ʃ          ← fraction + a stranded ".5" (a pause, then 5)
"1.5/2"        1.5/2                   ˈeːk əʔʃɑːɾˈiːɦ pˈɑːnət͡ʃ d̪ˈoː  ← declined (left guard)
"3/4,5"        تِین بٹا چار,5           t̪ˈiːn bˈəʈɑː t͡ʃˈɑːɾ , pˈɑːnət͡ʃ
"3,4/5"        3,4/5                   t͡ʃoːnt̪ˈiːs pˈɑːnət͡ʃ          ← list comma declines; TOKEN then reads "3,4" as 34
"1/2,3/4"      آدھا,3/4                ˈɑːd̪ʱɑː , t̪ˈiːn t͡ʃˈɑːɾ       ← second fraction unread
"1/1,000,000"  ایک بٹا ایک,000,000      ˈeːk bˈəʈɑː ˈeːk , sˈɪfɾ      ← "one over one, zero": the million is gone
"5,000/10,000" 5,000/10,000            pˈɑːnət͡ʃ ɦzˈɑːɾ d̪ˈəs ɦzˈɑːɾ
"یہ 1/2."      یہ آدھا.                 jˈəɦ ˈɑːd̪ʱɑː .
"١/٢٫٥"        آدھا.5                  (as 1/2.5)
"١٫٥/٢"        1.5/2                   (as 1.5/2)
"٣/٤،٥"        تِین بٹا چار،5           (، not digit-grouping here: stays punctuation)
"١/١٬٠٠٠"      ایک بٹا ایک,000          ˈeːk bˈəʈɑː ˈeːk , sˈɪfɾ
"۱/۲٫۵"        آدھا.5                  (as 1/2.5)
"۵،۰۰۰/۱۰،۰۰۰"  5,000/10,000            (as 5,000/10,000)
"۱/۲،۳/۴"       آدھا،تِین بٹا چار        (Arabic comma is not in either guard: both read)
"1/2.5/3"      آدھا.5/3                ˈɑːd̪ʱɑː . pˈɑːnət͡ʃ t̪ˈiːn
"x.1/2"        x.1/2                   (declined: the left guard refuses ANY `.`)
"پانی,1/2"     پانی,1/2                pˈɑːniː , ˈeːk d̪ˈoː          (declined: ANY `,`)
```

Implication: confirmed, and wider than the issue's two probes. The right side reads through a decimal and a
thousands group (`1/1,000,000` loses the million); the left side over-refuses a list comma and a non-numeric `.`.
Apply Mandarin's mirror exactly (Urdu keeps its `{1,3}` widths).

## Run 2 — 2026-10-09 21:15 — the mirrored guard

Change: `(?<![\d.,/])(\d{1,3})\/(\d{1,3})(?![\d/])` →
`(?<![\d/]|\d\.|\d,(?=\d{3}\/))(\d{1,3})\/(\d{1,3})(?![\d/]|\.\d|,\d{3}(?!\d))`, TS and C#.

Raw finding (same script):

```
"1/2.5"        1/2.5                   ˈeːk d̪ˈoː əʔʃɑːɾˈiːɦ pˈɑːnət͡ʃ   ← declined: one, two point five
"1.5/2"        1.5/2                   unchanged
"3/4,5"        تِین بٹا چار,5           unchanged
"3,4/5"        3,چار بٹا پانچ           t̪ˈiːn , t͡ʃˈɑːɾ bˈəʈɑː pˈɑ̃ːt͡ʃ
"1/2,3/4"      آدھا,تِین بٹا چار        both read
"1/1,000,000"  1/1,000,000             ˈeːk ˈeːk ɦzˈɑːɾ , sˈɪfɾ   ← declined (see below)
"5,000/10,000" unchanged
"یہ 1/2."      unchanged (reads)
Arabic-Indic / Extended forms: identical to their ASCII twins
"1/2.5/3"      1/2.5/3                 declined whole; `5/3` is not picked up (left `\d\.`)
"x.1/2"        x.آدھا                  reads (a `.` after a letter is not a decimal)
"پانی,1/2"     پانی,آدھا                reads
```

Note: the declined `1/1,000,000` reads "one one-thousand , zero" — that is the TOKEN rule's own grouping arm
(`\d+(?:,\d+)?`, one comma group), not this rule. Out of scope here; the fraction is correctly declined.

Implication: every probe lands where the Mandarin reference lands. Measure the corpus.

## Run 3 — 2026-10-09 21:20 — does any corpus row move?

Command: scratch `measure.mts` — the union of `csharp/goldens/ur.tsv` texts and FLEURS ur_pk dev/test/train
transcripts, `phonemize(_, "ur")` dumped with the fix and again with `normalize.ts` checked out at base.

Raw finding: `texts=1761 with digit/digit=1`; rows differing before/after: **0**.

Implication: the golden does not move; no regeneration. The one digit-slash text in the corpus is not one of the
affected shapes. The fix is defensive for input the corpus does not contain.

## Run 4 — 2026-10-09 21:25 — prove the guard by reverting the fix

Command: `npx vitest run test/urdu-fraction-guard.test.ts` and `dotnet test --filter UrduFractionGuardTests`, each
with the fix in place and with the engine file checked out at base.

Raw finding: fixed — TS 14/14, C# 14/14. Reverted — TS 8 failed / 6 passed, C# 8 failed / 6 passed (the same 8:
`1/2.5`, `1/1,000,000`, `1/2.5/3`, `١/٢٫٥`, `١/١٬٠٠٠`, `1/2,3/4`, `3,4/5`, `پانی,1/2`). The 6 that pass on base are
the cases the old guard already got right (`1.5/2`, `5,000/10,000`, `۵،۰۰۰/۱۰،۰۰۰`, `3/4,5`, `۱/۲،۳/۴`, `1/2.`),
kept as regression pins for the new guard.

Implication: the tests witness the fix. Expectations are relational (declined ≡ the two numbers spaced; read ≡
the spaced form), no typed IPA.

## Run 5 — 2026-10-09 21:30 — regex corpus and regex-diff

Command: `npx tsx tools/extract_regexes.mts`; `dotnet run --project csharp/tools/regex-diff`;
`cargo run --release -p regex-diff -- ../csharp/regex-corpus.jsonl` (in `rust/`).

Raw finding: 2,383 distinct patterns; the jsonl diff is exactly 1 line (the Urdu pattern replaced). C#: 145,234 probe
results identical, 0 DIFFER, 0 threw. Rust: 145,234 identical, 0 DIFFER, 0 refused, 0 UNSOUND.

Implication: the new lookaround shape (alternation inside a lookbehind, a lookahead nested in it) is handled by
both ports' regex engines.

## Run 6 — 2026-10-09 21:35 — do the sibling sites actually misread?

Command: scratch `sib.mts`, `phonemize` of `1/2.5`, `1.5/2`, `1/2`, `2.5` in hi mr ne gu lb ta en de es (base
engines; only ur was changed).

Raw finding (`1/2.5` / `1.5/2`):

```
hi  ˈaːd̪ʱaː . pˈaː̃t͡ʃ               / declined
mr  ˈəɾd̪ʱaː . pˈaːt͡s                / declined
ne  ˈek bˈʌʈa d̪ˈui . pˈãt͡s          / declined
gu  ˈəɽd̪ʱo . pˈãɲt͡ʃ                / declined
lb  ˈeːn hˈaləf kˈoma fˈənəf        / ˈeːnt kˈoma fˈənəf hˈaləf   ← 1.5/2 also misreads though the left guard refuses `.`; cause not traced (an earlier lb pass may consume the decimal first)
ta  ˈaɾaᶦ pˈʊɭːɪ ˈaᶦn̪d̪ʊ              / declined
en  wˈʌn hˈæf . fˈaᶦv               / wˈʌn pʰɔᶦnt fˈaᶦv hˈævz      ← \b family: both sides read into the decimal
de  aɪ̯n halp . fʏnf                 / aɪ̯ns . fʏnf hˈalbə
es  un mˈeðjo , θˈinko              / ˈuno , θˈinko mˈeðjos
```

Implication: the four Indic siblings are the same defect, one-for-one, and would take the same mirrored guard.
Left for their own fix per the task scope. The `\b` family misreads on BOTH sides — a different defect.

## Run 7 — 2026-10-09 21:45 — gates on the final tree

Commands, one at a time: `npm run check:goldens`; `npx vitest run`; `dotnet test` (full, in `csharp/`);
`dotnet run --project csharp/tools/parity -- ur`.

Raw finding:
- check:goldens — 189 languages, 36,495 rows, 0 stale.
- vitest — 347 files pass, 1 failed: `test/check-goldens-jobs.test.ts` 7/9, every one `status -1`. The test spawns
  `<root>/node_modules/.bin/tsx`, and this worktree has no `node_modules/.bin` (packages resolve from the parent
  checkout). With a temporary symlink to the parent's tsx the file passes 9/9; symlink removed. Environmental,
  not this change. 6,519 tests pass in all.
- dotnet test — 7,192 passed, 0 failed.
- C# parity ur — 200 rows byte-identical, 0 differ.

Implication: green. Golden not regenerated (Run 3: 0 rows move).

## Sibling sites (listed, not fixed here)

Same lopsided shape — left refuses `.`/`,`, right refuses only a digit or `/` — so `1/2.5` reads a fraction and a
stranded `.5` there too:

- `src/languages/hindi/normalize.ts` — `(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])` (identical but for `/` on the left)
- `src/languages/gujarati/normalize.ts` — identical to Hindi
- `src/languages/marathi/normalize.ts` — identical to Hindi
- `src/languages/nepali/normalize.ts` — identical to Hindi
- `src/languages/luxembourgish/normalize.ts` — left `[\d.,:/]`, right `[\d/]`
- `src/languages/tamil/normalize.ts` — left `[\d./]`, right `[\d/]` (the `,` is unguarded on both sides)

Lopsided on a different axis (letters, not decimals): haitian, lingala, zhuang (left refuses a letter, right does
not); ukrainian (right refuses `/`, left does not); italian (left refuses only a digit, right also `/`).

Symmetric but permissive on both sides — the `\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])` family (english, french,
german, spanish, portuguese, russian, indonesian): `\b` holds between `.` and a digit, so `1.5/2` and `1/2.5`
both match a fraction inside the decimal. Not the issue's shape; a separate defect class.
