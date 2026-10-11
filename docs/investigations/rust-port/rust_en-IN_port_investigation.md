# Rust port: Indian English (`en-IN`)

Branch `worktree-agent-ab430eb42060893ad` (after es-419, fr-CA). Part of #1463. Method as
rust_es-419_port_investigation.md.

## Run 1 — 2026-10-10 23:40 (the import closure)

**Question.** What does `src/languages/english-in/` need beyond the ported `en` engine, and how is its neural entry
wired?

**Command.** Read english-in.ts; `grep -n en-IN src/registry.ts src/neuralRegistry.ts`; read the Rust registry's
`EnglishEngine` (en / en-GB).

**Raw finding.** One module: `toIndian` (two runtime-built retroflexion patterns guarded by the U+0361 tie, then 18
literal `/…/gu` substitutions), `indianWordTransform = (ipa) => toIndian(ipa)` and `phonemizeWord(w) =
toIndian(createEnglish().text(w))`. Sync: `createEnglish().text(input, indianWordTransform)` — a PER-WORD transform
inside the English engine, not a whole-string delta, so no `noteRewrite`. Async: `phonemizeEnNeural(text, { host:
"en-IN", wordTransform: indianWordTransform })` — the same BiLSTM entry en-GB uses (#1260). `en-IN` is already in the
Rust `ROMAN_NATIVE` and `SPACED_DASH_OPT_OUT`, and `scripts.rs` knows it.

**Implication.** No new core module and no new model: `languages/english_in/english_in.rs`, and a third
`EnglishVariant` (`In` → host `en-IN`, `Some(&indian_word_transform)`) so en-IN shares the en engine and tagger
exactly as en-GB does.

## Run 2 — 2026-10-10 23:45 (golden gate)

**Command.** `cargo run --release -p parity -- en-IN en en-GB`, then `-- --sync en-IN`.

**Raw finding.** Best path: `en-IN 200/200`, `en 200/200`, `en-GB 200/200`. `--sync`: `en-IN: 181/200, 19 differ` —
every printed row an OOV word the BiLSTM reads differently from the n-gram (`Daesh`, `Pago Pago`, `Niue`, `METI`,
`biorhythm`), i.e. the goldens are `phonemizeAsync` and the sync gate is not their contract.

**Implication.** The sync path is proven by the `phonemize-sync` differential instead (Run 3).

## Run 3 — 2026-10-10 23:55 (differentials)

**Commands.** `.probe/bin/dd.sh en-IN en-IN enin phonemize-sync phonemize-best trace`. `langTexts("en-IN")` is the
three English goldens, FLEURS en_us (columns 3 and 4; no en_in transcripts here) and probes `en-normalize.txt` +
the new synthetic `en-IN.txt`. New `enin` dump: `indianWordTransform` over every accent-lexicon reading, `toIndian`
over every 1–3 symbol string of the 28-symbol context alphabet (t d ʰ U+032C U+0330 U+0361 ʃ θ ð e o a ᶦ ᶷ v w p k ɫ
ɝ ɚ ɹ ᵻ ᵿ ʲ ˈ space, a lone surrogate), `phonemizeWord` over every letter run of the texts.

**Raw finding.**
```
enin: 176678 identical, 0 DIFFER
phonemize-sync: 4171 identical, 0 DIFFER
phonemize-best: 4171 identical, 0 DIFFER
trace: 4171 identical, 0 DIFFER
```
Neural reach (`.probe/bin/sync_vs_best.py`): 619 of the 4,171 texts read differently on the best path, so the BiLSTM
+ transform composition is exercised. Mutation (then reverted): TH-stopping moved BEFORE retroflexion →
`enin: 170747 identical, 5931 DIFFER`, `phonemize-best: 2688 identical, 1483 DIFFER`.

## Run 4 — 2026-10-11 00:05 (reading for correctness; TS findings, reported not fixed)

**Command.** `npx tsx .probe/en-IN/findings.mts` (synthetic inputs, `en` vs `en-IN` sync and async).

**Raw finding (TS, verbatim).**
1. **The delta reaches a foreign run, and retroflexes a DENTAL stop.** `He said дети and τι and नमस्ते.` → en
   `… dʲˈetʲɪ ənd ti ənd nəmˈəst̪eː .`, en-IN `… ɖˈeʈɪ ənɖ ʈi ənɖ nəmˈəsʈ̪eː .` The Hindi engine's dental `t̪` becomes
   `ʈ̪` (a retroflex symbol carrying the dental diacritic): `t[ʰ̬̰]?(?!͡)` declines only the affricate tie, not U+032A.
   For en-IN this is the code-switching case that matters most — a Hindi word inside Indian English loses exactly
   the dental/retroflex contrast Hindi has; Russian `dʲ`/`tʲ` lose their palatalisation too (`ʲ` is dropped).
2. Checked and NOT a defect: `ɝ`/`ɚ` → `əɾ` followed by `ɹ` → `ɾ` could double the tap, but GenAm here never emits
   `ɝɹ` (`hurry hˈɝi`, `stirring stˈɝɪŋ`, `mirror mˈɪɹɚ` → `hˈəɾi`, `sʈˈəɾɪŋ`, `mˈɪɾəɾ`).

**Implication.** Finding 1 goes in the PR body; its line is in `probes/en-IN.txt` and inside the Run 3 numbers.

## Run 5 — 2026-10-11 00:10 (TS test pins, gates)

**Command.** `.probe/bin/extract_pins.py test/english-in.test.ts word` → `#[cfg(test)]`; `cargo test --release english_in`;
`cargo run --release -p parity`.

**Raw finding.** 27 extracted pins plus the `tin` ≠ `thin` assertion: `1 passed`. Parity: all 23 registered languages
200/200.
