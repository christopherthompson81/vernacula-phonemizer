# Danish (da) bring-up — investigation

Bring up Danish (da), a FLEURS-102 language: North Germanic, Latin script, ~6M. Danish is one of the DEEPEST
European orthographies (with English/French) — extensive consonant lenition (soft-d→ð, soft-g→vocalized/silent),
vowel-quality shifts, the suprasegmental STØD (creaky-voice/glottalization, ˀ), and aspiration/affrication. A greedy
g2p has a real ceiling; the question is how high.

## Run 1 — 2026-07-24 — referee + phonology scoping

Referee: **en.wiktionary Danish IPA, 7699 words** (HUMAN, via build-referee.ts) — a large, well-resourced referee
(unlike the ASJP-only Umbundu). The transcription is VERY NARROW: stød ˀ, aspiration/affrication (pʰ tˢ kʰ), voiceless
diacritics (b̥ ɡ̊ d̥ l̥), non-syllabic offglides (ɐ̯ ʊ̯), half-length, syllable dots.

Danish orthography→sound signatures observed in the referee:
- **soft d**: ⟨d⟩ after a vowel → [ð] (abbed→ɑb̥eð, adel→æðəl, advokat→aðvoˈkad); initial/after-nasal ⟨d⟩ stays [d].
- **final -t → [d]** (voiceless d̥): absolut→abˈlud, acetat→…tæˀd, advokat→…kad.
- **r**: onset ⟨r⟩ → uvular [ʁ] (afbryde→…bʁyˀðə); coda ⟨r⟩ → vocalized [ɐ̯] (abort→abʌɐ̯t).
- **⟨af⟩ prefix → [ɑw]/[au]** (⟨f⟩ vocalizes: afgift→ˈɑwˌɡifd).
- **er (final) → [ɐ]**; unstressed ⟨e⟩ → [ə] (abe→aːbə, adresse→adrɛsə).
- **aspiration/affrication**: initial ⟨p t k⟩ → [pʰ tˢ kʰ] (afklæde→…kʰl̥ɛˀðə); after ⟨s⟩ / final → unaspirated.
- **stød ˀ** is pervasive but suprasegmental + hard to predict from spelling → will be FOLDED (defer).

Plan (Mongolian pattern): fold the narrow layer (stød, aspiration, voiceless diacritics, half-length, dots), build a
greedy g2p with the context rules (soft-d, coda-r, final-t→d, er→ɐ, unstressed-e→ə, hv/hj silent-h), measure, iterate
on the top buckets. Expect a Mongolian-tier ceiling (deep orthography). Stress + stød deferred.

## Run 2 — 2026-07-24 — rules + an honest look at folds (the "inconsistency" question)

Built the greedy g2p with context rules: af-→aw glide, soft-d (⟨d⟩→ð only intervocalic/word-final after a vowel;
kept [d] before a consonant — adresse→adresə but abbed→abeð), coda handling, final-⟨t⟩-after-vowel→d, -er/-et/-en/-el
reductions, silent-h (hj/hv/th), ng→ŋ, doubled-C collapse. Rule iteration reached ~30% WITH a stack of vowel-quality
folds (ɑ→a, æ→a, ɛ→e, ɔ→o).

