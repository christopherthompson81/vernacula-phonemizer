# dict.tsv provenance

`dict.tsv` (word → Jyutping, 121,768 entries) is the **rime-cantonese** dictionary, exported
from the `pycantonese` package (`pycantonese.data.rime_cantonese.CHARS_TO_JYUTPING`).

- rime-cantonese: https://github.com/rime/rime-cantonese — CC BY 4.0.
- It is the standard open Cantonese pronunciation dictionary; greedy longest-match segmentation
  over it resolves polyphones by word (銀行 ngan4 hong4 vs 行路 haang4 lou6).

Only the Han→Jyutping mapping is external data; the Jyutping→IPA conversion (cantonese.jsonc) is
authored here in canonical IPA (phonemic aː/ɐ length, checked codas, six Chao tones) — NOT inherited
from any espeak-parity source.
