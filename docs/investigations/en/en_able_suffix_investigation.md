# en: -able/-ible read from the dictionary stem (#1504)

## Run 1 — 2026-10-14 (where the two misreadings come from, and which rule is net positive)

**Question.** `castable` read *kʰˈæsteᶦbəɫ* (sync) and *kʰˈeᶦstəbəɫ* (best). Is there a suffix step to extend?
Which rule is net positive on the dictionary's own -able/-ible words?

**Command.** `<scratchpad>/held.mts <root> <variant>`: every g2p-dict.tsv word matching `^[a-z]{6,}(able|ible)$`
(540 words), each decoded by `createEnglishG2p(...).decompose` with itself hidden from the dict through a
Proxy. Scored exact (ARPABET with stress) and by segments (stress stripped) against the dict row, on main and
on each variant. Then the en/en-GB phonemize-sync and phonemize-best fn-diff dumps (8,320 rows each, FLEURS en_us
plus goldens and probes) on main and on the fix, diffed.

**Raw finding.**
- **The step exists.** `englishG2p.ts` has a `SUFFIXES` table (`morphDecode`: a known suffix plus a dictionary
  stem), but no -able. The suffix in the dict is AH0 B AH0 L: 655 of the -able rows and 123 of the -ible rows.
- **Main:** exact 210/540, segments 257. The sync defect is the COMPOUND path. `able` is in g2p-common.txt, so
  the splitter reads `accept|able` with the full vowel of the word *able* (… T EY2 B AH0 L).
- **V1, suffix rows only:** exact 294, segments 349. But that came about by accident: the whole word decoded as
  one morph "piece" (minLen = n beats every split), so `compoundSplit` returned null. It also let the splitter
  build `in|credible`, `ap|plicable` and `com|patible` from stem+able pieces, with the stress on the first piece
  (42 segment losses).
- **V1 + `able`/`ible` stop pieces:** no change at all. The stop pieces were a dead end, and are dropped.
- **V2, no morph for compound pieces (`DERIVATIONAL_ONLY`), drop a letter only when it is doubled:** exact 205,
  i.e. below main. It closed the accident without replacing it.
- **V3, V2 + the suffix outranks the compound split for a whole -able/-ible word:** exact 318 (+108), segments
  374 (+117). Segment HIT→MISS 15, MISS→HIT 132.
  - The 15 losses are the stem's own dict reading: noun stress for `convert`/`attribute`/`access`, `unwin` the
    surname for `unwinnable`, `practice` → S for `practicable`, the `suggest` G JH row.
  - One loss is the `-le` stem schwa (`recyclable` … K AH0 L AH0 B …). Of the 60 remaining M misses it is the
    only one of that shape, so no rule was added for it.
- **V4, `-iable` tries the ⟨y⟩ stem first:** the held-out score is unchanged (318/374). It fixes `reliable`
  (`reli` is also a dict row, a name, R EH1 L IY0), which the new test caught.
- **The best path.** The neural tagger answers an OOV word before the G2P, and it reads `castable` as caste +
  able. The tagger can't be scored fairly on these words, since it was trained on them. So a new
  `g2p.derived(word)` serves only -able/-ible with a dictionary stem, and the resolver takes it before the
  tagger. After that, sync and best agree on castable/pastable/tasteable.
- **Corpus dumps:** 0 of 8,320 rows change in either path, because every -able word in them is a dictionary
  word. The Rust replay of both dumps, plus a synthetic probe line (`castable … spinnable, washable and
  surfable`), is identical. The goldens are fresh.
- **Tests:** TS `test/english-1504-able.test.ts`, C# `English1504AbleTests` and Rust
  `able_reads_from_the_dictionary_stem` build their expectations from the dict rows (stem phones + AH0 B AH0 L)
  and from sync against best.
  - With the change reverted, TS fails 8/8 and C# 13/13, and Rust fails.
  - With only the resolver reverted, the best-path test fails in TS, and in Rust (`kʰˈeᶦstəbəɫ` against
    `kʰˈæstəbəɫ`). That also shows Rust's best path really reaches the tagger.

**Implication.** Closes #1504. The stem-reading losses belong to the dictionary rows of those stems, not to
this rule.
