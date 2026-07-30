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

## Run 3 — 2026-07-28 18:00 — VIGESIMAL cardinal number compositor (numbers were deferred)

Question: `phonemize("<int>", "ka")` passed the digits through. Probe: 110/110 DIGIT-LEAK.

**Pattern B mandatory** (`src/languages/georgian/numbers.ts` + a `numbers` block in `georgian.jsonc`). Georgian is
not decimal below 100 — the shared `westernNumberWords` reads round TENS, and Georgian **has none**.

★ Score construction (20–99): the four score words are 20 ოცი, 40 ორმოცი (2×20), 60 სამოცი (3×20),
80 ოთხმოცი (4×20). Any other 21–99 is the score's stem + -და- ("and") + the plain **1–19** numeral as ONE word,
so the teens attach into the same slot. There is no ten digit: 50 = 2×20+10, 70 = 3×20+10, 90 = 4×20+10.
Implementation: score index = floor(n/20) ∈ 1..4, remainder = n − 20·index ∈ 0..19 by construction.

★ Truncation (≥ 100): groups are separate words, and a numeral FOLLOWED by a smaller number drops its final ⟨ი⟩.
This is LOCAL — the hundred truncates iff its own sub-hundred remainder is non-zero; a magnitude noun truncates
iff any remainder follows. A multiplier never truncates. Stored as bare/comb pairs in the jsonc.

Sources: ka.wikipedia `N (რიცხვი)` articles for 0–20, the round tens and the hundreds (0 ნული, 8 რვა,
19 ცხრამეტი, 30 ოცდაათი, 50 ორმოცდაათი, 70 სამოცდაათი, 90 ოთხმოცდაათი, 100 ასი, 300 სამასი, 700 შვიდასი,
1000 ათასი); ka.wikipedia YEAR articles as the compound/truncation referee; Wikipedia "Georgian numerals" for the
two rule statements. Note Omniglot's Georgian page mis-OCRs 300 as *ამასი — ka.wikipedia's სამასი is correct.

Verification against the year-article referee — every one an exact match: 101 ას ერთი · 1101 ათას ას ერთი ·
1300 ათას სამასი · 1500 ათას ხუთასი · 1800 ათას რვაასი · 1900 ათას ცხრაასი · 1959 ათას ცხრაას ორმოცდაცხრამეტი ·
1999 ათას ცხრაას ოთხმოცდაცხრამეტი · 2001 ორი ათას ერთი · 2101 ორი ათას ას ერთი. Spot checks required by the
task: 30 ოცდაათი · 45 ორმოცდახუთი · 67 სამოცდაშვიდი · 89 ოთხმოცდაცხრა · 99 ოთხმოცდაცხრამეტი.

Judgment call: 1000 → bare ათასი (no *ერთი ათასი — every ka.wikipedia 1000s year spells it that way), but
10^6/10^9 keep it (ერთი მილიონი / ერთი მილიარდი, both attested in running text) since those are borrowed nouns.

Result: probe **CLEAN** across the required range. Tests in test/georgian.test.ts.
