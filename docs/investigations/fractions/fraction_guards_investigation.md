# Fraction guards across the fleet (cross-cutting)

This picks up from `docs/investigations/ur/ur_fraction_investigation.md` (#1477, merged as #1492). That fix
mirrored Urdu's fraction guards on Mandarin's (#1487). This round does the same for the siblings that log listed
with the same lopsided shape: hi, gu, mr, ne, lb and ta. The defect class it does not fix (the `\b…\b` family)
and the letter-side asymmetries are filed as #1495.

The guard. Each side refuses a digit or `/`, a `.` with a digit beyond it (a decimal), and a grouped number:

```
(?<![\d/]|\d\.|\d,(?=\d{3}\/))(\d{1,3})\/(\d{1,3})(?![\d/]|\.\d|,(?:\d{3}(?!\d)|\d{2},\d))   hi gu mr ne ta
(?<![\d/]|\d[.,:])(\d{1,3})\/(\d{1,3})(?![\d/]|[.,:]\d)                                       lb
```

The Indic right side also refuses the lakh group `,dd,` (`1/1,00,000`), which these languages write. That is the
grouping in their own character set. On the left side a lakh group always ends in three digits, so
`\d,(?=\d{3}\/)` already covers it. lb's decimal separator is `,` (with an anglicism `.`), so any `.`, `,` or `:`
with a digit beyond it is refused. Its left side used to refuse any `:`; the mirror refuses `\d:`.

## Run 1 — 2026-10-09 21:20 — repro on the unfixed engines (base d1fdb503)

Command: scratch `probe.mts hi gu mr ne lb ta`, which runs `phonemize` over a synthetic probe set plus
native-digit twins (Devanagari, Gujarati, Tamil).

Question: does each sibling misread the way Urdu did, and what do the native digits and the lakh grouping do?

Raw finding (selected; full table in the scratch output):

```
hi  1/2.5        ˈaːd̪ʱaː . pˈaː̃t͡ʃ                ← a half, then a stranded ".5"
hi  1/1,00,000   ˈeːk bˈəʈaː ˈeːk , ʃˈuːnj        ← the lakh is lost
hi  1/2,3/4      ˈaːd̪ʱaː , t̪ˈiːn t͡ʃˈaːɾ            ← second fraction unread
hi  3,4/5        t͡ʃɔː̃n̪t̪ˈiːs pˈaː̃t͡ʃ                ← declined, then read as 34
gu  1/1,000,000  ˈek d̪ˈəs lˈakʰ                   (gu de-groups earlier: already declined)
mr/ne           identical shapes to hi
lb  1/2.5        ˈeːn hˈaləf kˈoma fˈənəf          ← a half, "Komma fënnef"
lb  1.5/2        ˈeːnt kˈoma fˈənəf hˈaləf         ← reads 5/2 although the left guard refuses `.`
lb  1,5/2        ˈeːnt kˈoma fˈənəf hˈaləf         ← the same with the language's own decimal comma
ta  1/2.5        ˈaɾaᶦ pˈʊɭːɪ ˈaᶦn̪d̪ʊ                ← a half, "point five"
ta  1.5/2        ˈonrʊ pˈʊɭːɪ ˈɪɾɐɳɖɪl ˈaᶦn̪d̪ʊ pˈɐŋɡʊ  ← "one point, five over two": reads 5/2
native digits: identical to their ASCII twins in all five scripts (each normalizer folds them first)
```

Implication: hi, gu, mr and ne are the Urdu defect one-for-one. lb and ta misread `1.5/2` too, even though their
left guards refuse `.`. Run 2 explains why.

## Run 2 — 2026-10-09 21:25 — why lb (and ta) misread `1.5/2`

Command: read the step order in `src/languages/luxembourgish/normalize.ts` and `src/languages/tamil/normalize.ts`.

Raw finding: in both files the DECIMAL rules run before FRACTION. In lb, step 8 DOT_DECIMAL
`(?<![\d.,:])(\d{1,2})\.(\d)(?![\d,.:\p{L}])` and step 9 COMMA_DECIMAL both permit a following `/`, and the
fraction was step 14. In ta, step 8 `(?<![\d.])(\d+)\.(\d+)(?![\d.])` permits a `/` on either side, and the
fraction was step 10. So `1.5/2` became `1 Komma 5/2` (ta: `1 புள்ளி 5/2`) before the fraction rule ran. By then
`5` had a space before it, and the guard never saw the `.`. `1/2.5` similarly became `1/2 Komma 5`.

Implication: the guard alone cannot fix lb and ta. The fraction has to see the raw digits, so it moves ahead of
the decimals (lb: to 7b, after the clock; ta: to 7d, after the clock/colon steps). Making the decimals refuse an
adjacent `/` was rejected: it would leave `1.5` in `1.5/2` unread by any rule, so the tokenizer would read "1 . 5".
Run 4 proves the reorder is needed.

## Run 3 — 2026-10-09 21:35 — the fix, probe readings after

Command: the same `probe.mts`, after the change, diffed line by line against Run 1.

Raw finding (changed lines only, selected):

```
hi  1/2.5        → ˈeːk d̪ˈoː d̪əʃˈəmləʋ pˈaː̃t͡ʃ        declined: one, two point five
hi  1/1,000,000  → ˈeːk d̪ˈəs lˈaːkʰ                  declined: one, ten lakh
hi  1/1,00,000   → ˈeːk ˈeːk lˈaːkʰ                  declined
hi  3,4/5        → t̪ˈiːn , t͡ʃˈaːɾ bˈəʈaː pˈaː̃t͡ʃ        list comma; the fraction reads
hi  1/2,3/4      → ˈaːd̪ʱaː , t̪ˈiːn bˈəʈaː t͡ʃˈaːɾ        both read
hi  1,5/2        → ˈeːk , pˈaː̃t͡ʃ bˈəʈaː d̪ˈoː            was "fifteen two"; `1,5` is not a number in hi
mr  1/2,3/4      → ˈəɾd̪ʱaː , paːˈuːɳ                 both read (3/4 is suppletive)
lb  1/2.5        → ˈeːnt t͡svˈeː kˈoma fˈənəf          declined
lb  1.5/2        → ˈeːnt kˈoma fˈənəf t͡svˈeː          declined
lb  3/4,5        → drˈæi fˈei̯ər kˈoma fˈənəf          declined: `4,5` is a decimal in lb
lb  1/2:3        → ˈeːnt t͡svˈeː , drˈæi               declined (mirror of `3:1/2`)
ta  1/2.5        → ˈonrʊ ˈɪɾɐɳɖʊ pˈʊɭːɪ ˈaᶦn̪d̪ʊ          declined
ta  1.5/2        → ˈonrʊ pˈʊɭːɪ ˈaᶦn̪d̪ʊ ˈɪɾɐɳɖʊ          declined
x.1/2 (all six)  now reads the fraction (a `.` after a letter is not a decimal)
```

Note: lb `1/1,000,000` declines but still reads "eent eent , null , null". That is lb's tokenizer, which has no
Western comma grouping. It was the same before this change, and it is not this rule.

Implication: every probe lands where the Urdu/Mandarin reference lands, with each language's own separators.

## Run 4 — 2026-10-09 21:40 — prove the tests by reverting

Commands: `npx vitest run test/fraction-guard-mirrors.test.ts` and
`dotnet test --filter FractionGuardMirrorsTests`, each with the fix in place and with the six engine files
checked out at base. Then a third TS run with ONLY the guard mirrored in lb and ta, and the rule still after
the decimals.

Raw finding: fixed: TS 62/62, C# 57/57. Reverted: TS 36 failed / 26 passed, C# 36 failed / 21 passed. Every
language has failing cases. Guard-only for lb/ta: 9 failed (`1/2.5`, `1.5/2`, `1/2.5/3` and the native twin in ta;
`1/2,5`, `1,5/2`, `1/2.5`, `1.5/2` and `3/4,5` in lb), so the reorder is load-bearing. Rust:
`fraction_guards_are_mirrors` in `hindi.rs` fails with `normalize.rs` reverted, and passes fixed.

Implication: the tests witness both halves of the fix.

## Run 5 — 2026-10-09 21:45 — rows moved over goldens + FLEURS

Command: scratch `measure2.mts` dumps `phonemize` over the union of each language's golden texts and its FLEURS
dev/test/train transcripts, before (base) and after; `cmp.py` diffs them. Then `npm run check:goldens` for the
whole fleet, because `makeHindiNormalizer` is shared by awa, bho, hne, mag, mai and rkt.

Raw finding:

```
hi 1758 texts  moved 0      gu 2006  moved 0      mr 2003  moved 0
ne 2073        moved 0      lb 1926  moved 0      ta 1910  moved 0
check:goldens: mai  200 rows  3 stale   (every other language fresh)
```

The three mai rows (text windows, IPA differences only):

```
a date  YYYY/MM/DD (Devanagari)       golden had a "bata" inside it   → now none: the date is declined
a date  YYYY/M/D   (Devanagari)       same                             → same
1/1,000,000,000 (Devanagari)          golden: "one bata one , zero"    → now "one, a hundred crore"
```

Under the old guard, the left side did not refuse `/`, so `MM/DD` inside a date matched as a fraction. A grouped
number on the right lost the billion. All three moves are corrections.

Implication: regenerate mai only (`npx tsx tools/gen_parity_goldens.mts mai`). The diff is 3 rows, IPA column
only, text column unchanged. check:goldens is then fresh: 189 languages, 0 stale.

## Run 6 — 2026-10-09 21:50 — Rust (hi), regex corpus, gates

Commands:
- `LANGS=hi npx tsx rust/tools/fn-diff/dump.mts <arm>` for hi-normalize, hi-word, phonemize-sync, phonemize-best and
  phonemize-trace, replayed with `cargo run -p fn-diff`. `probes/hi.txt` gained 9 synthetic fraction probes.
- `npx tsx tools/extract_regexes.mts`, then the C# and Rust regex-diffs.
- `npm run check:goldens`; `npx vitest run` (with `node_modules/.bin/tsx` symlinked to the parent checkout for
  check-goldens-jobs, then removed); `dotnet test` (full); C# parity for hi gu mr ne lb ta mai awa bho mag hne rkt;
  Rust `parity` (all ported); `cargo test --workspace`.

Raw finding:
- fn-diff hi: hi-normalize 3609 identical, 0 DIFFER (golden 132, FLEURS 3306, probe 171); hi-word 43098 / 0;
  phonemize-sync 3609 / 0; phonemize-best 3609 / 0; phonemize-trace 3609 / 0. With the Rust edit reverted:
  hi-normalize probe 7 DIFFER, so the dump sees the change.
- regex corpus: 2,382 patterns. The diff is the old ta and lb patterns replaced, plus the shared Indic pattern line
  dropped, since every user of it moved. C# 145,176 identical / 0 DIFFER / 0 threw; Rust 145,176 / 0 / 0 refused
  / 0 UNSOUND.
- check:goldens fresh (189, 36,495 rows, 0 stale); vitest 349 files, 6,588 passed, 5 skipped; dotnet test 7,249
  passed; C# parity 12 languages, 2,400 rows, 0 differ; Rust parity 10/10 at 200/200; cargo test --workspace all
  ok (90 + 1 in the crate).

Implication: green.

## Run 7 — 2026-10-09 21:55 — the class left for #1495

Command: scratch `letters.mts` (ht ln za uk it) and `sib.mts` (en de es), base engines.

Raw finding: the `\b…\b` family (en fr de es pt ru id) reads into a decimal on both sides. en `1.5/2` →
"one point five halves", `1/2.5` → "one half . five". ht/ln/za refuse a letter only before the fraction:
`1/2abc` reads, `abc1/2` does not. uk and it refuse `/` only after it: `3/1/2` reads `1/2`. None of the five
refuses a decimal on both sides.

Implication: filed as #1495 (generic wording, synthetic probes), not fixed here.
