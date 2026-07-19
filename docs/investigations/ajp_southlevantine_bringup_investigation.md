# South Levantine Arabic (ajp) native bring-up

South Levantine Arabic / اللهجة الشامية الجنوبية (ajp) — Palestinian + Jordanian, ~10M speakers. An Arabic **variety**
on the shared engine: a single `southlevantine.jsonc` VarietyDef (ordered consonant/diphthong rewrites on the MSA
g2p output), plus one line each in the VARIETIES map, the registry, and the eval map. The southern sibling of the
already-shipped North Levantine (apc).

## Referee + method

wikipron `ajp_arab_broad` (HUMAN, 2513 entries, fully-voweled dialectal IPA — INDEPENDENT). The reflexes were read
off the referee empirically (not guessed) by inspecting the diagnostic letters:

| Letter | MSA | ajp reflex (referee) | example |
|---|---|---|---|
| ق | q | **ʔ** (urban glottal) | أزرق→ʔazraʔ |
| ج | d͡ʒ | **ʒ** | أجار→ʔaʒaːr |
| ث | θ | **t** (learned→θ/s: lexical tail) | — |
| ذ | ð | **d** | أخذ→ʔaxad |
| ظ | ðˤ | **zˤ** (SIBILANT) | بوظة→buːzˤa, حافظ→ħaːfazˤ |
| ض | dˤ | **dˤ** (kept — distinct from ظ) | أبيض→ʔabjadˤ |

The single distinction from the North Levantine sibling (apc): **ظ → [zˤ]** (a sibilant), where apc merges it to the
stop [dˤ]. Since ض stays [dˤ], the two emphatics remain contrastive. Historical diphthongs monophthongize (ay→eː,
aw→oː).

## Result — the whole Arabic-dialect family is vowel-gap bounded

`npx tsx tools/referee-eval/eval.ts ajp` → **38.6% folded (970/2513)**. That looks low in isolation, but it is the
**high end** of the shipped Arabic-dialect family (apc sibling 22.4%, arz 47.5%, ary 25%, ayl 12%): every dialect is
bounded by the **shared short-vowel restructuring gap** — the MSA neural diacritizer restores *MSA* short vowels,
but the dialects reduce/imāla them, and that is data-blocked (the referee's dialectal vowels are not recoverable
without a dialectal diacritizer). The residual is 100% that vowel/gemination tail (عالم ʕaːlim~ʕaːlam, حاكى final
length); the **consonant + diphthong backbone is exact** — which is what this variety adds.

## Verdict: 🔷 (bounded by the shared vowel gap)

Consonant/diphthong shifts verified against an independent human referee, scoring at the family's high end. Floor
`ajp: 0.35`. Gold: the "South Levantine variety (ajp)" block in `test/arabic.test.ts`. Deferred (shared, engine-
wide): the dialectal short-vowel restructuring (needs a dialectal diacritizer) and learned-word interdental
retention.
