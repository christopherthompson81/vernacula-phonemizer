# Welsh (cy) bring-up investigation

Target: canonical IPA, espeak-independent, mirroring the Irish (ga) module structure
(welsh.jsonc data + manifest.ts + g2p.ts + welsh.ts + numbers.ts, registered in registry.ts).
Bootstrap reference = the espeak-ng-portable cy engine's canonical `phonemize()` output over the
50k corpus (NOT the raw `--ipa` shim, which mislabels the y-vowel as ʌ/ø; the TS engine already
applies the ə/ɨ relabel). Referee (later run): wikipron cym_latn.

## Run 1 — 2026-07-14 — segmental scaffold + penult stress + length rule

Oracle survey (50k, TS canonical phonemize):
- **Consonants**: digraphs ch→χ, dd→ð, ff/ph→f, ng→ŋ, ll→ɬ, rh→r̥, th→θ, si+V→ʃ; singles c→k,
  f→v, g→ɡ (always hard), others ~ letter. Affricates t͡ʃ/d͡ʒ (loan/j).
- **Vowels**: a ɛ ɔ ə e u i o ʊ ɨ ɪ; u→ɨ, w-vowel→ʊ/uː, i→i/j.
- **y-vowel** (the known espeak mislabel; canonical = ə/ɨ): ə in non-final syllables + function
  monosyllables (y/yn/yr → ə); ɨ (clear) in the final syllable + most monosyllables (cymru→kəmrɨ,
  the cym-y is ə, the -u is ɨ).
- **Diphthongs** carry a superscript offglide (like ga's ⁱ): ae→aᶤ, ei/eu/ey→əᶤ, oe→ɔᶤ, wy→uᶤ,
  aw→aᶷ, ew→eᶷ, yw/iw/uw/ow → …ᶷ/ᵘ. (ᶤ 10589, ᶦ 5424, ᶷ 1295, ᵘ 1230.)
- **Stress**: PENULTIMATE (cymru→kˈəmrɨ, prifysgol→prɨvˈəsɡɔl, gorffennaf→ɡɔrfˈɛnnav); monosyllables
  stressed. Exceptions (Cymraeg→kəmrˈaᶤɡ final-stress) DEFERRED.
- **Length** (stressed monosyllable, single coda): LONG when open or before a single voiced/
  fricative {b d ɡ v ð f χ θ s}; SHORT before voiceless stops {p t k}, m, ŋ, ɬ, and ALL
  clusters/geminates. Before {n r l}: genuinely SPLIT ~50/50 (lexical; the circumflex disambiguates
  — tân/taːn vs tan/tan) → DEFERRED to a later run/lexicon; Run 1 default short, circumflex forces long.

Plan Run 1: build the module, author unit goldens from the oracle, measure vs oracle. Defer:
n/r/l length ambiguity, final-stress exceptions, the wikipron referee.

### Run 1 results — segmental scaffold at 88.3% exact vs oracle (50k)

Built welsh.jsonc + manifest.ts + g2p.ts + welsh.ts + numbers.ts; registered "cy". Iterated by error-class
mining against the oracle: 49.2% → 71.0% (scanner reorder: multi-char clusters before w/i-consonant + single-y;
unstressed i→ɨ) → 85.5% (secondary stress on syllable 1 when primary ≥ 3rd nucleus; ew→eᶷ; drop mh/nh digraphs
= m+h/n+h; w-consonant in the gw- onset) → 88.3% (clitic/closed-syllable stressed i→ɨ; re-add ngh→ŋ̥).
33/35 authored goldens match the oracle exactly.

**Deferred to Run 2 (the residual ~12%):**
- Function-word length/quality irregularities: o'r→oːr (o long) vs i'r→ɨr (i short central) — the common
  monosyllables are lexically irregular; needs a small exception table + apostrophe-clitic handling (hi'n→hiːn:
  the enclitic must not close the stem syllable).
- The n/r/l vowel-length ambiguity (tân/taːn vs tan/tan) — lexical; the circumflex disambiguates.
- Penult tensing before an onset CLUSTER (dechrau→deχraᶤ): needs onset-maximizing syllabification, not raw
  coda-counting. Also the wedi→wɛdi (lax before single d) vs pobol→pobɔl (tense before b) split.
- Epenthesis in final -Cl/-Cr (bobl→bobɔl, gwneud→ɡwənəᶤd).
- Cymraeg-type final-stress exceptions; deeper secondary-stress placement.
- English loan-names (glasgow, royal, saturday) — espeak code-switches; out of scope for the Welsh g2p.
- The wikipron cym referee (independent validation).

## Run 2 — 2026-07-14 — nasal mutation, function-word exceptions, clitics, + the wikipron NW referee

88.3% → 88.98% exact vs oracle. Changes:
- **Word-initial nasal mutation** (treiglad trwynol): ngh→ŋ̥, mh→m̥, nh→n̥ applied ONLY at word start (nhw→n̥uː,
  nghymru→ŋ̥əmrɨ); MEDIALLY ⟨ngh⟩ etc. are ŋ+h / m+h / n+h (enghraifft→ɛŋhraᶦft). Fixed both directions.
- **Irregular function-word exception table** (a tiny closed-class lexicon): i→ɨ, bod→bɔd, heb→hɛb, un→ɨːn,
  sydd→sɨð, fy/dy… — short/lax where the regular length rule would lengthen. Removed fy/dy from obscureY
  (their y is clear ɨ).
- **Apostrophe enclitics** (o'r→oːr, hi'n→hiːn): phonemize the STEM as its own word so its length rule sees the
  real open syllable, then append the enclitic — instead of merging into one closed syllable.
- REVERTED an onset-cluster penult-tensing attempt (dechrau→deχraᶤ): it over-fired on eglwys (ɛ before ɡl stays
  lax) and llywodraeth (net-negative); the tense-before-onset-cluster rule needs the first C to be a fricative,
  not just any lengthener — not cleanly capturable, deferred.

**wikipron cym referee wired** — DIALECT-MATCHED: wikipron has NW (North Wales) vs SW variants; we target
Northern, so cym_latn_nw_broad_filtered (17,291 words) is a clean independent referee (unlike Irish's 3-dialect
mess). Folded backbone **45.4%** (floor 0.42). Folds: our modifier-letter diphthong offglides ᶤ→ɨ (central,
matching the referee's ɨ̯ for ae/au/oe/wy) / ᶦ→i (front, ai/ei) / ᶷᵘ→u; ɪ→i. The backbone already strips our
stress+length and the referee's non-syllabic/lowered combining marks.

**Run 3 (referee-guided, the Irish pattern):** the residual is dominated by the oracle's **i→ɨ artifact** — we
bootstrapped from espeak, which renders short/unstressed ⟨i⟩ as ɨ (lladin→ɬadɨn, pin→pɨn), but the INDEPENDENT NW
referee shows front **i** (pin→piːn). Re-examine the unstressed/closed i→ɨ rules against the referee (they may be
espeak artifacts), and the **n/r/l vowel-length ambiguity** (tân/tan) — both likely need an oracle-derived,
referee-GATED length/quality lexicon (cf. the Irish Run-3 method [[vernacula-oracle-lexicon-method]]).
