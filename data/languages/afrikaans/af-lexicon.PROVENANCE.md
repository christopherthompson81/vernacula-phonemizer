# af-lexicon.tsv — provenance

Proper nouns and opaque loans whose received pronunciation no Afrikaans spelling rule can
derive: Dutch/French/English-era name orthography (Botha→buəta, Blignault→ˈblɨxnœut,
Coetzee), anglicised initialisms (AWB), and the nasal-bearing set (Afrikaans→afrikɑ̃ːs).

**Source:** the en.wiktionary Afrikaans IPA rows themselves (human transcriptions),
**normalized to this engine's inventory** — not copied raw:

- stress marks, syllable dots and optional-segment parens removed;
- `ɪə`/`ʊə` → `iə`/`uə` (our centering-diphthong onsets), `x` → `χ` (our ⟨g⟩ fricative);
- referee-narrow marks this engine never emits dropped: half-length `ˑ`, non-syllabic
  `◌̯`, and `ɨ`/`ɲ`/`c` mapped to the nearest inventory segment (`ə`/`n`/`k`);
- length `ː` and nasalization `◌̃` KEPT — the eval backbone folds them for comparison,
  but shipped output is richer for carrying them.

Why the normalization matters: the eval's own folds (`ɪ→i`, `ʊ→u`, `x→χ`) and backbone
strip exactly the symbols that were wrong in the first draft, so shipping them raw would
have put unmeasurable segments in users' output — invisible to every gate.

**Circularity, and how it is contained:** Afrikaans is a SINGLE-SOURCE language (see
langs/af.jsonc `secondaryGap`), and these entries come from the same referee the engine
is scored against. So **the eval does not see them**: `tools/referee-eval/eval.ts` scores
`phonemizeWordRules`, which skips this file, and the reported percentage is the honest
generative number. The house pattern (en-GB, tl, ilo do the same). The lexicon improves
the SHIPPED phonemizer only, which is where a proper noun's received pronunciation
actually matters.

**Scope:** words that are lexical by nature — no spelling rule could derive them. Rows
that the pipeline can never reach do NOT belong here and were removed in review:
single letters (the letter-name rule of #761 owns those), hyphenated names (the tokenizer
splits them), and initialisms (normalize.ts expands them first).

**Regeneration:** entries were the capitalized single-word folded misses of the referee
run at the time of authoring. New referee rows do not auto-flow here; add deliberately.
