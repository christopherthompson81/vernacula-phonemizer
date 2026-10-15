# `af-lexicon.tsv` — provenance

**What it is.** A small curated table of proper nouns and opaque loans whose received pronunciation no
Afrikaans spelling rule can derive (Botha, Blignault, Coetzee, `Afrikaans` with its nasal vowel).

**Source.** The en.wiktionary Afrikaans IPA rows (human transcriptions), normalized to this engine's
inventory rather than copied raw:
- stress marks, syllable dots and optional-segment parentheses removed;
- `ɪə`/`ʊə` → `iə`/`uə`, and `x` → `χ`;
- narrow marks this engine never emits are dropped (`ˑ`, non-syllabic `◌̯`), and `ɨ`/`ɲ`/`c` are mapped to
  `ə`/`n`/`k`;
- length `ː` and nasalization `◌̃` are kept.

Entries were picked from the capitalized single-word misses of the referee run at the time of authoring.
New referee rows are not added automatically.

**Licence.** Wiktionary content, CC BY-SA (`LICENSES/PROVENANCE.md` §3).

Build notes, including how the referee eval avoids scoring these rows: `docs/investigations/af/af-lexicon_build_notes_investigation.md`.
