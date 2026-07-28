# Totontepec Mixe (mto) native bring-up investigation

Target: **Totontepec Mixe** (ayöök) — Mixe-Zoquean (Mixean, Oaxaca Mixe, North Highland), ~6k, Oaxaca. Latin
(modern SIL practical orthography). Canonical IPA, espeak-independent. **The fleet's FIRST Mixe-Zoquean family.**

## Run 1 — referee landscape + the reference material (2026-07-28)

Initially assessed INFEASIBLE (no IPA referee, unmappable vowel orthography). **UNBLOCKED by the user's
reference: Crawford, *Totontepec Mixe Phonotagmemics* (SIL, 1963)** — a full published phonology.
- **wikipron/kaikki/Wiktionary-IPA**: none. **Wiktionary lemmas**: 65 (modern orthography, no IPA).
- **ASJP NORTH_HIGHLAND_MIXE (toto1305, ISO mto, Wichmann)**: ~40 coarse Swadesh forms (independent) → the
  cross-check anchor (collapses the central-vowel contrasts, so inventory-only).
- **Crawford (1963)**: the g2p's phonology anchor (a falsifiable published source — the bho/Balochi mold).

## Run 2 — the phonology (Crawford 1963)

★ **VOWELS — 9 qualities in stressed syllables** (6 in unstressed; /u~ʊ/, /ɨ~ʌ/, /e~æ/ neutralize unstressed) +
PHONEMIC LENGTH (V· = long, written doubled in the modern orthography). Crawford's chart (§1.112):
- High: /i/[i] (front), /ɨ/[ɨ] (central), /u/[u] (back rounded)
- Mid: /e/[e]~[ɛ] (front), /ʌ/[ʌ] (central), /ʊ/[ʊ]~[o̝] (back rounded, "higher than mid [o]")
- Low: /æ/[æ] (front), /a/[a]~[ɑ] (central), /ɔ/[ɔ]~[o̞] (back rounded, "higher than low [ɔ]")
The three CENTRAL vowels /ɨ ʌ a/ vary backed↔fronted but never neutralize with the front series.

★ **CONSONANTS** (§1.111): stops /p t k/ + voiced /d g/; the affricate **/c/=[t͡s]** (sibilant release);
/ʔ/; fricatives /v/ (labial), /s/ (dental [s]), **/š/ (retroflex [ʂ]~[ʃ])**, /z/ ([ʐ], intervocalic/post-nasal
only), /h/; nasals /m n/; the glide /y/=[j]. **ALLOPHONY (§1.121):**
- ★ **POST-NASAL VOICING**: /p t c k/ → [b d dz ɡ] after a nasal / a nasal-final syllable (mp→[mb], nt→[nd],
  nts→[ndz], nk→[ŋɡ]).
