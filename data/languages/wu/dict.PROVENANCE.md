# `dict.tsv` — provenance (Wu Chinese / Shanghainese, wuu)

**What it is.** Han → Wugniu (zaonhe romanization) readings, 101,308 entries: 11,714 single-character
citation readings and about 89.6k multi-character words with register sandhi applied.

**Source.** The **rime-wugniu** `zaonhe` schema (吳語學堂 / Wugniu romanization, Shanghai reading),
<https://github.com/rime/rime-wugniu>, **GPL-3.0**.
- About 23.9k word entries are rime-wugniu's own multi-character readings.
- About 65.7k are composed here from its single-character readings over a jieba frequency ≥ 50 word list, in
  simplified and OpenCC-traditional forms.
- **Tones are derived here, not taken from the source**, which carries no tone digits. The citation tone
  comes from onset register and checked coda, with the 陰平/陰去 split taken from each character's Middle
  Chinese tone category (via Unihan `kCantonese`). The sandhi melody follows the 廣用式 register system.
- Simplified↔traditional folding uses OpenCC `STCharacters` (Apache-2.0).

**Licence.** This derived file is distributed under **GPL-3.0**. It is its own source, which satisfies the
source-availability condition. The runtime that reads it is not thereby GPL. The fence and the fallback (a
kaikki rebuild) are in `LICENSES/PROVENANCE.md` §4 item 2.

An earlier note said rime-wugniu carried no licence. That was wrong and was corrected on 2026-07-29: the
repository has carried a GPL-3.0 LICENSE since 2012-07-26.

Build notes: `docs/investigations/wuu/wu-dict_build_notes_investigation.md`.
