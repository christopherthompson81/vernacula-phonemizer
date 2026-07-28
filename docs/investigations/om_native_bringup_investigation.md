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

## Addendum — 2026-07-28 — Stress IMPLEMENTED from a phonetic reference (#548)

**This supersedes an addendum I wrote earlier the same day** which concluded, from 39 kaikki entries
alone, that Oromo prominence was tone and "not rule-derivable". A print reference was then supplied and
it refutes that. Recording the correction rather than quietly replacing it.

**The reference.** Dejene Geshe, *Kamisee Oromo Phonology*, Addis Ababa University MA thesis, 2010
(81 pp., text-extractable). §5.3.1 states plainly that Oromo stress is **phonetic and predictable** —
"there is no lexical contrast by making use of stress, and it could be predictable from the environment
of the utterance" — and §5.4.3 argues the dialect is a **stress language employing pitch, not a tone
language** (explicitly against Habte 2003). Waqo (1981:44) and Gragg (1976:175) report the SAME patterns
for the MECHA dialect, so this is corroborated across two dialects, not one variety's quirk.

**The rules** (§5.3.1, verbatim): monosyllables stressed · disyllabic short-final → penult "whatever the
length of the preceding vowel" · polysyllabic with no long vowel → penult · long-final → ultimate ·
consonant-final → ultimate unless another syllable has a long vowel, which then takes it · (fn16) a
non-ultimate long vowel with a short ultimate attracts the stress.

**Validation — two independent checks, neither circular:**

| gold | result |
|---|---|
| the thesis's own 24 worked examples | **24/24 = 100%** |
| kaikki human accent placement (39 marked entries, Wiktionary — never saw the thesis) | **36/39 = 92.3%** |

The kaikki check is the meaningful one: a print reference from one dialect predicting Wiktionary
transcriptions it has no connection to.

**One refinement beyond the thesis, data-driven.** As written the rules score 76.9% on kaikki; 7 of the 9
misses end in **-uu**, the INFINITIVE suffix (ˈdɪ́duː, ˈbɐ́nuː, ʔɐdʒˈdʒeːsuː). The thesis's rule-4 examples
are all nouns/adjectives in -aa/-oo/-ii — never infinitives — so the suffix appears to be extrametrical.
Treating it so takes 76.9% → **92.3%**. KNOWN LIMIT: a NOUN in -uu is then misread the same way (tiruu
'liver' is tɪˈrúː, we predict the penult); separating them needs morphology we do not have.

**Residual 3 misses:** halkan and afur (consonant-final, all-short — kaikki marks the initial syllable,
the thesis rule says the ultimate; plausibly a dialect difference) and tiruu (the -uu noun above).

**Effect:** `phonemizeWord` now carries exactly one primary stress; `phonemizeWordSegmental` exposes the
unstressed form for the referee eval and the segmental goldens. Referee eval unchanged at **100.0%**
folded backbone (the backbone strips stress by construction), so this cannot inflate the eval.

**Tone remains deferred** and that part of the earlier addendum stands: what other scholars analyse as
lexical tone is not recoverable from Qubee, which writes no tone. But the PROMINENCE that espeak was
marking is stress, it is predictable, and it is now implemented.
