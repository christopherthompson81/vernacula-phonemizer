# Luxembourgish (Lëtzebuergesch, lb) bring-up — West Germanic (Moselle Franconian), Latin, ~390k

Luxembourgish — a Moselle-Franconian (West Central German) variety, standardized in Luxembourg, Latin script with a
German-derived orthography (⟨w⟩→v, ⟨ch⟩→χ, initial ⟨st/sp⟩→ʃt/ʃp) + French superstrate loans. Referees: **wikipron
`ltz_latn_broad`** (human, CUNY-CL/wikipron, 4060 headwords) + **`ltz_latn_narrow`** (3209) — two independent human
referees → potentially ✅.

## Run 1 — 2026-07-26 — grapheme g2p, the diphthong system + the German-style rules

**The DIPHTHONGS are the core signal (non-obvious mappings, verified from the referee):**
- ⟨ei⟩, ⟨ai⟩ → [ai̯] (eisen→ai̯zen) — NOT [ei]
- ⟨au⟩ → [æu̯] (Haus→hæu̯s)
- ⟨ou⟩ → [əu̯]~[eu̯] (Kou→keu̯, Schoul→ʃəʊ̯l) — NOT [ou]
- ⟨é⟩, ⟨éi⟩ → [ɜɪ̯]~[ei̯] a front closing diphthong (Méi→mɜɪ, Wéi→vei̯, Dréi→dʀei̯)
- ⟨ie⟩ → [iə]~[iː] (Iesel→ie̯zel, Bier→biːr), ⟨ue⟩ → [uə]~[uː] (Buer→buːr)

The offglide diacritic (U+032F, combining inverted breve) is in the BACKBONE combining range → auto-stripped, so a
diphthong only needs the right two vowel SEGMENTS (ai̯→ai, æu̯→æu).

**The German-style consonant rules:** ⟨w⟩→v (Waasser→vaːsɐ), ⟨v⟩→f (Véier→fei̯ɐ), ⟨z⟩→[ts] (Kaz→kaːts, zéng→tseŋ),
⟨qu⟩→[kv] (Quell→kvæl), ⟨ch⟩→[χ] (broad transcribes the ach/ich split uniformly as χ: Buch→buχ, dech→deχ), ⟨sch⟩→ʃ,
initial ⟨st/sp⟩→[ʃt/ʃp] (Strooss→ʃtʀoːs, Spill→ʃpil), single intervocalic/initial ⟨s⟩→[z] (Sonn→zon, Iesel→iezel)
but ⟨ss⟩→[s]. **FINAL DEVOICING** (Hand→hant, Hond→hont, Frënd→fʀent; ⟨g⟩ final→[χ] Dag→daːχ). **r-vocalization**
final ⟨-er⟩→[ɐ] (Dokter→doktɐ; broad also writes -er, so fold).

**FOLDED (the Germanic-length call, like Afrikaans/Estonian):** vowel LENGTH (ː) — Luxembourgish length is largely
open/closed-syllable-conditioned (Kaz→kaːts) + from vowel doubling; a full model needs the syllable-weight rule
(deferred) → emit the segment skeleton, FOLD ː. Also fold: the ʀ~r rhotic variants, and the schwa notation.

## Run 2 — 2026-07-26 — iterating the g2p against the referee → 69.3% folded / 92.2% symbol

Built the greedy scan + rules and iterated against wikipron `ltz_latn_broad` (3893 headwords, variants merged).
Progression (folded backbone): baseline 38.7% → **69.3%**. The wins, each measured:

- **⟨é⟩ alone→[eː], only ⟨éi⟩ is the diphthong [ei̯]** (Déngen→deːŋən not dei̯ŋən). +geminate collapse (Flott→flot,
  Bidden→bidən) + removing an early final-⟨er⟩→ɐ vocalization (the broad referee mostly KEEPS -er): 38.7→51.9%.
- **short stressed ⟨e⟩→[æ], reduced ⟨e⟩→[ə]** (Belsch→bælʃ, Decken→dækən, but the ⟨-en⟩ ending + the ⟨ge/be/ver/er⟩
  prefixes reduce). Stress ≈ the first vowel past an unstressed prefix (the Germanic default) — plus the folds ɑ→a,
  ɪ→i, ʊ→u for the diphthong nuclei/offglides (Leit→lɑɪ̯t): 51.9→66.2%.
- **regressive DEVOICING before a voiceless obstruent** (Abt→apt, Bandscheif→bantʃaif) + **final ⟨g⟩→[χ] after a
  vowel / [k] after a consonant** (Dag→daːχ vs Alg→alk): →67.0%.
- **fold the ⟨é/éi⟩ nucleus ɜ→e** (Méi→mei̯ ~ referee mɜɪ̯): +2.3pp → **69.3%**.

