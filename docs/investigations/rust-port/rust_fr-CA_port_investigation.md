# Rust port: Québécois French (`fr-CA`)

Branch `worktree-agent-ab430eb42060893ad` (after es-419). Part of #1463. Method as rust_es-419_port_investigation.md.

## Run 1 — 2026-10-10 23:10 (the import closure)

**Question.** What does `src/languages/french-ca/` need beyond the ported `fr` engine? Neural entry? Roman policy?

**Command.** Read french-ca.ts; `grep -n fr-CA src/registry.ts src/neuralRegistry.ts`.

**Raw finding.** One module: `createFrench()` plus `toQuebecois` (three regex passes: `/t(?=[ˈˌ]?[iyɥj])/gu` and the
`d` twin, a laxing pattern BUILT AT RUNTIME from the `CODA`/`OPEN` strings with a `LAX` callback, and
`/a(?=[ .,;!?…»)]|$)/gu`), then `noteRewrite("accent:fr-CA", pre, out)` — NOT positional. No `neuralRegistry.ts`
entry, so `phonemizeAsync` serves the sync reading (the `fr` BiLSTM is NOT used by fr-CA); no `ROMAN_POLICIES`
entry, and `fr-CA` is in `ROMAN_NATIVE` (already in the Rust registry), so the Roman pass is skipped.
`phonemizeWord(w)` is `toQuebecois(createFrench().text(w))` — the France engine's whole `text()` on one word.

**Implication.** No new core module. `languages/french_ca/french_ca.rs`; `phonemize_word` is a method on the
engine (it needs the loaded France engine). The `OPEN` string's U+0361 is written `\u{0361}` so it is visible.

## Run 2 — 2026-10-10 23:15 (golden gate)

**Command.** `cd rust && cargo run --release -p parity -- fr-CA fr`.

**Raw finding.** `fr-CA: 200/200 identical, 0 differ`; `fr: 200/200`. First build.

## Run 3 — 2026-10-10 23:25 (differentials)

