# Madurese (mad) native bring-up

Austronesian (Malayo-Polynesian), ~14M speakers (Madura, East Java). Cleanroom
canonical-IPA rule g2p. **No machine referee exists** — no wikipron, no epitran
mapping, no kaikki, no Wiktionary IPA. But Madurese is richly documented: the build
is authored from **Davies (2010), *A Grammar of Madurese*** (Mouton), with the
**JIPA "Illustration of the IPA: Madurese"** transcribed text as a falsifiable
literary corroboration.

## Run 0 — 2026-07-17 — data check

- wikipron: none. epitran: no mapping. kaikki: no extract. Wiktionary: no IPA.
- Sources that DO exist: Davies (2010) full grammar (free PDF, text layer);
  Stevens (1968) phonology; Kiliaan (1897); a JIPA Illustration.

## Phonology (from Davies 2010, Ch. 2)

**Three-way stop system** (5 places × voiceless-unaspirated / voiceless-aspirated /
voiced), plus the retroflex series:
- bilabial /p pʰ b/, dental /t̪ t̪ʰ d̪/, retroflex /ʈ ʈʰ ɖ/, palatal /c cʰ ɟ/,
  velar /k kʰ ɡ/. Nasals /m n ɲ ŋ/, fricatives /s h/, liquids /l r/, glides /j w/,
  glottal stop /ʔ/. NB Davies analyses the "aspirated" series as **voiceless
  aspirated** [pʰ t̪ʰ …] (traditionally written as voiced-aspirate bh/dh).

**Eight vowels** /i ɨ u ɛ ə ɤ ɔ a/ with the signature **vowel harmony** (Ch.2 §4.1):
alternating pairs **ɛ~i, ɔ~u, a~ɤ, ə~ɨ** (non-high ~ high). The HIGH vowel follows
a **voiced OR voiceless-aspirated** stop (the ⟨b d dh j g⟩ register class); the LOW
counterpart occurs elsewhere (after voiceless-unaspirated stops ⟨p t ṭ c k⟩, nasals,
and word-initially). **[l r s j] are TRANSPARENT** word-internally (they pass the
preceding register through); word-initially they take the low vowel. Stevens: 95%
of words participate in this alternation. Stress is not salient (Davies §7) → not
emitted.

**The orthography problem.** The 1973 standard writes aspiration IDENTICALLY to
voicing (⟨b⟩ = both [b] and [pʰ]; ⟨d⟩ = [d̪]/[t̪ʰ]; ⟨j⟩ = [ɟ]/[cʰ]; ⟨g⟩ = [ɡ]/[kʰ]),
and ⟨e⟩ = [ɛ]/[ə]/[e], ⟨a⟩ = [a]/[ɤ], ⟨o⟩ = [ɔ]/[o]. So:
- The **b/pʰ consonant identity is not recoverable from spelling** (lexical) — but
  BOTH are register-raising, so the FOLLOWING VOWEL is still derivable.
- The **vowel quality IS derivable** from the preceding consonant's register class +
  the transparent-consonant rule (this is the whole point of the harmony).

Modern "Dutch-style" work (and the current orthography) writes the aspirates as
⟨bh dh jh gh⟩, which disambiguates the consonant — but introduces a ⟨dh⟩ collision
(retroflex vs aspirated-dental). Real Madurese text (Wikipedia) uses the **2008
revision**: aspirates ⟨bh dh jh gh⟩, retroflex with underdot ⟨ṭ ḍ⟩ (so ⟨dh⟩ = the
aspirated dental, NOT retroflex), and it marks vowel quality with ⟨â⟩ (ɤ) and ⟨è⟩ (ɛ).

## The reference — JIPA Illustration (Misnadin & Kirby 2020)

The user supplied the JIPA paper (open PDF). It gives, in the 2008 orthography +
broad IPA, the transcribed 'North Wind and the Sun' passage + wordlists — an
**independent, falsifiable gold** (35 orthography→IPA pairs curated). It confirmed
and sharpened the rules:
- ⟨bh⟩→pʰ, ⟨dh⟩→tʰ, ⟨jh⟩→cʰ, ⟨gh⟩→kʰ (voiceless aspirated); ⟨j⟩→ɟ; the dental series
  is written **plain t/d** in the broad transcription (retroflex ⟨ṭ ḍ⟩→ʈ/ɖ carry the contrast).
- The **harmony is keyed to the IMMEDIATELY PRECEDING consonant**, not a propagating
  state: bâla→[bɤla] (the ⟨a⟩ after transparent ⟨l⟩ stays low) vs pangambhârâ→[paŋampʰɤɾɤ]
  (⟨â⟩ is orthographically marked ɤ). raja→[ɾaɟɤ] (plain ⟨a⟩ after ⟨j⟩ raises).
- **Epenthesis**: ʔ between identical vowels (mataarè→mataʔaɾɛ); w/j between
  different-backness vowels unless height rises (loar→lɔwaɾ, kaduâ→kaduwɤ).
- **Final devoicing** (kamaksod→kamaksɔt) and **geminate length** (sèttong→sɛtːɔŋ;
  liquids degeminate, nyerra→ɲəɾa).

## Run 1 — 2026-07-17 — build + measure

A phonological engine (tokenize → epenthesis → immediately-preceding-consonant
harmony → final devoicing; geminate length in the tokenizer). First cut 60%; the
gaps were my gold's notation (I used t̪/d̪ and r where the JIPA broad passage uses
t/d and ɾ) + a propagating-state harmony bug. After switching to plain dentals,
normalising r→ɾ, and the immediately-preceding-consonant rule: **33/35 = 94.3%**.

The 2 residuals are orthographic under-specification, not engine bugs:
- **mokka→[mɔkːaʔ]**: a lexical word-final glottal /ʔ/ the orthography doesn't write.
- **aherra→[ahɛɾa]**: ⟨e⟩ = /ə/ vs /ɛ/ (we default /ə/); "aher" is underlyingly /ɛ/.
Neither is recoverable from spelling without a lexicon.

## Result

- JIPA gold (Misnadin & Kirby 2020): **94.3%** (33/35). Floor 0.86. → **🔷
  single-source** (one independent human phonetic source — small (35 words) but
  genuinely independent + falsifiable, and it PASSED). No machine referee exists.

## Run 2 — 2026-07-17 — adversarial review

Two latent fixes (neither touches the 35-word gold, both verified):
- **Cluster transparency was inert** — the `transp` class behaved like `low`, so
  the documented ⟨l r w y⟩ carry-through didn't exist. Fixed: a transparent consonant
  now passes a preceding stop's register through ONLY in an onset cluster (previous
  segment was a consonant): bra→[bɾɤ], gra→[ɡɾɤ], but pra→[pɾa] and bâla→[bɤla] (a
  liquid after a vowel is a fresh low onset). Gold unchanged at 33/35.
- **Final geminate devoicing** was length-sensitive (a final ⟨…bb⟩→[bː] missed the
  DEVOICE map); made it length-insensitive (sabb→[sapː]). Latent — Madurese has no
  word-final geminates.

**Deferred:** stress/intonation (Davies §7: "not a salient feature", no lexical
stress → not emitted); the two lexical ambiguities above (final-ʔ, /ə/~/ɛ/) which
need a pronunciation lexicon; morphological gemination at affix boundaries. A larger
gold (the full JIPA wordlist, a dictionary) would tighten the estimate beyond 35 words.
