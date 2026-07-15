# Burmese / မြန်မာ (my) native bring-up

Sino-Tibetan (Lolo-Burmese), ~43M speakers — the **hardest script/bring-up** in the project. The Mon-Burmese
abugida (Unicode U+1000–U+109F) is stored in LOGICAL order (consonant-first, no visual reordering), but the RIME
system is deeply contextual: a vowel's quality depends on its coda. Validated against two large human referees:
wikipron mya (8,288) + kaikki mya (8,107).

## The rime chart (the core difficulty)
A syllable = base consonant → medials → RIME. The rime is a 2-D function of the **vowel sign × coda class**:
- **Diphthongs surface only in CLOSED syllables**: ောင်→aʊɴ (aung), ိုင်→aɪɴ (aing), ိန်→eɪɴ (ein), ုန်→oʊɴ (oun).
- **A bare (inherent) rime takes the coda letter's historical vowel**: င်→ɪɴ, န်→aɴ, က်→ɛʔ, စ်→ɪʔ, တ်→aʔ.
- **⟨ွ⟩ labialisation** rounds the inherent vowel (ဝန်→wʊɴ, ကွန်→kʊɴ); with a vowel sign it is a plain -w- glide.
- **Minor-syllable reduction**: a bare open non-final syllable → [ə] (ဗမာ→bəma, ဆရာ→sʰəja).
- **Medials** palatalise velars (ကျ→t͡ɕ) and the **⟨ှ⟩** medial devoices sonorants (မှ→m̥, နှ→n̥, လှ→l̥).
- **Stacked consonants** (ကမ္ဘာ): the U+1039 stacker's upper member is silent.

## Runs — 2026-07-15
The number climbed the whole way as the model was corrected: flat "inherent-a + coda-type" **14%** → historical
killed-coda vowels **32%** → the full 2-D rime chart (vowel × coda class) **38%** → ⟨ွ⟩ labialisation + minor-
syllable ə **49%** → stacked consonants + the ော် tone-marker (not a checked coda) **50.5% / 52.1%**.

## Result — 🟠 (scope-limited; the hardest abugida)
50.5% / 52.1% FOLDED. The backbone strips TONE (the referees' à/á/a̰ diacritics), so this grades the SEGMENTAL
backbone — and common vocabulary is correct (မြန်မာ→mjaɴma, ကျောင်း→t͡ɕaʊɴ, အိမ်→ʔeɪɴ, တစ်→tɪʔ, the voiceless
sonorants). The moderate headline is deflated by the layers still DEFERRED:
- **The four tones** (low à / high á / creaky a̰ / checked) — Phase 2.
- **Intervocalic voicing sandhi** — an unaspirated onset voices after a vowel/nasal (k→ɡ, t→d, s→z, tɕ→dʑ,
  θ→ð), governed by compound boundaries → needs a lexicon.
- **Lexical rime variation** (ည → i ~ ɛ) and **word segmentation** (Burmese has no inter-word spaces).
A proper Burmese phonemizer needs a pronunciation lexicon for the sandhi + segmentation; this is a solid
rule-based Phase-1 core.
