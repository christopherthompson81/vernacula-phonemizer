# af-lexicon.tsv — provenance

Proper nouns and opaque loans whose received pronunciation no Afrikaans spelling rule can
derive: Dutch/French/English-era name orthography (Botha→buəta, Blignault→ˈblɨxnœut,
Coetzee), anglicised initialisms (AWB), and the nasal-bearing set (Afrikaans→afrikɑ̃ːs).

**Source:** the en.wiktionary Afrikaans IPA rows themselves (human transcriptions),
normalized to the engine's conventions: stress marks, syllable dots and optional-schwa
parens stripped; segments kept verbatim (including ː and nasalization — the eval
backbone folds those for comparison, but the shipped output is richer for it).

**Circularity, stated:** Afrikaans is a SINGLE-SOURCE language (see langs/af.jsonc
`secondaryGap`), and these entries are drawn from the same referee the engine is scored
against — for these ~50 words the eval measures reference-parity, not independent
confirmation. That is the same trade tagalog's kaikki-sourced lexicons made, and it is
confined to words that are lexical by nature (no rule to verify). The rule engine's
score without the lexicon is the honest generative number; both are recorded in
docs/afrikaans_stress_investigation.md.

**Regeneration:** entries were the capitalized single-word folded misses of the referee
run at the time of authoring. New referee rows do not auto-flow here; add deliberately.
