# Central Kurdish / Sorani (ckb) native bring-up

Central Kurdish / Sorani / کوردیی ناوەندی (ckb) — Iranian (Northwestern), ~8M speakers (Iraqi Kurdistan + western
Iran). Written in the **Sorani alphabet**, a modified Perso-Arabic script. This bring-up **complements the already-
shipped Kurmanji** (`kmr`, the Latin-script Northern Kurdish) — same macrolanguage, different standard + script.

## Referees — two human, plus one that failed

- **wikipron ckb_arab_broad** (PRIMARY, human) — 972 entries, broad transcription.
- **kaikki ckb** (SECONDARY, human, Wiktionary) — 1,037 entries.
- **epitran ckb-Arab** exists and runs, but its Sorani transcription diverges from the human referees by ~75%
  (folded match only ~25%) — a different vowel/short-i analysis — so it is **not usable** as a corroborator and is
  dropped. Two human referees is still a solid dual-source setup.

## The script — a near-FULL alphabet, not an abjad

The key fact (shared with Uyghur `ug`, unlike the Arabic/Persian/Urdu abjads): the Sorani alphabet **writes its
vowels**. All the long vowels are written — ⟨ا⟩→aː, ⟨ێ⟩→eː, ⟨ۆ⟩→oː, ⟨وو⟩→uː, ⟨ی⟩→iː — **and** the short /a/
(⟨ە⟩). So a plain left-to-right greedy scan recovers most of the word. The rules:

- **Matres lectionis** — ⟨و⟩ and ⟨ی⟩ are glides ([w]/[j]) word-initially or next to a written vowel, else the
  syllabic vowels [u]/[iː]; ⟨وو⟩→[uː].
- **ئ→ʔ** — the hamza carrier is the word-initial glottal onset (mid-word it just carries its vowel).
- **н→ŋ** before a velar stop.
- Signature consonants: the **pharyngeals** ⟨ح⟩→ħ, ⟨ع⟩→ʕ; the **velarised** ⟨ڵ⟩→ɫ vs plain ⟨ل⟩→l; the **trill**
  ⟨ڕ⟩→r vs the tap ⟨ر⟩→ɾ; ⟨ق⟩→q, ⟨غ⟩→ɣ, ⟨خ⟩→x, ⟨ژ⟩→ʒ, ⟨چ⟩→t͡ʃ, ⟨ج⟩→d͡ʒ.

## The one gap — the unwritten short /ɪ/ (bizroke)

The single vowel Sorani does **not** write is the short **/ɪ/** (the *bizroke*), which is epenthetic in consonant
clusters (ئاسن→ʔaːsɪn). I tried to **predict** it (insert ə to break word-final/internal clusters) — but Sorani
epenthesis is not positionally simple, and the crude rule scored only **71%** (worse than not emitting it). So, as
with the abjad short-vowel wall (`sd`/`ur`/`skr`), the short /ɪ/ is **folded** in the eval — except here the wall is
*much smaller*: it is one vowel, not the whole vowel system (Sorani writes everything else).

## Result

`npx tsx tools/referee-eval/eval.ts ckb`:
- **wikipron (human, primary): 94.9% folded (922 / 972).**
- **kaikki (human, secondary): 94.2% folded (977 / 1037).**

Two human referees corroborate at ~94.5%. Folds (see `langs/ckb.jsonc`): the unwritten short /ɪ/, the inconsistent
glottal onset ʔ, tap~trill r~ɾ (the referee mixes ⟨ر⟩/⟨ڕ⟩), the narrow vowel lowerings (ɑ/æ/ʊ/ɔ), and — because the
shared backbone already strips vowel LENGTH — the glide~high-vowel matres (j~i, w~u). The ~5% residual is genuine
narrow-transcription variation (⟨ە⟩ transcribed a~e, occasional ⟨و⟩→[oː], loan gutturals).

Spot-checks (raw module output): کوردی→kuɾdiː, حەوت→ħawt (pharyngeal), ئاڵا→ʔaːɫaː (velarised ɫ), ڕۆژ→roːʒ (trill),
خۆشەویستی→xoːʃawiːstiː.

## Verdict: 🟡 bounded

Two human referees at ~94.5% folded, with the bound being the one unwritten vowel (short /ɪ/). Solidly better than
the full-abjad bring-ups (`sd` 77%, `skr` 75%) because Sorani writes far more. Gold: `test/central-kurdish.test.ts`.
Floor `ckb: 0.92`. **Deferred:** the short-/ɪ/ epenthesis (would need a lexicon or a proper syllabifier — the crude
rule underperformed the fold), and **numbers** (Sorani number orthography is dialect-variable and not verifiable
against this word-list referee — digits pass through).
