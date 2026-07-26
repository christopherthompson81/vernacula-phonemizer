# Estonian (eesti keel, et) bring-up — Uralic (Finnic), ~1.1M

Estonian, the Finnic sibling of Finnish (fi), Latin script (a–z + õ ä ö ü, loan š ž z). Referee: **wikipron
`est_latn_broad`** (human, CUNY-CL/wikipron, 2,773 headwords; a narrow set also exists).

## Run 1 — 2026-07-26 01:00 — greedy phonemic g2p (the Finnish pattern) + first-syllable stress

Estonian is nearly as phonemic as Finnish at the SEGMENT level, so the engine is the Finnish shape — a greedy
grapheme scan + consonant/vowel gemination (double letter → [Cː]/[Vː]) — plus **fixed first-syllable stress**
(predictable → emitted). Estonian specifics vs Finnish:
- **⟨b d g⟩ are voiceless lenis** [b̥ d̥ ɡ̊] (Estonian has no true voiced stops; ⟨p t k⟩ are the half-long/long grades).
  The referee writes the devoicing ring (b̥/d̥/ɡ̊) which the BACKBONE strips → we emit plain b/d/ɡ and they compare.
- **9 vowels**: a→ɑ (back), e→e, i→i, o→o, u→u, and the four extra ⟨õ ä ö ü⟩ → ɤ æ ø y.
- **Diphthongs** are just two vowels (the referee marks the 2nd non-syllabic, ɤi̯/ɤu̯/eɑ̯ — the ̯ is BACKBONE-stripped),
  so no special handling.
- **n kept before a velar** (king→kinɡ̊, pank→pɑnk — unlike Finnish's ⟨nk⟩→ŋk). Standard analyses posit [ŋ] before
  k/g, but the referee is VARIABLE and mostly keeps [n] — MEASURED in Run 2: adding n→ŋ scored 92.2% vs 94.1%
  keeping n, so we keep n (referee-optimal; a few loans like Singapur→siŋɡ are the residual).

**The two FOLDED axes (Estonian's hard, only-partially-orthographic parts):**
- **PALATALIZATION** (t d n s l → Cʲ before/around i and in lexical contexts: külm→kylʲm, kass→kɑsʲː) — phonemic but
  NOT reliably written → we don't emit it and FOLD the referee's ʲ.
- **The three-way QUANTITY** (Q1 short / Q2 half-long ˑ / Q3 overlong): the orthography distinguishes single vs
  double letters (and ⟨b d g⟩ vs ⟨p t k⟩ vs ⟨pp tt kk⟩), but the Q2-vs-Q3 grade is largely NOT recoverable. We emit
  length from the double letters (ː) and FOLD the half-long ˑ (218/2903 referee lines) — the unwritten grade.

**Folds (referee-eval `et.jsonc`):** palatalization ʲ (unwritten); the half-long ˑ (unwritten Q2/Q3 grade); the
first-syllable stress ˈ (predictable, emitted, folded vs the referee's none). The offglide ̯ + the devoicing ring
b̥/d̥/ɡ̊ are BACKBONE-stripped automatically. Numbers = standard Estonian cardinals.

## Run 1 results — 2026-07-26 01:30

`npx tsx tools/referee-eval/eval.ts et`: **94.0% folded / 98.5% symbol accuracy** (2,773 headwords). The segments
(the 9 vowel qualities incl. õ→ɤ, b/d/ɡ, gemination, diphthongs) verified against the referee; the high symbol
accuracy shows the residual is pervasive single-symbol (quantity) variation. Two review-of-mismatch fixes:
- **Consonant gemination across a compound boundary**: kesk+kool → my "kk" wrongly geminated to [kː] vs the referee's
  two k's. Fixed: a doubled CONSONANT geminates only after a VOWEL (a true geminate is intervocalic; a doubled
  consonant after a consonant is a compound-boundary cluster). Net −0.2pp on this name-heavy referee (the reverse
  case, a final -ss after a consonant like allianss, is the rare loser) but linguistically correct (Estonian compounds
  are pervasive).
- **Accented loan vowels** (Aragón→ó was dropped) → mapped á é í ó ú.

**The QUANTITY is FOLDED (the key honest call).** Estonian's famous THREE-way quantity (Q1 short / Q2 long / Q3
overlong) is only PARTIALLY orthographic (single vs double letters, ⟨b d g⟩ vs ⟨p t k⟩ vs ⟨pp tt kk⟩), and the
referee's notation is INCONSISTENT — a long vowel appears as ɑː ~ ɑˑ ~ ɑɑ, and a single intervocalic ⟨p t k⟩ is
realized half-long [pˑ]. Measured directly: folding the half-long ˑ→ː scored **86.8%** (it makes the many single-⟨p
t k⟩ Q2 positions referee-long/ours-short), stripping ˑ scored 94.0%, and stripping ALL length (ː + ˑ) also 94.0% —
so length is unmatchable and we **strip it on both sides** and compare the segment + vowel-quality skeleton. The
engine still EMITS length from the double letters (correct canonical output: kool→koːl); only the eval folds it.

**Status: 🔷 (single-source, quantity folded).** wikipron est_latn_broad (2,773) is the only committed referee (the
narrow set adds only palatalization/half-length detail we fold). The segment skeleton is measured (94.0%/98.5%); the
famous three-way quantity + palatalization are folded (only partially orthographic). **Deferred:** the Q2/Q3 quantity
+ palatalization (need a quantity lexicon — genuinely hard); a 2nd independent referee.

## Run 2 — 2026-07-26 02:00 — review (2 agents) → text-path + loan fixes → 94.1%

The review confirmed the segments + quantity-fold framing (honest, measured) and found real bugs, all in the
tokenizer/loan/number path (the 94% segmental score is unaffected):
- **á é í ó ú absent from the TOKEN regex (HIGH):** the Run-1 accent fix (á→ɑ …) only worked via the eval's direct
  `phonemizeWord`; through `text()` the tokenizer split the word and dropped the accented vowel (Aragón→"ˈɑrɑɡ n").
  Added áéíóú to TOKEN (+ y to the vowel set).
- **Loan letters c/q/w/x/y dropped (MEDIUM):** not in the grapheme table → silently deleted (taxi→tˈɑi). Nativized:
  c→k, q→k, w→v, x→ks, y→i (taxi→tɑksi, york→iork).
- **"1 miljon" needs the numeral (MEDIUM):** 1 000 000 → "miljon" should be "üks miljon" (unlike "tuhat", which
  stands alone). Fixed.
- **n→ŋ MEASURED and rejected:** the referee is variable but mostly keeps [n]; adding the standard n→ŋ before k/g
  scored 92.2% vs 94.1% → kept n (referee-optimal; the doc's "NO n→ŋ" softened to "referee-driven").
- Cleanup: removed a `.join(" ").split(" ")` no-op in the digit fallback.

Known limitation (documented, eval-invisible since length is folded): the "geminate only after a vowel" heuristic
catches the C+CC compound cluster (kesk+kool) but not the V+CC boundary (viis+sada→viissada gets a spurious [sː]) —
detecting that needs morpheme boundaries.
