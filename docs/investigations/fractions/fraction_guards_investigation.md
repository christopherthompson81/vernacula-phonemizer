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

---

# #1495 — the `\b…\b` family, and the letter-side and `/` asymmetries (base 6330c01a)

The guards, per separator convention (each side refuses a digit or `/` as well):

```
en      (?<![\d/]|\d\.|\d,(?=\d{3}\/))\b(\d{1,3})\/(\d{1,3})\b(?!\s*[\/\d]|\.\d|,\d{3}(?!\d))
de es pt ru id
        (?<![\d/]|\d\.|(?<![\d/])\d+,)\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d]|\.\d|,\d+(?![\d/]))
fr      the same, keeping its own `(?!\s*\/?\d)`
it uk   the same without `\b`; uk keeps its \p{L} on both sides and gains `/` on the left
ht ln   (?<![\d\p{L}\p{M}/]|L_DEC)(\d{1,3})\/(\d{1,3})(?![\d/\p{L}\p{M}]|R_DEC)      (comma-decimal arms)
za      the en arms (`.` decimal, `,`+3 thousands), letters on both sides
```

In the comma-decimal languages, `,` with a digit beyond it is the DECIMAL. The exception is a `,` that sits
BETWEEN TWO FRACTIONS, where the digits after it run into a `/` (right side), or the digits before it follow a
`/` (left side). That `,` is a list separator, so `1/2,3/4` reads both fractions. Judgment, recorded: an
unspaced `1/2,3/4` could also be parsed as `1/2.3/4`. That parse is nonsense, though, and the reading a news
anchor would give is two fractions. The first version of the guard declined it (Run 9).

## Run 8 — 2026-10-09 22:05 — repro on the unfixed engines

Command: scratch `seps.mts en fr de es pt ru id ht ln za uk it`. It prints how each engine reads the bare
separators (`2.5`, `2,5`, `1,000`, `1.000`, `1 000`), then a synthetic fraction probe set.

Question: which separators does each engine treat as numeric? And where does the fraction read into one?

Raw finding (selected):

```
separators: en `.` decimal, `,` thousands · de/es/pt/id/it `,` decimal, `.` thousands (es, pt and ru also read `.` as a
            decimal) · fr/ru `,` and `.` both decimal, space thousands · ht/ln both numeric · za `.` decimal, `,` thousands
en  1.5/2   wˈʌn pʰɔᶦnt fˈaᶦv hˈævz          "one point five halves"
en  1/2.5   wˈʌn hˈæf . fˈaᶦv
en  3/1/2   θɹˈiː wˈʌn hˈæf                   `/` not refused on the left
de  1,5/2   aɪ̯ns , fʏnf hˈalbə                the decimal's tail read as five halves
es  1/2.5   un mˈeðjo , θˈinko
ru  1/1,000 ɐdnˈa pʲˈervəjə , nolʲ
it  1,5/2   ˈuno virɡˈola t͡ʃˈinkwe mˈet͡st͡si
ht  1/2abc  jɔ̃ dezjɛmabk                      read, fused to the next word
ht  1/2.5   jɔ̃ dezjɛm viɡil sɛ̃k
za  1/2abc  reads; abc1/2 declines
uk  3/1/2   trɪ ɔdna druɦa
```

Implication: the same mirror applies everywhere, with each language's own separators. Every `\b` rule also
needs `/` on the left.

## Run 9 — 2026-10-09 22:15 — first fix, and the list-comma judgment

Command: the guards above, but with the comma arm a plain `[.,]\d` on both sides. Then `seps.mts` again, diffed.

