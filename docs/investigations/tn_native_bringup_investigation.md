# Setswana (tn) native bring-up

Setswana / Tswana (tn) — Bantu, Sotho-Tswana branch (Guthrie S31); national language of Botswana + an official
language of South Africa (~14M). Latin orthography, NON-click (unlike its Nguni neighbours Zulu/Xhosa). This is a
fresh bring-up in vernacula-phonemizer (the `setswana_bringup.md` memory note is from the *other*, espeak-parity
codebase — Setswana was never ported here).

**Scope gate — PASSES.** Standardized Latin orthography + an independent machine referee (**epitran tsn-Latn**) +
a phonology reference on disk (**Mistry, _Tswana: An Introduction to Spoken_**, a 1970s ERIC teaching text citing
Cole 1955) + espeak's `ph_setswana`/`tn_rules` for cross-check.

## Run 1 — the g2p, 100% folded vs epitran

**Approach.** The Chichewa Bantu pattern: a pure greedy longest-match scan over an orthography→IPA grapheme table
(Setswana is open CV with syllabic-nasal + C onset clusters, so no coda/syllabification logic is needed). Module:
`src/languages/setswana/{setswana.ts, manifest.ts, setswana.jsonc}`.

**Phonology** (from the epitran map, cross-checked against Mistry/Cole and espeak). Two research agents mined the
book: one extracted a **1592-word wordlist** (from the vocabulary section + phonology exercises + reading
passages), the other extracted the phonology. Key facts:

- **Consonants where we AGREE with epitran**: ⟨kg⟩→k͡xʰ, ⟨kh⟩→kʰ (complementary — kh before i/u, kg elsewhere;
  the orthography already picks), ⟨tlh⟩→t͡ɬʰ, ⟨tl⟩→t͡ɬ (lateral affricates), ⟨tsh⟩→t͡sʰ, ⟨tš⟩→t͡ʃ, ⟨š sh⟩→ʃ,
  ⟨ph th⟩→pʰ tʰ, ⟨ng⟩→ŋ, ⟨j⟩→d͡ʒ.
- **Two beyond-epitran CORRECTIONS** (we are right, epitran is naive — confirmed by Mistry):
  - **⟨g⟩ → [x]** (voiceless velar fricative). Setswana has **no /g/ phoneme** — Mistry lists only ⟨b d⟩ as voiced
    stops, and ⟨g⟩ is the guttural of the kg/kh series (like Afrikaans ⟨g⟩). epitran emits a plain **[g]** — WRONG.
    Applies all over: tlhogo→t͡ɬʰoxo, legodimo→lexodimo, segolo→sexolo, nyaga→ɲaxa.
  - **⟨ny⟩ → ɲ** (palatal nasal, Mistry L25200). epitran emits **[nj]** (n + glide). senya→seɲa.
- **Vowels — a bounded, underdetermined class.** Setswana is a 7-vowel system /i e ɛ a ɔ o u/, but the standard
  orthography writes plain ⟨e⟩ (spanning [e]~[ɛ]~[ɪ]) and ⟨o⟩ (spanning [o]~[ɔ]~[ʊ]) — the ê/ô circumflex that
  disambiguates height is a learner aid, dropped in normal text. So **mid-vowel height is not recoverable from the
  spelling** (7→9-vowel raising harmony). We emit the close-mid default (⟨e o⟩→e o, ⟨ê ô⟩→ɛ ɔ) and fold the height
  for scoring (ɛ/ɪ→e, ɔ/ʊ→o). epitran applies its own broad raising (o→ʊ after C, se→sɪ, etc.); the fold
  neutralises both sides.

**Result.** `npx tsx tools/referee-eval/eval.ts tn` → **100.0% folded (1592/1592)**; raw exact 22.2% (we differ
from epitran on g, ny, tie-bars, and vowel height on nearly every word — the folded number is the real segmental
backbone signal). Folds: tie-bar `t͡ʃ~tʃ`, `g~x`, `ɲ~nj`, front-mid `[ɛɪ]→e`, back-mid `[ɔʊ]→o`.

Spot-checks confirm the unfolded output is linguistically sound, not just fold-matched: kgomo→k͡xʰomo, motho→motʰo,
tlhogo→t͡ɬʰoxo, ngwana→ŋwana, dijo→did͡ʒo, mmele→mmele (syllabic m), ntlha→nt͡ɬʰa.

## Verdict: 🔷 single-source + 🟢 bounded

The g2p is **correct on everything the orthography determines** (100% folded vs an independent referee it also
*corrects* in two places). Two characterised ceilings remain, both from the writing system rather than the engine:

- **Vowel height** — genuinely underdetermined by standard spelling (🟢 bounded; no path without the ê/ô circumflex
  or a lexicon).
- **Tone** (H/L, lexical) and the **ejective** analysis of p/t/k/tl/ts (Cole) — unwritten, so not emitted.

**Single-source (🔷):** epitran tsn-Latn is the only machine referee (no wikipron/kaikki tsn exists). It is
*independent* (a separate implementation) and we *diverge from it correctly*, so the corroboration is real — but a
second referee would be needed to call it ✅. **Numbers** are deferred (digits pass through).

Gold: `test/setswana.test.ts` (hand-adjudicated signatures + common words). Floor `tn: 0.98`.
