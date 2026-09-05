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

portable-espeak has a full Swedish Phase-2 setup — the CC0 **NST Pronunciation Lexicon**
(`swe030224NST.pron`) + `data/sv/accent-lexicon.tsv`. Reused it (the abstract, convention-independent features
only — NOT the espeak-convention segments).

**Lexicon build (`tools/gen/build-sv-lexicon.mts`):** parse NST field-12 SAMPA for every corpus word →
- pitch **accent** 1|2 from the primary-stress marker (`""` = accent 2, `"` = accent 1),
- absolute **stress ordinal** = the `$`-delimited syllable index carrying the `"` marker.
Restricted to the 50k frequency corpus, homographs majority-resolved. Output committed:
`src/languages/swedish/accent-stress.tsv` (42,052 words, 11,075 with a non-initial stress ordinal, ~480KB).

**First tried** deriving from portable-espeak's `accent-lexicon.tsv` col-3 IPA corrections — but col 3 only
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

**Review follow-up (alignment guard):** the adversarial verifier found the oː could land on the WRONG ⟨o⟩ for the `neuro-` family — NST consonantises ⟨eu⟩ (`ne$vrU$"lo:g`), dropping a vowel BEFORE the stress, so the ordinal shifts. Fixed by withholding the `o` flag when NST's vowel count and the word's disagree in a way that moves the index. The mismatch is PRE-stress (harmful: neurolog) vs POST-stress (harmless: a loanword's silent final ⟨e⟩ — adobe `a"do:b`, pose `"po:s`, where the stressed ⟨o⟩ still lines up). The guard absorbs one trailing silent ⟨e⟩ before comparing, so adobe/pose/code KEEP their correct oː while neurolog/neurologiska drop to uː. 605→592 flagged. (Prompted by review feedback: a "silent final e" is NST-accurate for the Swedish adaptation of these loans, but the drop is post-stress, so those overrides were correct and shouldn't have been withheld.)

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
portable-espeak's own sv convergence doc also leaves "NST compound-juncture conventions" as a residual, so
this is a genuinely hard sub-problem, deferred rather than shipped with regressions.

**Still deferred:** compound decomposition (above), OOV loanword stress (words outside the 50k corpus → first
syllable), short /ɛ/→[æ] before r (speaker-variable; wikipron uses ɛ).

## Run 7 — 2026-07-14 — pitch accent (accent 1/2) VALIDATED vs wikipron + numeral fix

The maturity note ("pitch accent deferred") was STALE: accent 1/2 is already rendered (swedish.ts — accent-2 = a
combining grave on the primary-stressed vowel, accent-1 = plain ˈ, from the NST lexicon's accent column; OOV falls
to oovAccent by shape). Validated it against an INDEPENDENT source: wikipron swe marks accent before the stressed
syllable (² = accent 2, ¹ = accent 1) — from English Wiktionary, independent of our NST-derived lexicon. New
committed eval `tools/eval/sv-accent-eval.mts` + floor `test/swedish-accent.test.ts`.

RESULT (excluding 21 homographs wikipron lists with both ¹/², e.g. anden 'duck'/'spirit', buren 'carried'/'cage' —
our single reading can't match both): **1073/1111 = 96.6%** accent agreement. Accent-2 recall (the reliably-marked
class) **98.0%**; accent-1 recall 64.6% on a small (48) adversarial subset — Wiktionary marks ¹ mostly to
disambiguate, so its accent-1 set is skewed to hard/contested/slang (byxis/fritis/sade). Like Japanese pitch, this
is an inherent ~95% task where two independent lexica disagree on the contested tail.

REAL BUG found + fixed: the **tens numerals 30–80** (trettio/fyrtio/femtio/sextio/sjuttio/åttio) rendered accent 1,
but the compound X+tio numerals are accent 2 (wikipron ² confirms; NST itself gives 10/20/90 = tio/tjugo/nittio
accent 2 — 30–80 was an NST inconsistency). Corrected in build-sv-lexicon.mts (ACCENT2_NUMERALS override, documented)
+ regenerated (6 rows changed). trettio→trˈɛ̀tːɪɔ. Accuracy 96.0→96.6%. Numbers are high-frequency for synthesis, so
this matters beyond the referee point.

STATUS: all of segmental + tonal accent + stress + o-quality + numbers are built and (accent now) independently
validated. Remaining deferred item is compound decomposition (Run 6 — hard, fogemorfem-aware junctures needed) +
minor tails (OOV loanword stress, short ɛ→æ before r).

## Run 8 — 2026-07-14 — compound prosody via NST secondary stress (NOT a splitter)

