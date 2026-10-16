# Rust port: Sundanese (su)

The Sundanese engine (`src/languages/sundanese/`: sundanese, sundaAksara, normalize) ported to
`rust/vernacula-phonemizer/src/languages/sundanese/` (sundaAksara.ts → `sunda_aksara.rs`), the fifth of the "seasia"
group. Tracking issue #1463. Import closure (rust_vi_port_investigation.md Run 0): `clauses`, `hostWord`,
`loadManifest`, `normalizeSymbols`, `provenance`, all ported; nothing from the Indonesian, Malay or Javanese engines.
No foreign reader, no neural entry, no Roman policy. ⚠ No FLEURS transcript exists for su: the golden (110 distinct
texts) and the synthetic probes are the whole haystack.

## Run 1 — 2026-10-15 04:47 (first golden gate, and an editor rewrite caught)

**Question.** Is the golden byte-identical, and did any literal change code points on the way into the file?

**Command.** `cd rust && cargo run --release -p parity -- su`; `audit.sh sundanese sundanese`. The seven Aksara tables
and the four normalize.ts tables were GENERATED from the TS object literals (`gen_tables.sh` → `literal.mts`) and
spliced into the files by a script, as was the symbol tier's JSON (`symdata.mts`).

**Raw finding.** `su: 200/200 identical, 0 differ`, first build. But the audit:
```
MISS normalize.rs:90: (?<![\d.,])([1-9]\d{0,2}(?:[    ]\d{3})+)(?!\d)
MISS normalize.rs:93: [    ]
MISS normalize.rs:90: '\xa0  ' [U+00A0 U+202F U+2009]
```
The TS writes the space class as ESCAPES (`[    ]`); the file as written held the three LITERAL
characters — the editing tool's escape→character rewrite, in both the grouping pattern and its inner replace. The
golden passed anyway (the two forms are the same class to the regex engine), which is exactly why only a code-point
audit sees it. Restored with `fix_esc.py` (a byte-level replace back to `   `); after:
`30 raw patterns, 2 not found verbatim` (the symbol JSON and the TOKEN `format!` template), `117 non-ASCII runs,
0 not found`. Then every pattern a su run compiles (`allregs.sh`, 73) against the TS's constructed patterns plus the
corpus: the 14 Rust-only entries are all core/tier patterns this port did not write (the same set the jv check
listed); none is a sundanese pattern.

**Implication.** The audit has to run after every write, not only once: the golden cannot see this class of change.

## Run 2 — 2026-10-15 04:52 (per-module differentials, and are they sensitive?)

**Command.** New dumps `su-normalize` (normalizeSundanese, normalizeSundaDigits, the recorded symbol tier and the
registry's engine via `renderInHost("su", t)` over the golden, new `probes/su.txt` and synthetic rows per arm; the
number path on 0…3,000, magnitudes to 10²², 2⁵³ ± 1, Aksara digits) and `su-g2p` (phonemizeWord and the nativiser over
every letter run as written/lower/UPPER, every 1–3 letter string, every 4-letter string over a context set, every
Aksara onset × medial × vowel sign × final, 4,000 fixed-seed U+1B80–U+1BBF strings; `isAksaraSunda|aksaraToLatin` over
the Aksara items).

**Raw finding.**
```
su-normalize: 9372 identical, 0 DIFFER   (synthetic 1242, number 3461, tier 4009, golden/probe)
su-g2p:       137906 identical, 0 DIFFER
```
**Is the replay sensitive?** First attempt: glottal insertion barred at index 1, and the school-year rule wanting
`+2`. The g2p break replayed 0 DIFFER — a DEAD END, not a blind spot: a word-initial vowel always has ʔ prepended
first, so `segs[0]` is never a vowel and the index-1 hiatus case cannot occur; the mutation was equivalent. The
school-year break: `su-normalize: 9364 identical, 8 DIFFER`. Second g2p break, the schwa-penult stress shift keyed on
ɨ instead of ə: `su-g2p: 134864 identical, 3042 DIFFER`. All reverted: 137906/0 and 9372/0.

## Run 3 — 2026-10-15 04:55 (end to end, the trace, the tier, provenance, the TS suite)

**Command.** `LANGS=su … phonemize-sync | phonemize-best | phonemize-trace | trace`, `SYMBOLS_LANGS=su … symbols`,
`npx tsx tools/provenance-poison.mts su`, `pins.mts` on test/sundanese.test.ts.

**Raw finding.** `phonemize-sync 220/0`, `phonemize-best 220/0`, `phonemize-trace 220/0`, `trace 220/0` (golden +
probes only: no corpus), `symbols 3272/0` (sundanese tier 200). provenance-poison: `distinct poison sites: 0`. TS
suite: `59 pinned, 1 skipped` (the skipped call is `getPhonemizer("su")` itself, which returns an object; its five
`.text` calls are pinned and replayed through `phonemize`), `expects evaluated: 60, failures: 0`. `cargo test
sundanese`: 2 passed.

## Run 4 — 2026-10-15 04:58 (reading for correctness: TS findings)

**Command.** `npx tsx <scratch>/t.mts su …` on synthetic input. Rust reproduces each reading.

**Raw finding.**
1. **A decimal with three or more fractional digits reads with a pause in the middle** (normalize.ts). The decimal
   rule takes one or two fractional digits and grouping takes exactly three after a `[1-9]` lead, so `3.14159` reads
   *tˈilu . ʔˈopat bəlˈas rəbˈu …* (three, SENTENCE PAUSE, fourteen thousand …) and `0,001` reads *ʔənˈol , hˈid͡ʒi*
   (zero, comma pause, one): the value is destroyed and a clause boundary invented. 36 golden texts have a
   `d[.,]ddd…` shape, but all of them are grouping; no corpus to count the decimal case in.
2. **No number word above yuta (10⁶)**: `1000000000` reads *sarəbˈu jˈuta* ("a thousand million") and 10¹³ *sapˈuluh
   jˈuta jˈuta*, while the same engine's symbol tier lists `milyar`/`miliar`/`triliun` as magnitudes. Whether the
   compositor should say them is a sourcing question, not settled here.

**Implication.** Reported in the PR, not fixed (TS first).

## Run 5 — 2026-10-15 20:40 (#1589 fixes, TS first, mirrored to C# and Rust)

**Finding.** Item 1: the decimal rule takes `\d+` fractional digits. Step 1 has already spent every exact
three-digit group, and over the mined corpus all 5 remaining 3+-digit shapes are decimals (`1.6726231 × 10⁻²⁷ kg`,
`0.9998 g/cm³`, `13,1313`, a coordinate, `0.917`); no DOI occurs.

Item 2: miliar (10⁹) and triliun (10¹²) added to `sundanese.jsonc` and the compositor. The corpus attests the exact
composition: `sapuluh juta nepi ka samiliar ($10^7$ nepi ka $10^9$)` (sa- on a leading 1), `Rp 13,1 miliar`,
`sapuluh triliun`; miliar ×6 against milyar ×3. Golden su: 0 rows changed.

⚠ Proof note: reverting `sundanese.rs` to main also deleted the test module that lives in it, so a whole-file
revert "passed" vacuously. Each fix was re-proved by disabling it in place.

**Test.** `test/sea-defects-1589.test.ts`, `SeaDefects1589Tests.cs`, and `defects_1589_tests` in the language's own Rust
module; relational, no typed IPA. Each fails with its fix reverted.
