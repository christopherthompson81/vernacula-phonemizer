# fr — name-initial rule after a non-ASCII letter; Mmes / Mlles misread (#1480)

Found in the audit of the French normalizer during the Rust port follow-up (#1463). Three items: (1) the
name-initial rule fires on the last letter of a word that ends in an accented letter + one ASCII letter;
(2) `Mlles` reads as a lone combining tilde on the best path; (3) `Mmes` reads as a Roman ordinal.

All example text in this log is synthetic. Corpus hits are cited only as the word-final fragment the rule
matched, never as the sentence.

## Run 1 — 2026-10-09 21:05 — repro on both paths

Command: a scratch script calling `normalizeFrench`, `phonemize` and `phonemizeAsync` for `fr` and `fr-CA`
on synthetic sentences.

Question: does each item reproduce, on which path, and is fr-CA affected?

Raw finding (fr; fr-CA identical in shape):

| input | normalized | sync | best |
|---|---|---|---|
| `Le syndicat Unión. Il part.` | `… Unióenne Il part.` | `… ynioɛn il pˈaʁ .` | same |
| `Les plats cuisinés. Ils sont bons.` | `… cuisinéesse Ils …` | `… kɥizineɛs il …` | same |
| `Mlles Dupont et Martin.` | unchanged | `mlə dypɔ̃ …` | `̃l dypɔ̃ …` (U+0303 + l) |
| `Mmes Dupont et Martin.` | unchanged | `dø miljɛm dypɔ̃ …` | same |
| `Mme Curie et Mlle Dupont.` | unchanged | `madam … madmwazɛl …` | same |
| `MM. Dupont et Martin.` | `messieurs …` | `mesjø …` | same |

fr-CA's best path equals its sync path (`mlə`), so only fr runs the tagger.

Implication: item 1 is in `normalizeFrench` step 4 (both paths). Items 2 and 3 are not normalizer output at
all — the plurals pass through unchanged — so the question is why the singulars work and the plurals do not.

## Run 2 — 2026-10-09 21:08 — root causes

Commands: `grep -P "^(mme|mmes|mlle|mlles|mm|…)\t" data/languages/french/lexicon.tsv supplement.tsv`; read
`normalize.ts` step 4, `ordinals.ts` ROMAN_NOTATION, `frenchNeural.ts`; a scratch probe of the tagger on
vowelless tokens.

Raw findings:

1. Step 4 is `/\b([a-zà-ÿ])\.(\s+)(?=[\p{L}])/giu`. JS `\b` is defined on ASCII `\w` EVEN UNDER `u`, so
   `ó`→`n` and `é`→`s` are boundaries, and the word's last ASCII letter is taken for a lone initial. Only
   ASCII letters have a `letterNames` row, so the rewrite fires exactly when an accented letter is followed by
   ONE ASCII letter and a dot before the next word. The same `\b` fronts steps 1 (era), 2 (numéro), 3
   (dotted abbreviations, both arms) and 3b (undotted dr/pr). Step 3 has the identical failure:
   `Čáp. Puis` → `Čápage Puis` (`p.` = page).
2. Lexique has `mme` and `mlle` but NOT `mmes` or `mlles`. The `DOT_ONLY` set listed all four under the
   comment "Abbreviations Lexique ALREADY pronounces as a token" — true for two of the four. So:
   - `Mmes`: the Roman-ordinal pass (`ROMAN_NOTATION`, `[ivxlcdm]+` + suffix, case-insensitive) reads it as
     `MM` + the plural ordinal suffix `es`; the lexicon veto (`isWord("mmes")`) does not fire, because the
     word is not a row. → *deux-millièmes*. (`Mme` survives only because `mme` IS a row.)
   - `Mlles`: OOV, no Roman reading (`ll` is not a numeral suffix). Sync path: rule g2p → `mlə`. Best path:
     the BiLSTM tagger is offered `mlles` and returns `"̃l"`.
3. Why the best path diverges: the tagger, not the normalizer or the input order — `normalizedFor` is shared
   by both paths and leaves `Mlles` unchanged. Tagger probe on vowelless tokens:
   `mlles`→`̃l`, `mllz`→`̃le`, `mr`→`̃ʁ`, `mrs`→`̃ʁ`; but `mlls`→`ml`, `mll`→`ml`, `ms`→`m`. The tagger
   can label a word-initial `m` with the bare nasalization mark (the chunk it gives `m` after a vowel), and
   nothing rejects an output that starts with a combining mark.

Implication: fix item 1 at the boundary (all six `\b` in steps 1–4, since they are one shape); fix items 2
and 3 by expanding the plurals in the normalizer, BEFORE the numeral pass, which removes them from both the
Roman pass and the tagger. The tagger's stray-tilde output is a separate latent defect (`Mr` in French text
hits it) — reported, not fixed here.

