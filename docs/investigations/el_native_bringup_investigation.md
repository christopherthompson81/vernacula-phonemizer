# Modern Greek (el) native bring-up

Hellenic (Indo-European), the Greek script. Cleanroom canonical-IPA g2p,
espeak-independent. The first CONTEXT-SENSITIVE engine of the Indo-European set
(not a table map). Excellently resourced: two large human referees.

## Run 0 — 2026-07-17 — data check

- **wikipron ell_grek broad: 19108** (HUMAN). Confirmed MODERN Greek (μπ→b, ντ→d,
  αυτό→afto, Άγγελος→aŋɟelos), NOT Ancient. Does NOT mark stress.
- **kaikki Greek: 19721 IPA entries** (HUMAN, same Wiktionary tradition; marks
  stress ˈ + syllable dots).
- No epitran for Greek. Both referees are Wiktionary-derived (same tradition).

## The engine (context-sensitive)

The historical spellings collapse to /a e i o u/ (η/υ/ει/οι/υι→i, ω→o, ου→u).
Rules, extracted from the 19k data:
- **Velar palatalisation** before a front vowel [e i]: κ→c, γ→ʝ, χ→ç; the γ-nasal
  digraphs γγ/γκ→[ŋɡ] (→[ŋɟ] before front; word-initial γκ has no [ŋ]).
- **Voiced stops** ⟨μπ ντ⟩: word-initial [b d], MEDIAL (before a vowel) prenasalised
  [mb nd]; before a consonant they are the separate letters μ+π/ν+τ (Πέμπτη→…mpti).
- ⟨αυ ευ⟩ → a/e + [v] (before a voiced sound) / [f] (voiceless); ⟨σ⟩ → [z] before a
  voiced consonant (κόσμος→kozmos); double consonants simplify (θάλασσα→θalasa).

## Runs 1–4 — build + iterate

- v1 (naive): 75.6%. Bugs: the double-consonant rule ate ⟨γγ⟩ (a digraph, not a
  geminate); velars wrongly absorbed the following [i]; γγ/γκ missing the [ŋ]; ρ→ɾ
  where the referee writes [r]. Fixed (γ-nasals before the geminate rule, velars
  keep the [i], ρ fold ɾ~r) → 86.1%.
- v2: added ⟨μπ ντ⟩ medial prenasalisation → 87.0% with a blanket synizesis.

### The synizesis problem (the crux of Greek g2p)

An unstressed [i] before another vowel is often not syllabic (Λειβαδιά→[livaˈðʝa]).
But applying it BY RULE **over-fires**: the careful-pronunciation referees mostly
KEEP the [i] (Κύριος→[ˈciɾios], ημιορόφου→[imioˈɾofu], αισιοδοξώ→[esioðoˈkso]) — it
is lexically/register conditioned, not derivable from spelling. Disabling the
blanket rule (keep [i]) rose **87.0 → 89.4%**.

The RELIABLE subset: synizesis before a STRESSED vowel (the productive -ιά/-ιό
pattern: κοιλιά→[ciˈʎa], Λειβαδιά→[livaˈðʝa], αγγουριά→[aŋɡuˈɾʝa]). Re-adding
synizesis gated on the following vowel being stressed (which needs the tonos —
tracked before stripping) → **90.2%**, without the over-firing.

## Result

- wikipron ell_grek (primary, human): **90.2%** (17237/19108)
- kaikki Greek (human): **89.2%** (17586/19721)

Two same-tradition (Wiktionary) human referees, both ~90% → **🟡 reliable +
lexical-tail**. Floor 0.88. Verified: Ελλάδα→[elaða], αυτό→[afto], μπύρα→[biɾa],
πέντε→[pende], κόσμος→[kozmos], ευχαριστώ→[efxaɾisto], Άγγελος→[aŋɟelos].

## Run 5 — 2026-07-17 — adversarial review (90.2 → 91.1%)

Two systematic bugs, both confirmed by BOTH referees (the TOKEN-regex worry was a
false alarm — `Ͽ` is U+03FF, so `[Ͱ-Ͽ]` covers the whole Greek block):
- **⟨μπ ντ⟩ before a liquid ρ/λ** wasn't voiced (μπλε→*mple, άντρας→*antɾas). The
  voiced-stop gate fired only before a vowel; extended it to a following ρ/λ (μπλε→
  ble word-initial, άντρας→andɾas medial). ⟨μπ ντ⟩ before an obstruent stays μ+π
  (Πέμπτη→pempti).
- **A tonos on the FIRST element of a vowel digraph is HIATUS** (τσάι = t͡s+a+i,
  ρολόι = ɾo.lo.i — a whole syllable was being dropped). Added a stress-aware vowel
  matcher that suppresses the digraph-merge when the first element carries the
  tonos; the diaeresis path and second-element tonos (ναύτης→naftis) were already fine.

Result: wikipron **90.2 → 91.1%**, kaikki 89.2 → 90.0%.

## Outstanding (the lexical tail, ~9%):
- **Lexical synizesis** — the register-conditioned unstressed-[i]-before-any-vowel
  cases (Σκόπια→[skopça] but Κύριος→[ˈciɾios]); a synizesis lexicon is the path.
- **Variable medial prenasalisation** (Modern Greek drops the nasal for younger
  speakers: άντεστε→[adeste] vs Κένταυρος→[cendavɾos] — the referee has both).
- Morphological ⟨γγ⟩=[ŋɣ] (συγγράφω, a σύν- prefix boundary) vs [ŋɡ] (Άγγελος).
- Loanwords/proper nouns; stress + numbers deferred.
