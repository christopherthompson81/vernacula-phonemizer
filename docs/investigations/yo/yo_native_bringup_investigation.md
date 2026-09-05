# Yoruba / Èdè Yorùbá (yo) native bring-up

Volta-Niger (Niger-Congo), ~46M speakers (Nigeria, Benin, Togo, + diaspora). A highly PHONEMIC three-tone Latin
orthography, so a near one-to-one rule-based g2p (the Hausa tonal-Latin pattern). Ported from the portable-espeak
authoring (epitran-validated). Validated here against **three referees**: wikipron yor + kaikki yor (both human,
large) + epitran yor-Latn.

## Signature features
- **Labial-velar stops** ⟨gb⟩→ɡ͡b and ⟨p⟩→k͡p (Yoruba has NO plain /p/); ⟨j⟩→d͡ʒ, ⟨y⟩→j (glide), ⟨ṣ⟩→ʃ, ⟨r⟩→tap ɾ.
- **Dotted-below vowels** ẹ→ɛ, ọ→ɔ (7 oral vowels i e ɛ a ɔ o u), derived from the base + combining dot in NFD.
- **Nasal vowels** from a coda ⟨n⟩ (ọdún→ɔdũ) — but an onset n before a vowel stays n (ẹni→ɛni); **syllabic** m̩/n̩.
- **Three LEVEL tones** on each vowel / syllabic nasal: High=acute ˥, Mid=unmarked ˧, Low=grave ˩ (Chao letters).

## Runs — 2026-07-15
- **Run 1** — authored the NFD scanner (vowel + dot-below + tone accent; coda/onset/syllabic n; gb/p/ṣ; Chao
  tones). First measure **88.5% / 87.7%**. The residual was dominated by referee noise (single-letter/letter-name
  entries B→bí, IPA-glyph headwords Ɔ̀) plus two real graphemes: **gh→ɣ** (ghọn→ɣɔ̃) and **Cʷ labialisation**
  (ẹgwa→ɛɡʷa). Added both → **89.6% / 88.8%.**

## Result — ✅
89.6% / 88.8% across two large independent human referees. Tone is folded by the backbone (our Chao letters AND
the referees' tone-accent diacritics á à ā both strip), so this grades the SEGMENTAL backbone; the tone system
itself is verified on the gold (bá/bà/ba → ba˥/ba˩/ba˧). The residual is diffuse referee noise (letter-name
entries, IPA-glyph headwords, syllabic-nasal place). Deferred: **tone processes** (spreading/sandhi on connected
speech) beyond the three level citation tones; the Yoruba **vigesimal number system** (famously complex,
subtraction-based — a bounded authoring task).