Raw finding: every decimal and group case declines (`1.5/2` → en "one point five two"; de `1,5/2` → "eins
Komma fünf zwei"). But `1/2,3/4` also declined in every comma-decimal language: de read "eins zwei Komma drei
vier". Before, it read both fractions. ht and ln still read `1/2.5` as a fraction followed by the decimal tail.

Implication: (a) that is a regression, not a decline. A list comma between two fractions is not a decimal, so
the arm becomes `,\d+(?![\d/])` on the right, mirrored as `(?<![\d/])\d+,` on the left. (b) ht and ln have the
lb/ta ordering defect (Run 10).

## Run 10 — 2026-10-09 22:20 — ht and ln rewrite decimals before the fraction

Command: read the step order in `haitian/normalize.ts` and `lingala/normalize.ts`.

Raw finding: in both files step 10 DECIMALS comes before step 11 FRACTIONS. ht turns `2.5` into `2 vigil 5`, and
ln turns it into `2 5`, and both decimal patterns accept a `/` next to them. So the fraction guard never sees the
separator. za already runs fractions (9) before decimals (10).

Implication: move FRACTIONS to 9b in ht and ln, in TS and C#. With only the guard mirrored, 5 ht/ln tests fail
(Run 12), so the reorder is needed.

## Run 11 — 2026-10-09 22:25 — after the fix, and rows moved

Commands: `seps.mts` diffed against Run 8. Scratch `measure2.mts` over each language's golden plus FLEURS
(en_us, fr_fr, de_de, es_419, pt_br, ru_ru, id_id, ln_cd, uk_ua, it_it; ht and za have golden only), at base and
fixed, compared with `cmp.py`. Then `npm run check:goldens` for the whole fleet.

Raw finding:

```
en 1/2.5 → wˈʌn tʰˈuː pʰɔᶦnt fˈaᶦv   1.5/2 → wˈʌn pʰɔᶦnt fˈaᶦv tʰˈuː   3/1/2 → θɹˈiː wˈʌn tʰˈuː
de 1,5/2 → aɪ̯ns kˈɔma fʏnf t͡svaɪ̯   1/1.000 → aɪ̯ns ˈaɪ̯ntaʊ̯zənt
ru 1/2,5 → ɐdʲˈin dva t͡sˈɛɫɨx pʲætʲ
ht 1/2.5 → ɛ̃ de viɡil sɛ̃k   1/2abc → ɛ̃ de abk   1/2,3/4 → jɔ̃ dezjɛm , twa katɣijɛm (was "... vigil twa ...")
1/2,3/4: unchanged (both read) in en fr de es pt ru id uk it za
rows moved: en 0/1977 fr 0/2013 de 0/1968 es 0/1948 pt 0/1947 ru 0/1976 id 0/1938 ht 0/200 ln 0/1921
            za 0/200 uk 0/1946 it 0/1982
check:goldens: 189 languages, 0 stale
```

The corpus holds at most two digit/digit texts per language, and none has the affected shapes.

Implication: no golden is regenerated. The fix is defensive, for input the corpus does not contain.

Left as found: ln `1/2,3/4` reads both fractions but loses the pause between them, because the fraction's output
digits (`1 ya 2,3 ya 4`) go back through the decimal step. It read the same before. The test pins only ln's
full-stop case.

## Run 12 — 2026-10-09 22:30 — tests fail on revert

Commands: `npx vitest run test/fraction-guards-1495.test.ts`; `dotnet test --filter FractionGuards1495Tests`;
`cargo test fraction_guards_are_mirrors_in`. Each was run fixed, and again with the engines checked out at base.
Then TS with the ht/ln guard mirrored but the rule order unchanged.

Raw finding: fixed: TS 102/102, C# 102/102, Rust 1/1. Reverted: TS 61 failed / 41 passed; C# 61 / 41; Rust
fails, at `it 1/2,5` once Italian joined the test. `1/2.5` fails in all 12 languages. Guard-only ht/ln: 5 failed
(`1/2,5`, `1/2.5` in both, and ht `1/2,3/4`).

Implication: the tests witness the guard and the reorder.

## Run 13 — 2026-10-09 22:40 — Rust, regex corpus, gates

Rust mirrors en, es, pt, fr and it. Italian is ported too: Rust parity lists it, so it is included.

Commands:
- `LANGS=en,en-GB,es,pt,pt-BR,fr npx tsx rust/tools/fn-diff/dump.mts <arm>` for normalize, initialisms,
  english-pre, english-gb-pre, es-normalize, pt-normalize, fr-normalize, phonemize-sync, phonemize-best and
  phonemize-trace, and `LANGS=it` for it-normalize and the three phonemize arms. All replayed with `fn-diff`.
  The probe files en-normalize, es, pt, pt-BR, fr and it gained 10 synthetic fraction lines each.
- `tools/extract_regexes.mts`, then the C# and Rust regex-diffs.
- `check:goldens`; `vitest` (with the tsx symlink, which was removed afterwards); `dotnet test` (full); C# parity
  for the 12 languages plus en-GB, en-IN, fr-CA, es-419 and pt-BR; Rust `parity`; `cargo test --workspace`.

Raw finding:
- fn-diff: normalize 4160/0, initialisms 4160/0, english-pre 4160/0, english-gb-pre 4160/0, es-normalize 11874/0,
  pt-normalize 11973/0, fr-normalize 12165/0, it-normalize 12123/0, it phonemize-sync/best/trace 4041/0.
  The six-language phonemize-sync, -best and -trace arms: 24,303 identical, 8 DIFFER. All 8 are probe rows with
  embedded Greek or Cyrillic (`loɣos`, `mɐskvˈa`, `vɫɐdʲˈimʲɪr`), which the Rust port drops because el and ru are
  not ported. None contains a fraction. With the Rust edits reverted: en normalize 5 DIFFER, fr-normalize 6,
  it-normalize 12, so the dumps do see the change.
- regex corpus: 2,387 patterns, 8 added / 7 removed. C# 144,898 identical, 0 DIFFER, 0 threw. Rust 144,898, 0 DIFFER,
  0 refused, 0 UNSOUND.
- check:goldens fresh (189 languages, 0 stale); vitest 354 files, 6,805 passed, 5 skipped; dotnet test 7,479 passed;
  C# parity 17 languages, 3,400 rows, 0 differ; Rust parity 10/10 at 200/200; cargo test --workspace ok (101 + 1).
  `cargo fmt --check` flags only lines already unformatted on main (core/unicode.rs and the pt files), none of them
  in this diff.

Implication: green. #1495 is closed by this branch.
