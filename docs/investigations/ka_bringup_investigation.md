# Georgian (ქართული, ka) bring-up — Kartvelian, Mkhedruli script

Georgian, Kartvelian (its own family — a fleet first), Georgia (~4M), the Mkhedruli alphabet. The orthography is
essentially ONE-LETTER-ONE-PHONEME (transparent, no digraphs), so the greedy-table pattern (Kikuyu/Kamba) fits
directly. Beyond-espeak, authored.

## Run 1 — 2026-07-25 — referee + empirical table derivation + one rule

**Referee is STRONG (unlike Kamba).** en.wiktionary Georgian has ~16k lemmas but almost none with IPA (the orthography
is so predictable editors skip it). But **wikipron `kat_geor_narrow` has 20,894 HUMAN-transcribed words** (CUNY-CL/
wikipron) — a large narrow-phonetic set. Saved as `ka.wikipron-kat-narrow.tsv`.

**Derived the 33-letter table empirically** from 18,350 1:1-aligned referee words (each Mkhedruli letter = one phone,
aggregated). This CONFIRMED the mapping and corrected two memory guesses: **ღ=ʁ** (voiced UVULAR, not velar ɣ) and
**ხ=χ** (voiceless UVULAR, not velar x). The three-way stop/affricate contrast is clean: voiced (ბ b) / aspirated
(ფ pʰ) / ejective (პ pʼ) at every place; uvular ejective ყ=qʼ (referee narrow [χʼ]); 5 vowels a ɛ i ɔ u (referee
narrow ä/e̞/o̞). Affricates tie-barred (t͡ʃ, d͡z, …).

**One context rule.** The pure table scored 91.7% folded, and the entire residual was a single process: **word-final
voiced STOPS devoice to aspirated** — ⟨დ⟩→tʰ (1584/1585), ⟨ბ⟩→pʰ (100/101), ⟨გ⟩→kʰ (11/12); the voiced fricatives/
affricates (ვ ზ ღ ძ ჯ) do NOT devoice finally. Modelled it as the ONE code rule (`FINAL_DEVOICE` in georgian.ts, keyed
on the final output char). Per the explicitness principle — it's a categorical, strongly-attested realisation, so emit
it rather than fold it.

**Result: 99.8% folded / 100% symbol** on the 20,894-word human referee — near the top of the fleet. The 49 residual
words are junk (4 Asomtavruli single-letter entries whose capital codepoints aren't in the Mkhedruli table), 3
single-letter citation forms my final-devoicing rule over-devoices, and a couple of loanword edges (asphalt ⟨ფ⟩→f).

**Folds (config):** segmentJoin (the referee is space-separated per phone); the shared BACKBONE already strips the
combining diacritics (ä→a, e̞→e, o̞→o, devoicing rings) + ties, so the per-language folds are just the remaining narrow
allophony: e→ɛ / o→ɔ (mid-vowel symbol), dark ɫ→l, pre-velar n→ŋ, the ვ labialisation glide ʷ→v, ⟨ყ⟩ [χʼ]→qʼ, and the
non-final ვ devoicing f→v.

**Status: well-verified (large single human source).** wikipron is the only numeric referee (no kaikki dump / epitran
kat committed), but at 20,894 words with a transparent orthography the segmental inventory is strongly attested — each
letter rests on hundreds–thousands of aligned tokens, and the mapping is the standard Georgian alphabet→IPA of any
grammar. Stress (weak/non-contrastive) + numbers deferred.

## Run 2 — 2026-07-25 — 3-angle review fixes

Table values + folds verified sound (no over-fold inflates the 99.8%; all 33 letters correct). Fixes:
- **Mtavruli titlecase bug** — `phonemizeWord` had dropped the template's `.toLowerCase()`, so all-caps Georgian
  (Mtavruli, U+1C90–1CBF, used for headings) survived NFC and missed the Mkhedruli-keyed table → EMPTY output
  (ᲡᲐᲥᲐᲠᲗᲕᲔᲚᲝ → ""). Restored `.toLowerCase()` (JS lowercases Mtavruli→Mkhedruli); regression test added.
- **჻ (Georgian paragraph separator)** added to the tokenizer + clausePunctuation → a sentence pause (was dropped).
- **x→χ fold** added: ⟨ხ⟩ has a velar allophone [x] before front vowels (~3 referee words) we emit as uvular χ →
  honest allophonic fold (20845→20848).
- **Doc accuracy**: removed the stale "no code rules / pure greedy" claims (manifest.ts + georgian.jsonc) and corrected
  the comments that wrongly described the final STOP devoicing as folded — it is MODELLED in georgian.ts (only the
  fricative ⟨ვ⟩→f is folded). A maintainer could otherwise have deleted FINAL_DEVOICE thinking it was an eval fold.
- **Known limitation (deferred):** the archaic Mkhedruli letters ჱ ჲ ჳ ჴ ჵ ჶ ჷ ჸ ჹ ჺ (U+10F1–10FA, dropped from the
  modern 33-letter alphabet) are not in the table → skipped; out of scope for modern Georgian text.
