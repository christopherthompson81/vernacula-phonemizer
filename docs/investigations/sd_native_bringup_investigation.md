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
