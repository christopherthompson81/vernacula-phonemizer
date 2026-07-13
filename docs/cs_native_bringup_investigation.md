# Czech (cs) native bring-up

Target: Czech, canonical IPA. West Slavic, Latin script. espeak ships cs, so the espeak-canonical output is a
**regression-guard bootstrap** — NOT the correctness target. Linguistic correctness is cross-checked against the
espeak-independent epitran `ces-Latn` referee (`tools/referee-eval`). Gold (bootstrap) = espeak-ng-portable
canonical over the 50k corpus.

## Architecture — rule g2p with three context systems
`g2p.ts` scans Czech orthography (fairly phonemic) with:
- **Vowels**: short a e i/y o u → a ɛ ɪ o u, long á é í/ý ó ú/ů → aː ɛː iː oː uː; diphthongs ou/au/eu → oᶷ/aᶷ/ɛᶷ.
  Hiatus: i/í/y/ý before a vowel inserts a glide j (policie→polɪt͡sɪjɛ).
- **Palatalisation**: d/t/n → ɟ/c/ɲ before i, í, ě (NOT before y, ý, e): divadlo→ɟɪvadlo, ticho→cɪxo; but
  typ→tɪp, den→dɛn.
- **⟨ě⟩**: after d/t/n it palatalises the consonant and is plain ɛ (děti→ɟɛcɪ); after m → mɲɛ (měl→mɲɛl); after
  a labial b/p/v/f → jɛ (běh→bjɛx).
- **Voicing assimilation** (`applyVoicing`, regressive, right-to-left): a voiced obstruent devoices word-finally
  and before a voiceless obstruent; a voiceless obstruent voices before a voiced one (led→lɛt, kde→ɡdɛ,
  prosba→prozba, vstup→fstup). v and ř are targets but do NOT trigger (svět→svjɛt, při→pr̝̊ɪ); before ɦ a voiced
  obstruent devoices (rozhodně→rosɦodɲɛ). ř additionally devoices progressively after a voiceless consonant
  (tři→tr̝̊ɪ). Plus n→ŋ before k/ɡ (venku→vɛŋku), nn→n degemination (činnost→t͡ʃɪnost), syllabic r̩/l̩ between
  consonants (krk→kr̩k, vlk→vl̩k).

`czech.ts` applies fixed FIRST-syllable stress with secondary stress on even non-final nuclei (republika→
rˈɛpublˌɪka). Numbers compose Czech text through the g2p with the tisíc/tisíce/tisíc agreement.

## Validation — two independent lenses
- **vs the espeak-canonical bootstrap** (50k): exact **94.6%**, stress-only ~0.1%. The residual splits into:
  (a) ~60 words where WE are correct and espeak is wrong — regressive voicing espeak misses (kdo→ɡdo, když→ɡdɪʃ,
  takže→taɡʒɛ), epitran-corroborated; (b) ~270 single-letter/acronym letter-spellings (usa, http — corpus
  noise); (c) the **loanword-palatalisation class** (see below); (d) first-syllable-stress on numbers where
  espeak wrongly stresses a long non-initial vowel (tisíc).
- **vs epitran ces-Latn** (independent, `tools/referee-eval`): **69.9%** segmental backbone after folding the
  e↔ɛ mid-vowel convention and syllabic/diphthong notation. This is DEFLATED by epitran's own voicing bugs — it
  voices pr→br, tr→dr word-initially (před→bret, třeba→dreba, Praha→braɦa), s→z (jsme→jzme), and writes ch→ɦ —
  all cases where OUR output is the correct one. So epitran is a weak referee for Czech voicing; it does
  corroborate our vowels, palatalisation, and consonant inventory. A human wikipron ces referee (used by the
  espeak-ng-portable convergence) would be a better second source to add.

## Known limitation — loanword palatalisation (~3% of the corpus)
The regular rule palatalises d/t/n before i/í/ě, which is correct for native words but WRONG for loanwords:
ministr should be [mɪnɪstr] (prescriptive standard), not [mɪɲɪstr]; likewise politiky, organizace, aktivní,
titul. This is genuinely **lexical** — espeak gets it right via a curated dictionary. Notably epitran makes the
SAME over-application (ministr→mɪɲɪstr), so it cannot adjudicate this class; published Czech phonology sides
with espeak (the citation form is un-palatalised; palatalising loans is colloquial). The proper fix is a
loanword-exception lexicon (portable from espeak's cs_list) — deferred; documented here as the main residual.

## Run 1 — rule g2p + voicing + numbers — 2026-07-13
Built g2p/czech/numbers; registered cs; added cs to the referee harness. Iteration vs the bootstrap: 84.5%
(first cut) → 89.1% (ř must not trigger regressive voicing — při→pr̝̊ɪ, not br̝ɪ) → 92.7% (hiatus j, au/eu
diphthongs, n→ŋ) → 94.6% (h-devoicing, y/ý hiatus, nn-degemination; restricted degemination to n after it broke
vyšší). 5 unit tests + full suite green.

Key lessons:
- Read voicing direction carefully: regressive assimilation is right-to-left, but ř devoices PROGRESSIVELY
  (after a voiceless C), and v/ř are targets-not-triggers. Treating ř as a trigger voiced every p before it.
- The independent referee (epitran) confirmed the espeak gold is wrong on kd→ɡd, but is ITSELF wrong on
  pr→br — a clean demonstration that no single source is an oracle. Adjudicate, don't auto-match either.
