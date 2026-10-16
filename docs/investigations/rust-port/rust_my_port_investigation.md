# Rust port: Burmese (my)

The Burmese engine (`src/languages/burmese/`: burmese, numbers, normalize) ported to
`rust/vernacula-phonemizer/src/languages/burmese/`, the third of the "seasia" group. Tracking issue #1463. Import
closure (rust_vi_port_investigation.md Run 0): `clauses` (clauseSink, emitUnclaimed), `trace` (beginToken, endToken,
enterEngine), `loadManifest`, `loadTsv`, `segment` (segmentByDag, loadSegWords), `provenance` — all ported. The
registry hands `createBurmese` the English reader, which the engine stores and never reads (the registry's own
comment says so); embedded Latin goes through the default foreign reader in `emitUnclaimed`. No neural entry, no
Roman policy.

## Run 1 — 2026-10-15 03:55 (first golden gate, and the built patterns by code point)

**Question.** Is the golden byte-identical, and is every pattern normalize.ts builds with `new RegExp` reproduced code
point for code point?

**Command.** `cd rust && cargo run --release -p parity -- my`; `audit.sh burmese burmese`; then a mechanical check of
the 64 runtime-built patterns: `regs.mts` records every `RegExp` the TS constructs while normalize.ts loads and runs
(a Proxy over the global constructor), a temporary `eprintln!` in the Rust `re` closure records the Rust side
(`logregs.sh`, reverted after), and `cmpregs.py` compares the two sets (`source`'s `\/` undone).

**Raw finding.** `my: 200/200 identical, 0 differ`, first build. Audit: 22 raw patterns, 9 `format!` templates not
verbatim (expected), `90 non-ASCII runs, 0 not found`; the invisible-character class keeps its literal U+200B–U+200D,
U+2060, U+FEFF as the TS writes them; `D` keeps its literal `၀-၉`, `DASH` its literal `‐-―−`. Built patterns:
`rust 64, ts 67, rust-only 0, ts-only 3` — the three TS-only entries are regex literals the TS evaluates per call
(the `×` relational, the dotted-initialism rule) and the provenance core's own, not built patterns. TOKEN is built from
`\u{1000}`-style escapes (the TS template literal's `က` evaluates to the character too): code points
`1000 103f 104c 109f a9e0 a9f9 1040 1049`, then `104b 104a` for `။၊`, as the TS. The same check over vi's 8 built
patterns: `rust-only 0`.

## Run 2 — 2026-10-15 04:00 (per-module differentials, and are they sensitive?)

**Command.** New dumps `my-normalize` (normalizeBurmese and the registry's engine via `renderInHost("my", t)` over the
golden, FLEURS my_mm columns 3+4, new `probes/my.txt` and synthetic rows per arm — every unit × rate denominator ×
numeral shape, every dash in every range shape and refusal, ²/³ × every unit, both digit sets; plus the digit token on
0…3,000 and long runs) and `my-g2p` (syllabify serialized, phonemizeWordRules, segment and phonemizeWord over every
Myanmar run of the texts raw and normalized, every dictionary / voicing-lexicon / seg-words key, 4,000 fixed-seed
seg-word concatenations half with a spliced random code point, 3,000 random U+1000–109F strings; numberToWords and
spellDigits).

**Raw finding.**
```
my-normalize: 12693 identical, 0 DIFFER   (probe 48, synthetic 1220, number 3513, the rest golden/fleurs)
my-g2p:       146526 identical, 0 DIFFER
```
Haystack (FLEURS my_mm, 3,943 unique lines): ASCII digit 293, Myanmar digit 528, grouped number 42, `:` 29, `%` 8,
`°` 6, `/` 27, a dash 121, an invisible character 8, Latin 681, a unit abbreviation 37, a currency sign 13, a relational
sign 4, dotted initials 12, the stacker ္ 1,234; `&` and Myanmar Extended-B 0.

**Is the replay sensitive?** First attempt was a DEAD END: the clock quantifier `{1,2}` → `{1,3}` and the segmenter's
body comparison `==` → equal LENGTH both replayed 0 DIFFER. The clock break is invisible by construction (on `123:45`
the TS matches `23:45` and leaves the `1` in front, so the rewritten text is the same string either way), and no input
distinguishes an equal-length body change. Second attempt: the range rule's `ထိ` refusal dropped, and the minor
syllable needing two more characters: `my-g2p: 144601 identical, 1925 DIFFER`, `my-normalize: 12425 identical, 268
DIFFER`. And the partial-cover guard disabled outright (always split): `142608 / 3918 DIFFER`, `10965 / 1728 DIFFER`,
so the guard is exercised. All reverted: 146526/0 and 12693/0.

## Run 3 — 2026-10-15 04:08 (end to end, the trace, provenance, the TS suite)

**Command.** `LANGS=my … phonemize-sync | phonemize-best | phonemize-trace | trace`; `npx tsx
tools/provenance-poison.mts my`; `pins.mts` on test/burmese.test.ts (extended to carry a string-array result, joined by
U+0001, so `segment` pins are kept rather than skipped).

**Raw finding.** `phonemize-sync 3980/0`, `phonemize-best 3980/0`, `phonemize-trace 3980/0`, `trace 3980/0`. The
engine's own token loop reports to the trace explicitly (enterEngine, beginToken/endToken, the gap pass), and the
trace replays exactly. provenance-poison: `distinct poison sites: 0`. TS suite: first run `83 pinned, 5 skipped`
(the `segment` arrays); after the extension `88 pinned, 0 skipped; expects evaluated: 77, failures: 0` (30
normalizeBurmese, 27 phonemize, 26 phonemizeWord, 5 segment). `cargo test burmese`: 2 passed.

## Run 4 — 2026-10-15 04:12 (reading for correctness: TS findings)

**Command.** `npx tsx <scratch>/t.mts my …` and `t2.mts` (normalizeBurmese) on synthetic and FLEURS-shaped input;
`grep -cP "[0-9၀-၉]:[0-9၀-၉]{2}\s*နာရီ"` over FLEURS my_mm. Rust reproduces each one.

**Raw finding.**
1. **A clock followed by the hour word says the hour word twice** (normalize.ts step 3). The rule emits `H နာရီ MM
   မိနစ်` and leaves a following `နာရီ` in place: `မနက် ၉:၃၀ နာရီ` → `မနက် ၉ နာရီ ၃၀ မိနစ် နာရီ`, `12:00 နာရီ` →
   `12 နာရီ 00 မိနစ် နာရီ`, `8:46 နာရီတိတိ` likewise. **6 FLEURS my_mm lines** have the shape. (vi's clock consumes
   its trailing `giờ` for exactly this reason.)
2. **Zero minutes are spoken**: `12:00` → `12 နာရီ 00 မိနစ်`, read "twelve hours zero minutes".
3. **The clock has no left guard and no range check**: `123:45` → `123 နာရီ 45 မိနစ်` (the match is `23:45`, the `1`
   stays in front and joins it), `99:99` → 99 hours 99 minutes, and a score `ဂိုး 3:21` is read as a time. FLEURS's
   ratios (`၂:၂`, `၃:၂`) have one minute digit and are refused already.
4. Not a defect, checked: Shan digits (U+1090–1099) sit inside TOKEN's letter class, but the registry's native-digit
   fold turns them into ASCII first (`႑႒` reads as 12, the same as `၁၂`).

**Implication.** Items 1–3 reported in the PR, not fixed (TS first).

## Run 5 — 2026-10-15 20:40 (#1589 fixes, TS first, mirrored to C# and Rust)

**Finding.** All three fixed in the clock rule: a following `\s*နာရီ` is consumed (a glued next word, `နာရီတိတိ`,
gets its space back), `:00` emits the hour alone, and a left digit guard plus hour ≤ 24, minute ≤ 59 refuses
`123:45` and `99:99`, which now fall through untouched. A score `ဂိုး 3:21` is still in range and still read as a
time; not in the issue, recorded. Golden my: 0 rows changed.

**Test.** `test/sea-defects-1589.test.ts`, `SeaDefects1589Tests.cs`, and `defects_1589_tests` in the language's own Rust
module; relational, no typed IPA. Each fails with its fix reverted.
