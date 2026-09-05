# Xhosa (xh) native bring-up

Xhosa / isiXhosa — Nguni Bantu, ~19M speakers (South Africa), Latin script. AUTHORED beyond-espeak (espeak ships
no click phonemes). The sibling of Zulu (`zu`).

## Reuse question (checked up front)

The Zulu bring-up note flagged Zulu as "a near-clone of Xhosa" and that "xh needs the same nj fix". So the first
task was confirming the reuse fit — and it is very high. Xhosa shares Zulu's entire click-and-depressor inventory
(the 15-way click series c/q/x → kǀ/kǃ/kǁ with aspirated/nasal/depressor accompaniments, implosive b→ɓ, ejective
plain stops, the nj→ɲd͡ʒ̤ fix already in the Zulu table). So Xhosa **reuses the shared Zulu g2p scan** (`zulu/g2p.ts`
`toSegments`, parameterised to take a rule table) and the Nguni penultimate-stress-with-lengthening logic,
differing only in DATA:

- **⟨rh⟩ → [x]** (voiceless velar fricative, the Xhosa-specific Khoisan-substrate reflex Zulu lacks — confirmed by
  both epitran rhoxa→xɔkǁa and the referee irhafu→íxáːfu).
- Xhosa **number words** (2 = -bini not Zulu -bili; 6–9 = isithandathu/isixhenxe/isibhozo/ithoba).

The g2p refactor is a defaulted parameter (`toSegments(word, rules = ZULU_RULES)`), so Zulu is byte-for-byte
unchanged (its 6 tests + 100% referee verified post-change).

## Data availability

- **wikipron xho_latn narrow** — 874 human words (PRIMARY). Very narrow (tone á à ǎ, breathy ̤, length ː,
  prenasalisation ⁿ/ᵐ/ᵑ, depressor devoicing ̥, syllabic ̩).
- **epitran xho-Latn** — programmatic (SECONDARY, INDEPENDENT). Two genuinely independent referees.

## Run — vs the two referees

**90.0% vs wikipron narrow / 80.2% vs epitran.** Two independent referees strongly corroborate the shared Nguni
engine + the rh addition. The folds all neutralise the systematic narrow allophony (never a click contrast — the
census clicks ǀ ǃ ǁ are kept):

- tone / breathy / length / depressor-ring — the backbone (+ a preFold for the exotic U+1DC0 tone-contour block).
- **prenasalisation** — the referee writes the homorganic nasal as a superscript (ⁿd, ᵐb, ᵑɡ) and inserts an
  epenthetic voiced stop in the NC clusters (nz→[ndz], ndl→[ndɮ], mf→[ᶬp̪f]); the folds map ⁿ→n / ᵐ→m / ᵑ→ŋ and
  drop the epenthetic d / p̪ (our canonical nz=[nz]). **This was the single biggest lever** — the initial fold
  wrongly *deleted* the superscript nasal (ⁿ→""), tanking the match to 55%; fixing it to ⁿ→n (the nasal is real)
  jumped it to 82%, and the ᵑ/p̪ additions to 90%.
- ejective release ʼ (unmarked in the narrow referee), labialisation ʷ→w, the mid vowels ɔ~o / ɛ~e, ɦ~h.

## Verdict — ✅ Reliable

The shared Nguni engine + the Xhosa ⟨rh⟩ addition are verified against two independent referees. **Outstanding:**
Xhosa **tone** (lexical, unwritten — deferred, as the Zulu out-of-lexicon path; a tone.tsv could be built as Zulu's
was), plus a thin tail (⟨tsh⟩ aspirate-vs-ejective, ⟨kr⟩→[kx] in loans, the NC-epenthetic stops we fold). Numbers
route through the same engine (approximate for the higher Xhosa multipliers).