## Run 3 — 2026-10-09 21:10 — item 1 footprint

Command: scratch `measure1.mts` — the step-4 pattern over FLEURS fr_fr column 2 (train+dev+test, 1972
unique texts), the fr and fr-CA goldens (200 each) and `tools/corpus/mined/fr.jsonc` (108 texts), counting
matches whose preceding character is `\p{L}\p{M}` and whose letter has a letter name; and the same for the
dotted-abbreviation alternation.

Raw finding:

| source | texts | name-initial after a letter | abbreviation after a letter |
|---|---|---|---|
| FLEURS fr_fr | 1972 | **11** | 0 |
| golden fr | 200 | 0 | 0 |
| golden fr-CA | 200 | 0 | 0 |
| mined fr | 108 | 0 | 0 |

The 11 fragments are all an accented vowel + one ASCII letter at a sentence end: `-és.`, `-ée.` (7 of 11
are past participles), `-ión.`, and one `-ău.` (a Romanian name). A first count that did not require a
letter-name row reported 22, because `-é.` also matches the pattern but has no `letterNames` entry and is
returned unchanged — the 11 are the ones that are actually rewritten.

Honorifics in the same sources: no `Mmes`/`Mlles` anywhere; `mm` ×8 and `mm.` ×1 in FLEURS, all millimetres.

Implication: goldens should not move. Bare `MM` must stay the unit (8 of 8 are units), so only the dotted
`MM.` is Messieurs, as today.

## Run 4 — 2026-10-09 21:14 — fix and revert proof

Fix (`src/languages/french/normalize.ts`): `WORD_START = (?<![\p{L}\p{M}\d_])` and
`WORD_END = (?![\p{L}\p{M}\d_])` replace `\b` in steps 1, 2, 3 (both arms), 3b and 4 — `\b`'s own ASCII
behaviour (letter, digit, underscore) extended to every script. `mmes`/`mlles` leave `DOT_ONLY`; the dotted
forms then expand through the existing `DOTTED_ABBREV` rows (`mesdames`, `mesdemoiselles`), and a new bare
rule in step 3b expands them anywhere (neither is a French word).

After (sync = best for every row):

| input | after |
|---|---|
| `Le syndicat Unión. Il part.` | normalized unchanged; the sentence break `.` survives |
| `Les plats cuisinés. Ils sont bons.` | `le pla kɥizinˈe . il sɔ̃ bˈɔ̃ .` — equals the two sentences read apart |
| `Mmes Dupont…` / `Mmes.` / `MMES` | identical to `mesdames Dupont…` (`mɛdam`, from Lexique) |
| `Mlles Dupont…` / `Mlles.` | identical to `mesdemoiselles Dupont…` (`mɛdəmwazɛl`, from Lexique) |
| `Mme`, `Mlle`, `MM.`, `10 MM` | unchanged |

Old-vs-new `normalizeFrench` over the same sources: FLEURS fr_fr 11 of 1972 changed (exactly the Run 3 set);
goldens 0 + 0.

Tests: `test/french.test.ts` "french name initials and plural honorifics (#1480)" — every expected reading
derived from the engine's own output for the spelled-out word. Reverting `normalize.ts` to origin/main: 2 of
the 4 new tests fail (the boundary test, the honorific test); the other 2 are the declines (a real initial,
the singulars / bare MM), which pass before and after by design. The old normalizer also gives
`Čáp. Puis` → `Čápage Puis`, so the abbreviation-boundary assertion is independently live.

Side observations, not fixed (separate defects): `Unión` reads `yni` — the `ón` is dropped (the word is
split at `ó`); `Čáp` alone reads `sˈˈiː` with a doubled stress mark.

