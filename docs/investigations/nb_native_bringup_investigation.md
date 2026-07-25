# Norwegian Bokmål (nb) native bring-up

North Germanic, Norway (~5M), Latin. Urban East Norwegian (standard østnorsk). Goal: an espeak-independent
canonical-IPA rule g2p. Closest sibling in the repo: Swedish (sv, a deep-orthography rule engine, referee-limited at
55.7%) and Danish (da, lexicon-first). Norwegian is a deep orthography: complementary vowel length, a tricky ⟨o⟩→[u]
split, retroflexes, silent-d, and pitch accent (tonelag 1/2, unwritten → deferred like Swedish).

## Run 1 — 2026-07-24 — referee, engine, and the referee ceiling

**Referee:** wikipron `nob_latn_broad` — 3432 HUMAN Bokmål entries. Read off the data: ⟨o⟩→uː (bok→buːk, god→ɡuː),
⟨u⟩→ʉː (hus→hʉːs), ⟨å⟩→oː/ɔ, retroflex r+coronal (barn→bɑːɳ, norsk→nɔʂk), silent final ⟨d⟩ (god→ɡuː, jord→juːr), the
digraphs sj/skj→ʃ, kj/tj→ç, hv→ʋ; pitch accent marked with ¹/²/circumflex (fold). Backbone folds length (ː) + stress +
tone, so the scored layer is vowel QUALITY + consonants.

Authored the module (mirroring the Swedish complementary-length engine): vowel long/short tables, front-vowel
softening, retroflex, silent-d, first-syllable stress. **First measurement: 10.9% folded** — very low. Three systematic
bugs, all fixed:
1. **short ⟨o⟩→ɔ** (was ʊ) — norsk→nɔʂk.
2. **a silent final ⟨d⟩ still closes the syllable** for length (hånd→hɔn short, but god→ɡuː long — count the d).
3. **unstressed ⟨e⟩→schwa** (Bergen→bærɡən, not bærɡɛn) — the Dutch/German lever, hits every -e/-en/-er ending.
→ **19.4%.**

