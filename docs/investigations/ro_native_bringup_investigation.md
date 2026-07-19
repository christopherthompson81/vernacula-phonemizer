# Romanian (ro) native bring-up

Romanian — Eastern Romance (~25M), shallow near-phonemic Latin orthography with diacritics ă â î ș ț. Well-resourced:
wikipron ron_latn broad (HUMAN, **9285** — one of the largest referees in the fleet) + a 5922-entry narrow. Its own
module (no shared Romance engine); modeled on the Italian pattern (scan → segments, manifest letter maps).

**Scope gates:** both trivially pass — Latin orthography (obviously community-adopted) + a huge independent human
referee. This is a clean, well-resourced bring-up.

**Phonology built (Run 1):** 7-vowel a e i o u + ă→ə, â/î→ɨ; ș→ʃ, ț→t͡s, j→ʒ, h→h (pronounced); c/g softening
(ce ci→t͡ʃ, ge gi→d͡ʒ; ⟨ci gi⟩+V silent softener-i; ch gh→k ɡ); rising diphthongs ea→e̯a, oa→o̯a; i/u glides
(iarnă→jarnə, ziua→ziwa, mai→maj); final-i palatalisation (lupi→lupʲ, copii→kopiʲ; syllabic after obstruent+liquid
and in monosyllables); word-initial e→je in the copula/pronoun class (este→jeste). Stress UNWRITTEN/lexical and the
broad referee marks none → DEFERRED (no ˈ emitted).

## Run 1 — first compile
**77.1% folded** (7157/9286), raw exact 75.4%. Strong baseline. Residual is a long DIFFUSE tail (the referee is
proper-noun-heavy — Romanian surnames, many of foreign origin) plus a few clean systematic classes:
- **word-final ⟨ie⟩ hiatus** (geografie→d͡ʒeoɡrafie, we glided i→j → …fje): final ⟨ie⟩ is [i.e], not [je].
- **intervocalic ⟨x⟩→ɡz** (examen→eɡzamen; we always did ks).
- **hiatus au/eu in learned words** (cauză→ka.u.zə, we did aw) — STRESS-dependent, deferred with stress.
- letter-NAME rows (I→j, C→t͡ʃ, E→je, X→ɡz): referee artifact, not an engine class.
- foreign-name -ci/-gi convention (Covaci→kovat͡ʃ, no palatalisation vs native cinci→t͡ʃint͡ʃʲ): a name/loan tail.

## Run 2 — glide syllabification, x, hiatus, 77.1 → 80.9%
Five evidenced fixes (the top-60 residual made the classes plain — the referee is proper-noun-heavy so foreign
names dominate the tail):
1. **Glide double-fire (biggest)** — the naive "high vowel next to a vowel → glide" made BOTH vowels in ⟨ui/iu⟩
   glides (lui→lwʲ, nucleus-less). Fixed: a high vowel is an OFF-glide after a nucleus, or an ON-glide only before
   a NON-high vowel. Repairs the whole genitive/dative -ului/-ei name ending (Abadanului→abadanuluj), -iu (radiu→radiw).
2. **⟨x⟩→ɡz restricted** to the word-initial ⟨ex⟩+V prefix (examen→eɡzamen); the blanket intervocalic rule was
   wrong on every Alex- name (Alexandru→aleksandru).
3. **muta cum liquida** — ⟨i⟩ after an obstruent+liquid onset (Cr/Cl) stays syllabic (Austria→awstria,
   Alexandria→aleksandria, patrie→patrie), while a single onset still glides (piatră→pjatrə).
4. **final -ie hiatus guard** — only after a CONSONANT (geografie→…fie); after a vowel it is an off-glide
   (cheie→keje, femeie→femeje). A real correctness fix (caught by the common-word check).
5. **ʲ~j fold** — the referee writes the desyllabified final ⟨i⟩ inconsistently as Cʲ (lupʲ) or Cj (Aanii→…nij).

**77.1 → 78.8 → 80.3 → 80.7 → 80.9% folded.** Common-word accuracy is far higher than the headline: a hand check of
31 frequent words matched the referee on all that appear in it (the misses were words absent from the 9285-list, our
output correct, + the loanword taxi→taksi). The diagnostic gold (romanian.test.ts, 15 words) passes.

**Residual = the proper-noun/lexical tail**, not an engine class: foreign-toponym -ia HIATUS (Albania→albanja vs
referee albania — [i.a] not [ja]; lexical, after a single consonant), unwritten-STRESS hiatus (cauză→ka.u.zə we
aw), foreign-name spellings, and letter-NAME referee rows (I→j, C→t͡ʃ).

**Verdict: 🟡.** The segmental g2p is reliable (Latin, one large HUMAN referee, 9285); the outstanding items are a
hiatus/loanword lexical tail and — the main gap — **STRESS**, deferred as a subsystem (unwritten and lexically
unpredictable in Romanian; the broad referee marks none, so it doesn't affect this number but is real work for a
complete canonical output). A future independent 2nd source (kaikki is same-tradition Wiktionary) would firm it up.
