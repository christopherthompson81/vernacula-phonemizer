# Akan / Twi (ak) native bring-up

Akan / Akan kasa (ak) — a Kwa (Niger-Congo) language of Ghana (~20M incl. L2), the fleet's **FIRST Kwa language**
(the fleet had Volta-Niger yo/ig, Bantu, Chadic, Cushitic, but no Kwa). `ak` is technically a macrolanguage
(Asante Twi + Akuapem Twi + Fante), but — unlike Rajasthani — Akan has a genuine **community-adopted standardised
orthography** (Bureau of Ghana Languages; Bible translations; school instruction), and the varieties share it. So
it clears the scope gate cleanly; the reference dialect is **Asante/Akuapem Twi**.

**Referee situation (thin).** No wikipron aka/twi; epitran ships no Akan mapping; kaikki Akan has only **22
pronunciation entries** (mixed Asante/Fante, tone + nasalisation marked, phonemic~phonetic mix). So this is the
Madurese/Igbo pattern: **author from the documented (shallow, well-described) orthography and anchor on a small
human gold** → 🔷 single-source. Documented from Dolphyne (1988) and **Paster (2010), "The verbal morphology and
phonology of Asante Twi"** (provided by the user).

## Run 1 — authored g2p
Shallow rule g2p (its own module). The interesting part is the **consonant DIGRAPH system**:
- **palatal series** ⟨ky gy hy ny⟩ → t͡ɕ d͡ʑ ɕ ɲ (kyerɛ→t͡ɕerɛ, gyina→d͡ʑina, ɔhyɛ→ɔɕɛ, nyansa→ɲansa);
- **labialised series** ⟨tw dw kw gw hw nw⟩ → t͡ɕʷ d͡ʑʷ kʷ ɡʷ ɕʷ ŋʷ — the signature Akan labial-palatalisation
  (twi→t͡ɕʷi, dwom→d͡ʑʷom, kwan→kʷan, hwɛ→ɕʷɛ, akwaaba→akʷaaba);
- ⟨ng⟩ → ŋ, and coda-⟨n⟩ **place assimilation** (nkran→ŋkran before k, else n/m).

Two things the Paster reference fixed at author time: (1) **Glide Formation** — a round vowel o/ɔ/u before a
DIFFERENT vowel becomes [w] (boa→bwa), the round vowel's mora deleting; NOT before the same vowel (huu = length,
not glide). (2) the ATR merger: the orthography writes [e]/[ɪ] both as ⟨e⟩ and [o]/[ʊ] both as ⟨o⟩, so ⟨e⟩/⟨o⟩ are
rendered at their [+ATR] phonemic values [e]/[o] (the [-ATR] ɪ/ʊ allophones are unwritten → deferred). Also fixed a
word-final-n bug (`"kg".includes("")` is true → over-velarised pɛn→pɛŋ).

**TONE (H/L) is phonemic but UNWRITTEN in the standard orthography → DEFERRED** (no tone emitted), as is
nasalisation (rare tilde only) and the ATR ɪ/ʊ allophony.

**Result: kaikki 14/20 folded (70%)** (tone/nasal/length folded — all unwritten). The 6 misses are NOT engine bugs:
documented Glide Formation vs kaikki citation (dua/obue/uɔfa — Paster's rule is right), deferred ATR vowel-raising
(aberanteɛ→abiranti), and a corrupt kaikki entry (uanim→wunim). The correctness anchor is the adjudicated gold
(test/akan.test.ts, 5 groups, all the digraph series + glide formation + coda assimilation). **🔷 single-source**
(small human corroboration; no independent second referee exists). **Outstanding:** tone (H/L, unwritten — the
Yoruba-minus-written-tone situation), ATR harmony (ɪ/ʊ allophones + a→e raising), nasalisation, and numbers.

## Run 2 — the deferred parts (ATR harmony + numbers done; tone + nasalisation are data-blocked)
Worked the four deferred items. Two were tractable and are now DONE; two are genuinely data-blocked and doing them
would mean fabricating unverifiable output (the same principle that skipped Rajasthani).

- **ATR HARMONY — DONE (documented rule).** The orthography merges the [+ATR]/[−ATR] mid pairs: ⟨e⟩ is [e]~[ɪ],
  ⟨o⟩ is [o]~[ʊ] (Paster 2010 rule 4/5, Dolphyne 1988). `atrByIndex()` classifies each vowel — unambiguous triggers
  ⟨i u⟩ = +ATR, ⟨ɛ ɔ⟩ = −ATR, ⟨a⟩ neutral — and spreads the nearest trigger to the ambiguous ⟨e o⟩ (default +ATR).
  So kyerɛ→t͡ɕɪrɛ (−ATR via ɛ), bisa→bisa (+ATR via i), obue→obwe (+ATR via u). The kaikki score is unchanged (16/22,
  since kaikki writes [ɪ] as ⟨i⟩); the win is documented explicitness, corroborated by kaikki's own aberanteɛ→abiranti
  (⟨e⟩→[ɪ] in a −ATR word).
- **NUMBERS — DONE.** Standard Twi cardinals (units baako…nkron, du, aduonu-tens, ɔha-hundreds, apem/mpem thousands),
  compositional and space-joined, rendered through the same g2p (21→aduonu baako→adwonu baako, glide formation
  applying inside the numeral). The deep number morphophonology (nasal mutation across seams, the ⟨ne⟩ connector) is
  simplified. Also fixed a tokenizer bug the numbers surfaced: TOKEN only matched [a-z], dropping capital letters
  (Me→e); added A-Z + Ɛ Ɔ.
- **TONE (H/L) — DATA-BLOCKED, not done.** Unwritten in the orthography; Akan tone is lexical/grammatical (not
  predictable from segments); the only machine-readable tone source is the 22-word kaikki set. A real tone system
  needs a tone-marked pronunciation lexicon that does not exist here — modelling it would be invention, not derivation.
- **NASALISATION — DATA-BLOCKED, not done.** Contrastive but unwritten (rare tilde only). No rule fits: mifi→mĩfi
  nasalises the post-nasal vowel but soma→soma does not, same position — so it is lexical, not derivable. The tilde
  ⟨◌̃⟩ is the only recoverable signal (already handled).

Net: the segmental engine is now feature-complete for what the orthography ENCODES (digraphs, glide formation,
coda assimilation, ATR harmony, numbers). The two remaining gaps are suprasegmentals the writing system does not
record and for which no corpus exists — a principled ceiling, not a backlog item.
