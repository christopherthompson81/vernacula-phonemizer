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