**MEASURED NEGATIVES (reverted):** (1) ⟨ie⟩→[iː] and ⟨ue⟩→[uː] scored WORSE than [iə]/[uə] — Bier→biːr is the
minority; Iesel/Ierwen/Liewen/Wues all want the [iə]/[uə] diphthong. (2) ⟨v⟩→[v] (loan-frequent) scored 66.6 vs
[f] (native) 67.0 — kept the native [f]. (3) coda-r vocalization (r→ɐ before a consonant) was net-negative both
broad (66.2→65.9) and restricted-to-schwa (66.6→66.3): the broad referee keeps [ər] more often than it vocalizes.

**Residual (all 1–2× counts, a long tail):** the FRENCH-loan class (Aubergine→obərʒin, Avion→avjo, Orange→oʁaʃ,
Astrologie→astroloʒi — ⟨g⟩→ʒ, nasal vowels, dropped finals; an unpredictable lexicon job, deferred); the ROMANCE
penult-stress class (Capellen→kapælən — our first-syllable stress mis-locates the [æ]); the ⟨ver/er⟩-prefix
r-vocalization (Verhalen→fəhalən, ~4 words); and referee NOTATION inconsistency (ie/ue [iə]~[iː], final-r [r]~[ɐ]).

**FOLDED:** vowel LENGTH (ː, open/closed-syllable + doubling — deferred weight rule), the ʀ~r rhotic, the ach/ich
split ɕ/ç→χ, the diphthong nuclei/offglides ɑ/ɪ/ʊ/ɜ, and unstressed ⟨e⟩ e→ə. Run-2 plateau: **69.3%**. 🔷
single-source-FAMILY (broad + narrow are the same Wiktionary scrape at two transcription depths → correlated).

## Run 4 — 2026-07-26 — cheap rule/fold pass (the "is it BiLSTM-shaped?" follow-up) → 72.1% folded / 93.0% symbol

Prompted by "how are OOVs working / would a BiLSTM help": characterized the residual by edit-distance. Of the 1176
folded misses, **88% are 1–2 phones off** (notation/allophone), only 12% are 3+ (the French-loan structural tail,
~140 words / 3.6%). The dominant single-substitution pairs: **æ↔ə (~108) + æ→a (29)** — the stress-conditioned
vowel-quality decision (the one genuinely BiLSTM-shaped sub-problem, like bn's ɔ/o, but blocked by thin single-source
data = the eval referee); then a batch of **cheap rule/fold gaps** left on the table. Landed the clean ones:

- **ʁ→r fold** (eval): the referee writes the rhotic as r ~ ʀ ~ **ʁ** (uvular fricative) — I only folded ʀ. +0.5pp.
- **⟨n⟩→[ŋ] before a velar [k/ɡ]** (`velarNasal`): Bankrott→baŋkrot. +1.2pp.
- **intervocalic g-spirantization ⟨g⟩→[ʁ]** (`spirantizeG`): Lager→laʁər — real Luxembourgish g-lenition; [ʁ] is a
  distinct sound (underlyingly /g/) so it doesn't muddy the /r/ inventory. +0.4pp.

**REJECTED on canonical-correctness grounds (not score):** medial ⟨st/sp⟩→[ʃt/ʃp]. It scored +0.5pp HIGHER without
a coda guard, but only because it also fires on VstV MONOMORPHEMES (Muster→muʃtɐ, Poster→poʃtɐ) where [st] is a
coda-onset split, not an onset — [ʃt] belongs only at a true morpheme boundary we can't detect without morphology.
Shipping a known-wrong rule for +0.5pp is the referee-score-vs-canonical-consistency trap; kept word-initial only.

**Total cheap pass: 69.8 → 72.1% (+2.3pp), symbol 92.3 → 93.0%.** The remaining headroom is the æ/ə/a stress class
(needs a stress model / tagger + a 2nd data source) + the French-loan lexicon tail — neither a cheap rule.

## Run 3 — 2026-07-26 — 2-agent review fixes → 69.8% folded / 92.3% symbol

A correctness review caught a real bug in `startsWithVowel`/`endsWithVowel`: they inspected the raw first/last
CODEPOINT, so a diphthong ending in the offglide ◌̯ (U+032F) or a long vowel ending in ◌ː (U+02D0) read as
consonant-final — breaking (a) the intervocalic ⟨s⟩→[z] voicing after a diphthong (Haiser→hai̯sər, should be hai̯zər)
and (b) the final-⟨g⟩→[χ]-after-a-vowel rule after a long vowel (leeg→leːk, should be leːχ). Fixed with a `coreChars`
helper that strips combining diacritics (U+0300–036F + the tie) and the length mark before testing the vowel edge:
**+0.5pp → 69.8%.** Also confirmed the ⟨ge/be/ver/er⟩ unstressed-prefix heuristic is worth **+3.9pp** over
always-first-syllable stress (measured), and kept it despite its inherent misfire on a disyllabic ⟨be/er⟩-ROOT
(besser→bəsær instead of bæsər) — the prefix words (erhalen, verhalen, gefall…) far outnumber the root exceptions,
and distinguishing them needs a lexicon. Review also fixed stale doc strings (a phantom ⟨-er⟩→ɐ rule that had been
measured-negative and removed; the ⟨é⟩→eː vs ⟨éi⟩→ei̯ conflation).
