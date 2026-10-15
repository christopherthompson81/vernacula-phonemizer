# `pfs.tsv` — provenance (Pha̍k-fa-sṳ → Meixian IPA, hak)

**What it is.** Pha̍k-fa-sṳ (the missionary romanization of Hakka) → Meixian Sinological-IPA, 3,536 keys:
1,279 single syllables and 2,257 multi-syllable words. It is read by `pfs.ts`, the Latin-script arm of the
`hak` engine.

**Source.** The same kaikki.org extract of Wiktionary Chinese (`kaikki-Chinese.jsonl`) that `dict.tsv` comes
from. 6,269 headwords carry both a Pha̍k-fa-sṳ spelling and a Meixian Sinological-IPA reading, and 4,754 of
them align syllable for syllable; this table is built from those pairs.
- Wiktionary tags the spelling Sixian and the IPA Meixian, so the table maps the spelling onto this engine's
  Meixian phonology.
- The regional sub-variants (`Miaoli`, `Neipu`, `Zhudong`, `Hailu`) are excluded.
- Each syllable key takes its majority reading, preferring a reading that agrees with the onset the spelling
  declares. Word keys keep the `underlying⁻surface` sandhi arrow.

**Licence.** Wiktionary content is CC BY-SA 3.0, and the kaikki extract is a mechanical redistribution of it.
This derived table is distributed on the same terms as `dict.tsv`.

**Regenerate.** The 1.18 GB source is not committed. The builder is deterministic:

```
npx tsx tools/gen/build-hak-pfs.mts --kaikki <kaikki-Chinese.jsonl> --report --validate
```

Build notes, coverage and accuracy: `docs/investigations/hak/pfs_build_notes_investigation.md`.
