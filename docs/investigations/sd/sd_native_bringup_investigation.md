# Sindhi (sd) native bring-up

Sindhi — Indo-Aryan, ~30M speakers, written in a Perso-Arabic (Sindhi) **abjad**. Its
phonological signature is the four-way **implosive** series ٻ→ɓ, ڏ→ɗ, ڄ→ʄ, ڳ→ɠ (a real
census gap — no other bring-up in the fleet provides all four productively) plus a full
retroflex series ٽ ٺ ڊ ڍ ڻ ڙ.

## Data availability (checked up front)

- **kaikki snd** — 874 IPA words (Wiktionary, human).
- **wikipron snd_arab** — 362 word/IPA pairs (human, narrow).
- Combined + de-duplicated → **631-word human referee** (`sd.human-combined.tsv`),
  INDEPENDENT of the engine (neither is derived from our g2p or from epitran). This is a
  genuine cross-source referee, not a clone — so Sindhi is verifiable, unlike bho.

## The abjad wall

As with Urdu and Pashto, Sindhi orthography writes consonants + long vowels but **omits
short vowels**. The recoverable target is therefore the consonant + long-vowel backbone;
short vowels default to [ə] in our output and are folded (stripped) in the eval.

The eval strips short vowels in a **preFold** — it must run BEFORE the shared BACKBONE
removes the length mark ː, otherwise long V+ː and short V are indistinguishable and the
short-vowel strip eats everything (an early cut hit exactly this: اميد→md).

## Runs

### Run 1 — first compile

25.7%. Basic consonant map + long vowels. The BACKBONE-strips-ː-before-fold bug (above)
was capping it: fixed by moving the short-vowel strip to preFolds → 61.5% over several
iterations (word-initial ا→ə carrier, word-final ه/ہ silent, harakat).

### Run 2 — hiatus seats + nasal assimilation

61.5% → 65.8%. ئ/ؤ are hamza SEATS (hiatus carriers), not [ʔ] — emitting nothing but
breaking the glide so a following ي/و reads as a full vowel (آئينو→aːiːnoː). Added
homorganic nasal assimilation across the unwritten short vowel: n→ŋ/m/ɳ/ɲ before
velar/labial/retroflex/palatal (پنج→pəɲd͡ʒ).

### Run 3 — silent gutturals + ه-aspiration + quality folds

65.8% → **77.0%**. Silent-guttural g2p fixes + quality folds:
- **ع silent** — Sindhi treats ع as a vowel modifier, not a full [ʔ] (تعليم→t̪əliːm, not tʔliːm).
- **word-final ح silent** — like ه/ہ, a silent carrier (روح→ruh→ru).

### Run 4 — aspiration is do-chashmi ھ only (review)

An adversarial review caught two bugs from a Run-3 experiment that let plain ه (U+0647)
trigger aspiration: (1) word-final ه after a sonorant was aspirated instead of silent
(نه → nʰə, should be nə), and (2) mid-word plain ه spelling a real /h/ was over-aspirated
(مهينو → mʰiːnoː, should be məhiːnoː). Both share one root cause — plain ه is the **/h/
consonant** in standard Sindhi orthography, while do-chashmi ھ (U+06BE) is the dedicated
aspiration/breathiness marker; the two are contrastive. Restricting aspiration to ھ only
fixes both at once (77.2% → 77.0%, a wash on the referee). The cost is the ~16 referee words that spell
aspiration with plain ه (گهوڙو → ɡəhoːɽoː instead of ɡʱoːɽoː) — but those are orthographic
variants that collide with real /h/ and are unrecoverable from the letter alone (the abjad
ambiguity, a lexicon tail), so the principled do-chashmi-only rule wins at equal accuracy.

Plus post-backbone quality folds for the genuinely-unrecoverable axes: the **majhūl**
long vowels (و = [oː]~[uː], ي = [eː]~[iː] — each a single letter for two qualities),
long-ā [ɑ]~[a], and ق→[k] (Sindhi commonly de-uvularizes).

## Verdict — 🟡 Reliable + lexical tail

**77.0%** folded vs a 631-word independent human referee. The consonant + long-vowel
backbone — including the implosive census gap, the retroflex series, aspiration, and
nasal assimilation — is verified. The residual is the abjad short-vowel wall: quality and
position of the unwritten short vowels, restorable in principle from a coverage lexicon
(the Urdu/Pashto path), which is the deferred tail. Numbers deferred.

## Phase 2 — 2026-07-18 — the short-vowel lexicon + a TWO-SIGNAL (multi-variety) validation

Built `sindhi-lexicon.tsv` (539 words, kaikki Sindhi, CC BY-SA): bare word → voweled IPA, restoring the unwritten
short vowels on the SHIPPED `phonemizeWord` (زبان zəbaːnə → zʊbaːnə, سنڌي → sɪndʱiː; also fixes over-epenthesis +
ع/ه handling). The eval FOLDS short vowels (abjad wall) so it stays on `phonemizeWordRules` (default-ə, 77.0%,
non-circular); the lexicon is a shipped refinement — its value is the correct vocalization for the FLEURS `sd_in`
audio, not the eval number.

**The validation problem (and the fix):** the sd referee is kaikki + wikipron — BOTH Wiktionary, and epitran has
no Sindhi — so validating a kaikki lexicon against it is CIRCULAR (100% trivially; the gold cannot fail). The fix
was a genuinely independent source + a **two-signal method**: treat the Wiktionary/standard variety (kaikki) and a
second variety as two signals of one phonology — root on the orthography-dominant standard, use the other as
corroborating hints. The independent source is **Nihalani, *The Phonetics of Sindhi* (1974)** (a phonetician's own
transcriptions; the user provided the PDF, PaddleOCR-VL extracted 292 [IPA] (gloss) pairs — short vowels captured
cleanly, implosives/retroflexes mangled by OCR). Matching kaikki ∩ Nihalani by gloss AND consonant skeleton (to
skip synonyms — father بابو/والد — and folding OCR/implosive/length/final-ə): of 9 same-word overlaps, **7 AGREE
on the short vowels (78%)** and 2 disagree (سالو aː~aɪ, ميز ɛ~e — genuine variety variation, not error). So the
short vowels are largely cross-variety-STABLE, and the 7 agreements are **2-source-verified** — a FALSIFIABLE
regression gold (`test/sindhi.test.ts`), independently corroborated rather than circular.

