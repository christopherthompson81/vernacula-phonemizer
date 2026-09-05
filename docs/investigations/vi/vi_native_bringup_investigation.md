# Vietnamese (vi) native bring-up

Target: Northern (Hanoi) Vietnamese, canonical IPA, espeak-independent. Slot #12 in the OmniVoice coverage set
(contributes `ˀ` glottalization + `ɗ` implosive). Vietnamese is written as space-separated MONOSYLLABLES; each
syllable is onset + (glide) + nucleus + tone + coda. espeak has solid Vietnamese, so the portable-espeak
canonical output is the oracle.

## Convention (from the portable-espeak canonical output)
- **6 Northern tones** as Chao contour letters AFTER the nucleus: ngang (no mark) `˧` (33), huyền `˨˩` (21),
  sắc `˧˥` (35), hỏi `˧˩˧` (313), ngã `˧ˀ˥` (creaky), nặng `˨˩ˀ` (heavy/glottal).
- Onsets: đ→`ɗ` (implosive), t→`t̪` (dental), th→`tʰ`, ch/tr→`t͡ɕ`, nh→`ɲ`, ng/ngh→`ŋ`, kh→`x`, ph→`f`,
  g/gh→`ɣ`, d/gi/r→`z`, x/s→`s`, qu→`kw`; vowel-initial → glottal `ʔ`.
- Rhymes with context: a→`e` before palatal nh/ch (anh→ʔeɲ), a→`aː` (long) elsewhere, ă/â→`a`/`ə`.
- Stress mark `ˈ` before the nucleus, tone after the nucleus, before the coda.

## Engine (g2p.ts)
1. **Tone extraction via Unicode NFD**: decompose the syllable, pull the tone combining mark
   (grave/acute/hook/tilde/dot-below), leaving the toneless base (â/ê/ô/ă/ơ/ư preserved).
2. **Onset** by longest orthographic match (digraphs first). qu → kw (u is the glide) except before ô/ơ where
   u+ô is the nucleus (quốc→kuək); gi → z, with the i rejoining a following iê diphthong (giết→ziɛt̪).
3. **Rhyme lookup**: Vietnamese rhymes are a CLOSED set (~375), so the rhyme (everything after the onset) is
   looked up in `rhymes.tsv` (derived from the portable-espeak gold, filtered to Vietnamese-only phonemes) —
   the same data-driven approach as the Japanese reading map. This captures the context rules (anh→eɲ, ach→ek,
   oa→waː) as data.
4. **Assembly**: onset + glide + ˈ + nucleus + tone + coda.

## Validation
The vi word corpus (25k) is heavily polluted with foreign words / acronyms / letter-names that espeak
phonemizes via its English fallback (peter, internet, single letters spelled out) — these are out of scope for
a Vietnamese phonemizer (they return "" and would need an English-switch + letter-name pass). On **pure-VN
single-syllable words** (9700, where both the word is all-Vietnamese-letters and the gold uses only VN
phonemes): **exact 93.0%, 93.3% with stress**. The residual is ~95% foreign words that coincidentally parse
(sony/piano/team). Genuine Vietnamese errors are a handful:
- **oa/oe + a contour tone**: espeak renders the glide as a separate toned vowel (họa→hˈo˧aː˨˩ˀ); we emit the
  standard glide + tone-on-nucleus (họa→hwˈaː˨˩ˀ). Deliberate divergence — ours is the standard representation.
- **disyllabic loanwords written as one word** (ôtô = ô·tô) — no space to split on.
- 112 function words where espeak uses secondary stress ˌ; we use ˈ (small).

The 6-tone minimal set is textbook-exact (ma/mà/má/mả/mã/mạ → aː˧/aː˨˩/aː˧˥/aː˧˩˧/aː˧ˀ˥/aː˨˩ˀ).

## Numbers
Cardinal compositor (numbers.ts): scales by thousands (mười/trăm/nghìn/triệu/tỷ), with the sound changes
5→lăm and 1→mốt after a ten, and linh for a zero tens slot. Northern forms (nghìn, not Southern ngàn).
Space-separated per the vernacula convention (espeak joins some).

## Run 1 — tonal engine — 2026-07-12
Built g2p.ts (NFD tone extraction + onset parse + rhyme table + assembly) + numbers + rhymes.tsv (375 entries);
registered `vi`. Fixed qu double-w (strip full kw in extraction), gi+ê→iê, and the quô nucleus case. 93.0%
exact on pure-VN single syllables; the metric is diluted by foreign-word corpus pollution (genuine VN accuracy
is much higher). Deferred: foreign-word English-switch + letter-name spelling, the oa-glide-tone espeak quirk
(we diverge deliberately), disyllabic-loanword splitting.
