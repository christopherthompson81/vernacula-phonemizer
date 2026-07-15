# `dict.tsv` provenance — Wu Chinese / Shanghainese (wuu)

Han → Wugniu (zaonhe romanization) readings, 101,308 entries: **11,714 single-character** citation readings +
**~89.6k multi-character word** entries with the left-prominent register sandhi baked in.

- **Source:** the **rime-wugniu** `zaonhe` schema (吳語學堂 / Wugniu romanization, Shanghai reading), via the
  espeak-ng-portable `wuu` authoring (`authoring/wuu/wuu_listx` + `wuu_words`). Word entries = the ~23.9k
  rime-wugniu multi-char readings (authoritative 文白) + ~65.7k composed from single-char citation readings over
  a jieba freq≥50 word list, in both simplified and OpenCC-traditional forms.
- **Tones are derived, not sourced** (the zaonhe dict carries no tone digits): citation tone from onset register
  + checked coda, with the 陰平/陰去 split recovered from each character's Middle Chinese tone category (via Unihan
  `kCantonese`); sandhi melody from the 廣用式 register 2-melody (compositional on σ1's register + syllable count).
- **License:** rime-wugniu carries **no license**. Used as functionally-reliable data (the same basis as the
  espeak-ng-portable `wuu` bring-up, which ships it publicly). Simplified↔traditional folds via OpenCC
  `STCharacters` (Apache-2.0).

Format: `<han-word>\t<wugniu-syllable+tonedigit> [<syllable+tonedigit> …]`. The runtime (`wu.ts`) segments Han by
greedy longest match over these keys and maps each Wugniu syllable → IPA via `wu.jsonc`.
