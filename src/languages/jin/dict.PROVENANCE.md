# `dict.tsv` provenance — Jin Chinese / 晋语 (cjy), Taiyuan 太原 dialect

Han → Sinological-IPA readings, **6,467 entries**: 4,434 **traditional** headwords (1,967 single-character
citation readings + 2,467 multi-character word readings, with the Taiyuan tone sandhi baked in as
`underlying⁻surface`) + 2,033 **simplified** aliases generated from them (see below), so Shanxi text (written
in simplified Han) resolves too.

- **Source:** the **Wiktionary Chinese** dialectal-pronunciation data, via the machine-readable
  **kaikki.org** extract (`kaikki.org-dictionary-Chinese.jsonl`, 1.18 GB). Every entry whose `sounds`
  array carries a pronunciation tagged `["Jin", "Taiyuan", "Sinological-IPA"]` was kept; the IPA string
  is taken verbatim (stripped of the enclosing `/…/`). Where a character has several readings, the
  first-listed (primary/literary) reading is kept.
- **Format:** `<han-word>\t<syllable …>` where each syllable is segmental IPA + a superscript pitch-number
  tone (`ma⁵³`, `yəʔ²`); multi-syllable readings are space-separated and may carry a sandhi arrow
  `underlying⁻surface` (`九十 → t͡ɕiəu⁵³⁻¹¹ səʔ⁵⁴`). The runtime (`jin.ts`) segments a Han string by greedy
  longest match over these keys, converts each pitch digit → a Chao contour letter (1→˩ … 5→˥, the fleet
  tone convention), and renders the SURFACE tone after the arrow.
- **Tone system (Taiyuan, 5 citation tones):** 平 ˩˩ (11), 上 ˥˧ (53), 去 ˦˥ (45), 阴入 ˨ (2, checked/-ʔ),
  阳入 ˥˦ (54, checked/-ʔ). The 入声/checked coda -ʔ is the Jin signature that separates it from Mandarin.
- **"dated" tag:** the Taiyuan Sinological-IPA in Wiktionary is drawn from an older dialect survey and
  carries the `dated` tag; it is the only machine-readable Taiyuan IPA and is used as-is.
- **Simplified aliases:** the kaikki headwords are traditional. Each traditional key is converted
  character-by-character to simplified via **OpenCC `TSCharacters`** (Apache-2.0) and, where the result differs
  and doesn't collide with an existing key, added as an alias pointing at the same reading (中國 → 中国, both →
  `t͡suŋ˩˩ kuəʔ˨`). 2,033 aliases added, 17 collisions skipped.
- **License:** Wiktionary content is CC-BY-SA 3.0; the kaikki extract is a mechanical redistribution of it.
  OpenCC `TSCharacters` is Apache-2.0 (the same basis already used for the Wu simplified↔traditional folds).

**Single-source (🔷):** there is no independent second referee for Taiyuan Jin (no wikipron cjy — the scrape
404s — and epitran ships no Jin), so this dict is verified only *within* the Wiktionary tradition. A systematic
error shared with that source would go undetected. See docs/jin_native_bringup_investigation.md.
