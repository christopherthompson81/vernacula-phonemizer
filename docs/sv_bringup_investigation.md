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
