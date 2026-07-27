# Santali (sat) native bring-up investigation

Target: **Santali** (ᱥᱟᱱᱛᱟᱲᱤ), Munda (Austroasiatic), ~7M (India/Bangladesh/Nepal),
the **OL CHIKI** script (ᱚᱞ ᱪᱮᱢᱮᱫ, U+1C50–1C7F — a distinct ALPHABET created 1925 by
Raghunath Murmu, now the official Santali script, India 8th Schedule). Canonical IPA,
espeak-independent. The fleet's first Munda language + first Ol Chiki script.

## Run 1 — referee landscape

- **wikipron**: NONE (no sat).
- **epitran**: NO sat-Olck/Beng/Deva mapping.
- **kaikki Santali**: 928 entries, **927 in Ol Chiki**, **490 unique with IPA** (HUMAN,
  Wiktionary). The ONLY machine referee → 🔷 single-source. Many entries are multi-word
  phrases (space-joined) + loans (Bengali/Hindi/English).

Ol Chiki is a true ALPHABET (not abugida) — ~30 letters, near-phonemic → a grapheme scan.

## Map mined from kaikki (Ol Chiki letter → IPA)

VOWELS: ᱚ(LA)→ɔ, ᱟ(LAA)→a, ᱤ(LI)→i, ᱩ(LU)→u, ᱮ(LE)→e, ᱳ(LO)→o.
CONSONANTS: ᱜ(AG)→ɡ ᱠ(AAK)→k ᱛ(AT)→t ᱫ(UD)→d ᱴ(OTT)→ʈ ᱰ(EDD)→ɖ ᱯ(EP)→p ᱵ(OB)→b
ᱪ(UC)→c ᱡ(AAJ)→ɟ ᱢ(AAM)→m ᱱ(EN)→n ᱝ(ANG)→ŋ ᱧ(INY)→ɲ ᱬ(UNN)→ɳ ᱞ(AL)→l ᱨ(IR)→r
ᱲ(ERR)→ɽ ᱥ(IS)→s ᱦ(IH)→h ᱭ(UY)→j ᱣ(AAW)→w ᱶ(OV)→w ᱷ(OH)→aspiration/[h].

MODIFIER SIGNS (the interesting part):
- **ᱷ OH** = ASPIRATION of the preceding stop (ᱵᱷ→bʱ, ᱫᱷ→dʱ, ᱜᱷ→ɡʱ, ᱠᱷ→kʰ); standalone [h].
- **ᱹ GAAHLAA TTUDDAAG** = VOWEL MODIFIER — ᱟᱹ→[ə] (părsi→pərsi, hăku→həku); the "extra"
  Santali vowels.
- **ᱸ MU TTUDDAG** = NASALIZE the preceding vowel (ᱟᱸ→ã cãdɔ, ᱤᱸ→ĩ, ᱚᱸ→ɔ̃).
- **ᱼ PHAARKAA / ᱽ AHAD** = CHECKED/GLOTTALIZED consonant (ᱜᱼ→[kʼ] menakʼa~menak̚ʔa).
- **★ Word-final CHECKED stops** (the Santali hallmark): a final voiced stop GLOTTALIZES —
  ᱜ→[kʼ]/[k̚ʔ] (dak’→dak̚ʔ "water"), ᱫ→[tʼ] (met’→metʼ "eye"), ᱵ→[pʼ], ᱡ→[cʼ], ᱰ→[ʈʼ].
- ᱻ RELAA (rare, 1×) — vowel length; deferred.

Engine: grapheme scan + these rules; iterate against the 490-pair referee in Run 2.
🔷 single-source (kaikki only), moderate size, phrase/loan-heavy → expect a moderate
folded % with the honest residual in loans + multi-word phrases.

## Run 2 — engine + tuning

Engine (`src/languages/santali/santali.ts`): Ol Chiki grapheme scan + sign rules +
final-checked-stop. First pass **83.3% folded / 94.0% symbol** (79.6% raw-exact — many
byte-perfect: Ol Chiki is near-1:1).

Folds (all notation, added to sat.jsonc): word-linking undertie ‿ + syllable dots
(multi-word phrases), voiced-aspirate ʱ~ʰ, palatal ɟ~d͡ʒ / c~t͡ʃ, and the checked-final
glottal marker [ʼʔ̚] (referee inconsistent [kʼ]~[k̚ʔ]~[kˈ] → fold, compare the final-
devoicing signal). → **89.4% / 96.3%**.

Three engine fixes from residuals:
- **⟨ᱺ MU-GAHLA⟩ = lower + nasalize** (ᱮᱺ→ɛ̃, not ẽ) — it carries the GAHLA vowel-mod too.
- **⟨ᱽ AHAD⟩ is NOT a checking trigger** — medial ᱫᱽᱨ→dr keeps plain d (gidrə); only
  ⟨ᱼ PHAARKAA⟩ + the word-final rule check. (Earlier ᱜᱽᱼ→kʼ was the PHAARKAA, not AHAD.)
- **skip final-checking on a vowel-less citation** (lone letter ᱵ→b, not pʼ).
→ **91.2% / 96.7%**.

- **phonemizeWord splits on spaces** so word-final checking applies to EACH word of a
  multi-word referee headword (ᱚᱞ ᱪᱮᱢᱮᱫ→ɔl cemetʼ, not …cemet with an unchecked medial d).
→ **91.8% folded / 96.9% symbol**.

Residual (~40, all ≤1–2×): English/Bengali LOANS (keep the final voiced stop —
pond→poɳɖ; loan vowel quality ᱟ~ɔ, ᱚ~o) + isolated-letter citation rows + lexical ᱨ~ɽ.
🔷 single-source (kaikki only). Deferred: numbers, a loan lexicon, ᱻ RELAA length.

## Run 3 — 2-agent review

Phonology reviewer (3 fixes, ~14 residual misses) + code reviewer (1 latent bug):
- **★ ⟨ᱽ AHAD⟩ word-finally BLOCKS checking** (marks the stop PLAIN/released) — the
  decisive minimal pair ᱨᱳᱜ→rokʼ vs ᱨᱳᱜᱽ→roɡ (also ᱵᱳᱫᱽ→bod, ᱞᱟᱵᱽ→lab). AHAD was
  being dropped, so the final rule wrongly checked. FIX: track the AHAD-marked index;
  the final-check skips it. (Medial ᱫᱽᱨ→dr and the PHAARKAA case ᱜᱽᱼ→kʼ still work.)
- **★ ⟨ᱶ OV⟩ = /w̃/** (the NASAL labial glide, distinct from ⟨ᱣ AAW⟩ /w/) — ᱥᱟᱶ→saw̃,
  ᱠᱟᱱᱶᱟ→kanw̃a (nasality is intrinsic, present with no adjacent nasal). FIX: ᱶ→w̃.
- **★ final-check nucleus test missed nasalized vowels + ɛ** (code reviewer): the guard
  used the plain-VOWEL set, so ᱫᱟᱸᱜ→dãɡ / ᱯᱮᱹᱫ→pɛd skipped checking. FIX: NFD-based
  isVowelSeg (ã→a+◌̃ counts) + added ɛ to VOWEL (which also fixed ᱮᱺ→ɛ̃ nasalization).

Verified-correct (no change): voiced-ONLY final checking (voiceless finals stay plain,
ᱞᱟᱠ→lak); GAHLA a→ə / e→ɛ; MU-GAHLA lower+nasalize; OH aspiration. → **92.9% folded /
97.1% symbol.** Residual now ~loans (final voiced stop kept) + citations. All repo
tests pass.
