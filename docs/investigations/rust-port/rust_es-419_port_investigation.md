# Rust port: Latin-American Spanish (`es-419`)

Branch `worktree-agent-ab430eb42060893ad`, from main f04b471e. Part of #1463, first of a group (es-419, fr-CA,
en-IN, ca, gl, ro). Method as the earlier ports (rust_sv_port_investigation.md): per-module `fn-diff`
differentials, then the public entry end to end, then the golden gate.

## Run 1 — 2026-10-10 22:40 (the import closure)

**Question.** What does `src/languages/spanish-419/` need beyond the ported `es` engine, and does it have a neural
entry or a Roman policy?

**Command.** Read spanish-419.ts and romanOrdinals.ts; `grep -n es-419 src/registry.ts src/neuralRegistry.ts`;
`grep -rn es-419 rust/vernacula-phonemizer/src`.

**Raw finding.** Two modules. `spanish-419.ts` is `createSpanish(true)` plus `toLatinAmerican` (`/θ/gu → s`, `/ʎ/gu → ʝ`)
on the whole output, with `noteRewrite("accent:es-419", pre, out, true)` — a POSITIONAL claim (both
substitutions are one code unit for one). `romanOrdinals.ts` re-exports es's `ROMAN_POLICY`. `ROMAN_POLICIES`
names `es-419`; `neuralRegistry.ts` does not, so the best path is the sync path. The Rust core already knows the
code (`scripts.rs` host scripts). `create_spanish(americas)` and `spanish::phonemize_word` are ported (es port).

**Implication.** No new core module. `languages/spanish_419/{spanish_419,roman_ordinals}.rs`, the roman module a
`pub use` of es's so the two cannot drift (the TS test pins identity).

## Run 2 — 2026-10-10 22:45 (golden gate)

**Command.** `cd rust && cargo run --release -p parity -- es-419 es`.

**Raw finding.** `es-419: 200/200 identical, 0 differ`; `es: 200/200`. First build.

## Run 3 — 2026-10-10 22:55 (differentials)

**Commands.** `.probe/bin/dd.sh` (TS dump, then Rust replay; `FLEURS_ROOT=<external-drive>/…/fleurs_transcripts/data`):
- new `es419-word` dump: es-419 `phonemizeWord` over every letter run of the es + es-419 goldens, FLEURS es_419
  (columns 3 and 4) and `probes/es.txt` + the new `probes/es-419.txt` (as written and lowercased), plus all 1–3
  letter strings; `toLatinAmerican` over 10 synthetic strings (empty, lone surrogates, capital Θ, a combining mark).
- `LANGS=es-419` `phonemize-sync`, `phonemize-best`, `trace`.

**Raw finding.**
```
es419-word: 23419 identical, 0 DIFFER
phonemize-sync: 3911 identical, 0 DIFFER
phonemize-best: 3911 identical, 0 DIFFER
trace: 3911 identical, 0 DIFFER
```
Haystack reach (`.probe/es-419/reach.mts`, Castilian `createSpanish(true).text` over the same 3,911 texts): 3,495
carry a θ and 1,042 a ʎ, so both mergers are exercised by most of the corpus.

**Can it see a defect?** One mutation at a time, then reverted:
- yeísmo removed: `phonemize-sync: 2869 identical, 1042 DIFFER` (exactly the ʎ-bearing texts); `trace` stays 0 DIFFER
  (the trace serializer carries spans, not the reading).
- `note_rewrite(…, positional = false)`: `trace: 313 identical, 3598 DIFFER` — the positional claim is what keeps the
  token `ipaSpan`s, and the trace dump witnesses it.

**Implication.** Both halves of the module are covered, by different dumps.

## Run 4 — 2026-10-10 23:00 (reading for correctness; TS findings, reported not fixed)

**Command.** `npx tsx .probe/es-419/findings.mts` (synthetic inputs).