**The low-vowel fold** — the referee writes /ɑ/ as front [a] far more (1865×) than back [ɑ] (730×); one phoneme, so
folded ɑ→a. → **27.2%.** Plus two clean segmental fixes (⟨ø⟩ stays øː before r — gjøre→jøːɾə, only ⟨e⟩ lowers to æ;
and ⟨rd⟩ counts as one coda so jord→juːr is long while hånd's nd→short). → **27.5%.**

**Where the ceiling is — REFEREE-LIMITED by loanword stress (the key finding).** The engine is SOUND on native
vocabulary (bok, hus, barn, norsk, god, tre, hånd, gjøre, kjøre, jord all correct). But a length/quality split by word:

| bucket | folded |
|---|---|
| short / native (≤6 chars) | **46.5%** |
| long (Latinate loanwords + inflected forms) | 15.4% |
| all-caps acronyms | 0% |

The wikipron nob referee is **dominated by long Latinate loanwords** (abandon, abbreviere, abdikasjon, …) and their
inflected forms, whose stress is NOT first-syllable — and Norwegian stress governs vowel length, quality, AND the
schwa reduction. A first-syllable rule engine mis-lengthens (Angola: ⟨o⟩ is long [u] under 2nd-syllable stress, the
rule makes it short) and mis-reduces these. This is exactly the Swedish (55.7%, "referee strips stress/length — not a
quality signal") and Dutch (64.5%, "deflated by proper nouns + the loanword vowel-quality/stress lexical tail")
situation — Norwegian sits lower because this particular referee is more loanword/inflection-heavy.

**Dead end this run:** an "unstressed -er keeps [e]" exception (abandoner→…eɾ) — REGRESSED 27.2%→23.6%, because the
referee reduces most -e to ə (ə=2181 vs e=827). Reverted; blanket unstressed-e→ə is the majority-right rule.

**Verdict: 🔵🔷 in-development + single-source, 27.5% folded.** Phase 1 is a working segmental engine (native words
right; the length/quality/softening/retroflex/silent-d machinery is in place). The number is referee-bounded by
loanword stress, not native error. **The path past the ceiling** is the same as the fleet's other deep orthographies:
a stress lexicon (the Swedish NST pattern — drives length/quality from lexical stress) or a pronunciation lexicon (the
Danish pattern). Pitch accent (tonelag 1/2) is a separate deferred layer. Floor 0.25. Wired: registry (`case "nb"`),
eval PHON, `langs/nb.jsonc`, `test/norwegian.test.ts` (5 tests), catalogue row, maturity row.

## Run 2 — 2026-07-24 — code review fixes

3-agent review (wiring + folds verified clean — ɑ~a / r~ɾ folds confirmed honest, no over-crediting; no Swedish
symbol leftover). One real bug + cleanups:
- **Accented vowels were dropped by the tokenizer** — the TOKEN class `[A-Za-zÆØÅæøå]` excluded é/ô/à/… so common
  Bokmål words split and lost their vowel (fôr→"f ɾ", idé→"iː", kafé→"kɑːf"). Added é è ê ë à â ô ü to the tokenizer +
  the vowel tables (é = always-long [eː]: idé→iːdeː; ô = long o: fôr→fuːɾ; others → base-vowel quality). +0.2pp → 27.7%.
- Verified the r+coronal-as-one-coda length rule empirically: counting it as 1 (long, current) scores 27.5% vs 27.2%
  as 2 (short) — the referee's lexical length is ~50/50 but as-1 is net-better; kept (barn→bɑːɳ, jord→juːr right; the
  bort/førti over-lengthening is the documented lexical tail).
- Cleanups: removed the dead `vowelChars` manifest field (code uses a local orthographic set), simplified the -sjon/
  -tion suffix check to `four === "sjon" || "tion"`, and corrected the jsonc "tjueen" number comment (the shared
  composer space-separates tens+unit). Golden added (idé, fôr). Full suite 1027/1027.

Acknowledged loanword-tail residue (documented, deferred): silent-⟨d⟩ over-applies to loans/names (David→dɑːʋɪ,
milliard→mɪlːɪɑɾ) — the same class as the stress ceiling, needs a lexicon.

## Run 3 — 2026-07-24 — the referee was the problem: frequency-weighting + a complete dump

Re-examined the 27% headline after the question "is this English code-switching / should we narrow the referee?".
Two findings reframed everything:
- **The "hard" words are NATIVIZED Latinate loans read with FULL Norwegian phonology, not English** — abandon→abandɔŋ
  (Norwegian final n→ŋ, ɔ; NOT English əˈbændən), abdikasjon→abdɪkaʃuːn (sj→ʃ). So language-switching them to English
  would be WRONG. The problem is Norwegian LEXICAL (non-initial) stress, not language.
- **The wikipron referee is the alphabetical HEAD of the scrape** — drowning in ab-/abs- Latinate families (97 "absor-"
  forms, 96 "abort-", 82 "absol-"). It is NOT representative of Norwegian; it over-samples exactly the loans that need
  lexical stress. It doesn't even contain the most-common words (jeg/det/er/du — not "a"-words).

**Fixes (this run):**
1. **A complete dump** — pulled kaikki nb (76k entries → 5943 words with usable IPA, vs wikipron's 3432 truncated
   subset), made it the primary referee. Same source (Wiktionary, correlated) but representative, and it PRESERVES
   stress (absorbere→absɔrˈbeːrə).
2. **Frequency-weighting the eval** — the honest version of "narrow to native words". Added a token-weighted metric to
   the referee-eval harness (`tools/referee-eval/freq/<lang>.txt`, OpenSubtitles no_50k, CC BY-SA): each referee word
   contributes its corpus frequency, so common (native, correct) words count and rare inflections don't. Reusable
   fleet-wide (Dutch/German are similarly deflated).

**The reframe:**

| referee | raw uniform | FREQUENCY-WEIGHTED (real text) | top-100 |
|---|---|---|---|
| wikipron (truncated) | 27.7% | 46.2% | — |
| **kaikki (complete)** | 23.0% | **63.4%** | 65.0% |

The engine was never "a 27% engine". On real-text token weighting it is **63.4%** — in line with Swedish (55.7%) and
Dutch (64.5%). The raw uniform number was a dictionary-shape artifact all along. The floor test now guards the raw
(≥0.20) AND a dedicated frequency-weighted floor (≥0.55, the meaningful regression guard for real-text quality).

**The path up (unchanged, now measurable):** a pronunciation/stress lexicon (the da/sv pattern) + an OOV per-grapheme
tagger (the da perceptron/BiLSTM pattern — Norwegian is the same deep-orthography problem where a tagger learns the
stress-conditioned vowel quality DIRECTLY from spelling, bypassing explicit stress). Re-measure frequency-weighted.

## Run 4 — 2026-07-24 — the two-tier fix: an independent lexicon (tier 1) + a stress-predicting BiLSTM (tier 2)

Run 3 reframed the 27% headline as a referee-shape artifact and named the path up (a pronunciation/stress lexicon +
an OOV tagger). Run 4 builds both and measures.

### Tier 1 — the NST pronunciation lexicon (the big win, ships unconditionally)

Pulled the **Norwegian National Library pronunciation lexicon (NST)** — `no.leksikon.tar.gz`, **CC0**, ~814k entries,
ISO-8859-1/CRLF, semicolon-separated (word = field 0, NST-SAMPA transcription = field 11). This is INDEPENDENT of
Wiktionary (the referee), so scoring against kaikki is non-circular. Built an NST-SAMPA→canonical-IPA converter
(`tools/norwegian/build_nb_data.py`: retroflex letter+backtick, the vowel tables, tone-2 `""`→ˈ with tone dropped,
boundary markers dropped). Two selection bugs mattered:
- **`u0` digraph** — `u0` (in full/null/produkt) was mis-read as `ʉɔ` (u→ʉ, 0→ɔ); it's the short /ʊ/. Fixed → null→nʊl.
- **variant selection (biggest lever)** — taking NST's FIRST variant gave spelling-letter readings for high-frequency
  function words (er→eːər, en→eːən). Taking the SHORTEST IPA variant per word fixed it (er→æːɾ). This alone lifted the
  shipped frequency-weighted score from 79.9% to 90.4%.

Frequency-filtered to the ~38k common forms → `src/languages/norwegian/nb-lexicon.tsv` (covers ~98% of real-text
tokens). `phonemizeWord` is now **lexicon → rules** (`phonemizeWordRules` = the Run 1–3 rule engine, kept as the OOV
fallback and the non-circular eval floor).

| path (vs kaikki, frequency-weighted real text) | score |
|---|---|
| rules only (floor) | 63.4% |
| **NST lexicon → rules (SHIPPED)** | **90.7%** |

NST independently corroborates the rule engine too (every design choice: Bergen→bæɾɡən, barn→bɑːɳ, gjøre→jøːɾə,
absorbere stress on -béː-), breaking Run 3's single-source caveat.

### Tier 2 — the OOV tail: BiLSTM vs perceptron (the experiment)

The lexicon leaves a ~2% genuine-OOV tail (proper nouns, novel compounds — for TTS, disproportionately names, where a
mispronunciation is most audible). Trained two per-grapheme taggers on the FULL NST (631k words, hard-EM
many-to-{0,1,2} alignment → per-grapheme IPA-chunk tags), evaluated on the SAME seed-0 held-out split (14,885 words):

| tagger on held-out OOV (segmental exact-match) | score | vs BiLSTM |
|---|---|---|
| **BiLSTM** (char-embed → 2-layer BiLSTM → tag head, GPU) | **83.4%** | — |
| averaged perceptron, IPM-parallel (±4-grapheme window) | 56.6% | −26.8 pts |
| rule engine (same set) | 9.4% | −74 pts |

**The perceptron loses ~27 points, not the ~5% hoped for** — the per-grapheme classifier can't model Norwegian's
long-range stress-conditioned vowel quality the way a BiLSTM's recurrent state can (this matches the Danish precedent,
where the perceptron was similarly dominated). So the sync-simplicity of a pure-JS perceptron isn't worth 27 points on
names. **Decision: ship the BiLSTM as an async OOV tier and drop the perceptron.** `onnxruntime-node` is already an
optional dependency (bn/fa), and the async neural-entry pattern (`phonemizeBnNeural` alongside a sync default) is
established — so the cost is the model file + a thin wrapper, not a new dependency.

