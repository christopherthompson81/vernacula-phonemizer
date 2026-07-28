# Oromo / Afaan Oromoo (om) bring-up investigation

First Cushitic (Afroasiatic) language. Written in the largely-PHONEMIC Latin **Qubee** orthography → a shallow
rule-based g2p (the Tagalog/Indonesian pattern). Fills a census gap: the EJECTIVES c→t͡ʃʼ, q→kʼ, x→tʼ, ph→pʼ and the
retroflex IMPLOSIVE dh→ᶑ.

## Run 1 — 2026-07-17 — Qubee g2p, dual-referee

**Data (the honest up-front check):** no wikipron (cjy/gaz/orm/om all 404), Oromo not in Unihan — BUT **epitran
orm-Latn** exists and is high-quality (nails the ejectives/implosive/gemination/length), and **kaikki Oromo** gives
5,810 entries → a 5,336-word Qubee wordlist + 51 human IPA transcriptions. So: PRIMARY = epitran on the wordlist
(the Hausa pattern), SECONDARY = the 51 human IPA (truly independent, narrow).

**Engine:** `oromo.jsonc` (digraphs ch/dh/ny/ph/sh + consonants incl. ejectives + vowels) + `oromo.ts` scanner
handling DOUBLED vowels → long (aa→aː), DOUBLED consonants → geminate (bb→bː), GEMINATE DIGRAPHS (Qubee doubles the
first letter: ddh/pph/cch → [ᶑː]/[pʼː]/[t͡ʃː]), and the apostrophe → [ʔ]. No stress (non-phonemic, epitran omits it).

**Result: 94.0% raw / 100.0% FOLDED vs epitran** (5334/5336). The only 2 residuals are cases where **epitran is
wrong and we are right**: its inconsistent ʼ (U+02BC) handling, and it fails to parse a geminate digraph
(qopphaaʼuu → epitran [kʼopːhaː], ours [kʼopʼːaː] — pph is geminate ph [pʼː], not pː+h). The fold strips [ʔ] because
epitran DROPS the apostrophe glottal (a'aa→aaː) — ours [ʔ] is correct.

**Human secondary: 96.1% FOLDED** (49/51) after folding the narrow allophony (ɐ/ɑ→a, ʊ→u, ɔ→o, β→b spirantization,
CC~Cː gemination, stress/tone stripped). Two corroborating sources.

**Status ✅ (segmental).** Qubee is phonemic → the g2p is deterministic and matches both references (the residual is
referee-limitation). Deferred: **tone** (Oromo has grammatical pitch-accent, UNWRITTEN in Qubee and not in epitran/
the target — a suprasegmental ceiling) and **numbers** (digit tokens; the number WORDS phonemize fine).

## Addendum — 2026-07-28 — Stress/tone: re-confirmed deferred (issue #548, closed invalid)

An espeak-diff over FLEURS flagged "Oromo emits no stress marks" (#548). **Rejected — this repeats the
Run-1 finding** already recorded above ("No stress (non-phonemic, epitran omits it)"; tone "Deferred").

What espeak calls stress, the human source marks as **pitch accent**: in `om.human-kaikki.tsv` every `ˈ`
co-occurs with an acute high tone (ˈlɐ́mɐ, bɪˈʃɑ́ːn, sɐˈɡɐ́l). Three reasons it stays deferred:

1. **The primary referee marks none.** epitran orm-Latn (5,337 entries) has zero; only the 51-entry human
   secondary carries accent, and `om.jsonc` already folds that narrow/allophonic layer to the phonemic backbone.
2. **Not rule-derivable.** Across the 39 accented entries the accent is on the first syllable 19 times and
   later 20 times — an even split. Weight-based placement does not fit either (halkan `ˈhɐ́lkɐn` accents the
   first of two closed syllables, sagal `sɐˈɡɐ́l` the second).
3. **Not recoverable at all.** Oromo pitch accent is grammatical and **UNWRITTEN in Qubee** — the
   information is absent from the input text, so no rule and no model over the orthography can restore it.
   It would need a tone-annotated lexicon; 39 words is not one.

### Is it stress or tone? — TONE, and the distinction matters
Oromo is **tonic, not stressed**. Every `ˈ` in the human source co-occurs with an acute (high) tone, and
Oromo's tone is **grammatical** — it participates in case/number marking. So the Run-1 note "no stress
(non-phonemic)" is right about STRESS but must not be read as "no tone": tone here IS phonemic. What
makes it undeliverable is availability plus conditioning, not irrelevance.

### Source availability — checked 2026-07-28, there is no reference to build from
| source | Oromo IPA | with tone |
|---|---|---|
| kaikki Oromo (5,810 entries) | **53** | **40** |
| wikipron `orm_latn_*` / `gax_latn_*` | **absent (404)** | — |
| epitran orm-Latn (5,337) | programmatic | 0 — omits tone by design |

The 40 tone-marked words ARE the 51-entry referee we already have; there is no larger open set. Compare
Sindhi, where a 29K-word vocalized dictionary existed and changed the answer — here it does not.

### And a lexicon alone would not be enough
Because Oromo tone is **grammatical**, the same lexeme carries different tone by syntactic role
(nominative vs absolutive). A word-level phonemizer cannot resolve that from the word alone — it is a
sentence-level problem, like homograph disambiguation. So the path would be a tone-annotated lexicon
**plus** morphological/syntactic context, not a lexicon lookup.

**Realistic path if ever wanted:** a print reference — Gragg's *Oromo Dictionary* (1982) or Owens' *A
Grammar of Harar Oromo* (1985) — via the OCR route used for Nihalani in the Sindhi bring-up, plus a case
analyzer. Documented here as a known deferral rather than left as an open issue.

Same lesson as the Amharic addendum: an espeak diff flags *difference*, not *defect*.
