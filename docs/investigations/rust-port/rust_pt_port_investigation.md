# Rust port: Portuguese (pt-BR, pt)

pt-BR is the European engine (`src/languages/portuguese/`) run with `dialect: "bp"` plus an open/close
override lexicon (`src/languages/portuguese-br/`). The whole pt directory is ported, so `pt` is registered too
once both goldens pass. Branch `rust-lang-ptbr`, off `rust-kokoro-core` (#1466).

## Run 1 — 2026-10-09 15:45 (scoping: the import closure)

**Question.** What does pt-BR need that the shared core does not have yet?

**Command.** Read `portuguese-br/*.ts`, `portuguese/*.ts` and their imports, against
`rust/vernacula-phonemizer/src/core/`.

**Raw finding.**
- Ported already: `latinPhones`, `initialisms` (`makeInitialismNormalizer`, `makeUnreadableTest`),
  `clauses` (`assembleClauses`), `provenance` (`rewrite`), `loadTsv`, `loadManifest`, `roman`.
- NOT ported: `makeSymbolNormalizer` (core/normalizeSymbols.ts, 1,469 lines). `core::normalize_symbols` holds
  only `folded_index`/`resolve_unit_symbol`. portuguese.ts's `SYMBOLS` tier needs it.
- No neural entry for pt or pt-BR (`neuralRegistry.ts`), so `phonemize-best` differs from `phonemize-sync`
  only by the registry's mixed-script English prewarm.
- pt-BR's `ROMAN_POLICY` is a re-export of pt's (`portugueseOrdinal` + an `ordinalAfter` noun list).

**Implication.** The coordinator assigned `makeSymbolNormalizer` to the es agent (`rust-lang-es`), to be
cherry-picked here. Until then the tier is an identity stub marked `TODO(normalizeSymbols)`, and every row
that carries %, a currency sign, a unit, `×`, `&` or a superscript is expected to differ end to end. The
per-module differentials (normalize, g2p, numbers) do not touch the tier and can go to 0 differ now.

## Run 2 — 2026-10-09 15:50 (per-module differentials: numbers, g2p, normalize)

**Question.** Do `numbers.rs`, the word path (`g2p.rs` + `portuguese.rs` + `portuguese_br.rs`) and
`normalize.rs` match their TS twins, before anything end to end?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts {pt-numbers,pt-g2p,pt-normalize} > .probe/pt/<name>.jsonl`,
then `rust/target/release/fn-diff <name> .probe/pt/<name>.jsonl`.
- `pt-numbers`: 0..25000, powers of ten 10^5..10^12 with neighbours, a 10^6..10^9 stride, and -1, 1.5,
  2^53, 2^53+2, 1e21, NaN, Infinity; EP and BP, each with and without a `raw` digit string; four odd raws
  (`0001234567890`, `12x4`, a 20-digit run, `1 6`); `portugueseOrdinal` over -1..1002 and 2.5.
- `pt-g2p`: every key of lexicon.tsv, lexicon-manual.tsv and pt-br-openclose.tsv, every `[a-zà-ÿ]+` token of
  the BP-normalized goldens/FLEURS/probes, and ~70 synthetic corners (foreign letters, ñ, y, ß/æ/ð/þ, a lone
  surrogate, an astral letter, ſ, K, İ, ×, ÷, the empty word). Five ops each: pt EP, pt BP, the pt-BR shipped
  path, and `renderWord` without a correction in both dialects.
- `pt-normalize`: both goldens, FLEURS pt_br (columns 3 and 4), probes/pt-BR.txt; EP, BP, and the initialism
  pass over BP.

**Raw finding.**
- first `pt-numbers` run: `101751 identical, 2 DIFFER`. Both were `1e21` without `raw`: TS gives
  `um e + dois um` (`String(1e21)` is `1e+21`, and `e`/`+` survive as themselves), Rust spelled 22 digits,
  because my `String(Math.abs(n))` stand-in formatted the integer. Fixed to JS's exponent form; then
  `101753 identical, 0 DIFFER`. (Unreachable from the engine: every caller without `raw` passes a small
  integer.)
- `pt-g2p: 75625 identical, 0 DIFFER` (15,125 words × 5 ops).
- `pt-normalize: 11913 identical, 0 DIFFER`: golden 921, fleurs 10,749, probe 243.

**Implication.** The three modules are done. The symbol tier is outside all three, so these numbers do not
depend on the stub.

## Run 3 — 2026-10-09 15:53 (end to end, with the symbol tier stubbed)

**Question.** With `makeSymbolNormalizer` still an identity stub, is EVERY end-to-end difference a symbol-tier
row?

**Command.** `LANGS=pt-BR,pt npx tsx rust/tools/fn-diff/dump.mts phonemize-sync` (and `phonemize-best`), replayed
with `fn-diff`; `cargo run --release -p parity -- pt-BR pt`.

**Raw finding.** `phonemize-sync: 7734 identical, 204 DIFFER`; `phonemize-best: 7734 identical, 204 DIFFER`.
Parity: `pt-BR: 197/200 identical, 3 differ`, `pt: 191/200 identical, 9 differ`. Every printed row carries a
unit, `%` or `US$`: `160 km/h` is TS *kilˈometɾus poɾ ˈɔɾɐ* and Rust *km*; `80%` is TS *poɾ sˈẽtu* and Rust
nothing; `7,7 kg` reads *kɡ*; `US$ 11.000` loses *dˈɔlaɾis*. The 12 golden rows are 1040 km, 80%, 160 km/h,
20 km / 65 km, 3,50 m and 12,8 km.

**Implication.** Nothing outside the tier differs on the rows shown. The claim for all 204 waits on the
cherry-pick: the remaining count after it must be 0.

## Run 4 — 2026-10-09 15:54 (three TS findings, confirmed in Node)

**Question.** Reading normalize.ts for correctness: do the clock, fraction and degree rules do what they
promise in pt-BR?

**Command.** `npx tsx .probe/pt/q.mts` (`normalizePortuguese(t, true)` and `phonemize(t, "pt-BR")`).

**Raw finding.**
- `Às 16h17 em ponto` becomes `Às dezasseis horas e dezassete em ponto`, read *dezasˈejs … dezasˈet͡ʃi* in
  pt-BR. `feminineCardinal` and `fractionWords` call `numberToWords(n)` with no dialect, so pt-BR's clock and
  fractions read the EUROPEAN teens (dezasseis/dezassete/dezanove), while the number tokenizer in the same
  sentence reads *dezessete*.
- `Comeu 17/19 do bolo` becomes `dezassete décimo nonos`: the EP teen again, and the plural `s` lands only on
  the last word of a compound ordinal (*décimos nonos* expected).
- `Mediu 1.000 °C` becomes `1.000 grau Celsius`, read *mˈiw ɡɾˈaw*: `degreeWord` reads `Number("1.000")` = 1,
  so dot-grouped thousands take the SINGULAR.

**Implication.** Reported, not fixed in Rust (bidirectional rule): the port reproduces all three, and
pt-normalize stays at 0 differ over them. No reachable `Object.prototype` lookup: every plain-object index
(`DOTTED_ABBREV`, `letterNames`, `CLAUSE_MARK`, `DENOMINATOR`, the accent/vowel tables) is keyed by one
letter, a digit string or an alternation of the table's own keys, and no key folds onto a prototype name.

## Run 5 — 2026-10-09 15:56 (per-arm coverage of the haystack)

**Question.** A clean differential proves nothing about an arm the haystack never reaches. Which
normalize.ts arms does the corpus (both goldens + FLEURS pt_br: 307 + 3,583 distinct texts, from the pt-normalize row counts) exercise, and which rest
on the probes alone?

**Command.** `npx tsx .probe/pt/arms.mts`: each arm's TS pattern tested against every distinct text (raw input,
so a count approximates what reaches that step).

**Raw finding.** Texts matched, corpus / probe:
- reached by the corpus: a.C. 9/2, d.C. 4/1, número 1/2, abbrev-continue 11/5, abbrev-end 8/2, ordinal
  indicators 19/6, US$ 1/2, °C 6/2, bare ° 10/6, `NhNN` 11/3, `h:mm` 21/1, `+` after a space 2/1, fractions 2/3.
- PROBES ONLY (corpus 0): digit grouping by a space (5 probe lines), the NBSP/NNBSP/thin-space fold (4), R$ (1),
  °F (1), minus (1), ± (1), glued `+` (1), `=` `<` `>` `÷` (1 each), and the BP `1 de <month>` (1).

**Implication.** Eleven arms rest on synthetic lines, each with its declining neighbour in the same file
(`1 0000`, `0 000`, `R$ abc`, `25°Cölner`, `a-5`, `C++`, `11 de julho`, `1 de julhos`, …). All are inside
`pt-normalize: 11913 identical, 0 DIFFER`.

## Run 6 — 2026-10-09 16:01 (the symbol tier wired: golden gate and end to end)

**Question.** With the es port's `makeSymbolNormalizer` cherry-picked (9aceb875) and the stub commit
dropped, do the goldens close, and do the 204 end-to-end differences of Run 3 all go away?

**Command.** `SYMBOLS` is built from `symbolTier` + `signWords` (multiply, ampersand) as portuguese.ts builds
it. Then `cargo run --release -p parity` (every registered language), the `phonemize-sync` and
`phonemize-best` dumps re-generated for `LANGS=pt-BR,pt` and replayed, and the three module replays re-run.

**Raw finding.**
- parity: `en 200/200`, `en-GB 200/200`, `pt 200/200`, `pt-BR 200/200`, 0 differ.
- `phonemize-sync: 7932 identical, 6 DIFFER`; `phonemize-best: 7932 identical, 6 DIFFER`. The 6 rows are 3
  probe lines × 2 languages, and each has a foreign run in an UNPORTED script: `Москва` (TS *mɐskvˈa*, via
  ru), `λόγος` (*loɣos*, via el), `東京` (*tʊŋ˥˥ t͡ɕiŋ˥˥*, via cmn). Rust drops the run, and the registry
  records the target as port-pending. The Latin run beside it (`Tokyo` → *tukˈiu*) is identical.
- module replays unchanged: normalize 11913 / g2p 75625 / numbers 101753 identical, 0 differ.
- `cargo test --workspace` green; `cargo build` 0 warnings.

**Implication.** pt and pt-BR are done: golden byte-identical, and every corpus row (goldens + FLEURS
pt_br) identical on both paths. The only open rows are port-pending (ru, el, cmn), not port defects. No
golden or FLEURS row needs a foreign engine.