**Shipping model — stress-included.** The segmental 83.4% number was for the perceptron comparison. For shipping, the
BiLSTM was retrained WITH the stress mark ˈ in the tag alphabet (631k words, 47 chars, 469 tags), so the bidirectional
pass predicts **stress POSITION** (the thing that's actually wrong for OOV loanwords — absorbere-type non-initial
stress) plus the vowel quality, in one pass. Exported to the shared structuralTagger contract
(`nb-g2p-tagger.onnx` + `.meta.json` = src/tags/charTags mask), served by `norwegianTagger.ts` (mirrors
`bengaliTagger.ts`, reuses `core/onnx.ts` + `core/structuralTagger.ts` masked-argmax) via the async
`phonemizeNbNeural` (lexicon → tagger → rules). **Held-out (631k, full-word exact-match INCLUDING stress): 89.7%**
(56376/62838) — i.e. ~90% of OOV words get both the vowel quality AND the stress position right, the second being
exactly what the rule engine gets wrong on loanwords. (The 83.4% above was the segmental-only metric, for the
apples-to-apples perceptron comparison; 89.7% is the harder complete-output number the shipped model is judged on.)

**A training-loss climb caught a fixed-LR bug (+14.6 pts).** The first stress-included run trained with a *fixed*
Adam lr=2e-3 and its training loss bottomed ~epoch 10 (0.091) then climbed ~50% to 0.138 by epoch 39 — the optimizer
overshooting the minimum once close, and we were exporting those last, past-the-minimum weights (held-out 75.1%).
Adding a **cosine LR decay** (2e-3→0 over the 40 epochs) made the loss decrease monotonically (0.283→0.039) and lifted
held-out **75.1%→89.7%**. Concretely the tagger reads what a single-first-syllable rule can't:
`absorbsjonskoeffisient`→`ɑbsɔɾbˈʃuːnskʊəfɪsɪˌɛnt` (primary stress on `-ʃuːn`, not the first syllable; a secondary
stress; the compound-internal sk→ʃ softening) vs the rule reading `ˈɑbsɔɾbʃuːnskɔəfːɪsɪənt`.

**Tooling / utilization.** The pure-Python single-core aligner pinned one core; rewrote the hard-EM alignment as a
multiprocess Pool (Viterbi E-step is embarrassingly parallel over words) and the perceptron as iterative parameter
mixing (McDonald 2010) — ~11 cores busy, alignment 8-iter dropped from ~7 min to ~22s. `nb_tagger_parallel.py`;
`train_nb_bilstm.py` reuses `align_parallel`. All training scripts log unbuffered (`-u`, `tail -f`-able).

**Architecture:** sync default = lexicon → rules (90.7% freq-weighted, C#-parity-irrelevant since nb is TS-only);
async premium = lexicon → BiLSTM → rules (OOV names). The perceptron/IPM tooling stays in-tree as the comparison
baseline but no perceptron model ships.
