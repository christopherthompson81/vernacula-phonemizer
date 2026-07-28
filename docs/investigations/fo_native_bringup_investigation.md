# Faroese (fo) native bring-up investigation

Target: **Faroese** (føroyskt) — North Germanic (Insular Scandinavian, sibling of Icelandic), ~72k
speakers (Faroe Islands), Latin script + ⟨á í ó ú ý æ ø ð⟩. Canonical IPA, espeak-independent. One of the
DEEPEST orthographies in Europe (etymological, like Icelandic). The fleet already has Icelandic (is,
🔷), Danish (da), Norwegian (nb), Swedish (sv) — is is the closest structural template.

## Run 1 — referee landscape (2026-07-27): WELL-RESOURCED

- **wikipron fao_latn_broad**: 3024 pairs (space-segmented, phonemic-ish, marks length ː + pre-aspiration ʰ
  + retroflex r-clusters) → PRIMARY.
- **wikipron fao_latn_narrow**: 1258 pairs (finer) → available.
- **kaikki Faroese**: exists (index 200) → possible secondary.
- Two Wiktionary-derived referees (same-source family), but LARGE + human → a real measurement (unlike the
  recent thin ones). Note the broad set is proper-noun-heavy (personal names) at the top.

## Run 2 — the phonology (read off the broad referee)

★★ **THE CORE = vowel LENGTH conditions vowel QUALITY.** A stressed vowel is LONG (and often diphthongal) in
an open syllable / before ≤1 consonant, SHORT (monophthong) before a cluster:
- a: [ɛaː] long (aka→ɛaːʰka, ala→ɛaːla) / [a] short (alda→alta, allur→atlʊɹ)
- á: [ɔaː] / [ɔ]; e: [eː] / [ɛ]; i,y: [iː] / [ɪ]; í,ý: [ʊiː] / [ʊi]; o: [oː] / [ɔ]; ó: [ɔuː] / [œ];
  u: [uː] / [ʊ]; ú: [ʉuː] / [ʏ]; ø: [øː] / [œ]; æ: [ɛaː] / [a]; ei: [aiː]/[ai]; ey: [ɛiː]/[ɛi]; oy: [ɔiː]/[ɔi]
Unstressed vowels → short quality.

★ **Consonants:**
- NO voicing contrast (the aspiration/pre-aspiration system): ⟨b d g⟩→[p t k], ⟨p t k⟩→[p t k] + PRE-ASPIRATION
  [ʰ] intervocalically/before a sonorant (aka→ɛaːʰka, at→ɛaːʰt); geminates ⟨bb dd gg⟩→[pː tː kː], ⟨pp tt kk⟩→
  [ʰpː …]. Pre-aspiration ʰ + length ː are pervasive → FOLD for v1 (emit the quality, which is the real signal).
- **⟨ð⟩ is largely SILENT** (etymological): intervocalic ⟨ð⟩ deletes (aðal→ɛːal, agað→ɛːa) → [j]/[v]/[w] glide
  in some V_V contexts (Aðalbjørg→ɛːja…). **Intervocalic ⟨g⟩ also deletes** (agað→ɛːa, bagal→peːal).
- **⟨g k⟩ before a FRONT vowel → affricate** [t͡ʃ] (argi→aɹt͡ʃɪ, avgera→…t͡ʃeːɹa); ⟨gj kj⟩ likewise.
- **Retroflex r-clusters**: ⟨rn⟩→[ɻɳ] (ahorn→ahɔɻɳ), ⟨rt rd rs rl⟩→[ʈ ɖ ʂ ɭ]; a plain ⟨r⟩→[ɹ].
- **⟨ll⟩→[tl]** (allur→atlʊɹ); **⟨v⟩→[u]** before a consonant (forms a diphthong: avgera→au…, avtala→au…) /
  [v] intervocalic (avi→ɛaːvɪ). **⟨hv⟩→[kv]**, ⟨hj⟩→[j].

## Run 3 — build + tune (iterative, targeting the broad referee, 2026-07-27)

Self-contained scan (faroese.ts): length-conditioned vowel quality + the deep-orthography consonant rules.
Folds: pre-aspiration ʰ, length ː, tie-bar, w~v (the round-glide), ɑ~a (the referee's inconsistent
low-vowel backness). Iterations:
- **v1** (length→quality + b/d/g→p/t/k + basic clusters): 33.8% folded / 82.2% symbol.
- **v2** (á→[ɔɑː]; geminate collapse; intervocalic g/ð → [j]/[v]/∅ glide by neighbour; length count excludes
  silent ð): 47.6% / 85.8%.