Re-attacked compound decomposition (the Run 6 deferral). First re-confirmed Run 6: a lexicon-wordlist splitter is
net-negative. A fogemorfem-aware (linking-s) recursive splitter reached 24/25 on a labeled set BUT at scale split
38% of words with terrible precision — inflected simplexes and loans parse into spurious words (bommar→bom+mar,
klasser→klas+ser, kontrovers→kon+tro+vers, skorstenen→skor+stenen). Confirmed the splitter path is a dead end
without a morphology/inflection model. Threw it away.

PIVOT: **NST already marks secondary stress with `%`** — `storstad → ""stu:$%s\`t\`A:d`, `storkök → ""stu:r$%s'2:k`
(NST even softens k→ɕ and lengthens the vowels at the element boundaries). 32.2% of the 42k corpus words carry a
`%`. So compound prosody is available as HIGH-PRECISION LEXICON DATA — no splitter, no false positives. This is the
same "take abstract features from NST, not its segments" principle the accent/stress/o-quality layers already use.

The gap the current engine has on compounds is boundary-unaware: storstad→stˈɔ̀ʂtad — the first ⟨o⟩ is computed SHORT
(coda "rst" counts ≥2) so it surfaces ɔ, but the element boundary stor|stad makes it an open syllable → long [uː]
(stor→stuːr standalone). Vowel QUALITY is coupled to length in Swedish (long o = [uː]/[oː], short o = [ɔ]), and the
BACKBONE keeps quality, so this is referee-visible AND a synthesis error. Plan: extract the secondary-stress ordinal
+ the LENGTH of the primary & secondary stressed nuclei from NST; the engine emits ˌ at the secondary nucleus,
drives compound stressed-vowel length from NST (not the boundary-unaware coda rule), and fires consonant softening
(k→ɕ, sk→ɧ, g→j) at the secondary onset too. Simplex words are unchanged (no `%` → rule as before).

### 8a — Result: compound prosody shipped

Implemented. build-sv-lexicon.mts now extracts, per corpus word, the secondary-stress ordinal (`s<N>`) + the set of
NST-long vowel ordinals (`L<ords>`) — 13178 of 42052 words carry it. The engine (g2p.ts `Compound`) emits ˌ at the
secondary nucleus, takes length from the NST-long set (boundary-safe — captures storkök's long stor-⟨o⟩ that the coda
rule shortens, AND unstressed-but-long vowels like arbetsplats' ⟨e⟩), and fires consonant softening at the secondary
onset (storkök k→ɕ). Simplex words (no `%`) are byte-identical to before.

storstad stˈɔ̀ʂtad → **stˈùːʂtˌɑːd** (o→uː quality fixed, stad ˌɑː), storkök stˈɔ̀rkœk → **stˈùːrɕˌøːk** (k→ɕ + ö long),
barnbok → bˈɑ̀ːɳbˌuːk. Referee **52.6% → 55.7%** (+3.1) — vowel QUALITY is backbone-visible (long o = uː/oː vs short
ɔ), so the boundary-safe length shows up. Accent unchanged 96.6%. Residual divergence classes are the SAME referee
noise as before (de/fan/inte casual forms) — no new compound-error class. Full suite 260/260 + 5 compound goldens.

This closes the last sv subsystem gap. The splitter dead-end (Run 6, Run 8 head) is avoided entirely by using NST's
own secondary-stress marks — high precision, zero false positives. Remaining tail is OOV compounds (outside the 42k
corpus → first-syllable stress, no secondary) + the minor folded items (short ɛ→æ before r).

### 8b — review fixes

Adversarial review of the compound change surfaced two candidates:
- **Bug 1 (empty-`L` shortens the primary vowel)** — INVESTIGATED, NOT a bug. NST genuinely marks these compounds
  short (inom→`""In$%Om`, bomull→`""bU$%mu0l`); Swedish compounds reduce the first element, and the independent
  wikipron referee CORROBORATES (morbror→[mʊrbrʊr], not the citation [muːr]). Measured the reviewer's proposed
  fallback (empty-`L` → coda rule): referee 2944 vs trusting-NST 2945 — trusting NST is at least as good. Kept.
- **Bug 2 (secondary-onset softening over-fires on a vowel-initial 2nd element)** — REAL, 11 words (björkö→bjœrɕøː,
  påskägg, lagändring…). The consonant before a vowel-initial second element is element-1's CODA, not an onset, so
  it must stay hard. Fixed: extract `%V` (vowel-initial secondary) from NST → `vi` token → suppress secondary
  softening there. björkö→bjˈœ̀rkˌøː; storkök/barnkör (consonant-initial 2nd element) still soften correctly.
  Referee 2945→2946.
