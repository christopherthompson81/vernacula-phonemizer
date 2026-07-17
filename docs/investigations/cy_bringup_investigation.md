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
mess). Folded backbone **49.1%** (deduped; floor 0.45). Folds: our modifier-letter diphthong offglides ᶤ→ɨ (central,
matching the referee's ɨ̯ for ae/au/oe/wy) / ᶦ→i (front, ai/ei) / ᶷᵘ→u; ɪ→i. The backbone already strips our
stress+length and the referee's non-syllabic/lowered combining marks.

**Run 3 (referee-guided, the Irish pattern):** the residual is dominated by the oracle's **i→ɨ artifact** — we
bootstrapped from espeak, which renders short/unstressed ⟨i⟩ as ɨ (lladin→ɬadɨn, pin→pɨn), but the INDEPENDENT NW
referee shows front **i** (pin→piːn). Re-examine the unstressed/closed i→ɨ rules against the referee (they may be
espeak artifacts), and the **n/r/l vowel-length ambiguity** (tân/tan) — both likely need an oracle-derived,
referee-GATED length/quality lexicon (cf. the Irish Run-3 method [[vernacula-oracle-lexicon-method]]).

## Run 3 — 2026-07-14 — referee-guided: reverted the oracle's i→ɨ artifact (the Irish lesson)

The Run-2 referee residual pointed at a systematic divergence, and the independent NW referee adjudicated it
decisively: **Northern Welsh keeps the letter ⟨i⟩ FRONT (i/ɪ/iː) and centralizes only ⟨u⟩ and clear ⟨y⟩ to ɨ** —
that i/ɨ distinction IS the Northern vowel system. Run 1's two `i→ɨ` rules (unstressed-i→ɨ + closed-stressed-i→ɨ)
matched an espeak ARTEFACT: the oracle renders short/unstressed ⟨i⟩ as ɨ, but the referee shows front i
(melin→mɛlɪn not mɛlɨn, brenin→brɛnɪn, gwin→ɡwiːn, min→miːn, enillodd→ɛnɪɬɔð not the oracle's ɛnɨɬɔð). Removed both. Also dropped the Run-2 "i"→ɨ exception (same artifact: the referee has i→iː front) — the rules now produce the correct ˈiː for the word ⟨i⟩ once the closed-i→ɨ rule is gone.

Result: referee folded **49.1% → 56.5%** (+7.4). Oracle exact "dropped" 88.98% → 72.4%, but the decomposition shows
that drop is US being MORE correct: **i-quality-only mismatches = 19.4%** (words where the sole diff is i↔ɨ and the
referee backs our front i), length-only = **0.6%** (a tiny residual where the oracle's length is right — the n/r/l
lexical length, NOT worth a lexicon), other = 7.5% (names/loanwords + the lexical wy quality u/ʊ/uːɨ, e.g.
gwyn = gw+ɨ not a wy-diphthong — deferred). LESSON (again): the espeak oracle carries dialect artefacts; the
espeak-exact metric can REWARD matching them. Validate segment quality against the independent referee.

Deferred (minor / lexical, referee-invisible because BACKBONE folds length): n/r/l vowel length (tân/tan), the
wy-diphthong quality split, English loan-name code-switching.

## Run 4 — 2026-07-14 — referee-backed diphthong nuclei (56.5→67.1%)

The Run-3 residual was dominated by DIPHTHONG-QUALITY mismatches. The NW referee adjudicates each nucleus; applied
the referee-confirmed corrections (all folded-agreement wins, goldens updated):
- **final unstressed ⟨-au⟩ → [a]** (707): the NW plural/verb-suffix reduction — llyfrau→ɬəvra, pethau→pɛθa,
  dechrau→dɛχra. g2p rule (only in polysyllables; a stressed monosyllable cau→kaᶤ keeps the diphthong). +2.1%.
- **⟨wy⟩-diphthong nucleus u→ʊ** (930): eglwys→ɛɡlʊɨs, Arglwydd→arɡlʊɨð, blwyddyn→blʊɨðɨn. Data. +2.0%.
- **⟨ew⟩ nucleus e→ɛ** (short; the length rule still gives eː in monosyllables tew→teːu): mewn→mɛun, Dewi→dɛu. +0.9%.
- **⟨ei⟩/⟨ey⟩ nucleus ə→e** (942): cymdeithas→kəmdeiθas, teithio→teiθjo, Aberteifi→...teivi. +4.5% (the big one).
- **⟨eu⟩ nucleus ə→e** (matching ei). +1.0%.
Total **56.5→67.1% (+10.5)**. Floor .50→.63. Suite 262/262 (5 goldens updated to the referee-matching values).

TESTED-and-REJECTED: ⟨ae⟩→eᶤ went NEGATIVE (−0.2%) — the referee is inconsistent (Aeres→eɨ, Aeddan→ei, some stay
aᶤ), so ⟨ae⟩ is genuinely contested; left as aᶤ.

STILL 🟡. Remaining residual: (1) **English/foreign-name code-switching** (Algeria→ald͡ʒiːrja, Aidan→ei̯dən — the
referee applies English phonology to English names; a name lexicon like the cs/th kaikki approach could help but
Welsh-ifies unpredictably); (2) **⟨gwy⟩/⟨yw⟩ structural** (gwyn→ɡwɨn not the diphthong; bywyd→bəuɨd — intertwined
with the imperfect y-obscure rule); (3) **⟨ae⟩ contested**; (4) n/r/l length (folded away). These are intricate /
lexical, lower-leverage than the nuclei just fixed.

## Run 5 — 2026-07-14 — penult vowels stay LAX (another oracle artifact) + gwy/chwy structural (67.1→73.5%)

The lowercase common-word residual was dominated by penult ⟨e⟩/⟨o⟩: ours TENSED them ([e]/[o]) but the NW referee
keeps them LAX (pobol→pɔbɔl, abadesau→abadɛsa, nesaf→nɛsav). This was the SAME espeak-oracle artifact as the Run-3
i→ɨ: the bootstrap tensed penult vowels; the independent referee shows lax. Removed the penult TENSE_SHORT step
(full length ː still applies in monosyllables/final syllables). **+5.9%** — the biggest single fix.

Also structural: ⟨wy⟩ in a ⟨gw⟩/⟨chw⟩ ONSET cluster is w-consonant + y (gwyn→ɡwɨn, gwybod→ɡwɨbɔd, achwyn→aχwɨn), NOT
the ʊɨ diphthong (contrast Arglwydd→arɡlʊɨð where ⟨gl⟩ is the onset). Skip the wy-cluster after ɡ/χ; ⟨y⟩ after that
/w/ stays clear ɨ even non-finally. +0.5%.

Total Run 5: 67.1→**73.5%**. Floor .63→.70. Suite 262/262 (nesaf/pobol goldens updated to the lax referee forms).
Session total: 56.5→73.5% (+17.0). Remaining residual: English/foreign-name anglicization (referee applies English
phonology — arguably not our error), ⟨ae⟩ (referee-contested), degemination (nn→n), st→sd + glide edges — intricate/
lexical/referee-limited. Common-word accuracy is now ~73%; STILL 🟡 (the diffuse tail is real but small-per-class).

## Run 6 — 2026-07-14 — degemination of written double consonants (73.5→76.2%)

Welsh writes ⟨nn⟩/⟨rr⟩ to mark the preceding vowel short, but they are pronounced SINGLE: gorffennaf→ɡɔrfɛnav (not
…ɛnnav), torri→tɔri, cynnar→kənar, ennill→ɛniɬ. Our engine emitted both consonants. Fixed: collapse adjacent
identical consonant phonemes in the OUTPUT — applyLength already counts the doubled coda (so the short-vowel marking
is preserved; only the surface form collapses). +2.7%. (ll/dd/ff/… are single digraph phonemes, never
identical-adjacent, so untouched.)

TESTED-and-REJECTED: **final unstressed ⟨e⟩→[a]** (the NW reduction bore→bɔra, carreg→karaɡ) — net −3.5% at scale.
Too many final ⟨e⟩ stay ɛ; the reduction is colloquial/lexical, not reliably rule-conditioned. Left as residual.

Session total 56.5→**76.2% (+19.7)**. RESIDUAL COMPOSITION (of 3426 mismatches): only **237 are proper names** (the
referee anglicizes English/foreign names — arguably not our error for Welsh text; NOT the dominant class, so
code-switching is NOT needed for the bulk); ~348 final-⟨e⟩→a (lexical), 456 ⟨ae⟩/⟨ai⟩ (referee-contested: eɨ/ei/aᶤ),
and ~2385 diffuse "other" (glide edges, st→sd, per-word quality). Common-word accuracy ~76%. STILL 🟡.

## Run 7 — 2026-07-14 — kaikki NW lexicon closes the lexical tail (76.2→83.7%) → ✅

Built the lexicon from kaikki.org Wiktionary Welsh — dialect-tagged, so the NORTH-WALES pron is taken (matching our
target + the NW referee). Tool tools/gen/build-cy-kaikki-dict.mts + src/languages/welsh/lexicon.tsv (2013 entries),
lookup wired into welsh.ts. Converter kaikki→ours (combining offglides ɨ̯/u̯/i̯→ᶤ/ᶷ/ᶦ, strip ̞/./(ə), re-place our
PENULT stress) VALIDATED 8949/8949 = 100% exact on rule-correct words.

kaikki cym is NOISIER than kaikki ces (mewn→mɨun WRONG, ⟨e⟩→ɨ / ⟨yw⟩→ɪ slips) AND standard-leaning where our rules
are colloquial (it keeps final -aᶤ vs our referee-backed -au→a reduction). Two guards: (1) exclude words ending in
-au (our rule owns that); (2) PIN each entry to a referee-CONFIRMED value — add only where converted-kaikki AND the
wikipron-NW referee agree (both Wiktionary), so the lexicon can't ship kaikki noise (mewn correctly excluded, stays
the rule's mɛun). It fixes: ⟨ae⟩/⟨ai⟩ quality (aeres→eɨ), oe length (oedd→oːᶤð), lax-i (dim→dɪm, dinas→dɪnas),
monosyllable diphthong length (llaw→ɬaːᶷ), ⟨yw⟩ (llywodraeth→ɬəw), y-obscure irregulars.

MEASUREMENT (honest): full-system **83.7%** — but the referee-PIN makes it CIRCULAR for the 2013 covered words. The
independent signal is the RULE-ENGINE on OOV words: **81.1%** (near-ceiling for a rule G2P on Welsh — mutations,
dialects, complex diphthongs). Session total **56.5→83.7% (+27.2)**. Residual: English/foreign-name anglicization
(referee applies English phonology, arguably not our error) + diffuse OOV edges. → ✅ referee-limited (wikipron
partly circular; the rule engine at 81.1% OOV is the anchor, the lexical tail is pinned to referee-confirmed values).