- **v3** (front-priority glide + digraph-vowel recognition; geminate gg/kk+front→[t͡ʃ]): 48.6% / 85.8%.
- **v4** (double-affricate bug fix; final -um→[ʊn] m→n; w~v fold): 51.0% / 86.7%.
- **v5** (⟨tj dj sj⟩ palatal digraphs; ɑ~a fold): 52.6% / 87.3%.
- **v6** (glide rule corrected — ⟨e⟩/⟨a⟩ NEUTRAL, i-type front {i í y ý ei ey oy æ} → j, round {o ó u ú ø á}
  → v: vegur→veːvʊɹ vs Eyður→ɛiːjʊɹ both right): 52.7% / 87.4%.
- **v7** (★ SKERPING ó→ɛ/ú→ɪ before ⟨gv⟩: dúgva→tɪkva; ★ ng-palatalization ⟨n⟩→[ɲ]/[ŋ] + a→ɛ: gangi→kɛɲt͡ʃɪ;
  ⟨ø⟩ removed from the g/k affrication triggers: gøta→køːta): **57.1% folded / 88.6% symbol**.

**Final: 57.1% folded / 88.6% symbol** on wikipron fao_latn_broad (3024). ★ **The 88.6% SYMBOL accuracy is the
honest headline** — the folded number is deflated by (a) proper-noun/loanword NON-INITIAL stress (Alaska,
Aleksandur, Benin — the engine assumes native initial stress; ~227 capitalized entries, but the lowercase-only
subset is also 56.7%, so this is a minor part), (b) the referee's own DIALECTAL MIXING (⟨rn⟩→[tn]~[ɻɳ]
retroflex — ahorn→ɻɳ but bjørn→tn; ⟨ð⟩→[j]~∅ — aðal vs Aðal transcribed both ways), and (c) fine
diphthong-offglide vowel detail. The segmental + vowel-quality core is solid (88.6%). 🔷 single-source family
(wikipron; kaikki fao is the same Wiktionary source). Numbers, a non-initial-stress lexicon, and the
retroflex/tn dialect split are deferred.

## Run 4 — 2-agent review (2026-07-27)

**Phonology reviewer — STRONG sign-off** (probed ~70 real words vs the referee). ALL 14 vowel long/short
values CONFIRMED (fá→fɔɑː, jól→jɔuːl, hús→hʉuːs, gøta→køːta, …); b/d/g→[p t k] confirmed; the intervocalic
ð/g glide (front-wins-over-round) confirmed exactly (siga→siːja, høgur→høːvʊɹ, Bogi→poːjɪ); g/k→[t͡ʃ] before
front (not ø) confirmed, and **[t͡ʃ] is the right symbol** (the broad referee writes the lenis ⟨g⟩ reflex as
[t͡ʃ] too — the voicing difference IS the folded pre-aspiration, so no voicing split is needed); skerping,
ng-palatalization, retroflex clusters, ll→tl, v→u/_C, tj/dj/sj, -um→ʊn all confirmed against referee words.
★ HIGH-VALUE MISSING RULE APPLIED: **skerping before ⟨ggj⟩** (the SKERP loop only matched ⟨gv⟩) — í/ý drop
the offglide to [ʊ] (nýggjur→nʊt͡ʃʊɹ, kríggj→kɹʊt͡ʃ, fríggjadagur; common words). +0.2pp → 57.1% folded, golden
added. Minor deferred (near the fold boundary, low-impact): í/ý short = [ʊi] is slightly too diphthongal in
truly closed syllables (referee drops to [ʊ]); the ⟨rn⟩→[ɻɳ]~[tn] dialect split (already disclosed).

**Code/wiring reviewer — CLEAN, no blocking bugs.** Verified the geminate double-affricate fix (eggja→ɛt͡ʃa,
ikki→ɪt͡ʃɪ — consumed grapheme neutralized), nasalPass doesn't misfire on ⟨k⟩ (banki→pɛɲt͡ʃɪ, referee agrees),
the length rule (word-final long, ð-skip), gdGlide, and skerping — all against referee words. Folds all
HONEST (ɑ→a neutralizes only the diphthong's 2nd element — the ⟨a⟩/⟨á⟩ contrast survives on the onset + short
forms; w~v = one labial, Faroese has no /w/; ʰ/ː/tie standard) → the folded % is DEFLATED not masking-inflated,
so "88.6% symbol is the honest headline" is consistent. Referee join clean (3024 rows). ★ FIX APPLIED: the
final ⟨-Vm⟩→[n] rule over-applied to loan -am/-om (Adam→…tan) → GATED on ⟨u⟩ so only the -um ending fires
(Adam→ɛaːtam keeps [m]). Wiring/counts/columns all correct.

**Final: 57.1% folded / 88.6% symbol. 🔷 single-source family (wikipron), LARGE. Floor 0.52.** Full suite
green, typecheck clean. Deferred: numbers, a non-initial-stress lexicon (the Norwegian path), the
retroflex/[tn] dialect split, compound stress, the í/ý-short closed-syllable [ʊ].
