# `mid-vowels.tsv` + `bl-gl-geminate.tsv` provenance — Catalan (ca)

Per-word abstract features for Central Catalan: `mid-vowels.tsv` (10.4k words → open/close
mid-vowel quality, e/ɛ and o/ɔ) and `bl-gl-geminate.tsv` (bl/gl gemination class). Built by
`tools/gen/build-ca-midvowels.mts` / `build-ca-geminate.mts`: espeak-ng 1.52's Central-Catalan
output over an external 50k frequency wordlist, with ONLY the abstract per-word feature kept
(no espeak rules, transcription conventions, or arrangement survive).

**Owner determination 2026-07-29 (docs/PROVENANCE.md §4.3): linguistic fact.** A word's
mid-vowel openness / geminate class is a dictionary fact of Central Catalan (DCVB/GDLC-
verifiable); the word selection is the external frequency corpus. ADR-0001 facts-not-expression
posture (docs/adr/0001-data-licensing-facts-posture.md). The files are headerless because the loader takes
every line as data.