**Commands.** `.probe/bin/dd.sh fr-CA fr-CA frca-word phonemize-sync phonemize-best trace` (FLEURS root on
`<external-drive>`). New `frca-word` dump: `toQuebecois` over every Lexique and supplement READING (the France
engine's own output alphabet, ~100k distinct strings) and every 1–3 symbol string over the 27 context symbols
(t d i y u ɥ j a ˈ ˌ p k s ʁ v z ʒ l ɛ U+0361 ʃ space . » … ɑ and a lone surrogate); `phonemizeWord` over every
letter run of the fr + fr-CA goldens, FLEURS fr_fr (columns 3 and 4; there is no fr_ca FLEURS) and probes
`fr.txt` + the new synthetic `fr-CA.txt`.

**Raw finding.**
```
frca-word: 104101 identical, 0 DIFFER
phonemize-sync: 3959 identical, 0 DIFFER
phonemize-best: 3959 identical, 0 DIFFER
trace: 3959 identical, 0 DIFFER
```
Mutation (then reverted): the affricate tie dropped from `OPEN` → `frca-word: 102669 identical, 1432 DIFFER`
(e.g. `abʁit͡sjɔ̃` vs `abʁɪt͡sjɔ̃`), `phonemize-sync: 3275 identical, 684 DIFFER`. The tie guard is reached by a
sixth of the corpus texts, and the harness sees it.

**Implication.** The haystack is France-French text (no Québécois corpus exists here), which is fine for a
context-free post-process: what matters is the IPA alphabet it is fed, and the Lexique readings cover it.

## Run 4 — 2026-10-10 23:30 (reading for correctness; TS findings, reported not fixed)

**Command.** `npx tsx .probe/fr-CA/findings.mts` (synthetic words and lines, `phonemize(…, "fr")` vs `"fr-CA"`).

**Raw finding (TS, verbatim).**
1. **An obstruent + liquid ONSET cluster is read as a coda, so a vowel in an OPEN syllable laxes**, against the
   module's own rule ("Open syllables keep the tense vowel"). `publique` fr `pyblˈik` → fr-CA `pʏblˈɪk`; `cyclone`
   `siklˈɔn` → `sɪklˈɔn`; `citron` `sitʁˈɔ̃` → `sɪtʁˈɔ̃`; `supplier` `syplijˈe` → `sʏplijˈe`. The laxing lookahead
   tests only the ONE symbol after the consonant (`(?![OPEN])`), and `l`/`ʁ` are not in `OPEN`, so `.bl`, `.kl`,
   `.tʁ`, `.pl` all count as closing the syllable. (The word-final `il`, `ik` cases the docstring lists are right.)
2. **The whole-string delta reaches an embedded foreign run**, the shape es-419 has: `Il a dit τι.` → `… t͡sˈi`
   (the Greek engine's `ti` affricated). A Cyrillic `дети` is spared only because the Russian reading's `dʲ`/`tʲ`
   put `ʲ` between the stop and the vowel.
3. (by design, noted) word-final `/a/ → [ɑ]` fires on every word that ends in `a` in the output, the unstressed
   clitics included: `Il a dit` → `ɪl ɑ d͡zi`; the docstring's rule is literally word-final, so this is its
   stated behaviour, not a code/doc gap.

**Implication.** Findings 1 and 2 go in the PR body. Both lines appended to `probes/fr-CA.txt`; re-run:
`frca-word 104103 / phonemize-sync 3961 / phonemize-best 3961 / trace 3961 identical, 0 DIFFER`.

## Run 5 — 2026-10-10 23:35 (TS test pins, gates)

**Command.** `.probe/bin/extract_pins.py test/french-ca.test.ts word` → a `#[cfg(test)]` module;
`cargo test --release french_ca`; `cargo run --release -p parity`.

**Raw finding.** 18 extracted `phonemizeWord` pins: `1 passed`. Parity: all 22 registered languages 200/200.

**Implication.** fr-CA done; the group's remaining gates are recorded in the last language's log.

## Run 6 — 2026-10-11 16:35 (#1533: onset clusters and foreign runs, TS-first)

**Question 1.** Does treating an obstruent + liquid before a vowel as an ONSET (`(?![ptkbdɡf][lʁ][OPEN])` ahead of
the coda consonant) stop `publique`/`cyclone`/`citron` laxing, and move nothing else?

**Raw finding 1.** `publique pyblˈɪk`, `cyclone siklˈɔn`, `citron sitʁˈɔ̃`, `supplier syplijˈe`, `microscope
mikʁɔskˈɔp`; a word-final cluster still closes the syllable (`chiffre ʃˈɪfʁ`, `équilibre ekilˈɪbʁ`). Golden
(`npx tsx tools/check-goldens.mts fr-CA --show 50`, then `--write`): 14 rows (15 findings, one row is duplicated)
move, and every changed word is a lax→tense vowel before such a cluster: `pʏblɪk→pyblɪk`×2, `nʏkleɛʁ→nykleɛʁ`×2,
`pʏblije`, `mɪɡʁatwaʁ`, `mɪɡʁasjɔ̃`, `ɪdʁatasjɔ̃`, `sʏplemɑ̃`, `nʏtʁɪsjɔnɛl`, `mɪkʁɔskɔp`, `nʊblije`, `ʁepʏblɪk`,
`ʁɛpʊblikɑ`, `pʏblikasjɔ̃`, `sɪklɔn`, `ʒezʏkʁɪst`. No fr-CA pronunciation referee exists, so the module's own rule
("Open syllables keep the tense vowel") is the only witness; this is a code/doc gap closed toward the doc.

**Question 2.** Can the delta stop reaching an embedded foreign run (`τι` → `t͡si`) without changing a French word?

**Fix.** `createFrench(foreign, accent?)`: the delta runs in `flush`, per group slot, AFTER `accentFinal` (it reads
the stress mark) and BEFORE the trace offsets are taken, and skips the slots that hold a foreign run's IPA. No rule
of the delta looks across a space (affrication and the onset test are in-word lookaheads; the laxing coda test sees
a space or the end of the piece the same way; word-final /a/ matches `$` at the end of a piece as it matched a space),
so a French word reads as before.

**Raw finding 2.** Apart from the 14 onset rows, 0 golden rows move. `Il a dit τι.` → `ɪl ɑ d͡zi tˈi .` (the Greek
run reads as the `fr` host reads it: `il a di tˈi .`). Side effect, measured: fr-CA no longer has a length-changing
post-assembly pass, so `phonemizeTrace` now REPORTS exact `ipaSpan`s for fr-CA; `test/trace.test.ts`'s
"length-changing pass withholds the output spans" lost its fr-CA case (`found` was 0), and a positive test replaces it.

**Implication.** Both fixed; mirror into C# and Rust. Each new test fails with its fix reverted (the onset guard
alone, and french.ts + french-ca.ts together).

(#1533 C#/Rust mirrors and the gates: see rust_ro_port_investigation.md Run 8.)