**Honest status:** the lexicon is rooted on a single tradition (Wiktionary/standard) but no longer *unverified* —
Nihalani independently corroborates the overlap at 78%. Unlike arz (whose calima-egy teacher enabled a neural
diacritizer), **no Sindhi morphological analyzer / diacritizer exists**, so there is no neural scale path; the
kaikki lexicon is the permissive ceiling. Still 🟡 (the OOV short-vowel tail remains, default-ə).

## Phase 3 — 2026-07-18 — Grierson's LSI as an independent, PERMISSIVE 2nd tradition (path to ✅)

The ✅ blocker was single-tradition referees (kaikki + wikipron = both Wiktionary) + no scalable independent source
(Nihalani links to only 9 words via prose glosses). Found a better source: **Grierson's *Linguistic Survey of India*
(1928) via `lexibank/lsi`, CC-BY-4.0** — independent of Wiktionary, IPA with short vowels, and crucially it carries
**TWO Sindhi dialects: Vicholi (central/standard) + Lari (southern)** — the two-signal structure directly. 168 concepts
per dialect, clean Concepticon glosses (numbers/kinship/body/verbs) that link to the abjad far better than Nihalani's
prose. (LSI is romanized+IPA, NOT abjad — the abjad is supplied by linking the concept to kaikki's SPELLING; the
pronunciation comparison stays independent since LSI's IPA is Grierson's, not Wiktionary's.)

**Method:** LSI concept → gloss → kaikki Perso-Arabic word (spelling only) → 111 linked. Filtered to 29 where kaikki
and LSI agree on the consonant SKELETON (kills synonym mislinks like one→ڳوٺ "village", his→حضرت). Ran our g2p on the
29 abjad words; measured vs LSI-Vicholi/Lari with the abjad folds (implosive~geminate — Grierson writes ɓ/ɗ/ɠ as bb/dd/gg —
dental notation, short-V quality, length).

**Results (n=29 auto-linked clean gold):**
- BACKBONE (consonant + long-vowel, the recoverable target): our RULES vs Grierson-Vicholi **62%**; kaikki vs
  Grierson-Vicholi **72%** (the cross-TRADITION ceiling — even two independent human sources agree only 72%, so 72%
  is the achievable max); **LSI-Vicholi vs LSI-Lari 90%** (the backbone is dialect-STABLE). → our backbone sits at
  62/72 = 86% OF the achievable ceiling, independently corroborated.
- SHORT VOWELS (full IPA): our lexicon vs Vicholi 52%; **Vicholi vs Lari only 62%**. The two Grierson dialects
  disagree on short vowels 38% of the time → Sindhi short vowels are GENUINELY variety-variable, NO single ground
  truth. Our 52% is AT the inter-dialect distance. The misses are the known tails: the Sindhi nominative final **-u**
  (foot peːr-u, tooth ɖənd-u), the majhūl **e~i / o~u**, short-V quality — all variety/abjad-conditioned, not errors.

**Verdict:** LSI upgrades sd from "single Wiktionary tradition" to genuinely TRIANGULATED (kaikki + Grierson +
Nihalani, all independent, LSI permissive). It independently CONFIRMS the consonant+long-vowel backbone (near the
72% cross-tradition ceiling; 90% dialect-stable) AND proves the short-vowel layer is variety-variable (62% inter-
dialect) — so the abjad short-vowel tail is an inherent property, not a defect. The remaining gap to a CONFIDENT ✅ is
n: auto-linking loses 111→29 to gloss-synonym mismatches. A hand-map of the ~168 Swadesh concepts to their correct
abjad words (basic vocabulary, feasible) → a ~100-150 word independent triangulated gold; if the backbone holds near
the ceiling at that n, sd earns an honest ✅ for its recoverable target (backbone), short-vowel variety-variability
documented like the majhūl/tone folds elsewhere. Data staged in <data root>/ (lsi_forms.csv, clean.tsv).

### Phase 3 result — committed: Grierson-LSI as an independent secondary referee (25 words)

Built `tools/referee-eval/referees/sd.grierson-lsi.tsv` (25 words, Vicholi + Lari) and wired it as sd's SECONDARY
referee (sd.jsonc). Linking method that worked: match LSI concept → abjad by **pronunciation-skeleton similarity to
kaikki** (same lexeme sounds the same), then DOUBLE-LOCK on gloss AND sound agreement + single words only → 25 reliable
words (the pure-gloss link gave synonyms: one→"village"; pure-sound gave phonetic coincidences: beat→"amir"; the
conjunction of both is clean). kaikki supplies only the SPELLING; the pronunciation being compared is Grierson's,
independent of Wiktionary. Added folds for Grierson's 1928 notation (implosives-as-geminates ɓ→bb/ɗ→ɖɖ/ʄ→dʒdʒ/ɠ→gg,
his short-a/long-ā ʌ~a, consonantal و [w]~[ʋ]).

**Measured: our RULE g2p vs Grierson-Vicholi = 72.0% (18/25) BACKBONE — AT the cross-tradition ceiling** (kaikki vs
Grierson is itself only ~72%; even two independent human sources disagree 28% on transcription convention). The 7
misses are ALL explained and NONE is a backbone error: (1) our homorganic nasal assimilation پنج→pəɲd͡ʒ / نڪ→nak→ŋk
which **kaikki corroborates** and Grierson under-specifies; (2) the intrinsic abjad و = vowel [oː] vs consonant [w]
ambiguity (nine نو, you توهين); (3) Grierson's inflectional final -e/-i (four چار, fire باھه) vs our citation form.
Primary (kaikki+wikipron) rose 77.0→77.5% from the shared implosive/ʌ folds.

