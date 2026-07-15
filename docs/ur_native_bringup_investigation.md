# Urdu (ur) native bring-up — investigation log

Urdu is the SAME spoken language as Hindi (Hindustani) — identical phoneme inventory (retroflex ʈ ɖ ɽ, dental
t̪ d̪, aspirates, ɳ, ɦ) — but written in the PERSO-ARABIC ABJAD (RTL display; logical order = phonetic order, so
RTL is a non-issue, as for Arabic). The hard part is the abjad property: LONG vowels are written (ا=ɑː, و=uː/oː,
ی=iː/eː, ے=eː) but SHORT vowels (ə ɪ ʊ) are usually OMITTED and must be restored — the same problem Arabic solved
with a neural diacritizer. First pass targets the consonant + long-vowel skeleton (+ diacritics when present);
short-vowel restoration is the deferred subsystem (🟠, mirroring Arabic's original state).

Referee: wikipron urd_arab broad (human, 7709 words) — fully-voweled Hindi-phonology IPA.

## Run 1 — 2026-07-15 — first-pass abjad G2P (🟠, folded backbone 42.9%)

Built the Urdu module: urdu.jsonc (letter→IPA maps, Hindi inventory) + g2p.ts (abjad parser) + urdu.ts
(Hindi weight-stress + numbers + clauses). Processing is logical-order (RTL is a non-issue, as for Arabic).

Handled: consonant letters; ASPIRATION (C + ھ do-chashmi-he → Cʰ voiceless / Cʱ breathy); retroflex ٹ ڈ ڑ,
dental t̪ d̪; long vowels written with ا/آ (ɑː), و (oː default), ی (iː default), ے (eː); hamza seats ئ/ؤ carrying
a hiatus vowel (بھائی→bʱɑːiː); و/ی as GLIDE ʋ/j after a vowel or before a vowel-letter (آواز→ɑːʋɑːz, دنیا→d̪ənjɑ);
word-final ہ → the [ɑ] vowel (بارہ→bɑːɾɑ, آئینہ→ɑːiːnɑ); ں nasalization; shadda→gemination; harakat when present.

SHORT-VOWEL problem (the abjad's core difficulty): ə/ɪ/ʊ are usually UNWRITTEN. Strategy chosen empirically —
insert a default [ə] between consonants, then Hindi Ohala medial-deletion. Measured 4 strategies on the referee:
Ohala-only 42.0% > Ohala+final-cluster-deletion 39.0% > no-deletion 27.7% > final-cluster-only 25.0%. So the
default-ə over-insertion (in clusters) is a bigger error than Ohala's occasional over-deletion → Ohala-only wins.
The final-cluster deletion HURTS (the referee KEEPS the ə in most VːCəC words: آدم→ɑːd̪əm, آتش→ɑːt̪əʃ) — دوست→d̪oːst̪
(Persian true cluster) is the minority. Removed it.

Fixes found via the residual: prevVowel detection read the trailing ː instead of the vowel (آواز→ɑːoːɑːz → ɑːʋɑːz);
added nasal PLACE assimilation n→ŋ/[velar] n→m/[labial] (انگور→əŋɡuːɾ, انبار→əmbɑːɾ); hamza seats ئ/ؤ.

RESULT: folded backbone (ə~ɪ~ʊ folded, ɾ→r, ʋ→v) **42.9%** vs wikipron urd. This measures the CONSONANT +
long-vowel skeleton we can derive; the unrecoverable pieces (short-vowel quality/placement, و/ی = oː/uː/eː/iː
lexical ambiguity) are the deferred restoration subsystem. Status 🟠 — mirrors Arabic before its neural diacritizer.

NEXT (deferred): short-vowel restoration — a diacritized-Urdu lexicon or a neural diacritizer would lift ur the
way the ONNX diacritizer lifted ar. و/ی quality also needs a lexicon.
