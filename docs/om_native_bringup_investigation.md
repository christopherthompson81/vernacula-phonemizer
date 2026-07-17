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
