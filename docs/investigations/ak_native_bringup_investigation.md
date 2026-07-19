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