## Run 5 — 2026-10-09 21:20 — the same ASCII `\b` in other languages

Command: grep for `\b(${…ABBREV_ALT})\.` and `\b([…])\.` across `src/languages`; scratch `otherlangs.mts` —
each language's dotted-abbreviation keys, matched with `\b(keys)\.` over its FLEURS transcripts, counting
matches preceded by a letter; then the reading of a synthetic sentence of the same shape.

Raw finding:

| language | rule | FLEURS texts hit | synthetic repro |
|---|---|---|---|
| pt | `normalize.ts` dotted abbrev (both arms) | 2 of 1943 (`-écia.`, `-ócia.`: key `cia`) | `Grécia.` → `ɡɾˈɛkõpɐɲjɐ` (companhia) |
| es | `normalize.ts` dotted abbrev | 1 of 1948 (`-ísta.`: key `sta`) | `taoísta.` → `taoˈisanta` |
| de | `normalize.ts` dotted abbrev | 1 of 1956 (`-öst.`: key `st`) | `gelöst. Dann` → `ɡəlˈøːzaŋkt` (Sankt) |
| en | `normalize.ts` PLAIN_ABBREV | 1 of 1976 (`-ínos.`: key `nos`) | `Taínos.` → `tʰˈaᶦnʌmbɚz` (numbers) |
| id | dotted abbrev | 0 of 1936 | — |
| ceb | dotted abbrev (no trailing-context guard) | 0 of 1932 | — |
| hil | dotted abbrev (no trailing-context guard) | not measured (no FLEURS) | — |
| es, en | `\b([ap])\.\s?m\.` (a.m./p.m.) | not measured | latent |

Implication: per-language code, not shared core, so out of scope for this fix and listed for a follow-up.
The German and Portuguese cases are the most exposed (`-öst`/`-ëst`, `-écia`/`-ócia` are ordinary word
endings).

## Run 6 — 2026-10-09 21:30 — ports and gates

A first cut built the fixed patterns with `new RegExp(\`${WORD_START}…\`)`. `tools/extract_regexes.mts` reads
regex LITERALS only, so that would have dropped five French patterns out of `regex-corpus.jsonl` and out of
both regex-diff gates. Rewritten as literals with the lookbehind written out; only the two
`ABBREV_ALT` patterns (already templates) use the constant. Corpus re-extracted with the tool: 2384 patterns,
6 lines changed.

C# (`Languages/French/Normalize.cs`) and Rust (`languages/french/normalize.rs`) mirror the change; C#
`FrenchNameInitialTests.cs` and a Rust `#[cfg(test)]` module port the tests (Rust: fr only, fr-CA is not
ported). Revert proofs: C# 3 of 5 fail on origin's `Normalize.cs`; Rust 2 of 2 fail on origin's
`normalize.rs`. Two synthetic probe lines added to `rust/tools/fn-diff/probes/fr.txt`.

Gates, one at a time, on the final tree:

| gate | result |
|---|---|
| `npm run check:goldens` | 189 languages, 36495 rows, **0 stale** (no golden regenerated) |
| `npx vitest run` (full) | 6509 passed, 5 skipped, 7 failed — all 7 in `check-goldens-jobs.test.ts`, which execs `node_modules/.bin/tsx` and this worktree has no `node_modules`. With that one binary symlinked in: 9/9 pass. Environmental. |
| `dotnet test` (full) | 7183 passed, 0 failed |
| C# parity fr, fr-CA | 400/400 byte-identical |
| C# regex-diff | 145212 identical, 0 DIFFER, 0 refused |
| Rust regex-diff | 145212 identical, 0 DIFFER, 0 refused, 0 UNSOUND |
| `cargo test --workspace` | 92 passed, 0 failed |
| Rust parity (en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr) | 2000/2000 identical |
| fn-diff, fr dumps regenerated from the fixed TS | fr-normalize 12132, fr-ordinals 20120, fr-g2p 139488, fr-numbers 20084, fr-tagger 15009: all identical. phonemize-sync/best/trace 4043/4044 — the one row is the existing probe that needs ru + el, unported in Rust (recorded in the Rust fr port log). |
