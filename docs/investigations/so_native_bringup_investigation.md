# Somali (so) native bring-up

Somali / Af-Soomaali — Cushitic (the **2nd**, after Oromo), ~22M speakers (Horn of Africa), the 1972 Latin
orthography. A cleanroom shallow rule g2p, espeak-independent.

## Data availability (checked up front)

- **epitran som-Latn** — a programmatic G2P (PRIMARY). Independent (rule-based, different authors).
- **kaikki so** — 232 human words (SECONDARY, Wiktionary). Small and NARROW (grammatical tone marks á à ā, ATR
  vowels, the epiglottal [ʡ͜ʢ] realisation of ⟨c⟩).
- **No wikipron som.** So the two referees are genuinely independent (a rule G2P + a human dictionary), but both
  small (~230 words). Two independent sources, modest volume.

## The rule core — a near-phonemic Latin orthography

Somali's 1972 orthography is shallow, so the g2p is a digraph-aware left-to-right scan. The interesting part is
the **signature Cushitic consonant inventory**, all straightforward once mapped:

- **⟨c⟩ → [ʕ]** (voiced pharyngeal) and **⟨x⟩ → [ħ]** (voiceless pharyngeal) — the two that surprise everyone
  (magac→maɡaʕ, xariir→ħariːr, dhagax→ɖaɡaħ has both).
- **⟨dh⟩ → [ɖ]** (retroflex), **⟨q⟩ → [q]** (uvular), **⟨kh⟩ → [χ]**, **⟨sh⟩ → [ʃ]**, **⟨'⟩ → [ʔ]** (glottal),
  ⟨j⟩→d͡ʒ, ⟨y⟩→j.
- **doubled consonants geminate** → Cː (abbaan→abːaːn); **doubled vowels are long** → Vː (soomaali→soːmaːli).

## The two unwritten layers (deferred/folded)

Somali has two phonological systems the orthography does NOT encode:

1. **ATR vowel harmony.** Somali has ~10 vowels (a front/back [±ATR] pair for each written quality: [æ]~[ɑ],
   [ɛ]~[e], [ɪ]~[i], [ɔ]~[o], [ʊ]~[u]), but writes only 5. The referees pick ATR variants differently — epitran
   uses the front/lax set (magac→mæɡæʕ), kaikki the back set (magac→mɑɡɑʕ) — which is itself evidence the contrast
   isn't recoverable from spelling. We emit the 5 written qualities and fold the ATR variants.
2. **Tone** — Somali prominence is a grammatical high pitch-accent (marking gender/number/case), not lexical
   stress, and it is unwritten. Deferred; the backbone strips the referees' tone marks (like Oromo).

## Run — vs the two referees

**98.7% vs epitran (primary) / 81.0% vs kaikki (secondary).** The near-phonemic g2p matches the rule-based epitran
almost exactly; kaikki is lower because it is a *narrow* human transcription (tone-conditioned final devoicing
r̥, affricate variants t͡ʃʰ~d͡ʒ for ⟨j⟩, epiglottal ⟨c⟩). Folds are all unwritten-harmony / notational: the ATR
vowels, gemination (dd~dː), kaikki's predictable word-initial glottal insertion (af→ʔaf), and the epiglottal ⟨c⟩.
None folds a written contrast.

## Verdict — ✅ Reliable

A shallow near-phonemic orthography, verified against two independent referees (the Oromo pattern). The signature
Cushitic consonants (pharyngeals, retroflex, uvular, glottal) are correct; numbers (units-first with "iyo") are
done. **Outstanding:** the unwritten ATR vowel harmony (not derivable from spelling — a 🟢-style bound, folded
here) and grammatical tone (deferred, as Oromo). The referees are small (~230), a volume caveat, but genuinely
independent and strongly corroborating.
