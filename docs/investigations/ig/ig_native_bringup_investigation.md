# Igbo / Asụsụ Igbo (ig) native bring-up

Igboid (Volta-Niger, Niger-Congo), ~44M speakers (SE Nigeria) — Yoruba's sibling. A phonemic Latin orthography →
a rule-based g2p (the tonal-Latin pattern). Ported from the portable-espeak authoring (which was segmental-only)
+ tone added.

## Referee GAP (but NOT circular — adjudicated gold is meaningful)
No independent referee EXISTS: wikipron `ibo_latn`, epitran `ibo-Latn`, and the kaikki Igbo extract are all 404.
Unlike Bhojpuri (a Hindi clone, where a gold would be circular), Igbo is a **distinct language**, so the
hand-adjudicated gold (`test/igbo.test.ts`; Emenanjo 1978, Green & Igwe 1963) is a meaningful correctness anchor —
the Naija/Wu no-referee pattern. Recorded as `referees: []` + `secondaryGap`.

## Signature features
- **Labial-velar stops** ⟨gb⟩→ɡ͡b / ⟨kp⟩→k͡p; **labialised** ⟨nw⟩→ŋʷ, ⟨gw⟩→ɡʷ, ⟨kw⟩→kʷ; ⟨ny⟩→ɲ, ⟨ch⟩→t͡ʃ,
  ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ, ⟨gh⟩→ɣ, ⟨ṅ⟩→ŋ, ⟨r⟩→tap ɾ.
- **8-vowel harmony** with the dotted-below [-ATR] set ị→ɪ, ọ→ɔ, ụ→ʊ (derived from base + combining dot in NFD).
- **Two tones** — High=acute ˥, Low=grave ˩ (Chao letters), downstep=macron ˧. Igbo standard orthography usually
  OMITS tone, so a vowel is toned only when its diacritic is present (nwoke→ŋʷoke toneless; ọ́nụ→ɔ˥nʊ; àkwụ́kwọ́→
  a˩kʷʊ˥kʷɔ˥). Syllabic nasals m̩/n̩.

## Run 1 — 2026-07-15
Authored the NFD scanner (dotted vowels, digraphs, labial-velars/labialised, tone-when-marked) modelled on the
Yoruba engine. Verified the common-word gold: nwoke→ŋʷoke, nwaanyị→ŋʷaaɲɪ, kpọọ→k͡pɔɔ, chọrọ→t͡ʃɔɾɔ, ụlọ→ʊlɔ,
ọ́nụ→ɔ˥nʊ, àkwụ́kwọ́→a˩kʷʊ˥kʷɔ˥.

## Result — 🟡
Segmental g2p + tone-when-marked, adjudicated-gold-anchored (referee gap). 🟡 for the deferrals: tone is only read
when marked (usually absent in standard orthography — a lexicon/tone-dictionary would supply it); connected-speech
**downstep/spreading** beyond the two level tones; and the **vigesimal number system** (bounded authoring task).
