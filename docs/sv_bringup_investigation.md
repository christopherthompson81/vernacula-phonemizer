# Swedish (sv) bring-up investigation

Central Standard Swedish (rikssvenska), authored beyond-espeak, canonical IPA.
Segmental-first (pitch accent 1/2 deferred to Phase 2 — lexical, needs a lexicon).
Referee: wikipron swe (human Wiktionary IPA), fallible; fold notation/allophony.

## Run 1 — 2026-07-13 — orientation + referee fetch
- Template: German (rule g2p + stress lexicon + manifest, on core helpers loadManifest/loadTsvMap/assembleClauses).
- epitran NOT installed; network available. Referee = wikipron swe (broad + narrow).
- Hard parts anticipated: sje-sound ɧ (sj/skj/stj/sk+front), tje-sound ɕ (tj/kj/k+front), retroflex
  assimilation (rt→ʈ rd→ɖ rn→ɳ rs→ʂ rl→ɭ), long/short vowel quality (o/u irregular), silent hj/lj/dj/gj→j.

## Run 2 — 2026-07-13 — referee calibration (wikipron broad)
Referee conventions confirmed from samples:
- sje-sound → ɧ (sj/skj/stj + sk before front vowel). tje-sound → ɕ (tj/kj + k before front);
  referee wobbles ɕ~t͡ɕ → fold t͡ɕ→ɕ.
- Vowels: a=ɑː/a, e=eː/ɛ, i=iː/ɪ, **o long=uː** (bok→buːk; irregular, lexical residual expected),
  o short=ɔ, u=ʉː/ɵ, y=yː/ʏ, å=oː/ɔ, ä=ɛː/ɛ (before r →æː), ö=øː/œ (before r→œː).
- Complementary length: stressed syllable is long-V+short-C OR short-V+long-C (kött→ɕœtː, sjö→ɧøː).
- Retroflex r+C→ʈ/ɖ/ɳ/ʂ/ɭ (ours, Central Standard); broad referee often leaves r+C → fold.
- Silent digraphs hj/lj/dj/gj→j; -tion→ɧuːn.
Referee saved: tools/referee-eval/referees/sv.wikipron-swe.tsv (broad, lowercase-alpha filtered).

## Run 3 — 2026-07-14 — Phase 1 segmental engine built + wired

Built the full Phase-1 stack mirroring the German template (rule g2p, no lexicon):
`swedish.jsonc` (vowel long/short tables, digraph + retroflex maps, front-vowel set, exceptions,
number words) + `manifest.ts` + `g2p.ts` (the scanner) + `numbers.ts` + `swedish.ts` (orchestrator) +
registry `case "sv"` + `test/swedish.test.ts` + referee-eval `CONFIG.sv`.

**g2p design:** left-to-right scan emitting `Seg[]`. sje ɧ (sj/skj/stj/sch, sk+front), tje ɕ (tj/kj,
k+front), g→j before front, retroflex r+dental → ʈ/ɖ/ɳ/ʂ/ɭ, geminate → Cː, complementary length on the
STRESSED (first) syllable via a coda-consonant count (retroflex cluster counts as 1). -tion → ɧuːn.

**Bugs found + fixed in-run (probe vs referee):**
- retroflex length guard `!isV(w[j+2])` wrongly excluded rt+vowel → skjorta got short ɔ; removed (rt is always
  a single retroflex). → skjorta ɧuːʈa.
- softening (k/g/sk) was GREEDY — `followingVowel` scanned past consonants, so `boken`→bˈuːɕɛn, `akter`→ɕ,
  `dragen`→j. Restricted to the first-syllable onset with an IMMEDIATE front vowel (softening is a stressed-onset
  rule). +3.2pp and fixes the whole `-en/-er/-et`-inflection family.
- gg/kk geminates weren't caught (g/k aren't in the plain CONS map) → egg ɛɡɡ; added explicit ɡː/kː.
- hj/lj/dj/gj were collapsing to j MEDIALLY too (miljon→mˈɪjɔn); made the silent rule word-initial-only.
- thousand==1 concatenated ett+tusen → ɛtːtɵsɛn (triple t); use the elided "ettusen".

**Referee (wikipron swe broad) folds:** strip the ² accent-2 prosodeme (Phase-2 pitch); fold our systematic
retroflexes back to r+dental (the broad referee is INCONSISTENT — mars→ʂ but barn→rn); tɕ→ɕ; æ→ɛ (ä-before-r
lowering); œ→ø.

