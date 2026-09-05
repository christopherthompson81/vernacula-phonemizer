# Wu Chinese / Shanghainese (wuu) native bring-up

The **third Sinitic** language (after Mandarin `cmn` and Cantonese `yue`), ~80M speakers (Shanghai / Suzhou /
Ningbo group; the prestige variety is Shanghainese). Same *category* as Cantonese — a **Han→reading dictionary
front-end** (Hanzi is the orthography Wu speakers read) — but phonologically the most distinct Sinitic language
we cover, so reading the same characters produces genuinely different output (上海 → Mandarin *shànghǎi*,
Cantonese *soeng6hoi2*, **Shanghainese [zɑ̃hɛ]**).

## Ported from portable-espeak

espeak-ng ships nothing for Wu; we authored a full `wuu` bring-up in the sibling portable-espeak project
(7 runs — segmental, citation tone, numbers, left-prominent sandhi, the 陰平/陰去 split). This vernacula bring-up
**ports that authoring** into the `yue` architecture:
- `dict.tsv` (101,308 entries) — Han → Wugniu (zaonhe) readings from `authoring/wuu/{wuu_listx,wuu_words}`,
  stripped of the `$text` flag. Word entries carry the **baked sandhi melody**; char entries carry citation tone.
- `wu.jsonc` — the Wugniu→IPA converter (initials / finals / tones), ported from `wuu_rules` + `ph_wuu`.
- `wu.ts` — the runtime, modelled on `cantonese.ts`: greedy longest-match Han segmentation, per-syllable
  [initial]+final+Chao-tone conversion, Han-numeral composition, English fallback for Latin.

## The Wu signature (what makes it a distinct engine, not a variant)
- **Three-way obstruent contrast** — Wu keeps the Middle Chinese *voiced* series that both Mandarin and Cantonese
  lost: 巴 pa˥˧ (voiceless) / 怕 pʰa˧˦ (aspirated) / 爬 ba˩˧ (**voiced** → yang-register low tone). The onset's
  voicing *is* the tonal register.
- **Glottalised yin sonorants** (ʔm ʔn ʔl ʔŋ): 你 ʔni.
- **Checked coda** (入声 → glottal stop ʔ): 國 koʔ, 學 ɦoʔ, 一 iʔ.
- **Front-rounded ø/y**, the **apical ɿ** (詩 sɿ), nasalised finals (ɛ̃ ɑ̃ oŋ əɲ ɪɲ), syllabic nasals (五 ŋ̍).
- **Left-prominent register sandhi** — the whole prosodic word's melody is set by σ1's register (yin σ1 ˥ /
  medial ˧ / final ˧˩; yang σ1 ˨ / rest ˦): 上海 zɑ̃˨ hɛ˦, 中國人 t͡soŋ˥ koʔ˧ ɲɪɲ˧˩.

## Run 1 — 2026-07-15 — port + validation
Generated `dict.tsv`, wrote `wu.jsonc` (ported the initial/final/tone maps) and `wu.ts`. Validated the converter
against the portable-espeak investigation golds: **14/14** (上海, 中國人, 好人, 你好, 國, 學, 謝, 羊, 雲, 話, 詩,
試, 好, 衣). One apparent miss (衣 → `i`, not `ji`) resolved to a **doc-prose transcription slip on my part**: the
rime-wugniu reading for 衣 is bare `i1` (Wugniu writes the on-glide only where phonemic, e.g. 羊 `yan`), so `i˥˧`
is the faithful port output, confirmed against the compiled portable-espeak dict (`{"words":["衣"],"phonemes":
"i1"}`). Three-way contrast, checked codas, sandhi words, and Han-numeral composition all verified.

## Result — 🔷 single-source verified (was 🟡; reclassified 2026-07-16)
Faithful port of a validated bring-up. Sandhi + three-way voicing + checked codas + the 陰平/陰去 split all present.
**SINGLE-SOURCE** (no independent CROSS-referee — no wikipron/epitran wuu, and the whole modern Wu pronunciation
ecosystem derives from the ONE Wugniu/Zaonhe romanization tradition, so any automated referee would be circular
with our source; recorded as `referees: []` + `secondaryGap`). But the correctness rests on a SUBSTANTIAL
authoritative source (rime-wugniu, 101k entries) + spot-corroboration (Zhu 2006, wuuwiki inline IPA, the adjudicated
gold `test/wu.test.ts`). That is NOT ⛔ cannot-verify (bho's circular clone) — it's verified, single-source. The
caveat is evidence breadth, not output quality. See the 🔷 tier in docs/language-maturity.md. 🔷, with the inherited deferrals:
- composed word entries use the σ1 **citation** reading (a char's word-specific 文白 reading is captured only where
  the rime-wugniu source word list had it); the sandhi *melody* is unaffected (register-driven);
- simplified-only characters absent from the traditional-keyed source may miss (OpenCC fold covers the frequent
  ones);
- decimals read the point as a pause rather than 點 (integers are composed).
