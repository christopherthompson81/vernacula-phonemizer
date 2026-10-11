# Rust port: Latvian (lv)

`latvian/{manifest,g2p,numbers,ordinals,normalize,latvian}.ts`. The g2p scans written palatals and length
directly, reads native ⟨o⟩ as [uɔ̯], takes ⟨i⟩/⟨u⟩ after the real falling pairs as an offglide, ⟨ie⟩ as [iɛ],
⟨v⟩ as [w] before a non-vowel, then n → ŋ before a velar and regressive devoicing only; stress is fixed on the
first nucleus. ordinals.ts composes the masculine definite ordinal in the case its HEAD noun is written in
(`HEAD_NOUN`, generated from two declensions plus the plural of `gads`/`gadsimts`). normalize.ts:
de-grouping, the dotted abbreviations (with the sentence period restored), the ordinal range and period, ranges,
the shared symbol tier (`compound` exponents, a bare-exponent template, an empty `unitPer`), degrees, signs, the
decimal comma. No neural entry, no Roman policy. Core imports: `clauses`, `hostWord`, `latinPhones`, `numbers`
(`digitIndex`), `normalizeSymbols`, `provenance`, `loadManifest`: all ported; NO core module is added.

## Run 1 — 2026-10-11 11:50 (port, golden)

**Question.** With the six modules ported and `lv` registered, what does the golden say?

**Command.** `cd rust && cargo build --release && ./target/release/parity lv`.

**Raw finding.** First build compiled clean; `lv: 200/200 identical, 0 differ`.

## Run 2 — 2026-10-11 12:05 (per-module differentials, pins, every gate on the group's final tree)

**Question.** Do the normalizer, the ordinal compositor, the g2p and the compositor match beyond the golden; and
are all gates green with the whole group registered?

**Command.** New dump entries `lv-normalize` (normalize, and `ordinalWords` over −1..2100 and corners × the nine
cases), `lv-g2p`, `lv-numbers`, replayed by one `fn-diff` arm; `LANGS=lv phonemize-sync` / `phonemize-best` /
`trace`; new synthetic `probes/lv.txt` (23 lines). Synthetic rows: `N.` and `N.–1550.` before every HEAD_NOUN
form plus a non-head word and `constructor` over 16 numbers; 26 unit/currency/degree/page suffixes; the
abbreviations before 4 followers; 18 sign shapes. Then the whole group's gates: `cargo fmt --check`, `cargo
clippy --workspace --release --all-targets`, `cargo test --release --workspace`, `cargo run --release -p
regex-diff`, `./target/release/parity` (all 26), and `LANGS=<the 20 earlier languages> phonemize-sync` replayed
with the six new engines registered.

**Raw finding.**
```
lv-normalize:   25672 identical, 0 DIFFER  (golden 132 / fleurs 3411 / probe 23 / synthetic 3134 / numeric 18972)
lv-g2p:         64875 identical, 0 DIFFER
lv-numbers:     26076 identical, 0 DIFFER
phonemize-sync:  3566 identical, 0 DIFFER
phonemize-best:  3566 identical, 0 DIFFER
trace:           3566 identical, 0 DIFFER
pins: test/latvian.test.ts 67 extracted, 14 skipped
parity: all 26 languages 200/200 identical, 0 differ
earlier 20 languages, phonemize-sync: 77341 identical, 1 DIFFER — the Lao run inside a Thai probe
  (`ไทยລາວไทย`, lo not ported), the same row the uk and sv logs record; nothing the group moves
regex-diff: 144898 probe results identical, 0 DIFFER, 0 patterns refused
cargo test --release --workspace: 141 + 1 passed; cargo fmt --check clean
clippy: one `manual_is_multiple_of` in ordinals.rs (fixed), then only module_inception on the six new modules
```
No TS regex was added or changed, so `csharp/regex-corpus.jsonl` needs no re-extraction. The 90 MB
cross-language dump was deleted after the replay.

**JS semantics reproduced on purpose.** `HEAD_NOUN[next.toLowerCase()]` is a plain-object lookup, so
`constructor` reads the inherited function, `ENDING[c]` misses, and the template appends the literal:
`Viņš bija 3. constructor.` → `Viņš bija trešundefined constructor.` (TS). `HeadCase::Proto` in Rust.
`HEAD_NOUN`'s spread order is kept with `IndexMap::insert` (a repeated key keeps its first position).

## Run 3 — 2026-10-11 12:10 (TS findings from reading; reported, not fixed)

**Command.** `npx tsx .probe/lv/check.mts <text>`; synthetic inputs.

**Raw finding (TS output, verbatim):**
1. **`constructor` after an ordinal period**: `Viņš bija 3. constructor.` → `trešundefined constructor` (above).
   A `Map` or `Object.hasOwn` fixes it.
2. **There is no clock rule**: `Pulksten 10:30 sākās.` is unchanged and reads `dˈɛsmit , trˈiːsdɛsmit` (the
   colon is a pause).
3. **A spaced score reads as a descending range**: `5 - 3` → `5 līdz 3` (the range rule has no ascending test).

The masculine-default `divi` before a feminine noun (`2 māsas` → *divi*) is the stated limit in numbers.ts,
not a finding. Every manifest field is read; nothing routes to an unported engine (no port-pending row).

**Implication.** Reported in the PR; Rust reproduces the TS.
