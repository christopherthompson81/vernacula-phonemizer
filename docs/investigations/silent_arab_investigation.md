# Silent deletion in the PERSO-ARABIC script languages — triage

`silentCharsIn` (`tools/normalization/defects.ts`, `54dae83`) reports a character that reaches the engine, is
not rejected, and produces nothing. This log triages every character it reports in the Arabic-script half of
the fleet: **legitimate orthographic silence**, **defect**, or **cannot decide**.

Design note and fleet-level reasoning: `docs/investigations/silent_deletion_detector_investigation.md`.

---

## Run 1 — 2026-08-14 09:20 — re-derive the counts, and find every Arabic-script language

**Command.** `npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/<l>.jsonc --lang <l>` for the
ten named languages, plus a census of every mined artifact containing U+0600–U+06FF to catch any that the
brief did not name.

**Question.** What does the detector actually report here, through the shipped code path (the brief's own
probe over-reported because it passed `nativeScript` as undefined, disabling the native-word filter)?

**Raw finding — 39 SILENT characters in 10 languages; two more Arabic-script artifacts report NOTHING.**

| lang | characters (occurrences, mode) |
|---|---|
| arz | ة ×3168 inert · ڤ ×49 inert · پ ×49 **sep** · ی ×24 **sep** · چ ×23 inert |
| ary | ة ×2525 inert · ݣ ×161 **sep** · پ ×119 **sep** · ڤ ×39 inert · ڭ ×25 **sep** · ْ ×10 inert · گ ×6 **sep** |
| ar | ة ×258 inert |
| bal | ِ ×212 · َ ×139 · ُ ×98 · ښ ×10 · ّ ×5 — all inert |
| skr | ً ×32 · ة ×9 · أ ×8 · ۃ ×7 · ك ×5 · ؒ ×5 · ڊ ×4 · ؔ ×3 · ؐ ×3 — all inert |
| pnb | ء ×158 · ى ×34 · ݪ ×6 — all inert |
| ug | ی ×35 · ڧ ×19 · ک ×5 — all inert |
| ps | ً ×13 · ّ ×10 — inert |
| ckb | ك ×12 · ى ×3 — inert |
| fa | ً ×9 — inert |

The character census over all 162 artifacts finds Arabic-block text in `sd` and `ur` as well (the other 12
hits are one-off Arabic quotations inside Latin/Cyrillic/Han corpora). **`sd` and `ur` both scan CLEAN** —
which is itself evidence, since they are the two closest siblings of `pnb`/`skr` and share their front end.

`ary`'s ـ ×429, `arz`'s ×37 and `skr`'s ×3 already report as ACCEPTED-ORTHOGRAPHIC (the fleet-wide tatweel
entry), so the exemption machinery is working as designed.

**Implication.** Seven families to judge: the Darija/Egyptian extended consonants, ⟨ة⟩ and its Urdu-script
twin ⟨ۃ⟩, the harakat, the Arabic-vs-Persian letterform variants, the Urdu honorific signs, the two Lahnda
letters ⟨ݪ ڊ⟩, and ⟨ء⟩.

---

## Run 2 — 2026-08-14 09:45 — ⚠ THE ⟨ة⟩ FINDING IS AN ARTIFACT OF THE SYNC ENTRY POINT

**Command.** The same deletion/space differential the detector runs, but through `phonemizeAsync` instead of
the synchronous `phonemize`, over 10 spread ⟨ة⟩ words per language.

**Question.** `ar "مدينة"` → `mdjn` loses the taa marbuta. Is that the engine, or is it the probe?

**Raw finding — ⟨ة⟩ CONTRIBUTES in 30 of 30 words, in all three languages.**

```
ar   سلسلة  → silsˈila     minus: sˈalsal      CONTRIBUTES
ar   مدينة  → madˈiːna     (sync: mdjn)
ary  الجديدة → alʒadˈiːda  minus: alʒadˈiːd    CONTRIBUTES
arz  منطقة  → mintˈaʔa     minus: mˈantˤiʔ     CONTRIBUTES
```

`arabic.ts`'s own header states it: **there are two entry points and they expect different input.** The
synchronous path assumes VOWELLED Arabic and reads bare text off its consonant skeleton; the async path runs
the neural diacritizer first. `mine.ts scan` calls the synchronous one, so on `سلسلة` it is not only ⟨ة⟩ that
says nothing — every short vowel in the word says nothing. ⟨ة⟩ is singled out only because the OTHER silent
things there are combining marks that are not present in the text at all, so no probe can see them.

**And ⟨ة⟩ is silent by rule anyway.** `arabic.jsonc`'s `convention` block has said so since the engine was
written — `"taaMarbuta": "ة silent in pausal (phrase-final) form"`. The /a/ of `madīna` is the **fatḥa on the
nūn**, not the tāʾ marbūṭa; the letter itself has no segment in pausal form. `diacritizer.ts`'s `pausalize`
makes every word pausal, so this is the whole of the engine's contract, not a phrase-position accident. The
async differential reads CONTRIBUTES only because deleting ⟨ة⟩ also deletes the SEAT that told the diacritizer
to put a fatḥa there.

**Implication.** `ar`/`ary`/`arz`/and the other seven Arabic varieties → **ORTHOGRAPHIC_SILENCE**, on the
writing-system claim, not on the artifact. ⚠ And the same character in `skr` is a DIFFERENT language fact and
gets the opposite verdict — see Run 5.

---

## Run 3 — 2026-08-14 10:05 — the same async re-probe for every other character

**Question.** Which of the remaining 36 findings are also sync-path artifacts?

**Raw finding — only `fa` ⟨ً⟩. Everything else is silent on BOTH paths.**

| char | async result | reading |
|---|---|---|
| ary ⟨ْ⟩ sukūn | INERT (9/9) | correct — a sukūn is the mark for NO vowel |
| arz ⟨ی⟩ | **SEPARATOR** (5/10), and the fragments are read as LETTER NAMES: `فین → fˈe nˈuːn` | defect |
| fa ⟨ً⟩ | CONTRIBUTES (7/7) — `تقریباً → taqɾiːbanˈaː` | sync artifact |
| ps ⟨ً⟩ | INERT (9/9) — `تقریباً → t̪əqribˈɑ` | defect |
| skr ⟨ً⟩ | INERT (8/8) — `تقریباً → t̪əqɾˈiːbaː` | defect |
| bal ⟨ُ⟩ | INERT (10/10) — `بُته → bt̪h` | defect |
| pnb ⟨ى⟩ | INERT in 6 of 10 — `عوامى → əʋˈaːm`, `آبادى → aːbˈaːd̪` | defect |

⚠ `fa` has a neural vowel restorer on its async path and it DOES read the tanwīn — badly (`daqiːqnˈaː` for
`daqīqan`, the /n/ landing before the /aː/ instead of after), but it reads it. That is a separate quality
problem in an existing subsystem, not a silent deletion, so ⟨ً⟩ in `fa` is **not this class's business** and is
recorded here as a measurement artifact rather than fixed. `ps` and `skr` have no such pre-pass, and there the
same character really is deleted.

**Implication.** ⚠ The general lesson for this detector: **in a language whose shipped path is ASYNC, a SILENT
finding must be re-probed through `phonemizeAsync` before it is believed.** Two of the six largest findings in
this half of the fleet (⟨ة⟩ ×5,951 across three languages, `fa` ⟨ً⟩) evaporate on that probe.
