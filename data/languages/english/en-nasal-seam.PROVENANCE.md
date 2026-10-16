# `en-nasal-seam.tsv` — provenance

**What it is.** For 38 English dictionary words, which `N` phones before `K`/`G` must not assimilate to [ŋ].
Most sit at a compound seam (`pan·cake`, `rain·coat`, `sun·glass`). CMUdict already writes `N` at each site;
the table stops the converter's velar-assimilation rule from overriding it.

**Sources.** Three referees, none of them this repo's:
- Moby Pronunciator II (Grady Ward), public domain by the author's grant (`LICENSES/PROVENANCE.md` §5.3);
- wikipron `eng_latn_us` broad, from Wiktionary, CC BY-SA;
- wikipron UK, from Wiktionary, CC BY-SA.

Only the verdict at the site is taken: whether the transcription writes `n` or `ŋ` before the velar. No
phoneme strings are copied, and only words already in this repo's dictionary get a row. A row needs every
covering referee to write `n`, plus either two covering referees or one referee and a seam visible in the
spelling.

**Licence.** Public domain + facts: each row is a CMUdict position, and the referees act only as filters
(`LICENSES/PROVENANCE.md` §1).

**Regenerate.** `tools/gen/build-en-nasal-seam.mts`, which is the whole extraction. It reads the morpheme
boundaries in `tools/gen/en-morph-boundary.tsv` (kaikki etymology templates, CC BY-SA; tools-only, see
`LICENSES/PROVENANCE.md` §3).

Build notes and measurements: `docs/investigations/en/en-nasal-seam_build_notes_investigation.md`.
