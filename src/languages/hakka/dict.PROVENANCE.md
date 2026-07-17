# `dict.tsv` provenance — Hakka Chinese / 客家话 (hak), Meixian 梅县 (Moiyen) dialect

Han → Sinological-IPA readings, **9,219 entries**: 6,362 **traditional** headwords (2,600 single-character
citation readings + 3,762 multi-character word readings, with the Meixian tone sandhi baked in as
`underlying⁻surface`) + 2,857 **simplified** aliases generated from them, so mainland Hakka text (written in
simplified Han) resolves too.

- **Dialect choice:** Hakka has several standards in Wiktionary (Sixian 四縣 and Hailu 海陸 in Taiwan, Meixian
  梅县 on the mainland). **Meixian** is the traditional prestige/representative dialect (the analogue of taking
  Taiyuan for Jin), and it carries a clean single `Meixian` tag, so it was chosen for consistency.
- **Source:** the **Wiktionary Chinese** dialectal-pronunciation data, via the machine-readable **kaikki.org**
  extract (`kaikki.org-dictionary-Chinese.jsonl`, 1.18 GB). Every entry whose `sounds` array carries a
  pronunciation tagged `["Hakka","Meixian","Sinological-IPA"]` was kept (first/primary reading per word); the
  IPA string is taken verbatim (stripped of the enclosing `/…/`).
- **Format:** `<han-word>\t<syllable …>` where each syllable is segmental IPA + a superscript pitch-number tone
  (`ma⁴⁴`, `səp̚⁵`); multi-syllable readings are space-separated and may carry a sandhi arrow `underlying⁻surface`.
  The runtime (`hakka.ts` via the shared `hanDictIpa.ts`) segments a Han string by greedy longest match over
  these keys, converts each pitch digit → a Chao contour letter (1→˩ … 5→˥), and renders the SURFACE tone after
  the arrow.
- **Tone system (Meixian, 6 citation tones):** 陰平 ˦˦ (44), 陽平 ˩˩ (11), 上 ˧˩ (31), 去 ˥˧ (53), 陰入 ˩ (1,
  checked/-ptk̚), 陽入 ˥ (5, checked/-ptk̚). The retained **-p̚ -t̚ -k̚** stop codas (all three MC entering-tone
  codas) are the Hakka signature that separates it from Jin (merged -ʔ) and Mandarin (lost).
- **Simplified aliases:** the kaikki headwords are traditional; each key is converted character-by-character to
  simplified via **OpenCC `TSCharacters`** (Apache-2.0) and, where the result differs and doesn't collide with an
  existing key, added as an alias pointing at the same reading. 2,857 aliases added, 27 collisions skipped. Same
  merged-simplified-char caveat as Jin (a merged glyph keeps only its own primary-sense reading).
- **License:** Wiktionary content is CC-BY-SA 3.0; the kaikki extract is a mechanical redistribution of it.
  OpenCC `TSCharacters` is Apache-2.0.

**Single-source (🔷):** no independent second referee for Meixian Hakka (no wikipron hak; epitran ships no Hakka),
so this dict is verified only *within* the Wiktionary tradition — a systematic error shared with that source
would go undetected. See docs/investigations/hakka_native_bringup_investigation.md.
