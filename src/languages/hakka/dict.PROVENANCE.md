# `dict.tsv` provenance — Hakka Chinese / 客家话 (hak), Meixian 梅县 (Moiyen) dialect

Han → Sinological-IPA readings, **9,220 entries**: 6,362 **traditional** headwords (2,600 single-character
citation readings + 3,762 multi-character word readings, with the Meixian tone sandhi baked in as
`underlying⁻surface`) + 2,857 **simplified** aliases generated from them, so mainland Hakka text (written in
simplified Han) resolves too, + **1 derived entry** (see below).

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

**Single-source ():** no independent second referee for Meixian Hakka (no wikipron hak; epitran ships no Hakka),
so this dict is verified only *within* the Wiktionary tradition — a systematic error shared with that source
would go undetected.

## Derived entries — exactly one, and why

Everything above is verbatim from kaikki. **One entry is not, and it is listed here so the file's provenance
claim stays exact:**

| key | reading | derivation |
|---|---|---|
| 度 | `tʰu⁵³` | see below |

**度 has no single-character Meixian reading in the source at all** — checked against the full 1.18 GB kaikki
Chinese extract, including non-primary readings: the character carries Hakka pronunciations tagged *Sixian*
(`Phak-fa-su thu`, `Sinological-IPA /tʰu⁵⁵/`) and *Hailu* (`/tʰu³³/`), and no *Meixian* one. The reading above
is derived, and three independent things agree on it:

1. **From the Meixian data itself.** Two multi-character Meixian entries in this very dict carry the character
   with its tone: `印度 in⁵³⁻⁵⁵ tʰu⁵³` and `深度 t͡sʰəm⁴⁴⁻³⁵ tʰu⁵³`. The single-character citation reading is
   read straight off them.
2. **From the source's own Sixian row.** Sixian `/tʰu⁵⁵/` is 去聲; the Meixian contour for 去聲 is ˥˧ — which
   is what (1) gives. Same segment, same tone category, the dialect's own contour.
3. **From hak.wikipedia.** The Pha̍k-fa-sṳ corpus writes the word 15 times as the degree unit (`Pet-vúi 42
   thu`, `180 thu`, `ngiap-shì 2040 thu`) and inside compounds (`Yin-thu` 印度, `chhòng-thu` 長度, `me̍t-thu`
   密度) — `th` = /tʰ/, matching (1) and (2).

⚠ **AND IT IS NOT A CONVENIENCE.** 度 is the **second most frequent uncovered single character** in the Han
portion of hak.wikipedia (137 occurrences; only 於 ×414 is commoner), and it is the one word
`normalize.ts` must emit for the degree rule to say anything at all — the shared Han engine SKIPS an
uncovered character silently, so `攝氏20度` would have read *ŋiap̚ sz̩ ŋi səp̚* with the unit gone. That is the
line drawn here: a character this layer EMITS gets sourced or the rule is declined (which is what the Jin layer
did with the same gap). 於 and the rest of the 1,282 uncovered characters are NOT added — they are the engine's
coverage gap, recorded in `docs/investigations/hak_normalization_investigation.md`, not this layer's.