**Result:** folded backbone **48.3%** vs the broad referee (raw 15.2%) — right at German's 49.8% against the
same kind of noisy human referee. The residual is now a DIFFUSE tail (all classes count 2–3): loanword/prefix
non-initial stress (förut, farväl, person, station), lexical o/u quality (son→oː, kort short), and referee noise
(truncated entries inte→ɪnt, casual fan→faan). No systematic bucket remains — the signature of a working
segmental Phase 1. Unit test (exact golds) 9/9 is the regression guard.

**Deferred to Phase 2 (needs a lexicon):** pitch accent 1/2; non-initial loanword/prefix stress; lexical o=oː
vs uː; compound decomposition (storkök→ɧ). A kaikki swe lexicon would unlock all of these + provide the
independent secondary referee (the current `secondaryGap`).

## Run 4 — 2026-07-14 — Phase 2: NST pitch-accent + stress lexicon

espeak-ng-portable has a full Swedish Phase-2 setup — the CC0 **NST Pronunciation Lexicon**
(`swe030224NST.pron`) + `data/sv/accent-lexicon.tsv`. Reused it (the abstract, convention-independent features
only — NOT the espeak-convention segments).

**Lexicon build (`tools/gen/build-sv-lexicon.mts`):** parse NST field-12 SAMPA for every corpus word →
- pitch **accent** 1|2 from the primary-stress marker (`""` = accent 2, `"` = accent 1),
- absolute **stress ordinal** = the `$`-delimited syllable index carrying the `"` marker.
Restricted to the 50k frequency corpus, homographs majority-resolved. Output committed:
`src/languages/swedish/accent-stress.tsv` (42,052 words, 11,075 with a non-initial stress ordinal, ~480KB).

**First tried** deriving from espeak-ng-portable's `accent-lexicon.tsv` col-3 IPA corrections — but col 3 only
covers words espeak MIS-stresses (relative to espeak's rule), so `polis`/`station` (which espeak stressed
correctly, non-initially) had no correction and stayed wrong. Went to the NST **source** for ABSOLUTE stress
instead → fixed them.

**Engine (`swedish.ts`):** look up word → stress ordinal (default first syllable) + accent (default the NST OOV
rule: monosyllable / non-initial-stress → 1, polysyllable initial-stress → 2). `toSegments(word, stressOrd)`
now takes the stress ordinal so the complementary-length rule lands the LONG vowel on the correct syllable; the
accent-2 grave (combining U+0300) marks the primary-stressed vowel. Input + output NFC-normalized (robust to
decomposed ö/ä/å input; deterministic grave).

