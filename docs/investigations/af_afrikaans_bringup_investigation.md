# Afrikaans (af) bring-up — vernacula-phonemizer

Afrikaans: Indo-European (West Germanic, daughter of Dutch), ~7M, South Africa/Namibia, Latin script + diacritics
(ê ô û î ë ï é á à). espeak SHIPS af (af_rules) — but vernacula targets BEYOND-espeak canonical IPA. Fairly regular
orthography (more than Dutch/English) → greedy digraph-first g2p (the Wolof/Kikuyu/Mossi pattern) should fit.

## Run 1 — 2026-07-24 — plan + phonology notes (to VALIDATE against the referee)

Referee: en.wiktionary Afrikaans IPA via tools/corpus/build-referee.ts --lang af --wnl Afrikaans. (wikipron afr is a
2nd option.) Beyond-espeak → shimOracle:false; validate on the referee, not espeak parity.

Candidate grapheme→IPA (Standard Afrikaans, to confirm/fold):
- **g = [x]** the signature velar fricative (NOT [ɡ]); ch/gh = [x]; final -g often [x].
- Diphthongs: **ei/y = [əi]**, **ui = [œy]**, **ou/ouw = [œu]**, eu = [øː]/[iø], **ai = [ai]**, aai = [aːi], ooi = [oːi], oei=[ui], eeu=[iu].
- Long vowels (digraphs): aa=[ɑː], ee=[eː]/[ɪə], oo=[oː]/[ʊə], uu=[yː]; ie=[i], oe=[u].
- Short vowels: a=[a], e=[ɛ]/schwa [ə], i=[ə]/[i], o=[ɔ], u=[œ]/[ə].
- Diacritics: ê=[ɛː], ô=[ɔː], û=[œː], î=[əː]; ë/ï = diaeresis (syllable break, own vowel).
- Consonants: v=[f], w=[v], j=[j], b/d final DEVOICE (b→p, d→t), h=[ɦ], r=[r] (trill/tap), sj=[ʃ], tj=[c]/[tʃ],
  dj=[dʒ], ng=[ŋ], nk=[ŋk], -tjie diminutive=[ki].
- Nasalization before -ns (mens=[mɛ̃ːs]) — DEFER to a later run if referee marks it.

Open questions for the referee: schwa distribution (unstressed e/i), g voicing in loans, diphthong exact symbols
(əi vs ɛi, œy vs œi), final devoicing scope, stress (unwritten → likely fold). Build greedy g2p → measure folded →
iterate. NUMBERS + stress deferred until segmental is solid.

## Run 1b — referee built (2220 Wiktionary pairs) + CONFIRMED rules

Symbol inventory: ə(1846, dominant) ˈ.ˌ(fold) r/ɾ(fold) χ(384=g!) ̯(fold, diphthong offglide) a/ɑ ɔ ɛ ɪ œ u ʊ y ø o ŋ ɦ.
Wiktionary uses **χ (uvular) for g**, marks **stress + syllable dots** (fold), **nasalization** (Engels→ɛ̃ŋəls), and
**optional schwa** in parens (arm→ˈɑr(ə)m — fold parens).

CONFIRMED grapheme→IPA (from short native words):
- **Open/closed vowel LENGTH rule (Germanic):** a single vowel is LONG/tense in an OPEN syllable (V.CV: ape→ˈɑːpə,
  adel→ˈɑːdəl) and SHORT/lax in a CLOSED syllable (VCC/VC#: abba→a, appel→a, al→a, adder→adər). Heuristic:
  single vowel + (exactly one C + vowel) → long; else short. NOT a trivial greedy loop → needs lookahead.
- **Long mids are CENTERING DIPHTHONGS:** long a=[ɑː] (monophthong); ee / open-e = [iə̯]/[ɪə̯] (Here→ɦiərə); oo /
  open-o = [uə]/[ʊə] (Botha→buəta, Boland→bʊəlant); ie=[i]; oe=[u] (Boer→buːr).
- Short: a=[a], e=[ɛ] (closed, adres→aˈdrɛs) / [ə] (unstressed, adder→adər), o=[ɔ], i=[ə]/[ɪ], u=[œ].
- **y = [əi̯]** (altyd→altəi̯t, anys→aˈnəis, wyn→vəin); ei = [ɛi̯] (aarbei→bɛi̯); ui=[œy]; aai=[ɑːi̯]; ou=[œu].
- Consonants: **g=[χ]** (ag→aχ, afgaan→afχɑːn); **w=[v]** (aalwyn→vəin); **v=[f]** (advies→atˈfis, aanveg→fɛχ);
  h=[ɦ]; r=[r]~[ɾ] (fold); ng=[ŋ]; nk=[ŋk]; **final DEVOICING** (aanbid→bət, aand→ɑːnt, advies→atfis) — variable in
  the referee (baard→bɑːrd kept); diminutive **-tjie/-jie=[ki]**; ch/sj=[ʃ]; tz=[ts].

PLAN: greedy digraph-first g2p + open/closed vowel-length lookahead + final devoicing + folds (stress/dots/parens,
r~ɾ, χ~x, nasalization strip, ̯ offglide). Measure folded vs the 2220 referee; iterate. Nasalization + stress DEFER.

## Run 2 — 2026-07-24 — engine built + iterated to 71.2% folded

Built src/languages/afrikaans/{afrikaans.jsonc, manifest.ts, afrikaans.ts}, registered in registry.ts, wired
tools/referee-eval/langs/af.jsonc + eval.ts. Engine: greedy fixed-table (digraphs/consonants) + code rules that beat
the table (geminate collapse, soft-⟨c⟩) + open/closed vowel-length lookahead + final devoicing + first-syllable
stress (past unstressed prefixes be/ge/ver/ont/her).

Iteration on the 2220-word Wiktionary referee (folded):
- 45.0% first pass (no stress) → over-lengthened unstressed open vowels + e→ɛ not ə.
- 49.3% first-syllable stress (only lengthen stressed) · 51.6% ⟨i⟩ tense/lax by syllable + ei→əi ·
- 55.3% prefix-aware stress + soft-⟨c⟩ · **65.1% the KEY folds: ʊ~u + œy~œi** (centering-diphthong onset — huge) ·
- 66.0% geminate collapse (reorder: code rules must precede the fixed table) · **71.2% removed n-before-fricative
  deletion** (it was net-NEGATIVE once the reorder made it fire — over-deletes on native monosyllables).

Final: **71.2% full / 86.2% short-native / 90.8% monosyllabic.** The full-set residual is (a) PROPER-NOUN/loan lexical
pronunciations (Afrika→ɑfrika, Botha→buəta, Coetzee — the Wiktionary category is name-heavy) and (b) stress-conditioned
vowel reduction on POLYSYLLABLES (Amerika stress is 2nd-syllable; our first-syllable heuristic misses lexical stress).
Both need what's DEFERRED: a real stress/syllable model + a proper-noun lexicon. Common native vocabulary is strong
(Die man loop huis toe.→di man luəp ɦœys tu). 🔷 single-source (Wiktionary; wikipron afr a candidate 2nd referee).
Goldens in test/afrikaans.test.ts; floor af:0.68. LESSON: code rules must run BEFORE the greedy fixed table (else
they're dead code — the geminate/n/c rules initially never fired); and a "linguistically correct" rule (n-deletion)
can still be net-negative vs the referee → always measure.
