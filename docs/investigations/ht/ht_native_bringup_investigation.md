# Haitian Creole (kreyòl ayisyen, ht) bring-up — French-lexified creole, Latin, Haiti (~12M)

Haitian Creole — a French-lexified creole (the 3rd creole in the fleet, after [[kabuverdianu_bringup]] kea + Nigerian Pidgin pcm; kea is
Portuguese-lexified). ~12M speakers, Haiti. The IPN orthography (Pressoir-Faublas 1979 standard) is deliberately
PHONEMIC — one letter/digraph ≈ one sound — so a greedy scan + the nasal-vowel rule nails it. Referee: **wikipron
`hat_latn_broad`** (human, CUNY-CL, 1691 headwords) + kaikki. espeak ships a Haitian voice; this is independent.

## Run 1 — 2026-07-26 — the IPN phonemic g2p + the nasal-vowel rule

**Vowels:** ⟨a e i o⟩→[a e i o], ⟨è⟩→[ɛ], ⟨ò⟩→[ɔ], **⟨ou⟩→[u]** (jou→ʒu, moun→mun), ⟨ui⟩→[ɥi] (uit→ɥit).

**★ The NASAL-VOWEL rule (the core):** ⟨an en on⟩ (plain a/e/o + ⟨n⟩) → the nasal vowels **[ã ɛ̃ ɔ̃]** — but only when
the ⟨n⟩ is syllable-final (before a consonant or word-end): nan→nã, senk→sɛ̃k, bonjou→bɔ̃ʒu, lang→lãɡ (an+g). Before a
VOWEL the ⟨n⟩ is an oral onset (no nasalization). A DOUBLED ⟨nn⟩ → nasal vowel + [n] (Enndyana→ɛ̃ndjana). Only ⟨a e o⟩
nasalize — ⟨i⟩ (machin→maʃin) and ⟨ou⟩ (moun→mun) do NOT, and ⟨è ò⟩ (accented) stay oral.

**Consonants:** ⟨j⟩→[ʒ] (jou→ʒu), ⟨ch⟩→[ʃ] (chwal→ʃwal), **⟨r⟩→[ɣ]** (the Haitian velar fricative: diri→diɣi,
frè→fɣɛ, kreyòl→kɣejɔl), ⟨y⟩→[j] (kay→kaj), ⟨w⟩→[w], ⟨g⟩→[ɡ]; ⟨p t k b d f l m n s z v⟩ direct. ⟨h⟩→[h] (rare).

**Stress** (final-syllable, predictable) is not emitted — the referee marks none. **FOLDED:** the rhotic ɣ~ʁ~w~ɰ
(variants), rare loan nasals (õ~ɔ̃, ũ~u). 🔷 single source (wikipron 1691; kaikki a candidate 2nd).

## Run 2 — 2026-07-26 — the IPN phonemic g2p → 97.7% folded / 99.4% symbol

The direct IPN map + the nasal-vowel rule scored **96.9% folded on the FIRST pass** (the orthography is near-phonemic).
Three small residual-driven fixes → **97.7%**:

- **⟨an en on⟩ nasalize before a GLIDE ⟨y w⟩** too (anyen→ãjɛ̃, anwo→ãwo) — the "oral before a vowel" exception is only
  for TRUE vowels; a following glide is not a nucleus, so the vowel still nasalizes;
- **geminate collapse** (accoma→akoma — doubled consonants in loan spellings → single);
- the Haitian **⟨r⟩ [ɣ] → [w] before a rounded vowel** (o/ò/ou): ayeropò→ajewopɔ, larouze→lawuze — a documented
  positional realization (+0.3pp); ⟨r⟩ stays [ɣ] elsewhere (diri→diɣi, granmoun→ɡɣãmun).

**Residual (all 1×):** the rest of the variable ⟨r⟩ realization (coda-⟨r⟩ dropping, ajourte→aʒute), loan vowels
(o→ɤ, e→ɛ before a coda), and loan clusters (bilding→bildzin). NOTE: **the backbone strips the nasal tilde** (a
combining mark), so the nasal-vowel comparison reduces to the base vowel — our canonical output DOES emit the nasals
(ã ɛ̃ ɔ̃); the eval just can't grade the tilde. The 99.4% symbol accuracy confirms the segments are essentially perfect.

**FOLDED:** the rhotic ɣ~ʁ~ɰ, the rare loan nasals (õ→ɔ̃, ũ→u), stress (unmarked). **97.7% folded / 99.4% symbol.**
🔷 single source (wikipron 1691; kaikki a candidate 2nd).
