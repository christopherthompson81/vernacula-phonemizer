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

65.8% → **77.2%**. Three g2p fixes from the residual:
- **ع silent** — Sindhi treats ع as a vowel modifier, not a full [ʔ] (تعليم→t̪əliːm, not tʔliːm).
- **aspiration accepts ه OR ھ** — Sindhi uses both do-chashmi ھ and plain ه for the
  ج/گ + sonorant aspirates (سنجهو→sɲd͡ʒʰu, was d͡ʒh).
- **word-final ح silent** — like ه/ہ, a silent carrier (روح→ruh→ru).

Plus post-backbone quality folds for the genuinely-unrecoverable axes: the **majhūl**
long vowels (و = [oː]~[uː], ي = [eː]~[iː] — each a single letter for two qualities),
long-ā [ɑ]~[a], and ق→[k] (Sindhi commonly de-uvularizes).

## Verdict — 🟡 Reliable + lexical tail

**77.2%** folded vs a 631-word independent human referee. The consonant + long-vowel
backbone — including the implosive census gap, the retroflex series, aspiration, and
nasal assimilation — is verified. The residual is the abjad short-vowel wall: quality and
position of the unwritten short vowels, restorable in principle from a coverage lexicon
(the Urdu/Pashto path), which is the deferred tail. Numbers deferred.
