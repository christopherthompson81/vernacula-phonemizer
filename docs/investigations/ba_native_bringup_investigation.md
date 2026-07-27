# Bashkir (ba) native bring-up investigation

Target: **Bashkir** (Башҡортса / Башҡорт теле), Kipchak Turkic (sibling of Tatar),
~1.4M (Bashkortostan, Russia), CYRILLIC (Bashkir alphabet). Canonical IPA,
espeak-independent. Joins the Turkic family; sibling of the fleet's Tatar (tt).

## Run 1 — referee landscape

- **kaikki Bashkir**: 3354 entries, **2799 with IPA** → **2395 multi-char pairs** (HUMAN,
  Wiktionary, phonemic /…/). The PRIMARY referee — large + native vocab, BUT (like Tatar)
  Russian-LOAN-heavy with Russian-style pronunciation (palatalization ʲ, akanye о→a,
  the vowel ä): Азия→äzʲijä, республика→rʲispublʲikä.
- **wikipron**: bak_cyrl_narrow (2235) + broad (208) — HUMAN but also loan/citation-heavy.
- **epitran**: NO bak-Cyrl mapping.

🔷 single-source-FAMILY (kaikki + wikipron both Wiktionary). Referee-noisy (loans) → the
% will be dragged but the engine is validatable on the native subset (the Tatar situation).

## Map mined from kaikki single-letter citations

★ HALLMARK = the **INTERDENTAL fricatives ҫ→[θ], ҙ→[ð]** (Bashkir's signature, shared
with Turkmen). Bashkir WRITES the uvulars **ҡ→[q], ғ→[ʁ]** (so NO harmony inference is
needed, unlike Tatar/Kyrgyz — к→[k], г→[ɡ] always). ң→[ŋ], һ→[h], х→[χ] (uvular).
★ The **BASHKIR VOWEL SHIFT** (non-obvious): а→[ɑ] (back), **и→[e]** (not i!), **о→[ʊ]**,
**у→[o]/[u]**, **е→[ɪ]** (bare; je initial), ы→[ɯ], э→[ɪ], ә→[æ], **ө→[ʏ]**, **ү→[ɵ]**.
Iotated я→jɑ ю→ju ё→jo; е→je word-initial/post-vowel. в→[w] (~[β] intervocalic, арба→ɑrβɑ);
ж→[ʐ], ш→[ʂ], ц→t͡s, ч→t͡ʃ, щ→ɕː. Build + iterate against the 2395-pair referee in Run 2.

## Run 2 — engine + the REFEREE-LIMITED / loan-routing reality

Cyrillic scan (interdentals, written uvulars, vowel shift, dark-l harmony, у/ү glide).
First pass 24.7% folded. Folds (all allophonic notation): the vowel-LOWERING diacritic
̞ (ʊ̞~ʊ), reduction breve ̆, rhotic ɾ~r (referee inconsistent), sibilants ʂ~ʃ/ʐ~ʒ,
intervocalic б β~b, dark ɫ~l, front-rounded ø~ʏ~ɵ~ʉ~y. Vowel fixes from residuals:
у→[u] (not o — ун→un, кукуруз→kukuruz), и→[i] (ике→ikɪ), е→[jɪ] initial. → **40.8%
folded / 80.9% symbol.**

★ **REFEREE-LIMITED (the Tatar situation).** The 40.8% is NOT a quality signal: kaikki
Bashkir (2395) is HEAVILY Russian-LOAN-polluted — the referee reads loans (Украина,
республика, театр, телевизор…) RUSSIAN-style (palatalization ʲ, akanye, ä) which a
native Bashkir g2p correctly does NOT reproduce. The native g2p is verified CORRECT on
the goldens (башҡорт→bɑʂqʊɾt, ҡыҙыл→qɯðɯɫ, аҫыл→ɑθɯɫ, ҙур→ðuɾ) and ~71% on the
non-detected-loan subset (still loan-dragged: many harmonic loans slip the heuristic).

★ **THE USER'S INSIGHT — Russian-loan ROUTING (implemented).** Real Bashkir text is
loan-saturated and Bashkir speakers pronounce loans Russian-style, so a realistic
phonemizer should route detected loans to the Russian g2p. Detection = VOWEL-HARMONY
VIOLATION: native Bashkir is strictly all-back (а о у ы) or all-front (е и э + the
Bashkir letters ә ө ү), so a word MIXING back + front vowels and lacking any Bashkir-
specific letter (ҡ ғ ҙ ҫ ң ә ө ү һ — always harmonic) is a Russian loan → routed to
`ru` (bashkir.ts imports russian's phonemizeWord directly; no circular dep). This gets
the Russian PALATALIZATION (rʲ lʲ tʲ nʲ) a native Turkic scan can't produce
(республика→rʲɪspublʲɪkə). The eval barely rewards it (the referee's loan forms are a
Russian~Bashkir HYBRID — Russian palatalization but LESS vowel reduction, ukraina not
ʊkrɐinə — and folding that reduction would corrupt the native о→ʊ), but the SHIPPED
behaviour is correct for real text. The heuristic catches the harmony-violating loans
(~90 in the referee) but misses HARMONIC loans (автобус all-back) — a loan lexicon is
the deferred fix. 🔷 single-source-family; referee-limited.

## Run 3 — 2-agent review

- **CODE (HIGH): stress dropped on words ending in ⟨и⟩/⟨ү⟩** — `IPA_VOWEL` (the stress
  placer's vowel set) was populated from the DOC values, missing the code's emitted [i]
  and the ⟨ү⟩ onset, so биш→biʃ / ил→il got no stress (invisible: stress is folded). FIX:
  reconcile IPA_VOWEL to the actually-emitted vowels.
- **PHONOLOGY (HIGH): ⟨и⟩ is harmonically NEUTRAL** — it occurs freely in back-vowel
  Arabic/Persian loans (тарих, иман, ислам), so "back + и" is NOT a harmony violation.
  `isRussianLoan` was false-positiving this whole class (33 of 90 flagged words are read
  NATIVE by the referee). FIX: drop ⟨и⟩ from FRONT_V (keep only е/э — genuinely front,
  never in native back words). Tradeoff: all-back+neutral loans like Украина now slip the
  heuristic (the harmonic-loan class a lexicon must catch — already deferred). Internally
  consistent now (the dark-л BACK set already treated и as neutral).
- **PHONOLOGY (MED): ⟨ү⟩→[y]** (was [ɵ], which inverted the height vs ⟨ө⟩); **⟨ө⟩→[ø]**;
  **⟨ш ж⟩→[ʃ ʒ]** (plain post-alveolar, not retroflex). Canonical-output fixes (folded in
  eval). Symbol accuracy 80.9→81.1%. Docstring и→[e]/у→[o] corrected to и→[i]/у→[u].

All native-g2p corrections; the referee-limited framing stands (40.8% folded, loan-noisy).
Native goldens updated + a stress golden pinned (биш→ˈbiʃ). All 1278 repo tests pass.
