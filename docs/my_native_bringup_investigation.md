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

## Run — 2026-07-16 — TONES (Phase 2) + segmental fixes

Picked up the sole remaining 🟠 language. Attacked the biggest deferred subsystem (tones) plus the segmental
residual classes surfaced by the eval.

**Segmental fixes** (50.5/52.1 → **54.2/55.9%** folded):
- **`ေါ` tall-aa variant (U+102B).** The `ော=au` combo detection only tested `ာ` (U+102C), so `ေါ` fell to plain
  `a`: `ပေါ→pa` not `pɔ`, `ခေါင်→kʰaɴ` not `kʰaʊɴ`, `ဒေါ်→da` not `dɔ`. Accept both aa variants → +1.1.
- **`ငြ→ɲ`.** The palatal map lacked the velar nasal, so `ငြိမ်→ŋjeɪɴ` not `ɲeɪɴ`. Added `ŋ→ɲ`.
- **`ွ` before `-ng`.** `ွ`/onset-`ဝ` rounds the inherent rime to ʊ (`ကွန်→kʊɴ`), BUT before the velar-nasal `င်`
  coda it stays a `-w-` glide (`လွင်→lwɪɴ`, `ကွင်း→kwɪɴ`, `ဝင်→wɪɴ`) — the front `-ɪɴ` rime blocks rounding.
  Coda-specific, decided after the coda is known.

**TONES (Phase 2 — the deferred subsystem, now DONE).** Burmese tone is ORTHOGRAPHIC and rule-derivable (no
lexicon). Rendered as Chao letters (repo convention): **low ˨ / high ˥˩ / creaky ˥ˀ**, checked = the ʔ coda (no
letter), inserted after the nucleus (before a ɴ/ʔ coda). Rules: explicit marks win — visarga `း`→high, dot-below
`့`→creaky, asat-on-vowel `ော်`→low; else a CLOSED (nasal) syllable is low; else OPEN by vowel — `ော`/`ဲ`→high,
bare-inherent / short `ိ`/`ု`→creaky, else (long `ီ`/`ူ`, `ာ`, `ေ`, `ို`) low. Minor `ə` syllables are toneless.
The dot-below can sit between the coda letter and its asat (`ကန့်`) — handled in the coda scan.

**Tone eval** (`tools/my-tone-eval.ts`, tone-category sequence ours-Chao ↔ referee-diacritics): **99.6% mono
(1633/1640), 97.9% per-syllable aligned** vs kaikki (same vs wikipron) — beats the prior bring-up's 92.2%. The
whole-word sequence is 79.9%, deflated almost entirely by syllable-count mismatch (1340 length vs 290 tone), i.e.
the still-deferred minor-syllable-reduction problem, not the tone rules. The segmental eval folds the creaky `ˀ`
(a tone marker) like vi.

## Result — 🟠 (scope-limited; the hardest abugida) — tones now done
**54.2% / 55.9%** FOLDED segmental (the backbone strips TONE — the referees' à/á/a̰ diacritics + our Chao letters).
Tones are DONE and measured (99.6% mono). Common vocabulary correct (`မြန်မာ→mja˨ɴma˨`, `ကျောင်း→t͡ɕaʊ˥˩ɴ`,
`ကန်း→ka˥˩ɴ`). Still 🟠 — two whole subsystems remain DEFERRED (needs a pronunciation lexicon):
- **Intervocalic voicing sandhi** — an unaspirated onset voices after a vowel/nasal (k→ɡ, t→d, s→z, tɕ→dʑ, θ→ð),
  compound-boundary governed → the biggest residual class (`က→ka` vs referee `ɡa`). Buildable from the kaikki data
  (which carries the voiced forms), as the old espeak-ng-portable bring-up did.
- **Lexical rime variation** (`ည` → i ~ ɛ) and **word segmentation** (no inter-word spaces) + minor-syllable
  reduction (the syllable-count tail on the tone whole-word metric).
