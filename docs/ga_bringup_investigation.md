# Irish Gaelic (ga) bring-up investigation

FIRST Celtic/Goidelic. THE novel axis: BROAD (velarized ˠ) vs SLENDER (palatalized ʲ) consonants — every
consonant has two forms, orthographically determined by flanking vowels (*caol le caol, leathan le leathan*:
a consonant is slender next to e/i, broad next to a/o/u). Target: Standard/Connacht-ish canonical IPA.
Oracle: espeak-ng-portable's mature authored ga engine (`phonemize(w, loadLanguage("ga"))` — full ˠ/ʲ).
Referee: wikipron gle_latn broad (21k, but 3-DIALECT multi-pron, heavy vowel variation → ~34% ceiling even
for a mature engine; the referee is vowel-noise-dominated, NOT a tight guard).

## Canonical map (from the oracle)
- **Broad** (ˠ): bˠ mˠ fˠ pˠ sˠ ɾˠ; dental l̪ˠ n̪ˠ d̪ˠ t̪ˠ; velar k ɡ; ch→x.
- **Slender** (ʲ): bʲ mʲ fʲ pʲ ɾʲ lʲ nʲ dʲ tʲ; s→ʃ; velar k→c ɡ→ɟ (PALATAL stops); ch→ç.
- Word-initial r ALWAYS broad (rí→ɾˠiː); rr broad (carr→kaɾˠ).
- Lenition (séimhiú): bh/mh→v(ˠ/ʲ) (+w broad glide), ch→x/ç, dh/gh→ɣ/j, fh→∅, ph→f, sh/th→h.
- Vowels: fada á→ɑː é→eː í→iː ó→oː ú→uː; short a e→ɛ i→ɪ o→ɔ u→ʊ; unstressed→ə. Stress: first syllable (native).
- Vowel digraphs (semi-lexical): ea→a, ai→a, ao→eː, eo→oː, ua→uːə, ia→iːə, iú→uː, ói→oːⁱ … (helping vowel marks
  the adjacent consonant's quality; the "real" vowel is the other). This is the Run-2+ residual.

## Run 1 — 2026-07-14 — broad/slender core + vowels + lenition

### Run 1 result — broad/slender core, 42.6% vs referee (21/24 vs oracle)
Built irish.jsonc + manifest.ts + g2p.ts + irish.ts + numbers.ts + registry + test + referee-eval CONFIG.
The g2p: consonant quality from the nearest flanking vowel LETTER (slender e/i, broad a/o/u; word-initial r
broad); broad/slender consonant maps (velar k/ɡ → palatal c/ɟ slender, s→ʃ, dentals l̪ˠ/n̪ˠ/d̪ˠ/t̪ˠ);
lenition digraphs; a longest-match vowel-cluster lookup. Orchestrator: first-syllable stress (marked even on
monosyllables), unstressed short vowels → ə.

**Fixes in-run:** monosyllables DO take stress; unstressed short-vowel reduction → ə (madra→mˠˈad̪ˠɾˠə);
doubled consonant collapse (carr→kˈaɾˠ); final -dh/-gh silent (chéadaigh→çˈeːd̪ˠə — the -aigh/-idh endings).

**21/24 exact vs the espeak-ng-portable canonical oracle** (the broad/slender + reduction + stress + lenition
+ digraph system). **Referee 42.6%** — ABOVE the ~34% ceiling a mature engine hits on this referee, because we
fold the 3-dialect vowel-noise (the wikipron gle referee mixes Connacht/Munster/Ulster with heavy vowel
variation; it is NOT a tight guard). Unit test 5/5.

**Run-2+ residual (vowel clusters + endings):** i-offglide before a slender consonant (áit→ɑːⁱtʲ, aill→ailʲ);
eo→ɔ vs oː context (deoch); ea→a vs ɑː dialect; bh/mh vocalization to a vowel (eabhair→…au…); -aigh→iː vs ə
dialect; a single-dialect (Connacht) pronunciation lexicon from the oracle to pin the semi-lexical vowels.