**Raw finding.**
1. **The whole-string delta reaches an embedded FOREIGN run.** `Dijo θεός en griego.` → es `dˈixo θeos …`, es-419
   `dˈixo seos …`; `Leyó Αθήνα y Θεσσαλονίκη.` → es-419 `asina i sesalonici`. The Greek engine's /θ/ is a real
   dental fricative of Greek, and seseo is a fact about Spanish words; `toLatinAmerican` runs on the assembled
   string, so it cannot tell them apart. (A Latin-script English run is read by the Spanish g2p here and carries no
   θ, so it is unaffected: `the Beatles` → `tˈe βeˈatles` in both.) FLEURS es_419 has no Greek run, so no measured row
   moves.
2. (already reported, #1150) the trace token records the CASTILIAN reading (`cerveza` emits `θeɾβˈeθa`, the
   utterance reads `seɾβˈesa`); the spans survive because the rewrite is positional.

**Implication.** Finding 1 goes in the PR body; the Rust reproduces it (both lines appended to `probes/es-419.txt`,
re-run: `phonemize-sync 3913 / phonemize-best 3913 / trace 3913 / es419-word 23425 identical, 0 DIFFER`).

## Run 5 — 2026-10-10 23:05 (TS test pins, gates)

**Command.** `.probe/bin/extract_pins.py test/spanish-419.test.ts word|text es-419` (regex over `phonemizeWord("…")).toBe(…)`,
the GOLD `["…", "…"]` pairs and `phonemize("…", "es-419")).toBe(…)`), appended as a `#[cfg(test)]` module;
`cargo test --release spanish_419`; `cargo run --release -p parity`.

**Raw finding.** 34 word pins + 34 es-419 text pins + the one `es` text pin + the Roman policy assertions: `3 passed`.
Parity: every registered language 200/200, es-419 included (11.5 s for all 21).

**Implication.** es-419 done; remaining gates (fmt, clippy, regex-diff, full test) are run once for the group at the
end and recorded in the last language's log.

## Run 6 — 2026-10-11 16:25 (#1533: the accent delta and foreign runs, TS-first)

**Question.** Can seseo/yeísmo stop reaching an embedded foreign run without changing any Spanish word?

**Dead end considered first.** Keeping the whole-string delta and protecting the foreign spans needs their offsets
in the assembled string, which only the trace recorder knows (and only while tracing). Placeholder characters for
θ/ʎ inside the foreign output would be seen by `spirantizeAcrossWords`'s `[\p{L}\p{M}ˈˌ]` test. Neither is sound.

**Fix.** `createSpanish(americas, accent?)`: the delta is applied to every Spanish reading (`wordIpa`, both the word
and the number branch) and never to what `emitUnclaimed` emits. The delta is a context-free code-point substitution,
and nothing after `wordIpa` creates or tests θ/ʎ (`spirantizeAcrossWords` reads nasals, `l` and a letter class), so
a Spanish word reads exactly as before.

**Command.** `npx tsx tools/check-goldens.mts es-419 --show 50`; synthetic probe lines.

**Raw finding.** `goldens fresh` for es-419: 0 of 200 rows moved. `Dijo θεός en griego.` now reads identically in
es and es-419 (`dˈixo θeos en ɡɾjˈeɣo .`); `Leyó Αθήνα y Θεσσαλονίκη.` → `leʝˈo aθina i θesalonici .` (the Spanish
yeísmo applies, the Greek θ survives); `La calle y la cerveza.` → `la kˈaʝe i la seɾβˈesa .` unchanged. The
`accent:es-419` rewrite event is gone (there is nothing left to rewrite), so a trace token now records the reading
that ships rather than the Castilian one — the #1150 note in Run 4 item 2 is resolved by the same change.

**Implication.** Fixed; mirror into C# and Rust. The new test fails with spanish.ts/spanish-419.ts reverted.

(#1533 C#/Rust mirrors and the gates: see rust_ro_port_investigation.md Run 8.)
