# Bambara (bm) native bring-up

Bambara / Bamanankan (bm) — Mande (Manding branch); Mali's principal language and lingua franca (~14M incl. L2).
Written in the **Latin** orthography (official Malian, standardized) and **N'Ko** (a separate Manding script). This
is a fresh bring-up in vernacula-phonemizer targeting the Latin orthography (N'Ko deferred).

**Scope gate — PASSES (single-source).** Standardized Latin orthography + a human referee: **kaikki Bambara**
(Wiktionary, CC-BY-SA). No epitran `bam`, no wikipron `bam` — kaikki is the only machine referee (🔷 single-source,
like Lingala).

## Run 1 — the g2p + nasalisation, 86.5% folded

**Referee.** Downloaded the kaikki Bambara dictionary (791 entries; **80 with IPA**, 74 single-token). The
transcription is NARROW: it marks **tone** (à/á, level ˦/˨, downstep ꜜ), **nasalisation** (ã õ ũ), and vowel
**length** (doubling / ː). Standard Bambara orthography marks none of tone or length (both lexical), so the eval
folds them and compares the SEGMENTAL + NASALISATION backbone.

**g2p** (Chichewa greedy pattern + one code rule). Consonants: ⟨c⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ, ⟨ny⟩=⟨ɲ⟩→ɲ, ⟨ŋ⟩→ŋ,
the rest as written; 7 oral vowels i e ɛ a ɔ o u. The one non-table rule is **NASALISATION**: a syllable-final
⟨n⟩ (word-final or before a consonant) nasalises the preceding vowel [Ṽ] and drops (ban→bã, kalan→kalã), while an
onset ⟨n⟩ before a vowel stays [n] — so kunun→kunũ (only the *final* n nasalises, the medial n is an onset). A
word-initial nasal + C is a prenasal onset (mburu→mburu; ⟨ng⟩→ŋɡ by place assimilation). The ⟨ny⟩ digraph is
checked BEFORE the ⟨n⟩ rule so it is not intercepted (denya→deɲa, not dẽja).

**Result.** `npx tsx tools/referee-eval/eval.ts bm` → **86.5% folded (64/74)**; raw 2.7% (we differ from the
referee on tone/length/tie-bars on nearly every word — folded is the real backbone signal). Folds: tie-bar,
tone (combining à/á + Chao ˦˨ + downstep ꜜ), length (ː + collapse doubled vowels incl. nasalised), ⟨y⟩~[j].
Spot-checks are linguistically sound: cɔnkɔ→t͡ʃɔ̃kɔ, jan→d͡ʒã, shinye→ʃiɲe, mburu→mburu, sanga→sãɡa, dolen→dolẽ.

**The residual (~10 words) is referee broadness + lexical oddities, not g2p error:** several kaikki entries are
BROAD (they skip the regular nasalisation/palatalisation — adamaden→ádamàden not ...dẽ, adamadenya→...denya not
...deɲa), where OUR rule-based output is the more consistent one; plus a loanword syncope (aderenalini→adrenalini),
a grammatical-word exception (an→[án] oral, not ã), and a couple of variant forms. Folding these would be gaming.

## Verdict: 🔷 single-source

The segmental + nasalisation g2p is correct for what the orthography determines (86.5% folded vs an independent
human referee). Genuinely deferred, all unrecoverable from the standard Latin spelling:
- **TONE** (2-level H/L + downstep + spreading) — lexical + unwritten (same class as Chichewa/Setswana; no toned
  lexicon at scale). The kaikki referee marks it, so it's *folded* here, not emitted.
- **Vowel LENGTH** — phonemic but inconsistently written; the referee's doubling is folded.
- **NUMBERS** — deferred (the Bambara numeral words weren't verifiable against a source on hand; digits pass
  through) — a candidate Run-2 item.
- **N'Ko** — the second Manding script; a separate front-end, deferred.

Single-source (🔷): kaikki is the only machine referee (74 IPA words — small, like Lingala). Gold:
`test/bambara.test.ts`. Floor `bm: 0.85`.

## Run 1b — Vydrin (2020) confirms the inventory (expert validation)

The user supplied **Vydrin, "Vowel elision and reduction in Bambara" (Italian Journal of Linguistics 32.1, 2020)**
— Valentin Vydrin is the leading Mande linguist. It confirms the whole bring-up (no code change needed):

- **Vowels (§2.1):** exactly three series — **short oral /i e ɛ a ɔ o u/**, long oral /iː …/, and **short nasal
  (ĩ ẽ ɛ̃ ã ɔ̃ õ ũ)**. Matches our 7 oral vowels + the nasalisation rule (nasal vowels are short only; length is
  phonemic → folded, consistent with our length fold).
- **Consonants (Table 1):** ⟨c⟩=t͡ʃ, ⟨j⟩=d͡ʒ, **⟨ʃ⟩ is a MARGINAL phoneme** (bracketed — contact-induced), the
  **prenasalised stops/fricatives are UNIT phonemes** (mp nt ɲt͡ʃ ŋk / mb nd ɲd͡ʒ ŋg / mf ns), ⟨ny⟩=ɲ, ⟨ŋ⟩=ŋ — all
  as we render them. Two residuals explained: **foot-internal /g/ varies [k~g~ɣ~Ø]** (the dingɛ→dĩɛ g-drop is the
  [Ø] realisation — dialectal/variable, not an error) and **/r/ occurs only foot-internal** (never word-initial).
- **Nasal-vowel realisation (§2.2):** a nasal vowel is [Ṽ] before a pause, but before a consonant it is a homorganic
  **nasal sonorant + partly-denasalised vowel** [VN] (dén [dé] → dénkɛ [déŋkɛ]). The kaikki referee transcribes the
  medial case as [Ṽ] (sanga → sã˨ɡa), so we follow the referee's Ṽ; [VN] is the equivalent narrow alternative.
- **Tone (§2.3):** two level tones (low = grave, high = acute; falling = circumflex), organised around a **lexically
  determined tonally-dominant syllable**, with downdrift/downstep and a floating-low tonal morpheme. This is exactly
  the *lexical, unwritten* profile → tone stays deferred (folded), now with expert backing rather than inference.

**Net:** the g2p is expert-confirmed by Vydrin (2020); the ~10 folded residuals are the referee's broad entries +
Vydrin's own documented variable processes (foot-internal g-lenition), not g2p defects. Verdict unchanged: 🔷
single-source, 86.5% folded, tone/length/numbers/N'Ko deferred.

## N'Ko front-end (2026-07-26)

Added **N'Ko** (ߒߞߏ, U+07C0–07FF) as a second input script — the modern (1949, Solomana Kanté) RTL phonemic
alphabet for the Manding languages. The Tashelhit/Fula pattern: `bambaraNko.ts` transliterates N'Ko → the Latin
orthography and the existing greedy g2p + nasalisation rule runs unchanged (N'Ko codepoints are stored in logical
order, so a left-to-right scan is correct). Auto-detected per word (U+07CA–07FF).

Handled: the **vowel-naming trap** (LETTER EE = /e/, LETTER E = /ɛ/, LETTER OO = /o/, LETTER O = /ɔ/); the
**NASALIZATION MARK** (U+07F2) → a syllable-final ⟨n⟩, so the engine's existing "final-n nasalises the preceding
vowel" rule fires (ߖߐ߲ → jɔn → d͡ʒɔ̃); the standalone LETTER N assimilating before a velar (ߒߞߏ → nko → ŋko). The
**7 combining tone marks + the tone apostrophes are DROPPED** — Bambara's Latin orthography and this engine are
toneless, so this matches the Latin path (tone stays a documented deferral). LAJANYALAN (lengthener) and DAGBASINNA
(carrier) are dropped.

**Validation = self-consistency:** transliterating the Latin referee words → N'Ko → back gives **72/74 = 97.3%
identical IPA**; the 2 misses are LOANWORDS (`Zanga` /z/, `shinye` /ʃ/) — phonemes N'Ko has **no dedicated letter
for** (unlike Fula-Adlam, which covers every Fula phoneme). **Native Bambara is 100% consistent**, so the N'Ko path
inherits the Latin path's kaikki-validated accuracy for the core phonology; the /z ʃ/ loans are the honest edge.
