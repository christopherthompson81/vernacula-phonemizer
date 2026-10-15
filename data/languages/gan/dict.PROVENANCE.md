# `dict.tsv` — provenance (Gan Chinese / 贛語, gan; Nanchang 南昌 dialect)

**What it is.** Han → Sinological-IPA readings, 5,033 entries: 3,531 traditional headwords (single-character
readings and multi-character words, with Nanchang tone sandhi as `underlying⁻surface`) plus 1,502 simplified
aliases.

**Source.** The Wiktionary Chinese dialectal-pronunciation data, via the kaikki.org extract
(`kaikki.org-dictionary-Chinese.jsonl`). Every entry whose `sounds` array carries a pronunciation tagged
``["Nanchang","Sinological-IPA"]`` was kept, with the IPA string taken verbatim (slash delimiters stripped).

**Simplified aliases.** The kaikki headwords are traditional. Each key is converted character by character
with OpenCC `TSCharacters` (Apache-2.0), and where the result differs and does not collide with an existing
key, it is added as an alias for the same reading.

**Licence.** Wiktionary content is CC BY-SA 3.0, and the kaikki extract is a mechanical redistribution of it.
OpenCC `TSCharacters` is Apache-2.0. This file is in the share-alike stratum (`LICENSES/PROVENANCE.md` §3).

Build notes: `docs/investigations/gan/gan-dict_build_notes_investigation.md`.
