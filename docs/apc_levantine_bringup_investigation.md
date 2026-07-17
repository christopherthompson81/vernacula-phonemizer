# North Levantine Arabic (apc) bring-up investigation

2nd Arabic VARIETY (after Egyptian arz), same architecture: shared Arabic engine + `levantine.jsonc` (IPA shifts on
the MSA g2p output), registered under ISO code `apc` (Syrian/Lebanese, urban). Referee: wikipron apc_arab_broad
(HUMAN, 410 words, fully-voweled DIALECTAL IPA, INDEPENDENT).

## Run 1 — 2026-07-17 — Levantine consonants (Phase 1)

Levantine differs from Egyptian mainly in **ج → [ʒ]** (Levantine fricative, vs Egyptian [ɡ]); the rest of the
consonant shifts match (ق→[ʔ] urban, ث→[t], ذ/ظ→[d]/[dˤ], ay→[eː], aw→[oː]). So `levantine.jsonc` is `egyptian.jsonc`
with one line changed. Confirmed against the referee: إجا→ʔiʒa, أورونج→…ʒ.

**Result: MSA baseline 18.8% → 23.2%** folded (+4.4pp from the consonant/diphthong shifts). جَمِيل → ʒamiːl
(Levantine) vs ɡamiːl (Egyptian) — the signature difference works.

**Lower than arz (37.3%) because Levantine IMĀLA is pervasive:** the referee shows aː→[eː] and a→[e] in many words
(آسف→ʔeːsef, not ʔaːsif). Imāla is context/lexically conditioned and VOWEL-level — the same data wall as arz (Run 3),
but with a bigger footprint here. The only machine-readable Levantine IPA is the 410-word wikipron scrape = the
referee, so a vowel lexicon is circular + tiny; blanket imāla rules would over-fire (as they did net-negative for
arz). So **consonants are done and verified; the vowels (imāla especially) are a documented ceiling with current
data** — recoverable in principle, no independent corpus. 🟡.
