# Tigrinya (ti) native bring-up

Tigrinya / ትግርኛ (ti) — North Ethiosemitic (Semitic → Ethiosemitic → North); ~9M speakers (Tigray in Ethiopia +
Eritrea, where it is a working language). Written in the **Ge'ez / Fidäl syllabary-abugida** — the same script as
Amharic (`am`), already in the fleet. Scope gate: trivially PASSES (Ge'ez is one of the world's oldest continuously-
used scripts, with a vast literature; Tigrinya is a national/working language with standard orthography).

## Referees — a genuine two-source setup

- **kaikki tir** (Wiktionary, HUMAN) — the correctness anchor, but **thin: only 26 Ge'ez-script entries carry IPA**
  (from 898 headwords). It shows the exact contrastive features cleanly (ħadɐ, ʕasːɐrtɐ, kʼaflaj).
- **epitran tir-Ethi** (an INDEPENDENT rule-based implementation, PanPhon-family) — run over the 898 kaikki
  headwords → a large corroborating referee. Independent codebase, so NOT the bho circular-clone trap, but it is
  rule-based (a fidelity check, not a second human judgment).

## The engine — a SHARED Ge'ez core

Amharic's fidel→CV lookup + epenthetic-ɨ deletion turned out to be Ethiosemitic-general, so this bring-up first
**extracted `core/geez.ts`** (`makeGeezG2P` + `deleteEpenthetic`) out of `amharic.ts` and re-pointed Amharic at it
(verified byte-identical — the am golden suite still passes). Tigrinya then reuses that core over its own fidel
table. The whole language-specific difference is **`fidel.tsv`** (306 rows, adapted from the Amharic table).

## The split from Amharic — PRESERVED SEMITIC GUTTURALS

Amharic collapsed the historical guttural series; Tigrinya keeps them, and that is the entire phonological story of
the table adaptation (confirmed by BOTH referees):

| Ge'ez series | Amharic | **Tigrinya** | evidence |
|---|---|---|---|
| ⟨ሐ⟩ Ḥäwt, ⟨ኀ⟩ Ḫarm | h | **ħ** (pharyngeal) | ሓደ→ħadɐ, ሉሕ→luħ |
| ⟨ዐ⟩ ʕayn | bare vowel | **ʕ** (pharyngeal) | ዓሰርተ→ʕasːɐrtɐ, ትሽዓተ→tɨʃʕatɐ |
| ⟨አ⟩ ʔälef | bare vowel | **ʔ** (glottal onset) | አፍ→ʔɐf, ኣድሪ→ʔɐdɾi |
| ⟨ኸ⟩ | x | **x** (kept) | — |
| guttural **1st order** | lowered to [a] | **central [ə]** | ʔɐf, ʔɐdɾi (not ʔaf) |

⟨ቀ⟩ (qaf) is rendered **[kʼ]** — the value the *human* kaikki referee uses (kʼaflaj, kʼæɾʃi); epitran renders it
[q], folded to kʼ in the eval. Gemination and the epenthetic 6th-order [ɨ] are UNWRITTEN and handled exactly as in
Amharic (shared core).

## Result

`npx tsx tools/referee-eval/eval.ts ti`:
- **kaikki (human, primary): 96.2% folded (25/26).** The single miss is ሰማይ→səmaj vs the referee's diphthong
  semaɪ̯ (a glide~diphthong notation edge).
- **epitran (independent, secondary): 94.3% folded (847/898).** The residual is the minor ⟨ቐ⟩ letter (epitran
  [qʰ] vs our [kʼ], ~3 words) and epenthetic-ɨ analysis noise (folded).

Folds (see `langs/ti.jsonc`): the epenthetic ɨ (we delete phonotactically per the human referee; epitran keeps all
→ strip both sides), unwritten gemination, q→kʼ, the central-vowel narrow spread (ɐ/æ/e ~ ə), inconsistent glottal
onset marking, r~ɾ.

**Numbers** are implemented and *verified*: the units 1–10 are all attested in kaikki (ሓደ→ħadə … ዓሰርተ→ʕasərtə), so
the cardinal compositor is built on referee-confirmed forms.

## Verdict: 🔷 single-source (conservative)

Two referees corroborate at ~95%, and the defining pharyngeal restoration is confirmed by *both*. But the **human**
anchor is only 26 words, and the large corroborator (epitran) is rule-based — so I keep the verdict conservative at
🔷 rather than claiming 🟢/✅ off a thin human referee. (For calibration: the Amharic sibling is 🟡 with two *human*
referees of ~450 words each.) Deferred/residual: the ⟨ቐ⟩ minor-letter value (no human referee), the stop+ɾ
epenthesis (shared Amharic rule keeps ɨ where kaikki sometimes drops it — folded), tone/gemination are not written.
Gold: `test/tigrinya.test.ts`. Floor `ti: 0.88` (a one-word margin on the 26-word human referee).
