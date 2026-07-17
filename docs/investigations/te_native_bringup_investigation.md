# Telugu (te) native bring-up — investigation log

Telugu — a Dravidian Brahmic abugida read by the generic engine (core/abugida.ts) + a Telugu data file
(telugu.jsonc). Unlike the Indo-Aryan abugidas there is NO inherent-vowel deletion (every akshara is
pronounced; inherent /a/). Referees: wikipron tel_telu broad (human, 5117) + a 20-word gold.

## Run 1 — 2026-07-15 — Dravidian abugida → ✅ (98.2% deduplicated, gold 100%)

Built telugu.jsonc (full Telugu consonant/vowel inventory) + a thin telugu.ts (abugida g2p + geminate→length +
final ం→[m], NO schwa deletion). Telugu-distinctive:
- Inherent /a/, and NO deletion — అంకము→aŋkamu (every vowel pronounced). This is the big difference from Hindi.
- Dravidian short/long e·o: ఎ [e] / ఏ [eː], ఒ [o] / ఓ [oː].
- DENTAL affricates ౘ [t͡s] ౙ [d͡z] alongside palatal చ [t͡ʃ] జ [d͡ʒ]; retroflex ళ [ɭ], ష [ʂ]; ఱ [r].
- Word-final anusvara ం → [m] (అంకురం→aŋkuɾam): presubstitute final ం→మ్; medial ం is homorganic via the engine.

Residual fixes: హ → [h] (voiceless — the referee uses [h] not [ɦ]: బహు→bahu); ళ్ల → [ɭː] assimilation
(కోళ్లు→koːɭːu). Folds: the alveolo-palatal ɕ/t͡ɕ/d͡ʑ = our ʃ/t͡ʃ/d͡ʒ (notation), tap ɾ, degemination.

RESULT: wikipron **98.2% DEDUPLICATED** (79.6% all-rows — multi-pron rows deflate the headline), adjudicated
common-word gold **100%**. Status ✅ — the shallow, deletion-free Dravidian orthography is highly derivable.
The thin residual is the ఋ/ృ = [ɻ̍] (referee's Sanskrit citation) vs our [ɾu] (spoken Telugu: కృష్ణ→kɾuʂɳa)
convention, the nasal-before-dental-affricate detail (ంౘ→n̪t͡s), and multi-pron variants. Suite 34/34; typecheck clean.