**Why the referee score moved even though ˈ/grave are backbone-stripped:** the stress lexicon relocates the
long-vowel QUALITY (uː vs ɔ, ɑ vs a), which the backbone keeps. `polis`→pɔlˈiːs (was pˈuːlɪs), `telefon`→
tɛlɛfˈuːn, `student`→stɵdˈɛnt. Folded backbone **48.3% → 52.0%** (now above German's 49.8%).

**Verified accents are NST-faithful (majority-resolved homographs):** `boken`→accent 1 (the frequent noun sense;
NST lists 2×A1 + 1×A2), `ligga`→accent 1 (what NST marks). The unit test asserts these, not my priors.

**Still Phase-3+ (small residual):** lexical o=oː vs uː (son); compound decomposition (storkök); OOV loanword
stress (words outside the 50k corpus fall to first-syllable). A kaikki swe *pron*-lexicon would be the
independent segmental secondary referee (still a `secondaryGap`).

## Run 5 — 2026-07-14 — PR #75 review fixes (3-agent review)

Three finder agents (g2p correctness, lexicon-build, Swedish phonology) surfaced real bugs; fixed:

- **é loanword vowel unhandled** (idé/armé/kafé): `é` was in neither the vowel table nor the TOKEN char class,
  so it leaked as a literal / was dropped by `text()`. Added `é → eː` + to VOWELS + TOKEN. 104 lexicon rows
  were dead; now live (idé→ɪdˈeː).
- **Diphthong stress off-by-one** (europa): the build counted NST `$`-SYLLABLES, but the engine counts vowel
  LETTERS; NST ties ⟨eu⟩ into one syllable. Rebuilt the ordinal as a count of SAMPA VOWEL symbols before the
  `"` (matches the engine's per-letter nuclei). europa 1→2. (Residual: ~155 words where NST collapses ⟨au⟩ to
  a single vowel `}` — e.g. restaurang — stay off; a bounded NST-encoding inconsistency, documented.)
- **-tion fired word-initially** (tionde→ɧuːnde): gated the suffix rule to `i>0` (it always follows a stem).
- **⟨x⟩ mis-counted as one coda consonant** (sex→seːks): `x`=/ks/ now counts 2 in the length rule → sɛks.
- **Word-initial ⟨gn⟩** (gnista→ŋnɪsta): onset gn→ɡn; only coda/medial gn→ŋn (regn, vagn).
- **⟨ck⟩ dropped geminate length** (flicka): ck→kː (consistent with tt/kk/gg; canonical-consistency).
- **är hardcoded ɛːr** contradicted the ä-before-r rule → removed the exception (rule gives æːr). Added the
  unstressed numeral **en → ɛn** (fixes "en miljon"→ɛn).
- **thousands ending in ett** (21000→tjugoetttusen): generalized the ett+tusen elision → tjugoettusen.
- **text() tokenized RAW input**: NFD ä/ö/å broke tokenization (för→fo+r); NFC-normalize before tokenizing.

Referee 52.0→**52.3%**; unit test 12/12 (added a segmental-edge-cases block). Deferred (low severity): short
/ɛ/→[æ] before r (speaker-variable; wikipron uses ɛ, and the eval folds æ→ɛ), negative-number sign word, and
the au-collapse diphthong sub-class.

## Run 6 — 2026-07-14 — Phase 3: lexical o-quality; compound decomposition evaluated & deferred

**Data-first triage:** re-ran the referee residual (52.6%). It is now DIFFUSE — every top bucket is count 2–3,
dominated by referee noise (truncated `inte→ɪnt`, casual `fan→faan`, `de` variants) and OOV/rare-word stress.
The score is near its ceiling for this noisy broad referee; further gains are correctness-for-synthesis, not
referee points. So Phase 3 targets canonical correctness, judged per-feature, not the headline number.

### 3a — Lexical o-quality (oː vs uː) — DONE
Swedish spelling underdetermines long ⟨o⟩: /uː/ (bok, son, sol) vs /oː/ (telefon, kol, adobe). NST distinguishes
them (`bu:k` vs `fo:n`). Extended `build-sv-lexicon.mts` to emit a per-word `o` flag when the STRESSED nucleus is
orthographic ⟨o⟩ that NST realises as long `o:` (605 corpus words). The engine (`toSegments(word, ord, oLong)`)
emits [oː] there instead of the default [uː]. telefon→tɛlɛfˈoːn, kol→koːl, adobe→adˈoːbɛ; bok/son/sol keep [uː].
Referee 52.3→52.6%. Lexicon format: `word\taccent[\tord][\to]` (numeric token = ordinal, "o" = oː flag).

### 3b — Compound decomposition — EVALUATED, DEFERRED (measured precision too low)
Prototyped a lexicon-driven greedy splitter (longest-first, parts ≥3 chars, from the 42k lexicon wordlist).
Split 673/5286 referee words; many correct (affärs+liv, afton+falk, akvarell+målare). But precision is not
ship-safe:
- **Linking-⟨s⟩ (fogemorfem) false matches:** `aktningsvärd → aktning+svärd` (the "sword" trap), i.e. the
  linking -s- is misparsed as the onset of a real word.
- **False short / function-word parts:** `allemansrätt → alle+mans+rätt`, and soft-trigger traps like
  `påsken → på+sken` (would mis-soften sk→ɧ giving *poɧen* for /ˈpoːskɛn/).
These produce WRONG pronunciations, so a blind splitter is net-negative. A safe splitter needs fogemorfem-aware
junctures + a frequency-weighted, function-word-excluded free-morpheme list — a larger effort. Notably
espeak-ng-portable's own sv convergence doc also leaves "NST compound-juncture conventions" as a residual, so
this is a genuinely hard sub-problem, deferred rather than shipped with regressions.

**Still deferred:** compound decomposition (above), OOV loanword stress (words outside the 50k corpus → first
syllable), short /ɛ/→[æ] before r (speaker-variable; wikipron uses ɛ).
