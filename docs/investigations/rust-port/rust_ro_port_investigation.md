# Rust port: Romanian (`ro`)

Branch `worktree-agent-ab430eb42060893ad` (last of the group es-419, fr-CA, en-IN, ca, gl, ro). Part of #1463.
Method as rust_ca_port_investigation.md. The group's closing gates are recorded here (Run 6).

## Run 1 — 2026-10-11 02:15 (the import closure)

**Question.** What does `src/languages/romanian/` need that the Rust core lacks? Neural entry? Roman policy?

**Command.** Read romanian.ts, normalize.ts, romanOrdinals.ts and their imports; `grep -n '\bro\b' src/registry.ts
src/neuralRegistry.ts`.

**Raw finding.** Three modules. romanian.ts holds the manifest load, the g2p scan, final-i, stress (rule + an
OPTIONAL mined lexicon `romanian-stress.tsv`, values kept only when `Number(v)` is an integer ≥ 1), the
gender-agreeing cardinal compositor `numberWords(n, { stem })` and `text()` — ported as ONE file, as the TS has it.
normalize.ts needs only `makeBareUnitNormalizer` (ported: `core::normalize_symbols::make_bare_unit_normalizer`) and
`rewrite`; there is no full symbol tier. The `UNITS` table is used two ways off each regex's SOURCE: the bare-unit
key is read out of it with `/\\b([a-z]+)\\b$/u`, and the digit rule rebuilds it with `\b` stripped and flags `gu`
(the literals' own `giu` never applies) — the Rust keeps the sources verbatim and derives both the same way rather
than hand-writing the keys. `ROMAN_POLICIES` names `ro` (the `al …-lea` ordinal, `exclude: ROMAN_EXCLUSIONS.ro` =
`vii`). No neural entry. The scan walks CODE POINTS (`[...word]`); `stressFromEnd` reads code UNITS.

**Implication.** No new core module: normalize → romanian → roman_ordinals.

## Run 2 — 2026-10-11 02:35 (golden gate)

**Command.** `cargo run --release -p parity -- ro`.

**Raw finding.** `ro: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-11 02:45 (differentials)

**Commands.** `.probe/bin/dd.sh ro ro ro-normalize ro-g2p ro-numbers phonemize-sync phonemize-best trace`
(`FLEURS_ROOT=<external-drive>/…`). New dumps:
- `ro-normalize`: `normalizeRomanian` over the golden (110), FLEURS ro_ro columns 3+4 (3,819) and the new synthetic
  `probes/ro.txt`.
- `ro-g2p`: `phonemizeWord` (lexicon stress), `phonemizeWordRules` (rule stress) and `nat` over every stress-lexicon
  key (3,7xx), every letter run (as written, lowercased, nativised), every 1–3 letter string over the 31 Romanian
  letters, every 4-letter string over `aeiouăcghxqlrt`, and 21 edge strings (cedilla ş/ţ, `İași`, `ſat`, astral …).
- `ro-numbers`: `numberWords` (cardinal and `stem`) and the Roman ordinal over 0…20,000, the k·10³/10⁶/10⁹
  strides, powers of ten to 10²¹ and −1/−0/NaN/∞/2⁵³. **No fractional n** — a dead end noted rather than ported:
  `numberWords(1.5)` indexes `NUM.units[1.5]` (undefined, then `join` writes it as ""), and no caller can pass a
  fraction (`text()` passes `Number(/\d+/)` or a single digit; the Roman pass passes an integer), so the dump
  omits it instead of the Rust emulating an undefined slot nothing reaches.

**Raw finding.**
```
ro-normalize: 3948 identical, 0 DIFFER
ro-g2p: 257019 identical, 0 DIFFER
ro-numbers: 81162 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 3948 identical, 0 DIFFER each (best == sync: no neural tier)
```
Per-arm reach (`.probe/bin/arms.mts`; golden 110 / FLEURS 3,819 / probe 19): corpus-reached — dot thousands 3/35/1,
space thousands 0/8/1, decimal comma 3/25/1, clock 3/31/1, percent 1/15/1, `°C` 0/2/1, bare `°` 0/4/1, `km/h`
0/16/1, `m/s` 0/2/1, ranges 2/35/1. PROBES ONLY: `℃`/`℉`, `°F`, the glued sign, `+` between numbers, `&`, and the
relational signs (`±≈≤≥=<>×÷`, not literal-parsed by the arm counter but on probe line 13).

Mutation (then reverted): the muta-cum-liquida onglide guard dropped → `ro-g2p: 256701 identical, 318 DIFFER`,
`phonemize-sync: 3793 identical, 155 DIFFER`.

## Run 4 — 2026-10-11 02:55 (reading for correctness; TS findings, reported not fixed)

**Command.** `npx tsx .probe/ro/findings.mts`.

**Raw finding (TS, verbatim).**
1. **The module docstring says stress is "DEFERRED (no ˈ emitted)", and the code emits it.** romanian.ts's header:
   "Stress is UNWRITTEN … so it is DEFERRED (no ˈ emitted)"; `phonemizeCore` places `ˈ` on every word with a nucleus
   (`Casa e mare.` → `kaˈsa ˈje ˈmare .`), via `stressFromEnd` and the 3.7k-row stress lexicon the same file loads.
   A code/doc gap (PORTING.md question 1); the behaviour is the measured one, the comment is stale.
2. **The ordinal of a count of exactly 1000 takes the SINGULAR stem.** `magnitudeGroup` returns the bare `sg` in stem
   mode for a count of 1, so `romanianOrdinal(1000) = al mielea` while `2000 → al două miilea` (the plural stem the
   ordinal is built on); `1001 → al mie unulea`, `1100 → al mie sutălea`. Reached by `secolul M` / `mileniul M`
   (`ˈal mjeˈle̯a`). FLEURS ro_ro: no such numeral.
3. (by design, noted in the TS) `secolul al XIX-lea` keeps the cardinal (the KNOWN GAP in romanOrdinals.ts).

**Implication.** Findings 1–2 go in the PR body; the finding-2 line is appended to `probes/ro.txt`.

## Run 5 — 2026-10-11 03:00 (TS test pins)

**Command.** `.probe/bin/extract_pins.py test/romanian.test.ts {word | call:ro | text ro | call:normalizeRomanian |
call:ord}` → a `#[cfg(test)]` module (in normalize.rs, beside the normalize pins); `cargo test --release romanian`;
dumps re-run.

**Raw finding.** 20 word + 13 `ro(…)` + 3 `phonemize` + 17 normalize + 10 ordinal pins, plus the policy's trigger
and `vii` assertions: `2 passed`. Re-run: `ro-normalize 3949 / ro-g2p 257025 / phonemize-sync 3949 / phonemize-best
3949 / trace 3949 identical, 0 DIFFER`.

## Run 6 — 2026-10-11 03:15 (the group's gates)

**Commands.** `cargo clippy --workspace --release` filtered to the group's files; then `cargo fmt`, the saved dumps
of all six languages replayed (`.probe/bin/replay_all.sh`) plus the `symbols` dump (`SYMBOLS_LANGS=ca,gl,ro`);
`cargo test --release --workspace`; `cargo run --release -p regex-diff`; `cargo fmt --check`;
`cargo run --release -p parity`; a port-pending probe (`.probe/extra.mts`: one synthetic sentence per host per
foreign script — Cyrillic, Greek, Han, Hangul, Hebrew, Arabic, Devanagari, Thai, kana).

**Raw finding.**
- clippy, first pass, in the new files: 9 `collapsible_if` (ca 5, gl 2, ro 2) and 3 `type_complexity` (the
  `IS_UNREADABLE` statics of ca/gl, ro's `BARE_UNITS`). Fixed as let-chains and two type aliases. ⚠ The aliases were
  first inserted ABOVE the statics' doc comments, orphaning them; moved back before the commit. After: only
  `module_inception` in each new `mod.rs`, as every language has; `registry.rs` collapsible_if and fn-diff's
  `main.rs:651` predate this branch.
- replay after the cleanups: every dump of the six languages `0 DIFFER` (es419-word 23425, frca-word 104103, enin
  176678, ca-g2p 487280, ca-normalize 22403, ca-numbers 52125, gl-g2p 394092, gl-normalize 18796, gl-numbers 28066,
  ro-g2p 257025, ro-normalize 3949, ro-numbers 81162, and phonemize-sync/best/trace for each); `symbols: 10383
  identical, 0 DIFFER` (catalan 3683, galician 3628).
- `cargo test --release --workspace`: 141 passed, 0 failed (+1 doc-test crate).
- `regex-diff`: 144898 probe results identical, 0 DIFFER, 0 patterns refused. No TS regex was added (TS sources
  untouched), so the corpus is not regenerated.
- `cargo fmt --check`: clean.
- parity: all 26 registered languages 200/200, 0 differ.
- port-pending: `phonemize-sync: 42 identical, 12 DIFFER` — exactly the Hebrew and Arabic runs in each of the six
  hosts (he, ar not ported); the other seven scripts route to ported engines and match. No golden or FLEURS row
  needs an unported engine.

**Implication.** The group is done on this machine.
