# Assamese (as) native bring-up

Assamese / অসমীয়া — Eastern Indo-Aryan, ~24M speakers (Assam), Bengali-Assamese script. Reuses the **Bengali
engine** (makeNativeBengali — the generic abugida scan + inherent-vowel deletion, shared Eastern-Indic phonology)
with an Assamese manifest, espeak-independent.

## Distinctness from Bengali (checked FIRST)

The first task was to confirm Assamese warrants its own engine rather than a Bengali variant. It emphatically does —
the wikipron referee confirms the famous divergences:

- **The three sibilants শ/ষ/স → [x]** (voiceless VELAR fricative): অসম→ɔxɔm, সাত→xat, দেশ→dex, শিশু→xixu. Bengali
  has [ʃ]. This alone makes Assamese unmistakable.
- **Deaffrication**: চ/ছ → [s] (চা→sa, চাউল→saul), জ/ঝ → [z] (জীৱন→ziwɔn). Bengali keeps the affricates t͡ʃ/d͡ʒ.
- **No retroflex/dental split**: ট ঠ ড ঢ and ত থ দ ধ all → plain **alveolar** t tʰ d dʱ (ভাত→bʱat). Bengali has
  retroflex ʈ… vs dental t̪….
- Two **extra letters**: ৰ [ɹ] (ra) and ৱ [w] (wa); য → [z]; ড়/ঢ় → [ɹ] (no retroflex flap).

This is not the ⛔ Hindi-belt clone situation — Assamese is segmentally *distinct*, with two independent human
referees that transcribe the distinctive features.

## Data availability

- **wikipron asm_beng broad** — 2,982 human words (PRIMARY).
- **kaikki as** — 3,327 human words (SECONDARY). Both **Wiktionary-derived** (same-source, weak corroboration),
  but substantial and both confirm the distinctive phonology. No epitran Assamese.

## Reuse + the three disabled Bengali rules

Assamese shares the Bengali abugida scan, ং/ৎ normalization, geminate→length, and final inherent-vowel deletion.
It **diverges** on three rules, now flags on the shared engine (discovered from the referee residuals):

1. **heightHarmony: false** — Assamese lacks Bengali's ɔ→o raising before a high vowel. The referee keeps ɔ:
   চকৰি→sɔkɔɹi (not sɔkoɹi), জৰি→zɔɹi. (Disabling it: +6.7pp.)
2. **medialSchwaDeletion: false** — Assamese RETAINS the medial inherent vowel that Bengali/Hindi delete:
   চকৰি→sɔk**ɔ**ɹi, ঢাকনি→dʱak**ɔ**ni. (Disabling it: +12.8pp — the single biggest lever.)
3. **skipLexicon: true** — the Bengali whole-word lexicon (bengali-lexicon.tsv) was leaking Bengali readings onto
   shared spellings (এক→[æk], the Bengali pronunciation of "one"); Assamese uses the pure rule engine (এক→[ek]).
   Caught by the review-style probe on the number path.

The Assamese consonants from deaffrication + the alveolar merger (t d s z x) also needed their own **geminate→
length** pass (the Bengali engine's geminate set only covers its own phonemes) — added in the wrapper.

## Run — vs the two referees

**72.6% vs wikipron / 69.5% vs kaikki.** Both Wiktionary parsings corroborate the distinctive Assamese rules. The
folds are notational/allophonic: the rhotic ɾ~ɹ, the mid-vowel e~ɛ (Assamese lowers ⟨এ⟩ in closed syllables), the
⟨ফ⟩ pʰ~f~ɸ, the ⟨ও⟩ o~ʊ raising, the homorganic ⟨য়⟩ glide (iya→[ija]~[ia], the Tagalog offglide pattern), and the
kaikki syllable dots. The residual is:

- **Variable ɔ→o harmony** — some words DO raise (ফণি→pʰoni in the referee) where the rule (now off) keeps ɔ; it
  is lexically inconsistent → a lexical tail.
- **The apostrophe ⟨'⟩ orthography** — Assamese ল'ৰা marks the o vowel with an apostrophe (loɹa); we currently read
  the inherent ɔ (lɔɹa). A specific, unmodeled Assamese convention.
- final inherent-vowel-after-cluster (Assamese deletes where Bengali retains), and glide/hiatus variation.

## Verdict — 🟡 Reliable + lexical tail

The distinctive segmental core (the x-fricative, deaffrication, alveolar merger, retained medial ɔ) is correct and
corroborated by two substantial human referees. **Outstanding (🟡):** the variable ɔ→o harmony (a lexical tail, the
mr/bn class), the ⟨'⟩ apostrophe-o orthography, and final-cluster inherent-vowel deletion — a harmony/orthography
lexicon is the path. Both referees are Wiktionary-derived (same-source), a breadth caveat. Numbers route through the
same engine (round tens; irregular 21-99 use the graceful fallback).
