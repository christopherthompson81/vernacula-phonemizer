# Finnish (fi) native bring-up

Uralic (Finnic), Finland (~5.4M L1), Latin script. A FLEURS-102 language. Goal: an espeak-independent canonical-IPA
phonemizer. Finnish is one of the most **phonemically transparent** orthographies in the world (very nearly one
grapheme ↔ one phoneme), so the expected shape is a greedy longest-match g2p with a handful of code rules — the polar
opposite of the Danish bring-up (where the vowels are unrecoverable and the path is lexicon-first).

## Run 1 — 2026-07-24 — referee sourcing

**Question:** what referee do we score against? The first instinct (`tools/corpus/build-referee.ts --lang fi`, the
batched en.wiktionary scraper) returned **0 rows from 12,000+ category members** — because Finnish Wiktionary entries
use the auto-generating `{{fi-pronunciation}}` template, so the literal `{{IPA|fi|/…/}}` the scraper greps for is
almost never present in the wikitext.

**Fix:** fetch **wikipron `fin_latn_broad`** (github.com/CUNY-CL/wikipron) — the same Wiktionary pronunciations but
template-EXPANDED by wikipron, **173,449 human entries**, space-segmented IPA. Installed as
`tools/referee-eval/referees/fi.wikipron-fin-broad.tsv`. (Lesson for future transparent-orthography langs that use a
lang-specific pronunciation template: the {{IPA|xx}} scraper will find nothing → go straight to wikipron.)

**Conventions read straight off the referee** (no guessing needed — the data is dense and consistent):
- ⟨a⟩ = **ɑ** (back), ⟨v⟩ = **ʋ** (labiodental approximant: kova→koʋɑ), ⟨r⟩ = r (trill), ⟨d⟩ = d, ⟨j⟩ = j.
- **Doubling = length**: aa→ɑː (Aabraham→ɑːbrɑhɑm), kk→kː (Aakko→ɑːkːo).
- **⟨ng⟩ = ŋː** (a long velar nasal): kuningas→kuniŋːɑs, rengas→reŋːɑs, sangen→sɑŋːen. **⟨nk⟩ = ŋk**: sänky→sæŋky,
  Helsinki→helsiŋki.
- **The 18 diphthongs mark the 2nd vowel non-syllabic (V̯)** — closing (au→ɑu̯, ai→ɑi̯, öy→øy̯) AND opening
  (ie→ie̯, uo→uo̯, yö→yø̯): mies→mie̯s, suo→suo̯, työ→tyø̯.
- A word-final **`ˣ`** (28,945 rows) = boundary gemination / *loppukahdennus* — a sandhi that only surfaces before a
  following word → fold. A handful of ʔ / ə / ɤ / nasalized-vowel rows are loan/foreign residue → fold/ignore.

**Eval backbone note:** the shared `BACKBONE` strips stress, **length (ː)**, and **combining diacritics incl. the
offglide (̯)** on both sides. So emitting length and diphthong offglides does NOT move the folded score — but they are
real (the referee carries them) and worth emitting for **canonical-IPA fidelity**. Only `ˣ` survives → the one real
fold in `langs/fi.jsonc` (plus ʔ).

## Run 2 — 2026-07-24 — greedy g2p, first measurement

Authored the module (`src/languages/finnish/`): `finnish.jsonc` (grapheme table: 8 vowels back-⟨a⟩, long-vowel +
18-diphthong digraphs, ʋ/r/loan consonants; cardinal-number stems), `finnish.ts` (greedy scan + code rules:
gemination Cː, ⟨ng⟩→ŋː, ⟨nk⟩→ŋk), `numbers.ts` (agglutinating compositor). Consonant **gradation** needs no logic —
the orthography already spells the graded surface form, which is what we phonemize.

**Result: 96.0% folded (166,446 / 173,449).** raw-exact is meaningless here (0.0%) because the referee is
space-segmented and carries length/offglide the backbone strips — the folded number is the real one.

**Residual analysis (top buckets are all 3–4× out of 173k — a flat tail, NOT a systematic gap):**
- **loanword letter values** — cappuccino (cc→ts/tʃ, we read kk), wushu (w→w, we read ʋ), zeeta (z→z, we read ts),
  shampanja (sh→ʃ, we read s+h), Pantheon (th→t, we read t+h). Genuine foreign phonology.
- **foreign names** — Götanmaa→jøtɑnmɑː (Swedish-style ⟨g⟩→j on a name).
- **letter-spelled acronyms** — VMTL→ʋeːemteːel, AMK. Read as letter names in the referee.
- **compound-seam sandhi** — pytonkäärme (n|k across the python#käärme seam stays [n] in the referee, we assimilate to
  ŋ), kalsiummagnesium (the m|m seam: referee two m's, we geminate mː). Both need compound segmentation.

None of these is fixable by a native Finnish rule without a **loanword lexicon** or a **compound segmenter**. 96.0% is
essentially the phonemic ceiling for native Finnish; the ~4% is loan/foreign/acronym/seam material.

**Considered and rejected (this run):**
- ⟨sh⟩→ʃ and ⟨z⟩→z tweaks: would each rescue a few hundred loanwords but risk native s|h / cross-boundary readings;
  the gain is a flat loan tail, not worth the native-risk. Left ⟨z⟩=ts (the traditional Finnicising prescription) and
  ⟨sh⟩ as s+h (⟨š⟩ is the standard sibilant letter).

**Known minor artifact (documented, deferred):** the greedy diphthong digraphs read a **morpheme-seam vowel pair** as a
diphthong — most visibly in composed numbers: `kaksikymmentäyksi` → …tæy̯ksi (the ä|y across kymmentä#yksi gets a
spurious offglide). It is folded by the backbone and phonetically marginal (fast-speech gliding), so it is noted rather
than special-cased; a per-morpheme number phonemization would remove it if wanted.

**Verdict: 🔷 single-source.** wikipron fin is Wiktionary-derived (kaikki fi would be correlated, also Wiktionary), so
there is no *independent* 2nd referee — but Finnish's transparency means low referee-error risk, and 96.0% on 173k
human entries is a strong, honest result. Floor 0.94. Wired: registry (`case "fi"`), eval PHON, `langs/fi.jsonc`,
`test/finnish.test.ts` (6 tests), catalogue row, maturity row.

## Run 3 — 2026-07-24 — code review

3-agent review (Finnish path solid; wiring + Danish-golden change verified clean). One real fix:
- **Large digit strings** — `numberToWords(Number(m[2]))` lost precision / went exponential for very long numbers
  (`1e21`→`"1e+21"`), and the `String(n)` digit fallback then read `e`/`+` as `units[NaN]=undefined` → empty tokens.
  Fixed: `text()` composes only for ≤9-digit numbers (a safe integer <1e9) and otherwise reads the raw digit STRING
  via the new `readDigits` (no float), so 10¹¹+ reads digit-by-digit correctly. Golden added.
- Loosened the floor 0.94→0.93 (the tightest in the file at 0.02; a transparent orthography is low-variance but a
  referee refresh shouldn't surprise). Deferred (reviewer-endorsed): the composed-number seam diphthong (a real
  per-morpheme-phonemization fix, not the "cheap" boundary-marker hack) and the 6.5 MB referee (precedent: full
  wikipron referees are committed). Full suite 995/995.
