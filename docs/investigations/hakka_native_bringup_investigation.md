# Hakka Chinese (hak) native bring-up — Meixian 梅县

Hakka Chinese / 客家话, ~44M speakers across Guangdong/Fujian/Jiangxi, Taiwan, and the diaspora. A **distinct
primary branch of Sinitic** — the sixth Sinitic language covered (after Mandarin, Cantonese, Wu, Min Nan, Jin).
Its signature is the retention of **all three Middle Chinese stop codas -p̚ -t̚ -k̚** (十→səp̚, 月→ŋiat̚, 六→liʊk̚,
客→hak̚), where Jin merged them to a glottal -ʔ and Mandarin lost them entirely — so Hakka is the fleet's fullest
witness to the MC entering-tone system.

This is the second 🔷 Sinitic stub in a row, on the same Wiktionary/kaikki route proven for Jin.

## Data availability (checked up front)

- **wikipron hak** — none. **epitran** — no Hakka. So no independent referee → 🔷 (as with Jin).
- **Wiktionary/kaikki Chinese** — the `kaikki.org-dictionary-Chinese.jsonl` extract carries Hakka Sinological-IPA
  for several dialects: Sixian 四縣 (Miaoli/Neipu, Taiwan), Hailu 海陸 (Zhudong, Taiwan), and **Meixian 梅县**
  (mainland). Meixian is the traditional prestige/representative Hakka variety (the analogue of taking Taiyuan
  for Jin) and carries a clean single `Meixian` tag, so it was chosen. Tag filter:
  `["Hakka","Meixian","Sinological-IPA"]`.

## Build

Identical route to Jin. Streamed the 1.18 GB dump, kept every Meixian Sinological-IPA sound (first reading per
word) → **6,362 traditional headwords** (2,600 single-char + 3,762 multi-char words with baked `underlying⁻surface`
sandhi) + **2,857 simplified aliases** (OpenCC `TSCharacters`, Apache-2.0) → **9,219 entries**.

**Shared engine (the 2nd-consumer refactor).** Jin and Hakka are the two "IPA-already-in-the-dict" Sinitic
bring-ups (Wu and Min Nan instead carry a romanization → IPA layer). Rather than copy `jin.ts`, the shared logic
— greedy longest-match Han segmentation, superscript-tone → Chao contour-letter conversion (surface tone after
the `⁻` sandhi arrow), and Han numeral composition — was extracted to `src/languages/sinitic/hanDictIpa.ts` (since moved to `src/core/hanDictIpa.ts` — it is a core module, and `languages/sinitic/` was never a language); each
language module supplies only its dict + Chao map + punctuation. Jin was refactored onto it in the same change
(byte-identical output, its 6 tests still pass). This is the project's "gate from day one, lift the parameter
data on the 2nd consumer" convention applied to the shared engine.

## Tone system (Meixian, 6 citation tones)

| category | pitch | Chao | example |
|---|---|---|---|
| 陰平 yīn píng | 44 | ˦˦ | 馬 ma˦˦ |
| 陽平 yáng píng | 11 | ˩˩ | 人 ŋin˩˩ |
| 上 shǎng | 31 | ˧˩ | 犬 kʰian˧˩ |
| 去 qù | 53 | ˥˧ | 二 ŋi˥˧ |
| 陰入 yīn rù | 1 (checked) | ˩ | 六 liʊk̚˩ |
| 陽入 yáng rù | 5 (checked) | ˥ | 十 səp̚˥ |

Multi-char readings bake in the Meixian sandhi (中國 → 中 44→35 before a checked syllable → `t͡sʊŋ˧˥ kuɛt̚˩`); the
surface tone after the `⁻` arrow is rendered (surface inventory also includes the 35/55 sandhi contours).

## Verdict — 🔷 Single-source verified

A working Meixian Hakka phonemizer: 9,219 Han→IPA entries, the -p̚/-t̚/-k̚ coda signature, the six-tone system as
Chao letters, simplified + traditional input, and Han numerals — on a shared engine now covering two Sinitic
languages. Verified only *within* the Wiktionary tradition (no independent referee; the gap is recorded in the
referee-eval config, the anchor is the adjudicated gold). Deferred: cross-word phrase-level sandhi, the OOV
single-char tail beyond Wiktionary coverage, and the choice of Meixian over the Taiwan Sixian/Hailu standards
(a different dialect would be a separate dict on the same engine).