- **/d g/ → the fricatives [ð ɣ]** intervocalically (voiced STOPS [d ɡ] only after a nasal).
- **/Cy/ PALATALIZATION**: a consonant + /y/ patterns as one palatalized unit; **/cy/=[t͡ʃ]** (~[tʂ]), /ny/=[ɲ].
- **/n/ → [ŋ]** before a velar stop.
- **/v/**: [v] onset / [w] intervocalic & post-nasal & complex-onset / **[f]** as a terminus after V, V? (but
  [w] after /a/, [v] after V·, V?V).
- **/h/ + nasal/glide → voiceless** [n̥ m̥ j̥]; nasal + /h/-terminus → voiceless.
- **/ʔ/**: a discrete stop as onset; **LARYNGEALIZATION (creaky)** of the vowel in the V?V / V·? nuclei.

★ **The MODERN ORTHOGRAPHY** (Wiktionary/SIL) is NOT Crawford's 1963 phonemic notation, but his example words
anchor it: kääm 'pig'=/kæːm/ → ⟨ä⟩=/æ/, doubled=long; këp 'tree'=/kɨp/ → ⟨ë⟩=/ɨ/; üts 'I'=/ʌts/ → ⟨ü⟩=/ʌ/;
ök 'dog'=/ʊk/ (ASJP uk) → ⟨ö⟩=/ʊ/. ts=/c/[t͡s], tx=/cy/[t͡ʃ], x=/š/[ʃ], j=/h/, c=/k/, ꞌ/'=/ʔ/. ★ The UNDERLINE
diacritic (a̱ e̱ o̱ u̱ ö̱) is NOT in Crawford (a later orthographic device) → its exact value is the RESIDUAL
UNCERTAINTY (likely a phonation/register or the back-vowel series; treated conservatively, disclosed).

## Run 3 — build + tune (2026-07-28)

Self-contained scan (totontepecmixe.ts): the modern orthography → Crawford's phonemes → IPA, + the allophony
passes. **The allophony reproduces Crawford's transcriptions** (his §1.121 examples, re-spelled in the modern
orthography where ⟨c⟩=/k/, ⟨ts⟩=/c/=[t͡s]): mpahk→[mbahk] (his §1.121d example, letters identical),
tsingavus→[t͡siŋɡavus] (Crawford's cìngávus [tsingávus] — his ⟨c⟩=/c/=[t͡s] is modern ⟨ts⟩) — a falsifiable
check. Also: cumantoc→[kumandok] (post-nasal nt→nd), tocunaguc→[tokunaɣuk] (intervocalic g→ɣ), nyuhm→[ɲum̥]
(hm→voiceless), ncaap→[ŋɡaːp] (n→ŋ + post-nasal), tsiv→[t͡sif] (v→f terminus), mhaacy→[m̥aːt͡ʃ] (nasal+h). The
vowel anchors match Crawford's example words: kääm→[kæːm], këp→[kɨp], üts→[ʌt͡s], ök→[ʊk]. Six allophonic rules
implemented: post-nasal voicing, /d g/→[ð ɣ], n→[ŋ], /ny/→[ɲ], /v/→[f] terminus, /h/±nasal→voiceless.

**REFEREE — severely limited.** The ONLY independent phonetic data is the ASJP North-Highland-Mixe Swadesh list
(coarse, Wichmann), and only **3 concepts** overlap the 65 modern-orthography Wiktionary lemmas: dog (ök↔uk),
I (üts↔əts), tree (këp↔kup). All 3 match under the ASJP-coarseness folds (ʊ/ɨ→u, ʌ→ə — ASJP can't represent the
central-vowel contrasts) → 3/3, an INVENTORY check, NOT a quality signal. The engine's REAL gate is the
phonology (consonants + allophony) vs Crawford + the goldens.

**Final: 🔷 AUTHORED from a published grammar (Crawford 1963) — the bho mold — SEVERELY referee-limited.** The
CONSONANTS + ALLOPHONY are Crawford-grounded and confident (and reproduce his exact allophonic examples). The
modern-orthography VOWEL mapping (ä ö ë ü → the central/back series) is reconstructed from Crawford's example
words — defensible but the residual uncertainty; the ★ UNDERLINE diacritic (a̱ o̱ u̱) is NOT in Crawford (a later
orthographic device) → treated as the plain vowel (stripped). Per the phonology review, the underline **most
likely marks a PHONATION contrast — a glottalized/creaky (laryngealized) nucleus — NOT length (already written
by doubling) or quality (already spent on ä ë ö ü)**; stripping it is the conservative choice (never emits a
wrong segment, only under-specifies a foldable phonation feature). Deferred: the underline phonation value, the
creaky-glottal V?V fine detail, unmarked stress, numbers, a real referee (none exists). This is the honest
ceiling for a ~6k-speaker language with one published phonology and no IPA corpus.

## Run 4 — 2-agent review (2026-07-28)

**Phonology reviewer (with Crawford access) — STRONG endorsement.** Read Crawford §1.11–1.32 and CONFIRMED
against the grammar: the 9-vowel mapping (all four anchors — ä=/æ/, ë=/ɨ/, ü=/ʌ/, ö=/ʊ/ — verified from
Crawford's example words + his §1.112 chart; the back-mid /ʊ/ and low /o/ are his descriptions), the consonants
(/c/=t͡s, /cy/=t͡ʃ, /š/=[ʂ]~ʃ, saltillo=ʔ, etc.), and ALL implemented allophony reproducing his examples
(mpahk→mbahk, tocunaguc→tokunaɣuk). "The vowel reconstruction and allophony hold up against the grammar; no
gross error." Drove 3 amendments (APPLIED): (1) the acute-vowel DROP bug — fixed (strip U+0301/U+0300, same as
the underline); (2) the two biggest missing allophones IMPLEMENTED — **/v/→[f] terminus** (cív→t͡síf, sáv→sáw,
long stays) and **/h/±nasal→voiceless** (hn→[n̥], mh→[m̥]); (3) the underline disclosure sharpened to "likely a
phonation (glottalized/creaky) contrast." Endorsed the 🔷 authored-from-Crawford framing as accurate.

**Code/wiring reviewer — CLEAN.** Verified the underline-strip, the post-nasal-voicing/n→ŋ left-to-right
interaction (ncaap→ŋɡaːp), the ny→ɲ no-artifact, the fold honesty (the ASJP-coarseness folds are genuine, the
"3/3 is not a quality signal" disclosed consistently), the 3-word referee integrity, and all wiring/counts.
★ Found the same **acute-vowel DROP bug** (áéíóú admitted by TOKEN but absent from the maps → whole nucleus
dropped: tocu̱nágu̱c→tokuŋɡuk) — FIXED (strip the acute; golden updated to the real accented lemma
tocu̱nágu̱c→tokunaɣuk). Deleted a dead no-op branch.

**Final: 🔷 authored from Crawford (SIL 1963), the fleet's FIRST Mixe-Zoquean. Severely referee-limited (3
coarse ASJP words, inventory-only). The phonology (9 vowels + 6 allophonic rules) is Crawford-verified.** Full
suite green, typecheck clean. Deferred: the underline phonation value, unmarked stress, numbers, an IPA referee.
