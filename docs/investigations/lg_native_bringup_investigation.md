# Luganda (lg) native bring-up

Luganda / Oluganda (lg) — Bantu, Great Lakes (JE15); the principal language of Uganda and the most widely spoken
Ugandan language (~11M incl. L2). Latin orthography. This is a fresh bring-up.

**Scope gate — PASSES, but with a WEAK referee.** Standardized Latin orthography + epitran lug-Latn. But: **no
kaikki, no wikipron** Luganda — epitran is the ONLY machine referee, and it is itself RULE-based, so an
epitran-vs-ours comparison is **partly circular** (both g2p the same orthography — the uz precedent). To keep the
bring-up honest, the phonology is grounded INDEPENDENTLY in the **Wikipedia (Luganda)** phonology, and one
deliberate convention divergence from epitran is made (⟨c j⟩ = palatal stops, below).

## Run 1 — the g2p, 99.1% folded (circular)

**Referee.** epitran lug-Latn run on a **1500-word Leipzig wordlist** (`lug_wikipedia_2021_10K`, CC-BY;
lowercase, proper-noun-filtered). epitran output: prenasalised superscripts (nga→ᵑɡa), labialisation (bwe→bʷe),
r→ɾ, y→j.

**g2p** (Chichewa greedy pattern + two code rules), phonology from Wikipedia + the epitran map:
- **5 vowels a e i o u; DOUBLING = LENGTH** (aa→aː …). Length is phonemic (bana 'four' vs baana 'children').
- **PRENASALISATION** (code): ⟨n m⟩ + an obstruent → a place-assimilated superscript nasal (ᵐ/ⁿ/ᵑ), and the
  obstruent is then scanned normally so its **labialisation survives** — ndw → ⁿdʷ (the initial digraph-table
  approach lost this: it grabbed ⟨nd⟩ before the ⟨w⟩). ⟨ng'⟩→ŋ (matched *before* the prenasal rule, so it is the
  velar nasal, not ᵑ+g); ⟨n'⟩→ⁿ (syllabic nasal prefix); ⟨ny⟩→ɲ, ⟨nny⟩→ɲː.
- **VOWEL LENGTHENING before a prenasalised consonant** (code post-step): Buganda→buɡaːⁿda, omuntu→omuːⁿtu (real,
  per Wikipedia; epitran does it too).
- **CONSONANT GEMINATION** (code): a doubled consonant → [Cː] (bbiri→bːiɾi, kitto→kitːo).
- **LABIALISATION** ⟨Cw⟩→Cʷ; ⟨l⟩=l, ⟨r⟩=ɾ (the l/r allophony is already written in the orthography).
- **DELIBERATE DIVERGENCE from epitran:** ⟨c⟩=c, ⟨j⟩=ɟ — the palatal STOPS (Wikipedia; [tʃ]/[dʒ] are allophones
  before front vowels), consistent with our Wolof convention. epitran emits tʃ/dʒ, so the eval folds c~tʃ, ɟ~dʒ.

**Result.** `npx tsx tools/referee-eval/eval.ts lg` → **99.1% folded (1486/1500)**, raw 89.6%. Folds: tie-bar,
c~tʃ, ɟ~dʒ. **This number is inflated by the circular referee** — it largely confirms we implement the same
orthography rules as epitran (plus our deliberate c/ɟ choice), not an independent correctness check.

**The 14-word residual is entirely English/tech LOANWORDS**, not native Luganda: epitran glides a high vowel to a
glide before another vowel (tekinologia→tekinoloɡja, motion→motjon) and devoices final obstruents in loans
(and→ant). Native Luganda is essentially at ceiling vs epitran.

## Verdict: 🔷 single-source + partly-circular

The g2p is a faithful, Wikipedia-grounded implementation of the Luganda orthography. But the ONLY referee (epitran)
is rule-based, so the 99.1% is a **fidelity** measure, not an independent correctness one — this is the weakest
verification of the recent bring-ups (weaker than Wolof/Bambara, which had human kaikki referees). Deferred:
- **TONE** (3-way H/L/falling) — lexical + unwritten (Wikipedia: "stress and tones are not represented in the
  spelling"), Meeussen's rule etc. No toned lexicon → deferred, the standard Bantu situation.
- **NUMBERS** — deferred (digits pass through).

Gold: `test/luganda.test.ts`. Floor `lg: 0.97`.
