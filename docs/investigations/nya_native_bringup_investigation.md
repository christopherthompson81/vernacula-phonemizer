# Chichewa / Chinyanja (nya) native bring-up

Bantu (Guthrie N31), Malawi/Zambia/Mozambique, ~12M+ speakers. The Latin
orthography. Cleanroom canonical-IPA rule g2p, espeak-independent. The best data
situation of the recent bring-ups: THREE referees, real triangulation → ✅.

## Run 0 — 2026-07-17 — data check

- **wikipron nya_latn broad: 1562** (HUMAN, NARROW — tone á, implosives ɓ/ɗ,
  retroflex tap ɽ, prenasalisation superscript ᵐ/ⁿ/ᵑ, labialisation ʷ).
- **kaikki nya: 1526 IPA entries** (HUMAN — same Wiktionary narrow tradition, with
  stress ˈ + syllable dots).
- **epitran nya-Latn: 1562** (INDEPENDENT, programmatic, BROAD — plain b/d, full
  nasals, no tone).

wikipron + kaikki share the Wiktionary tradition; epitran is the independent second
tradition → genuine triangulation.

Phonology (from the narrow referees): ⟨b⟩→ɓ, ⟨d⟩→ɗ (implosive; PLAIN after a nasal
— ⟨mb⟩→ᵐb, ⟨nd⟩→ⁿd); the single liquid ⟨l⟩=⟨r⟩→[ɽ] uniformly; prenasalised NC;
aspirates ⟨ph th kh⟩; ⟨ng'⟩→ŋ vs ⟨ng⟩→ᵑɡ. Tone (H/L) is phonemic but UNWRITTEN →
deferred (the backbone strips the referees' tone/stress).

## Run 1 — 2026-07-17 — build + iterate

A greedy longest-match scan (Shona pattern). First cut: 91.0% wikipron / 89.7%
kaikki / 87.6% epitran. Two systematic gaps, fixed by adding cluster entries:

1. **Prenasalised/labialised ASPIRATES weren't aspirating** — ⟨nth⟩ gave [ⁿt]+[h]
   not [ⁿtʰ]; ⟨mph⟩→[ᵐp]+[h]; ⟨ntch⟩→[ⁿt]+[t͡ʃ]. Added nth→ⁿtʰ, mph→ᵐpʰ, ntch→ⁿt͡ʃʰ,
   nkhw→ᵑkʷʰ, thw→tʷʰ. → 96.2 / 94.8 / 91.4%.
2. **⟨Cy⟩ palatalisation** — ⟨dy⟩ gave [ɗj] (glide) not [ɗʲ]. Listed the palatalised
   digraphs (by→ɓʲ, dy→ɗʲ, …) emitting Cʲ (fleet-consistent with Kinyarwanda) + the
   ʲ~j fold. → 97.5 / 96.2 / 92.8%. Then nkhw/thy → **98.7 / 97.4 / 92.1%**.

## Result

- wikipron nya_latn (primary, human, narrow): **98.7%** (1541/1562)
- kaikki nya (human): **97.4%** (1486/1526)
- epitran nya-Latn (independent, broad): **92.1%** (1450/1562)

Three referees, two human at ~98% + an independent programmatic at 92% → **✅**.
Floor 0.96. The residual (~1.3% on the primary) is a clean referee-limited tail:
place-name idiosyncrasies (Limbe→[ɽíᵐbi], Soche→[sot͡ʃí], final-vowel raising in
some toponyms), loanwords (Mozambique, Marx), and apostrophe-elision edge cases.

Verified signatures: banda→[ɓaⁿda], anthu→[aⁿtʰu], phiri→[pʰiɽi], ngwazi→[ᵑɡwazi],
mfumu→[ᶬfumu], nyumba→[ɲuᵐba], and the ng'/ng contrast ng'ombe→[ŋoᵐbe].

**Deferred:** tone (H/L, unwritten — the standard orthography marks none; the
narrow referees' tone is folded by the backbone) and the noun-class **number
concord** (Chichewa counts 6–9 as "5 and N"; the composer is best-effort, unmeasured).
