# Hijazi Arabic (acw) native bring-up

Hijazi Arabic / الحجازية (acw) — western Saudi Arabia (urban Mecca/Medina), ~11M speakers. An Arabic **variety** on
the shared engine: a single `hijazi.jsonc` VarietyDef + one line each in the VARIETIES map, the registry, and the
eval map.

## Referee + method

wikipron `acw_arab_broad` (HUMAN, 1891 entries, fully-voweled dialectal IPA — INDEPENDENT). Reflexes read off the
referee empirically:

| Letter | MSA | acw reflex (referee) | example |
|---|---|---|---|
| ق | q | **ɡ** (voiced) | أخلاق→ʔaxlaːɡ |
| ج | d͡ʒ | **d͡ʒ** (RETAINED affricate) | أبجورة→ʔabad͡ʒoːra |
| خ | x | **x** (kept — NOT uvular [χ]) | أخ→ʔax |
| ث | θ | **t** (learned→θ/s) | أثاري→ʔataːri |
| ذ | ð | **d** | أخذ→ʔaxad |
| ظ | ðˤ | **zˤ** | انتظر→antazˤar |

The distinctive Hijazi profile: the voiced ق=[ɡ] **combined with** a **retained affricate ج=[d͡ʒ]** — unlike Egyptian
(ج→[ɡ]) or Levantine (ج→[ʒ]) — and ⟨خ⟩ kept as [x] (unlike the uvular [χ] of Gulf/Libyan). Interdentals merge to
stops/[zˤ]; diphthongs monophthongize (ay→eː, aw→oː).

## Result

`npx tsx tools/referee-eval/eval.ts acw` → **42.5% folded (804/1891)** — in the arz (47.5%) range, the high end of
the Arabic-dialect family, bounded by the same **shared short-vowel restructuring gap** (MSA diacritizer restores
MSA vowels; dialects reduce them). The consonant + diphthong backbone is exact; the residual is the vowel/gemination
tail.

## Verdict: 🔷 (bounded by the shared vowel gap)

Consonant/diphthong shifts verified against an independent human referee, at the family high end. Floor `acw: 0.38`.
Gold: the "Hijazi variety (acw)" block in `test/arabic.test.ts`. Deferred (shared, engine-wide): the dialectal
short-vowel restructuring.