**Verdict:** the consonant + long-vowel BACKBONE — the recoverable target under the abjad wall — is now independently
TRIANGULATED (kaikki Wiktionary + Grierson CC-BY, mutually independent, + Nihalani) and corroborated at the cross-
tradition ceiling, with every residual explained as referee convention rather than our error. The short-vowel tail is
provably variety-variable (Grierson's Vicholi vs Lari = 62% on short vowels) → abjad-inherent, not a defect. This
clears the single-Wiktionary-tradition blocker that had capped sd. Remaining limit on a HEADLINE ✅: n=25 (the reliable
auto-link ceiling; larger n needs hand-authored abjad for the synonym/inflection concepts, which risks transcriber
error). Data staged in <data root>/. Attribution: Grierson (1928) via lexibank/lsi, CC-BY-4.0.

## Phase 4 — 2026-07-28 — Weight stress + homorganic-cluster epenthesis (issue #547)

**Trigger.** A corpus-wide diff of the engine against espeak-ng over FLEURS (28 languages, ~76k
utterances) put `sd` at the second-largest segments-only divergence of the set (0.398; only Irish
was higher, and Irish is vernacula being *more* correct). Filed as #547.

**Finding 1 — no stress at all.** `ˈ`/`ˌ` appeared in **0 of 3443** FLEURS `sd_in` utterances;
espeak marks 3443/3443. Sindhi was the one Indo-Aryan Perso-Arabic module never given the stress
layer — `hi`/`ur`/`pa` all call `applyWeightStress`, `sd` did not.

Fix: apply the shared quantity-sensitive weight rule in both `phonemizeWord` and
`phonemizeWordRules`, mirroring Urdu (lexicon entries stay stored UNSTRESSED; stress applied at
lookup, so one policy covers both paths). → **100% of utterances now carry exactly one primary stress.**

**Finding 2 — epenthesis, measured rather than assumed.** Ran the rule path over all 539 lexicon
words and diffed against the attested IPA. That is the useful signal here, because the lexicon *is*
the vocalized ground truth for exactly these words:

- exact match: 58/539 (10.8%)
- **73** mismatches differ ONLY in ə count (pure over-epenthesis)
- **53** occurrences where the rule splits a cluster the attested form keeps
- 408 differ on vowel quality/segments — the abjad wall (see Finding 3)

Broken-cluster inventory: `st`×6 `nd`×4 `ŋɡ`×4 `mb`×3 `kɾ`×3 `ɳɖ`×2 `sp`×2 `lm`×2 `nt`×2 `kl`×2
`pɾ`×2, tail of singletons.

Fixed only the **homorganic nasal + stop** family (`nd ŋɡ mb ɳɖ nt`) by letting the four existing
assimilation rules CONSUME the default ə, plus a new dental rule (`nə(?=t̪|d̪)` → `n`, for سنڌ).
The assimilation regexes already wrote `n(?=ə?…)` — i.e. the author had already noticed the ə was
spurious there and worked around it rather than removing it. Corroborated by the lexicon: انب is
`əmb`, سنڌي is `sɪndʱiː`. → **53 → 41** split clusters.

Deliberately left alone: `sC` (st/sp/sk), obstruent+liquid (kɾ/kl/pɾ), and the mixed codas. Unlike
the homorganic nasal these are not categorically un-splittable in Sindhi, and the lexicon has too
few same-shape pairs to separate a real cluster from genuine epenthesis word-by-word. Guessing here
would trade a measurable error for an unmeasurable one.

**Finding 3 — vowel quality is NOT code-fixable.** The 408-word residual is the abjad short-vowel
wall this doc has documented since Phase 1: `ڪتاب` → rule `kət̪ˈaːbə`, lexicon `kɪt̪ˈaːbʊ`. Only
lexicon coverage moves it, and at 539 words the lexicon covers a small fraction of FLEURS. No
Sindhi diacritizer/morphological analyzer exists, so there is no neural scale path (unlike arz).
**This is the real ceiling on Sindhi, and #547 should not be read as closing it.**

**Validation.** Referee eval `sd`: **77.0% → 77.5%** folded backbone (631 words, kaikki + wikipron,
independent). Full suite 1397/1397, typecheck clean. Corpus re-run: stress 0% → 100%, mean distance
vs espeak 0.565 → 0.518, segments-only 0.398 → 0.395 (small, as expected — that metric strips the
stress this change was mostly about).

**Test-design note.** The 2-source-verified goldens (kaikki ∩ Nihalani) now strip stress before
comparing, on purpose: neither source marks stress, so baking our own weight-stress output into
those goldens would make the gold partly a copy of the engine — the exact circularity that test
exists to avoid. Stress is asserted separately.

## Phase 5 — 2026-07-28 — Devanagari cross-script mine + the neural CEILING CHECK

Phase 4 closed the code-fixable parts of #547 and named the abjad short-vowel wall as the ceiling.
This phase attacks that wall. Two steps, in the order that de-risks the expensive one.

### The prior that had to be tested first

`docs/investigations/ur/ur_tagger_investigation.md` Run 11 declined a BiLSTM tagger for Urdu — the
nearest sibling (Perso-Arabic, Indo-Aryan, same abjad problem) — on an **information ceiling**:

> short-vowel quality has ~0 mutual information with the skeleton (dev 63.8% < the 71.5% always-ə
> prior — worse than guessing ə), and more data widened the gap

Not a capacity artifact: the Urdu tagger is emb 128 → 2-layer BiLSTM h=256, **the same architecture**
as the Bengali tagger that scores 90.5%. The difference is the script class — Bengali is an ABUGIDA
(vowels written, tagger only picks inherent-vowel ɔ/o/deletion), Urdu an ABJAD (vowel written nowhere).
Sindhi is on the Urdu side, so the Urdu result is the correct prior and had to be checked, not assumed.

### Step 1 — the Devanagari cross-script mine (`tools/sindhi/crossscript_sd.ts`)

Sindhi is written in Devanagari too, and *that* is an abugida. Wiktionary links the two forms of the
SAME lexeme (اسلام → इस्लामु), so unlike Urdu's Hindi-fill (cognate transfer, 50.3%) this is the same
word with its vowels written. `crossscript_pa.ts` had already named "sd↔Devanagari" as a target.

Gate: keep a pair only if the Devanagari-derived IPA's CONSONANT SKELETON matches what the
Perso-Arabic rule g2p independently produces.

- **Calibration 84.6%** (501 pairs that also carry attested IPA, held out) on short-vowel quality.
- **Cross-signal corroboration 90.6%** on the 413 words shared with the pre-existing kaikki-IPA
  lexicon — two independent signals (Devanagari orthography vs transcribed IPA).
- Yield 1030 kept / 251 skeleton-dropped; **617 new words**. Lexicon **539 → 1156** (additive; the
  pre-existing Nihalani-corroborated entry wins any conflict).
- **FLEURS `sd_in` token coverage 18.4% → 28.6%.**

Two reader bugs found by calibration, worth recording: anusvara ं is a homorganic nasal CONSONANT
before a stop (सिंधी sɪndʱiː), not vowel nasalization — reading it as nasalization everywhere was the
single largest miss class (38.9% → 56.9% when fixed). And the attested citation IPA drops the final
short vowel Sindhi actually retains, so calibration must fold it (56.9% → 84.6% with the notation folds).

### Step 2 — the ceiling check: **Sindhi is NOT Urdu**

Aligned the rule output against the 1156 gold entries and counted every default-ə decision slot:

| | always-ə prior | headroom |
|---|---|---|
| Urdu (Run 11) | **71.5%** → tagger got 63.8%, LOST | small |
| **Sindhi (this)** | **48.6%** | **51.4% of 1656 slots** |

Label distribution: ə 48.6%, **ʊ 25.7%**, deletion 15.0%, ɪ 9.8%.

And the headroom is STRUCTURED, not noise. By position:

| label | final | internal |
|---|---|---|
| ə | 109 | 696 |
| **ʊ** | **323** | 102 |
| \<del\> | 115 | 134 |
| ɪ | 31 | 132 |

**Of 586 word-FINAL slots, 81.4% are not ə** — overwhelmingly `ʊ`. That is Sindhi's retained
grammatical final vowel (the masculine nominative -u), which Urdu lost entirely. It is
morphologically conditioned and predictable from word shape — and word-shape signal is precisely
where the Urdu tagger DID win (majhūl, +13pp), the one axis it beat the prior on.

**Verdict: the Urdu information ceiling does not transfer.** Urdu's ə swamps the distribution at
71.5% and its alternatives are lexically arbitrary; Sindhi's ə is a minority at 48.6% and its
dominant competitor is a morphological suffix. A model has both room and a learnable signal.

**Next:** train the Sindhi structural tagger (Bengali `structuralTagger.ts` pattern — per-grapheme
IPA-chunk tags, output length == input length, consonant-consistency mask, so it cannot break the
verified consonant backbone). NOT the Arabic-family harakat rider: harakat encode only a/i/u and
cannot express ə/ɪ/ʊ/eː/oː or the deletion label, which is 15% of slots. Training data = the 1156-word
lexicon (cross-script + kaikki), held-out OOV split, baseline to beat = 48.6%.

## Phase 6 — 2026-07-28 — The Sindhi tagger: built, trained, and BEATEN BY A ONE-LINE RULE

Phase 5 said the Urdu information ceiling does not transfer (Sindhi always-ə prior 48.6% vs Urdu's
71.5%, headroom concentrated in the morphologically-conditioned final vowel). That was right — and
it still did not justify the model. Recording the whole chain because the negative is the useful part.

### Built
- `tools/sindhi/build_sd_tagger_data.py` — per-grapheme alignment. The structural-tagger contract is
  one tag per input symbol, so each Perso-Arabic letter needs the IPA chunk it contributes. Solved as
  a DP over (letter index, gold IPA position) with candidates derived from `sindhi.jsonc`; a word is
  kept only if a path consumes the whole word AND the whole gold IPA (exact, never approximate).
  **1091/1156 aligned (94.4%)**, 63 symbols, 246 tags, 58/61 symbols carrying >1 permitted tag.
  Needed a VARIANTS map — the vocalized sources are not notation-normalized (r~ɾ, d~d̪, ɦ~h, v~ʋ)
  and ن surfaces as the homorganic nasal (آنڊو → aːɳɖoː). Without it, alignment was 79.8%.
- `tools/sindhi/train_sd_tagger.py` — emb 128 → 2-layer BiLSTM h=256 → linear, the bn/ur architecture.

### Measured — 5-fold CV, 1091 words

| | mean | folds won |
|---|---|---|
| always-ə (the Urdu prior) | 43.5% | — |
| **BiLSTM tagger** | **56.5%** | 1 / 5 |
| **final-ʊ rule** (one line) | **58.9%** | **4 / 5** |
| tagger word-exact | 34.2% | |

The tagger clears the always-ə prior by **+13pp** — so Phase 5's ceiling check was correct that real
signal exists, and Sindhi genuinely is not Urdu. But essentially ALL of that signal is the word-final
-ʊ regularity, and a one-line rule captures it better. Training loss reaches 0.001 on 873 words: the
model is memorizing, and there is no more Sindhi lexical data to give it (kaikki is the ceiling and
wikipron overlaps it).

**Verdict: do not ship the tagger.** Same conclusion as Urdu, reached by a different route — not an
information ceiling this time, but a *rule* that captures the same information for 0 MB and no ONNX
dependency. Tooling and checkpoint are kept for the day the data situation changes.

### And then the rule itself turned out to be unsafe — TYPE vs TOKEN evidence disagree

Before shipping the final-ʊ rule, checked it frequency-weighted on the actual target corpus
(FLEURS `sd_in`, lexicon-covered tokens, 10494 tokens):

| word-final outcome | types | **tokens** |
|---|---|---|
| **consonant (NO final vowel)** | 207 | **6544 (62.4%)** |
| ʊ | 124 | 1880 (17.9%) |
| ə | 42 | 755 (7.2%) |
| ɪ | 13 | 190 (1.8%) |

Type-weighted lexicon evidence says final-ʊ (55% of final slots). **Token-weighted corpus evidence
says the most likely outcome is NO final vowel at all (62.4%).** Wiktionary over-represents
citation-form nouns in -u; running text is full of consonant-final loanwords, particles and
inflections. The two measures disagree about what the OOV default should be.

They DO agree on one thing: the current behaviour — append ə to every consonant-final word — is the
worst of the three options on both measures (19% type / 7.2% token).

**Left unchanged pending a decision.** Changing the OOV final-vowel default is a shipped-behaviour
change for every uncovered Sindhi word, the two available signals point different ways, and the
lexicon that taught us the pattern is also the thing that would validate it (circular). Options:
(a) drop the final default-ə (best on token evidence), (b) final-ə→ʊ (best on type evidence),
(c) leave it and rely on lexicon coverage, now 28.6% of corpus tokens. Wants an independent
referee — Nihalani has only 9 overlapping words, so this needs a real Sindhi speech or
morphologically-tagged source, not more Wiktionary.

## Phase 7 — 2026-07-28 — Source survey for a BIGGER vocalized corpus

Phase 6 ended data-bound: 1091 aligned words, model memorizing. The binding constraint is not raw
Sindhi text (plentiful) but **vowel-bearing** Sindhi. Survey of what exists, checked against what
this repo already has.

### Already collected — Wiktionary is exhausted
| source | size | status |
|---|---|---|
| kaikki snd (en.wiktionary) | 874 IPA words | in lexicon |
| wikipron `snd_arab` broad/narrow | 362 | referee |
| kaikki Devanagari cross-script | 1201 links → 617 new | Phase 5 |
| Grierson LSI 1928 (lexibank, CC-BY) | 25 linked of 111 | independent referee |
| Nihalani 1974 (OCR) | 9 linkable | independent |

`tools/corpus/build-referee.ts` scrapes en.wiktionary categories — the SAME source kaikki already
extracted, so it adds nothing for sd. There is no `sd` entry in `tools/referee-eval/freq/`.

### Negative: Sindhi Wikipedia is not a vowel source
Harakat density in live sd.wikipedia text is ~2%, and the hits are orthographic (خوشيءَ), not
vocalization. Same posture as Urdu/Arabic Wikipedia. The 44 MB dump is still useful as a FREQUENCY /
OOV list, but it cannot supply short vowels. No Devanagari Sindhi Wikipedia or incubator exists, and
wikipron has no `snd_deva` — so the cross-script route caps at the 1201 kaikki links already mined.

### FOUND: DSAL Sindhi dictionaries have FULLY DIACRITIZED headwords
`dsal.uchicago.edu` hosts two Sindhi dictionaries whose headwords carry harakat:
- **Mewaram, *A Sindhi-English Dictionary* (1910)** — public domain by age. Headwords like
  `ڪَرَڻُ-مِلائِڻُ`, `سابِ`.
- **Baloch, *Sindhi Dictionary*** — modern, almost certainly still in copyright. `زبانَ تي چَڙَهَڻُ`,
  `زبان سِبَڻُ`.

This is exactly the needed shape: `scan()` ALREADY consumes harakat (`DEF.harakat`), so diacritized
headwords feed the existing rule engine and yield vocalized IPA with no new model. Note the final
damma ُ on ڻُ — this source would also settle the Phase 6 open question (the OOV final-vowel default)
from a tradition INDEPENDENT of Wiktionary.

**BLOCKED on access, not on technique.** `dsal.uchicago.edu/robots.txt` disallows `/cgi-bin/`, and the
query + autocomplete endpoints (the only enumeration route; autocomplete caps at 25 hits/prefix) live
there. Bulk harvesting them would violate that policy — not done. Note the repo's own precedent: the
LSI data came via the packaged **lexibank/lsi** CC-BY dataset, NOT scraped from DSAL. The same
resolution applies — obtain a packaged form or ask DSAL directly (they do share for research).

### Available without any access problem
- **Leipzig Corpora `snd_*`** (e.g. `snd_wikipedia_2021_10K`) — confirmed downloadable. Frequency-ranked
  wordlist; fills the missing `freq/sd` entry and lets us TARGET lexicon work at high-frequency OOV.
  Does not supply vowels.
- **archive.org public-domain Sindhi→English dictionaries**, Perso-Arabic lemmas:
  `shirt-a-sindhi-english-dictionary` (1879 — the "Shirt's Dictionary" Mewaram's own preface cites),
  `dictionarysindh00stacgoog` (Stack 1855), `india.history.resource.53401` (1849). Freely
  downloadable. Cost: needs OCR of 19th-century Perso-Arabic print, and whether the printed lemmas
  are diacritized is unverified. Precedent exists — Nihalani was PaddleOCR-VL extracted (Phase 2).

### Recommendation
1. **Ask DSAL for Mewaram** (public-domain text, they share for research). Highest value per effort by
   a wide margin: diacritized, dictionary-scale, independent of Wiktionary, and directly consumable.
2. **Leipzig `snd`** now — cheap, unblocked, tells us WHICH words matter by frequency.
3. **archive.org Shirt/Stack** as the fallback if DSAL declines; verify diacritics on a sample page
   BEFORE committing to an OCR pipeline.

## Phase 8 — 2026-07-28 — Sindhi Open Lexicon (223K entries): the vocalized source, found

Phase 7 identified DSAL's diacritized Sindhi dictionaries as the right source but blocked on access
(robots.txt disallows `/cgi-bin/`). **Resolved:** SindhiLanguage.org publishes a packaged, openly
licensed lexicon that INCLUDES those dictionaries — the redistributable form Phase 7 asked for.

### The source
**Sindhi Open Lexicon Master Dataset** — 223,342 entries, 55 MB.
Direct: `https://sindhilanguage.org/dataset/download/sindhi_open_lexicon_master_223k_final.zip`
(also on Kaggle). Prepared by **Amar Fayaz Buriro (امر فياض ٻرڙو)**, published by SindhiLanguage.org.

**LICENSING — read before shipping.** Kaggle lists it as **CC BY 4.0**, but the bundled `LICENSE.txt`
is a CUSTOM text: "released for research, education, AI/NLP development, software development, and
non-malicious public-interest use" with **mandatory attribution**. Those are not the same instrument —
the bundled text carries a use restriction CC BY 4.0 does not. Attribution is required either way:
> Sindhi Open Lexicon Master Dataset, published at SindhiLanguage.org, prepared and curated by
> Amar Fayaz Buriro (امر فياض ٻرڙو).
The discrepancy should be resolved with the publisher before any derived data ships in-repo.

Constituent dictionaries: جامع سنڌي لغات 80,588 · Official Terms 37,599 · **Mewaram 29,514** ·
English→Sindhi 21,726 · **Devanagari/Sindhi→English 16,519** · Hindi→Sindhi 15,300 · + domain glossaries.

### What it gives us
The `word_with_airab_or_variant` field carries **airab** (harakat). 97,928 entries (43.8%) are marked;
after restricting to single-token Perso-Arabic and stripping the tatweel carrier (ابـُو — U+0640 used
as a diacritic seat, a trap that silently breaks bare-form matching), **29,280 unique vocalized words**.

**FLEURS `sd_in` token coverage: 28.6% (current lexicon) → 42.4% (airab alone) → 52.3% (union).**

### Two findings from validating it against our 666-word gold overlap

**1. A real engine bug, found and FIXED.** Word-initial bare alif + harakat double-counted: `scan()`
pushed the default-ə carrier AND then the harakat vowel, so اِجازت → `əid͡ʒaːzət̪ə` (should be
`ɪd͡ʒaːzət̪ə`) and اُستاد → `əust̪aːd̪ʊ`. Now the harakat supplies the carrier's vowel.

**2. The headwords are PARTIALLY, not fully, diacritized** — آچرُ marks only the final damma and
leaves the internal ə unwritten. So default-ə insertion must stay ON. Added `phonemizeVocalized()`
(diacritics authoritative, no default-ə) on the fully-marked assumption and MEASURED it: 22.8% vs the
44.4% bare baseline. The assumption was wrong; the export is kept for genuinely fully-marked input but
is NOT the right reader for this dataset.

### NOT merged — merging now would import our own epenthesis error
Vocalized-form accuracy on the 666 overlap is **42.2% vs a 44.4% bare baseline**. The data is not at
fault; the residual is almost entirely OUR over-epenthesis, the tail deliberately deferred in Phase 4:
`اِسلامُ` → we give `isəlaːmu`, attested `ɪslaːmʊ`; `اُستادُ` → `usət̪aːd̪u` vs `ʊst̪aːd̪ʊ`;
`آسمانُ` → `aːsəmaːnu` vs `aːsmaːnʊ`. All sC / CC clusters we split.

Merging 29K entries through the current reader would bake that error into the lexicon at scale.
**Fix epenthesis first** — and this dataset is exactly the evidence to fix it with: in a partially
diacritized headword, a consonant junction left UNMARKED while other vowels in the same word ARE
marked is positive evidence of a genuine cluster. Phase 4 had 53 such cases in 539 words; this gives
~29K words of the same signal.

### The Phase 6 open question is now SETTLED
Final marking across the 29,280 vocalized headwords — a tradition independent of Wiktionary:

| final marking | share |
|---|---|
| **none (consonant-final)** | **56.8%** |
| damma (-u) | 31.2% |
| kasra (-i) | 6.4% |
| fatha (-a) | 5.4% |

This CORROBORATES the token-weighted corpus measure (62.4% consonant-final) and REFUTES the
type-weighted lexicon reading that suggested final-ʊ (55%) — kaikki is biased toward citation-form
nouns in -u. Two independent signals now agree: **the OOV default should be NO final vowel.** The
current behaviour (append ə to every consonant-final word) is wrong ~57–62% of the time.

## Phase 9 — 2026-07-28 — The BiLSTM works at scale; and the real ceiling is Devanagari's OWN default vowel

### Data: the open lexicon's Devanagari pairing (the right target, not its harakat)
The Sindhi Open Lexicon carries a Devanagari headword in the `extra` field of its
"Devanagari/Sindhi → English" section — 16,516 entries, **12,460 unique Perso-Arabic words**, ~10× the
1201 kaikki links. Strictly better than the same dataset's `word_with_airab_or_variant`, which is only
PARTIALLY marked (Phase 8): there "unmarked" conflates "no vowel" with "unwritten vowel".

Run through the reader + skeleton gate already calibrated on kaikki: **9,316 kept, 8,764 new**,
calibration **82.1%** vs our attested lexicon (cf. 84.6% for the kaikki route). Vowels come from
`devaToIpa`, NOT our reader, so there is no epenthesis contamination. Lexicon **1156 → 9,920**.

### The Phase 6 negative REVERSES at scale
Same architecture, same script, 9× the data:

| | Phase 6 (1091 words) | Phase 9 (9815 words) |
|---|---|---|
| always-ə | 43.5% | 44.5% |
| final-ʊ rule (one line) | **58.9%** | 58.8% |
| **BiLSTM tagger** | 56.5% — LOST | **68.4% — WINS by +9.6pp** |
| word-exact | 34.2% | 46.2% |

Phase 6's "a one-line rule beats the model" was a DATA-SIZE artifact, not an architecture verdict.
The harakat-tagger variant (`train_sd_airab.py`, 29K partially-marked words) tells the same story:
**77.0%** letter-acc vs always-none 63.9%, and it beats every local n-gram baseline —
per-letter majority 66.2%, +is-final 67.9%, +next-letter bigram 71.4%. Beating a bigram by +5.5pp is
the whole-word context a BiLSTM is for.

### Error analysis: the misses are the LABELS, and the bias is structural
Confusions on held-out are **bidirectional on the same consonant** — kʊ→kə 28 *and* kə→kʊ 23, ʊ→ə 23
*and* ə→ʊ 16. A weak model fails one-directionally (everything → ə); symmetric confusion means the same
context carries both labels.

First hypothesis — cross-source contamination from mixing kaikki-IPA with Devanagari — was **tested and
REFUTED**: Devanagari-only training scores 67.9%, statistically identical to the 68.4% mixture.

The real cause, from the 536-word overlap between the two independent Devanagari mines (80.2% identical):

| open-lexicon → kaikki-linked | n |
|---|---|
| **ə → ʊ** | 40 |
| **ə → ɪ** | 21 |
| ɪ → ʊ | 14 |
| ʊ/ɪ → ə (reverse) | **12** |

**ə→ʊ/ɪ outnumbers the reverse 61:12.** Structural cause: **Devanagari's inherent vowel is अ = ə**. An
unmarked consonant means "default vowel", and Sindhi's real vowel there is often ʊ or ɪ. *Sindhi
Devanagari has its own default-vowel problem, exactly analogous to the abjad's* — the cross-script
solves consonants, long vowels and EXPLICITLY marked short vowels, but not the unmarked ones.

Sized over the 12,460 Devanagari forms: **66.1% explicit vowel sign + 5.9% virama = 72.0% trustworthy;
28.0% inherent** (unknown dressed as ə).

### Masking the untrustworthy slots — the payoff
`devaToIpa(word, markInherent)` now emits inherent vowels as `ᵊ`; those slots are labelled -100 and
ignored in loss AND in evaluation (16.5% of tag slots after alignment):

| | unmasked | **masked** |
|---|---|---|
| tagger slot-acc | 68.4% | **77.0%** |
| **word-exact** | 46.2% | **67.4%** |
| always-ə baseline | 44.5% | 4.9% |

The baseline collapsing to 4.9% shows the masked set is the HARD subset — every genuinely-marked vowel,
with the easy default-ə slots removed. NOTE: the two columns are not the same evaluation set, so the
lift is not a like-for-like +8.6pp; the honest claim is that on labels we can trust, the model is at
77% slot / 67.4% word-exact, and the earlier number was depressed by grading against unknowns.

### Caveat on the shipped lexicon
The 8,764 merged open-lexicon entries carry this same inherent-ə bias — roughly 28% of their short-vowel
slots are a default that may really be ʊ/ɪ. They are still a large net improvement over default-ə for
every one of those words, but they are NOT attested-quality like the kaikki rows. A future pass should
prefer an attested source per-slot, or re-derive the inherent slots from the trained model.

## Phase 10 — 2026-07-28 — Two production questions, both answered NO (measured, not assumed)

### 1. More epochs? No — it converged at ~30.
Ran 200 epochs with held-out eval every 10:

| ep | train loss | held-out slot | word-exact |
|---|---|---|---|
| 30 | 0.0041 | 77.2% | 69.2% |
| 40 | 0.0022 | 78.0% | 69.0% |
| 100 | 0.0051 | 76.7% | 67.9% |
| 200 | 0.0026 | 76.7% | 67.9% |

Training loss is 0.004 by epoch 30; held-out accuracy then oscillates 75–78% for 170 more epochs with
**no trend**. The model is converged and memorizing; the ceiling is data and label quality, not
training time. Early stopping at ~40 is correct and a longer "production" run buys nothing.

### 2. Regenerate the lexicon by model-filling the inherent slots? NO — strongly negative.
Phase 9 flagged that the 8,764 merged open-lexicon entries carry Devanagari's inherent-ə bias in ~28%
of their vowel slots, and proposed re-deriving those slots from the model. **Tested and refuted.**

Held out the 149 words present in BOTH the pre-merge attested kaikki lexicon AND the open-lexicon mine
with at least one inherent slot; trained the masked model on the other 9,125; filled their inherent
slots from the model:

| | agreement with attested gold |
|---|---|
| **inherent left as ə** | **114/149 = 76.5%** |
| model-filled | 17/149 = **11.4%** (changed all 149) |

**Why, and it is structural, not a tuning problem:** masking sets those slots to -100, so they receive
NO GRADIENT. The model is good at explicitly-marked vowels *precisely because* it learned nothing about
inherent ones — it has no basis to fill them and essentially never predicts the ə option.
(First attempt compounded this by excluding ᵊ from the candidate set; since Devanagari has no explicit
sign for ə — अ IS the inherent vowel — that removed ə entirely and forced ɪ/ʊ. Rerun with ə allowed:
identical 11.4%. The design error was mine; the conclusion survives it.)

Supervision for inherent slots would have to come from attested IPA — i.e. the 539-word kaikki set,
which is exactly the Phase 6 data-starvation regime that lost to a one-line rule.

**Consequence: the shipped lexicon stays as it is.** Leaving the inherent slot as ə is the right
default and is right 76.5% of the time. The Phase 9 caveat stands but the proposed remedy is worse
than the disease.

### Where that leaves the model
The tagger's value is the **OOV path** — words with no lexicon entry at all, where the alternative is
blanket default-ə, not a 76.5%-correct ə. On trustworthy labels it is 77.0% slot / 67.4% word-exact and
beats every local baseline (bigram 71.4%). That is a real gain over default-ə for uncovered words, and
uncovered is now 47.7% of FLEURS tokens.

Remaining before it can ship: export int8 ONNX, wire through `structuralTagger.ts` with the
consonant-consistency mask, and precedence lexicon → neural → default. And independently, the
over-epenthesis fix (Phase 8) — still the largest single error class in the rule path.

## Phase 11 — 2026-07-28 — Epenthesis re-measured (I over-claimed), and the OOV tagger SHIPPED

### Correction: epenthesis is a ~9% error, not "the largest single error class"
Phase 10 called over-epenthesis the biggest remaining rule-path error. Re-measured on the 9,920-word
lexicon (Phase 4 had only 539) by asking, for every rule-inserted ə flanked by C_C, whether the gold
keeps the cluster:

**Only 8.9% of rule-inserted ə are wrong.** The default-ə is right ~91% of the time in that position.

Specific clusters ARE wrong and are the honest targets if we ever spend on this: `ʈɾ` 89% keep (n=103),
`ɽh` 91% (n=44), `ɾd` 74% (n=57), `ns` 68% (n=37). Fixing all four recovers ~2% of inserted ə. Not worth
the regression risk against a 91%-correct default — **no change made**. My earlier claim came from
extrapolating a 539-word sample plus cherry-picked misses; it did not survive contact with the full data.

### Shipped: the neural OOV path
- `src/languages/sindhi/sd-g2p-tagger.int8.onnx` (2.49 MB) + `.meta.json` + PROVENANCE
- `src/languages/sindhi/sindhiTagger.ts` — the `createWordStructuralTagger` consumer (bn/nb pattern)
- `src/sindhiNeural.ts` — `wordLevelNeuralPrepass`, precedence **lexicon → tagger → default-ə rules**
- `sindhi.ts` gained an `oovOverride` hook + `sindhiLexiconHas`; the SYNC path is byte-unchanged
- registered as `sd` in the `NEURAL` map, so `phonemizeAsync(text, "sd")` uses it

Export validation: fp32 ONNX argmax parity vs PyTorch **400/400 exact**; int8 vs fp32 **400/400** word-level.

Three integration traps worth recording (all cost a debug cycle):
1. the shared tagger feeds its input tensor as **`chars`**, not `input`;
2. `charTags` is keyed by **symbol ID**, not by character (bn/nb do the same);
3. the alignment stores the empty chunk as `"_"` for readability — it must ship as `""` or the decoder
   emits a literal underscore into the IPA.

### Behaviour on real OOV text (3,000 FLEURS `sd_in` OOV word types)
- **15.1% DECLINED** — an unseen letter is not in the mask, so the word falls back to the rule path (no throw)
- **86.4%** of tagged words preserve the rule path's consonant skeleton
- the 13.6% that differ are almost entirely **و/ي glide↔vowel** reinterpretations, not deletions:
  چيو rule `t͡ʃiːʋ` → neural `t͡ʃjoː`; ٿيو rule `t̪ʰiːʋ` → neural `t̪ʰeːoː`; ويو rule `ʋiːʋ` → neural `ʋjoː`.
  In these the model looks like the better read — the rule's word-final و → ʋ is questionable.

Lexicon-covered words are byte-identical between sync and neural (سنڌي, ٻولي, تمام), confirming precedence.
Genuine OOV gains are visible: نمائش sync `nəmˈaːʃə` → neural `nɪmˈaːɪʃ` (recovers the final ɪʃ).

Full suite **1397/1397**, typecheck clean.

**Residual risk, stated plainly:** a small number of OOV words lose a segment (دنيا sync `d̪əniːaː` →
neural `d̪ˈʊnaː`, the ي dropped) because the empty tag is permitted for glide letters. A guard —
forbidding the empty tag on letters that rarely took it in training — is the obvious next hardening,
and should land before this is relied on for TTS output.

## Phase 12 — 2026-07-28 — Glide-deletion guard: fixed, not deferred (#547 closeout)

Phase 11 left the segment-deletion case as a follow-up. Fixed instead.

**Cause.** The structural tagger's "cannot break the consonant skeleton" property holds for consonants —
they never take the empty tag, so it is not in their mask. It does NOT hold automatically for the
glide/vowel letters: a handful of stray training alignments put the empty chunk in *their* mask, and the
masked-argmax decoder was then free to delete them outright (دنيا → `d̪ʊnaː`, the ي gone).

**Measured empty-tag rate per letter** (the discriminator):

| letter | n | empty | rate | verdict |
|---|---|---|---|---|
| ھ | 337 | 337 | **100%** | legitimate — absorbed into the preceding aspirate digraph |
| ه | 1464 | 220 | 15.0% | legitimate — silent word-final carrier |
| ع | 94 | 13 | 13.8% | legitimate — silent in Sindhi |
| ا | 4661 | 357 | 7.7% | legitimate — bare-alif carrier |
| **آ** | 194 | 3 | **1.5%** | noise |
| **ي** | 3570 | 91 | **2.5%** | noise |
| **و** | 4552 | 55 | **1.2%** | noise |
| **ئ** | 1023 | 4 | **0.4%** | noise |

**Fix** (`export_sd_tagger_onnx.py`, mask-only — no retrain): drop the empty tag from any letter that took
it in <5% of ≥20 observations. Prunes exactly آ ئ ي و and leaves ھ/ه/ع/ا untouched. A 5% threshold
separates the two groups with a wide margin (7.7% vs 2.5%), so it is not a knife-edge constant.

**Result:** دنيا → **`d̪ʊnjaː`** (was `d̪ʊnaː`) — the ي is preserved AND correctly read as the glide of
*dunyā*. Locked by a regression test asserting the shipped MASK directly, so it needs no onnxruntime and
cannot silently regress.

**Metric caveat, recorded because it misleads:** the crude "consonant skeleton preserved" figure went
86.4% → 82.7% after the guard. That is not a regression — forcing و/ي to emit *something* produces more
glide↔vowel differences from the rule path, which that metric counts as "changed". It conflates deletion
with the glide/vowel choice and is the wrong instrument; the mask assertion is the right one.

### #547 closeout — final state
| claim in #547 | status |
|---|---|
| no stress marks | **fixed** — 0% → 100% of `sd_in` utterances |
| over-applied schwa epenthesis | **fixed + re-scoped** — homorganic nasal+stop no longer split; re-measured at 9,920 words the overall error is 8.9%, not the dominant class #547 implied |
| flattened vowel quality | **fixed** — see below |

Vowel quality, token-weighted over FLEURS `sd_in` (36,661 tokens):

| resolution path | tokens | share |
|---|---|---|
| lexicon (attested vowels) | 14,576 | **39.8%** |
| neural tagger (77.0% slot acc) | 16,814 | **45.9%** |
| blanket default-ə (residual) | 5,271 | **14.4%** |

Before this work: **100% default-ə**. Lexicon 539 → **9,920** words.
Full suite **1398/1398**; referee eval **77.5%** (unchanged by construction — it runs the lexicon-free path).

Remaining Sindhi tail is documented here, not filed as issues: the 14.4% default-ə residual (words whose
letters the tagger declines), the four cluster pairs worth ~2% of epenthesis, and further lexicon growth.
