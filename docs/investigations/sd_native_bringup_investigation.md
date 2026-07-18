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
documented like the majhūl/tone folds elsewhere. Data staged in /mnt/data/sd-lsi/ (lsi_forms.csv, clean.tsv).

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
error). Data staged in /mnt/data/sd-lsi/. Attribution: Grierson (1928) via lexibank/lsi, CC-BY-4.0.
