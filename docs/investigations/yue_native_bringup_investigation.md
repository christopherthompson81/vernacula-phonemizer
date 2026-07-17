# Cantonese / Yue (yue) native bring-up — investigation log

Second Sinitic language after Mandarin. Han characters; the front-end maps Han→Jyutping via the rime-cantonese
dictionary, the back-end maps Jyutping→canonical IPA. Referees: epitran yue-Latn (INDEPENDENT, jyutping→IPA,
crude) + a 18-word adjudicated Han→IPA gold.

## Run 1 — 2026-07-15 — Han→Jyutping (rime-cantonese) + authored Jyutping→IPA → ✅

Architecture mirrors Mandarin (dict front-end + syllable back-end), but Cantonese-specific:
- **Han→Jyutping**: the rime-cantonese dictionary (dict.tsv, 121,768 word→jyutping entries, exported from
  pycantonese; CC BY). Greedy longest-match segmentation resolves polyphones BY WORD (銀行→ngan4 hong4 vs
  行路→haang4 lou6, 中→zung1). This is a real dictionary front-end, not a per-char table.
- **Jyutping→IPA** (cantonese.jsonc, authored): initials (b→p, p→pʰ, z→t͡s, gw→kʷ, …), finals with the phonemic
  aː/ɐ LENGTH split (aa=[aː] vs a=[ɐ]), the checked -p̚/-t̚/-k̚ codas, œː/ɵ round-front vowels, syllabic m̩/ŋ̩, and
  the SIX Cantonese tones as Chao contour letters (1˥ 2˧˥ 3˧ 4˨˩ 5˩˧ 6˨ — matching the espeak-portable
  investigation's contour analysis). Numbers via Han-numeral composition (零一二…十百千萬億) fed back through the dict.

DELIBERATELY NOT reused: the espeak-ng-portable yue data. It exists (data/yue, a full converged reader), but its
IPA is ESPEAK-PARITY-shaped — no length marks (ho, not hoː; ɡwonɡ), tone placed inside the coda (si˧p), ŋ→"nɡ",
z=ts. This project's premise is canonical IPA, so inheriting those quirks would be wrong. We keep the phonemic
length + standard tone placement. (Reused only the tone-contour analysis + the number spellings — both convention,
not espeak-shaped data.)

VALIDATION: the epitran yue-Latn referee is INDEPENDENT (not espeak-derived) but crude — it MERGES the aa[aː]/a[ɐ]
length (both→a), drops the vowel in some checked syllables (caat3→tsʰt̚, an epitran bug), and merges ing→ɛŋ. So it
CAPS the folded score at 70.9% (folds: aa/a merge, offglide i~j / u~w, tie notation, kʷ~kw), not our quality. The
adjudicated common-word Han→IPA gold is 100% (香港→hœːŋ˥ kɔːŋ˧˥, 飲茶→jɐm˧˥ t͡sʰaː˨˩, 屋企→ʊk̚˥ kʰei˧˥, all verified
standard HK Cantonese). Status ✅ referee(epitran)-limited. Suite 36/36; typecheck clean.

NEXT (deferred): tone sandhi (Cantonese changed-tone / 變調, e.g. 女→neoi5→neoi2 in some compounds); a wikipron
yue referee would corroborate the fine vowels epitran can't.