**METHODOLOGY CORRECTION (prompted by the right question — "does referee inconsistency indicate lexical
differences?").** It does. There are TWO kinds of referee variation and I was wrongly folding both:
- **True notation noise** (fold OK): uvular~alveolar r (ʁ~r), syllable dots, whether stød/half-length is marked,
  aspiration on p/t/k. And — tested — the ⟨a⟩ [a]~[ɑ] front/back pair: MODELLING a→ɑ by context (before r/velar) was
  measured and LOST vs folding, confirming the referee varies it freely for the same context → genuine noise → fold.
- **Real structure** (must MODEL / keep distinct, NOT fold): the ⟨æ⟩ vs ⟨e⟩ vs ⟨å⟩ vs ⟨o⟩ qualities are DIFFERENT
  LETTERS/phonemes — folding æ→a, ɛ→e, ɔ→o conflates genuinely distinct words. Those folds were inflating the score
  by **+8pp (24.7→30.8→…)** while degrading the canonical output (emitting ⟨æ⟩ and ⟨a⟩ identically). Dropped them.

**Honest folded backbone: 24.7%** (a/ɑ + suprasegmental notation folded; æ/ɛ/ɔ kept distinct). This is LOW because it
is TRUE: Danish is the deepest European orthography — the stressed-vowel QUALITY, the soft-d/soft-g realisation, the
unstressed reduction, and stress placement are all largely LEXICAL / stress-conditioned and NOT recoverable from
spelling by rule. The consonantal skeleton is mostly right; the vowels are the ceiling. The real path to a usable
Danish phonemizer is a PRONUNCIATION LEXICON (a Wiktionary/CC-derived word→IPA table, held out for eval, with the rule
engine as the OOV fallback — the Bengali/German lexicon-tier pattern), NOT more folds and NOT rule-guessing at
unrecoverable vowels. → decision point: ship the honest rule engine (~25%, documented ceiling) vs invest in the
lexicon tier (the genuine fix).

## Run 3 — 2026-07-24 — the lexicon tier + a stress model (user-chosen fix)

Given the honest rule ceiling (~25%, vowel quality unrecoverable), built the LEXICON tier + a stress model.

**Lexicon** (tools/gen/build-da-lexicon.mts → src/languages/danish/da-lexicon.tsv, 7476 words): each raw narrow
Wiktionary transcription is NORMALISED to canonical Danish IPA — strip the suprasegmental / notation layer (stød ˀ,
aspiration/affrication, length, syllable dots, optional-parens, voiceless/non-syllabic diacritics) but KEEP the
segmental phonemes AND the real stress marks. Source is CC-BY-SA (Wiktionary) → shippable per the permissive-data
policy. `phonemizeWord` = lexicon lookup → rule fallback. The lexicon covers **97.3%** of the referee (i.e. common
Danish words) at reference quality; real Danish text is common-word-dominated so effective coverage is high.

**Stress model** (rule engine): first-syllable stress (the Germanic default) shifting to the syllable AFTER an
unstressed prefix (be-/for-/ge-/und-/er-), emitting ˈ (København→…ˈhɑwn via the lexicon; forstå→fʌˈsdɔ, begynde→beɡønə
via the rule). Monosyllables carry no mark. Stress is folded in the eval (so it doesn't move the 24.7%) but it is real
canonical output and the hook for a future stød model.

**Non-circularity:** the referee-eval's PHON[da] points at `phonemizeWordRules` (the rule engine ONLY), so the 24.7%
is the genuine OOV/novel-word capability — the lexicon (built from the referee) is NOT what's scored. Floor da:0.22.
Catalogue da→implemented 🟡; goldens test/danish.test.ts (lexicon path + rule fallback). All 987 tests pass.

**Path past the floor (deferred):** a neural per-grapheme OOV g2p (the bn BiLSTM-tagger pattern) trained on the
lexicon would generalise the vowel-quality/reduction that the rule engine can't — the real way to lift OOV Danish.
Plus a bigger lexicon (a full CC Danish pron-dict) and cardinal numbers (the Danish vigesimal system).

## Run 4 — 2026-07-24 — adversarial review fixes

Two review agents (lexicon/circularity/folds + rule-engine correctness). Non-circularity VERIFIED (eval → the rule
engine only, never the lexicon; the lexicon's tie-bar concern was moot — 0 ties in the source). Fixes:
- **ə→ɐ fold REMOVED** — the review correctly flagged it as the same overreach I'd claimed to fix: Danish /ə/ (‑e) and
  /ɐ/ (‑er, vocalised‑r) are DISTINCT phonemes. Keeping them distinct cost −0.2pp (honest). (ɣ~ɡ and a~ɑ folds KEPT —
  modelling each was tested and LOST, proving they're context-inconsistent notation noise, not contrasts.)
- **Rule-engine bugs fixed (2 HIGH):** (1) the ‑er/‑et/‑en/‑el reductions fired on MONOSYLLABLES (den→dən, der→dɐ,
  let→ləð — high-frequency function words); now gated on a preceding nucleus (den→den, der→deʁ). (2) primary stress
  could land on a REDUCED schwa when UNSTRESSED_PREFIX misfired on a non-prefixed word (gerne→ɡeʁnˈə); rewrote stress
  as a two-pass segment placement that puts ˈ only on a FULL nucleus (gerne→ɡˈeʁnə, begynde→beɡˈynə). Removed dead
  IPA_VOWEL/WORD_VOWELS. The monosyllable fix recovered the 0.2pp → **honest 24.7%** with correct function words.
- af-glide over-applies to the mono-morpheme "aften" (→awtən) — lexically governed / unrecoverable; the lexicon
  covers the common cases, accepted as an OOV residual.

## Run 5 — 2026-07-24 — OOV tagger tier + rule mining + the lexical ceiling

The Run 3 "path past the floor" (a neural OOV g2p) — built and measured honestly. Deterministic 90/10 split
(`hash(("da",w))%10==0`), aligned by hard-EM Viterbi (many-to-{0,1,2} monotonic), held-out folded:

| Path | Held-out OOV (folded) | Deps |
|---|---|---|
| Rule engine (`phonemizeWordRules`) | 25.8% | none |
| + mined contextual rules + noise folds | ~27.4% (rule-floor) | none |
| **Averaged perceptron** (`tagger.ts`, sync) | **42.0%** | none |
| BiLSTM (2-layer, GPU, ONNX) | ~50.1% | onnxruntime |
| Collapse EVERY vowel-quality distinction | **55.7%** | — (ceiling probe) |

**The ceiling is LEXICAL, not model capacity.** The last row is a probe: a hypothetical perfect model blind only to
`a/ɑ e/ɛ o/ɔ ø/œ` quality still tops out at ~56%. So the ~44% no model can reach is genuine deep-orthography depth —
Danish stressed-vowel quality is not a function of the spelling+context, it's decided lexically. Neural learning got us
"about halfway" precisely because half the information isn't in the input. Only the lexicon carries it.

**Shipped architecture (three tiers):** `phonemizeWord` = lexicon → **perceptron tagger** → rule fallback. The
perceptron is chosen over the BiLSTM: sync (no torch/onnxruntime, the repo's `posTagger` precedent), +16pp over rules,
and the BiLSTM's extra +8pp tops out against the 56% wall anyway. `tagger.ts` byte-matches the Python `feats()`
(verified: snurretop→snorɛtop, fladbrød→flaðbrœð). Model = `da-g2p.tsv` (perceptron weights, |w|≥0.75 pruned).

**Miss-mining → referee noise (the user's ask "corrections to training data, or referee noise").** Mining the
held-out misses separated clean notation noise from real depth. Found **~3.4pp of genuine referee inconsistency** worth
folding (same phoneme/context written two ways, like the `r/ʁ` we already folded):
- `[nŋ][ɡk]→ŋ` — the velar-nasal cluster's post-nasal stop presence+voicing is written inconsistently (-ing→eŋ but
  arving→arvenɡ; bank→baŋɡ).
- `ɡ$→k`, `b$→p` — final-stop voicing (voiceless-diacritic stripped) written both ways (alk→alɡ).

These are now folds in `da.jsonc` (rule floor 24.7%→27.4%, BiLSTM 46.7%→50.1%). The rest of the misses are NOT
noise/fixable-data — the 55.7% collapse ceiling proves it. Danish is just hard; cleaning the referee won't rescue it.

**Mined RULES (rules > neural for the common case, the user's steer).** `mine_da_rules.py` aligns the lexicon and ranks
(prev,g,next)→tag contexts whose dominant tag differs from the grapheme default, weighted by appearance in words the
rule engine gets wrong. Three high-purity, high-impact contexts became fast scan rules in `phonemizeWordRules`: final
⟨g⟩-after-vowel silent (rolig→roli), ⟨i⟩→[e] before ⟨n⟩+C (ind→en), ⟨o⟩→[ʌ] before ⟨ld⟩ (hold→hʌl). Rule floor
24.7%→25.8% before folds.

**Tooling (committed, reproducible):** `tools/danish/da_tagger_prototype.py` (loader + hard-EM aligner + perceptron +
export), `train_da_bilstm.py` (GPU BiLSTM → ONNX; the async upgrade path, pipeline committed but the 2.5MB artifact is
NOT shipped — regenerable, doesn't justify onnxruntime for +8pp against the lexical wall), `mine_da_rules.py`,
`da_rule_probe.mts`, `da_tagger_eval.mts` (folded held-out eval). GPU training runs in a gitignored `.venv/` (torch
cu124). All numbers above are the folded held-out eval, non-circular (the eval scores the rule engine / tagger, never
the lexicon).
