# Silent deletion in the CYRILLIC-script languages — the soft/hard signs and the dictionary stress mark

The brief: triage and fix `silentCharsIn`'s findings in `chv tt ky mn tg ba ab` and any other Cyrillic
language the detector reports. Two questions that are NOT the same one — ⟨ь⟩/⟨ъ⟩, which have no segment of
their own but are not necessarily silent, and ⟨U+0301 COMBINING ACUTE⟩, which is not a letter at all and was
SPLITTING words in half.

---

## Run 1 — 2026-08-14 09:10 — re-derive the counts through the shipped path

**Command.** `npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/<l>.jsonc --lang <l>` for every
Cyrillic-majority artifact — ab ba be bg chv kk ky mk mn ru sr tg tt uk (14, selected by counting Cyrillic
letters in each of the 162 artifacts, not from a language→script table).

**Question.** The brief's numbers came from a probe with a filter disabled. What does the instrument actually
report?

**Raw finding.** Eight languages, and the brief's numbers are low by roughly 1.4× on the soft sign:

| language | reported |
|---|---|
| chv | ь ×364 inert · ъ ×16 inert · U+0301 ×5 separator |
| tt | ь ×275 inert · U+0301 ×5 separator |
| ky | ь ×196 inert |
| ab | U+0301 ×43 inert · щ ×7 inert |
| tg | ь ×34 inert · U+0301 ×7 separator |
| be | U+0301 ×17 separator |
| ba | ӊ ×11 · ѳ ×7 · U+0301 ×5 separator |
| mn | ъ ×9 · ї ×8 · U+0301 ×3 separator |

`bg kk mk ru sr uk` report nothing. **be is in the class and was not in the brief's list** — its only finding
is the combining acute, which is exactly the character the brief predicted would be one fix for everybody.

**Implication.** Three separate families, not one: (1) the stress mark, cross-fleet; (2) the soft/hard signs,
per language; (3) a small homoglyph family — ba ⟨ӊ ѳ⟩ and mn ⟨ї⟩ — that nobody had named.

---

## Run 2 — 2026-08-14 09:40 — the combining acute is a FLEET defect, not a Cyrillic-corpus one

**Command.** A direct probe of one stress-marked word per Cyrillic engine, and the same word with the mark
removed by hand.

**Question.** Which engines split, and does `ru` — the one with real palatalisation machinery — get it right?

**Raw finding — 14 of 14, `ru` included.**

```
ru   А́страхань  → a strˈaxənʲ      (mark removed: ˈastrəxənʲ)
be   Абіса́ль    → abʲisa lʲ        (abʲisalʲ)
tt   А́страхань  → ˈɑ strɑˈxɑn      (ɑstrɑˈxɑn)
mn   кабу́л      → kʰap ɮ           (kʰapʊɮ)
kk   аба́й       → ɑbˈɑ jˈə         (ɑbˈɑj)
uk   Ки́їв       → kɪ jiu̯           (kɪjiu̯)
bg   мля́ко      → mlʲa kɔ          (mlʲakɔ)
mk   ма́јка      → mˈa jkˈa         (mˈajka)
…ba ky chv tg ab all the same shape; only sr declines, because it strips marks itself.
```

Every Cyrillic engine in this repo tokenizes on the BLOCK RANGE `[Ѐ-ӿ]+`, and U+0301 is outside it. The word
breaks in two and both halves are then read AND STRESSED as words. `ru bg kk mk uk` never appeared in Run 1
only because their artifacts happen not to carry one — the defect is in the engines, not in the corpora.

**Implication.** This belongs in `src/core`, per the brief's second option. A per-engine token-class widening
would have to be written 14 times and would leave the 15th.

---

## Run 3 — 2026-08-14 10:20 — the fold, and why a blind strip would DELETE LETTERS

**Command.** `foldCyrillicStressMarks` in `src/core/unicode.ts`, wired into `registry.ts`'s `foldPass` after
`foldCyrillicConfusables` (which pulls a Latin look-alike INTO the Cyrillic word — running the mark fold first
would leave the annotation sitting on a Latin `a` and miss it).

**Question.** Can the mark simply be stripped from a Cyrillic base?

**Raw finding — NO, and this is the one trap in an otherwise trivial fold.** Macedonian ⟨ѓ⟩ and ⟨ќ⟩ ARE
⟨г⟩/⟨к⟩ + U+0301 under NFD, and ⟨ѐ⟩ ⟨ѝ⟩ are ⟨е⟩/⟨и⟩ + U+0300. Those are LETTERS of the alphabet, and a
copy-paste can deliver them decomposed. So each base+mark pair is composed with NFC first: a pair that
composes to a single character is a letter and is KEPT (in composed form, which is also what the token class
wants); only a pair that does not compose loses its mark. U+0340/U+0341, the deprecated tone-mark spellings,
fall out of the same check.

⚠ The mark is DROPPED, not HONOURED. None of these engines takes a per-word stress argument — stress is by
rule (Turkic oxytone, Chuvash last-full-vowel, Tajik final) or by lexicon (`ru`'s `stress.tsv`) — so honouring
the annotation means plumbing an override through fourteen engines for a character that occurs a few dozen
times per corpus. Dropping it restores the correct SEGMENTS, which is the defect. Checked on the case where
the two could disagree: `ru А́страхань` now reads `ˈastrəxənʲ`, the lexicon's own stress, which agrees with the
annotation.

---

## Run 4 — 2026-08-14 10:55 — the fleet measurement, because it went into core

**Command.** A pristine tree extracted read-only at HEAD (`git archive HEAD | tar -x`, `node_modules`
symlinked — no `checkout`, no `stash`), the same script run against both trees, dumping `lang → reading` for
every mined line in all 162 artifacts that carries any of the four marks, then a line-by-line diff.

**Question.** Does a core fold move a language it should not?

**Raw finding.** 649 lines across 34 languages carry one of the marks. **57 readings change, in 21 languages,
and every one of them is a word being rejoined.** The other 592 lines are byte-identical, and the 128
artifacts with no mark at all cannot move: the function early-returns the input when no mark is present.

**⚠ THIRTEEN OF THE 21 ARE NOT CYRILLIC LANGUAGES**, which is the finding that justifies applying the fold for
every language rather than for `CYRILLIC_HOSTS`. A Russian gloss inside a foreign article is routed to the
Russian reader by the script router, and it was splitting there too:

```
hyw  Со́фия                → so fʲˈijə          → sɐfʲˈijə
oc   Васи́лий Ива́нович     → vˈasʲɪ lʲij ˈivə nˈovʲɪt͡ɕ → vɐsʲˈilʲɪj ɪvˈanəvʲɪt͡ɕ
ti   сбо́рная … футбо́лу    → zbo rnˈajə … fˈudbə ɫu   → zbˈornəjə … fʊdbˈoɫʊ
hak  Новосиби́рская о́бласть → nˈovəsʲɪbʲɪ rskˈajə o bɫasʲtʲ → nəvəsʲɪbʲˈirskəjə ˈobɫəsʲtʲ
```

Movers: ab arz awa ba be chv fi gan hak hyw ky mai mn nya oc shi syl tg ti tk tt.

**Implication.** Ship in core. The discriminator is the BASE CHARACTER, not the host language, and the fold
makes no claim about the same mark on a Latin, Greek or Devanagari base — where it is a tone or stress LETTER.

---

## Run 5 — 2026-08-14 11:30 — what ⟨ь⟩ does, per language, from the referees rather than from Russian

**Question.** The brief's first question. Russian's ⟨ь⟩ palatalises the preceding consonant. Do chv, tt, ky
and tg share that convention, and do their engines simply lack the mechanism?

**Command.** Grep the independent referee TSVs in `tools/referee-eval/referees/` for headwords containing ⟨ь⟩
— i.e. ask a published transcription rather than reason from Russian.

**Raw finding — the four languages answer DIFFERENTLY, and only one of them is Russian-like.**

| language | referee row | verdict |
|---|---|---|
| chv | `выльӑх ˈʋɯlʲəχ` | **PALATALISES.** The mark surfaces as ʲ on the preceding consonant. A real deletion of a real contrast. |
| tt | `яшь jæʃ` · `дөнья døn.jɑ` · `көньяк ˈkø̞nˌjɑq` | **SILENT.** Word-final it leaves no trace at all, and before ⟨я/ю/е⟩ it is a hiatus mark whose [j] the vowel letter already supplies. No ʲ anywhere in the referee. |
| tg | `автомобиль a v t o m o b i l` · `бисьёр b i s j o r` | **SILENT.** Same shape: no ʲ, and the [j] of `бисьёр` comes from ⟨ё⟩. |
| ky | no ⟨ь⟩ headword in `ky.wikipron-kir-broad.tsv` at all | see Run 7 |

The remaining four languages of the class already handle their sign and were never reported for it:
`ru` has the full softening machinery (`g2p.ts`: "ь/ъ carry no phoneme (ь already softened the preceding
consonant)"), `mn` fronts the preceding vowel (а→æ, о→œ) and says so in its manifest, `ab` treats ⟨ь⟩ as one
of three MODIFIERS (⟨ь⟩ palatal, ⟨ә⟩ labial, ⟨'⟩ pharyngeal) and `ba` routes Russian loans to the Russian g2p
outright.

**Implication.** ⚠ "The soft sign is silent" is a claim per LANGUAGE, and copying Russian's answer to all four
would have invented a palatalisation contrast in three languages that do not have one. chv gets the
mechanism; tt, tg and ky get an evidenced `ORTHOGRAPHIC_SILENCE` entry.

---

## Run 6 — 2026-08-14 12:10 — chv: the mechanism the engine lacked, and where the [ʲ] has to be applied

**Command.** `ь` → a `palatal` flag on the preceding segment in `chuvash.ts`, applied AFTER the voicing pass.

**Question.** Chuvash's referee config already FOLDS `ʲ` away with the note "allophonic, we don't emit it".
Does emitting it after ⟨ь⟩ contradict a decision already taken?

**Raw finding — no, and the config's own note says why.** It records that the referee marks palatalisation
"INCONSISTENTLY (выльӑх→ʋɯlʲəχ and чӗрпӗк→t͡ɕʲø̆rʲpʲɘkʲ mark it, пӗр→pɘr does not)". Every inconsistent case is
palatalisation BEFORE A FRONT VOWEL, which is predictable and stays unwritten here. ⟨ь⟩ is the environment
where it is NOT predictable — before a reduced or back vowel and word-finally, `выльӑх` [ʋɯlʲəχ], `тӑрать`
[təratʲ] the 3sg present against a bare stem. The two decisions do not overlap.

**⚠ THE ORDER IS LOAD-BEARING AND WAS WRONG ON THE FIRST ATTEMPT.** Appending `ʲ` to the segment during the
scan changes the string the voicing table is keyed on — `t` is a row in `voiced`, `tʲ` is not — so every
⟨ь⟩-bearing word would have quietly lost its allophonic voicing. Recorded as a flag and applied after the
voicing pass, `Перечень → pereˈd͡ʑenʲ` keeps both.

`выльӑх → ˈʋɯlʲəχ`, byte-identical with the referee's own row.

**Second chv finding, same file.** ⟨ъ⟩ ×16 is written only in Russian loans and only before an iotated
letter, where its whole job is to keep the glide: `объектов` read `obekˈtoʋ`, losing the [j] of [objekt].
⟨я ю ё⟩ already emit theirs unconditionally, so only the ⟨е⟩ arm needed the environment. → `objekˈtoʋ`.

---

## Run 7 — 2026-08-14 12:40 — ky, and "nothing is attested" re-probed rather than assumed

**Command.** A census of every ⟨ь⟩-bearing word in the ky artifact, since `ky.wikipron-kir-broad.tsv` has no
⟨ь⟩ headword at all to consult.

**Raw finding.** Тянь ×11, роль ×7, Шань ×5, Гумбольдт ×4, Нью ×4, декабрь ×4, Запорожье ×3, премьер ×3,
стиль ×3, октябрь ×3, июль, Сибирь, сурьма, Беларусь, февраль, январь, рельеф, Польша, Болонья, Вильнюс…
**Not one native Kyrgyz word, and there cannot be one:** Kyrgyz has no palatalised consonant series, and ⟨ь⟩
⟨ъ⟩ are in the alphabet solely to spell Russian borrowings. Kyrgyz reads `рубль` as [rubl], not [rublʲ].

**Implication.** A NEGATIVE result, and it is the interesting kind: ⟨ь⟩ ×196 is a legitimate silence, so it
goes to `ORTHOGRAPHIC_SILENCE` with the census as its evidence and reports as a note, not a defect. The same
verdict for tt ×275 and tg ×34 rests on their referees (Run 5) rather than on this argument.

⚠ Recorded because it is exactly the shape the brief warns about: the table is not a hatch, and the reason
these three are in it and Chuvash is not is that four languages that share a character do not share a
phonology.

---

## Run 8 — 2026-08-14 13:05 — the family nobody had named: a pre-Unicode font generation

**Question.** ba ⟨ӊ⟩ ×11 and ⟨ѳ⟩ ×7, mn ⟨ї⟩ ×8 — three characters in two languages, reported by the same
instrument in the same week. Related?

**Command.** Count each against the letter it resembles, in the same artifact.

**Raw finding — one cause, and the ratios settle it.**

| language | intruder | the real letter | ratio | corpus words |
|---|---|---|---|---|
| ba | ѳ U+0473 (fita) | ө U+04E9 | 7 : 1,323 | кѳньяғында, һѳрѳлгән, кѳтѳүлектәр |
| ba | ӊ U+04CA (en-with-tail) | ң U+04A3 | 11 : 921 | уныӊ, кешенеӊ, меӊдән |
| mn | ї U+0457 (Ukrainian yi) | ү U+04AF | 8 : 2,703 | бїр, бїлэг, їр |

Pre-Unicode Cyrillic fonts for these languages had no slots for ⟨ө ү ң⟩ and borrowed Church-Slavonic and
Ukrainian codepoints; text typed on one and pasted into the wiki keeps the wrong codepoint. Every one of the
26 occurrences is a word that exists with the real letter.

**⚠ AND IN BASHKIR THE DELETED VOWEL WAS THE SMALLER HALF OF THE DAMAGE.** `кѳньяғында → knjɑʁɯnˈdɑ` lost its
vowel — and Bashkir routes Russian loans to the Russian g2p by detecting a VOWEL-HARMONY VIOLATION, so a
front-harmony Bashkir word with its only front vowel deleted is one keystroke away from being read as
Russian. The fold therefore runs before `isRussianLoan`, not inside the native scan.

**Implication.** ⚠ NOT a registry-level confusable fold. `foldCyrillicConfusables` maps LATIN look-alikes into
Cyrillic; ⟨ї⟩ is a real letter of the Ukrainian alphabet and folding it fleet-wide would corrupt uk. The claim
is per language and lives in each engine.

---

## Run 9 — 2026-08-14 13:30 — ab ⟨щ⟩: a Russian letter in an Abkhaz article

**Raw finding.** ×7, all in Russian quoted inside Abkhaz text (обращаться, общезападнокавказского), reading
as a HOLE: `обращаться → obraatʼʲsja`. ⟨щ⟩ is not in the Abkhaz alphabet — but neither are ⟨в ф ц⟩, which the
base table already carries at their nearest Abkhaz values (⟨ц⟩ takes the aspirated [t͡sʰ] of the Abkhaz series,
not Russian's [t͡s]). One row on the same principle: ⟨щ⟩ → [ɕ], the value of Abkhaz ⟨ҫ⟩. Length is not written
— Abkhaz has no geminate contrast to carry Russian's [ɕː].

---

## Run 10 — 2026-08-14 14:15 — the gates, before and after, per language

`mine.ts scan` — **every SILENT line in the Cyrillic fleet is gone.** What remains is reported under
`ACCEPTED-ORTHOGRAPHIC`, i.e. visibly decided rather than quietly absent:

| language | before | after |
|---|---|---|
| chv | SILENT ь ×364, ъ ×16, U+0301 ×5 | ACCEPTED-ORTHOGRAPHIC U+0301 ×5 |
| tt | SILENT ь ×275, U+0301 ×5 | ACCEPTED ь ×275, U+0301 ×5 |
| ky | SILENT ь ×196 | ACCEPTED ь ×196 |
| ab | SILENT U+0301 ×43, щ ×7 | ACCEPTED U+0301 ×43 |
| tg | SILENT ь ×34, U+0301 ×7 | ACCEPTED ь ×34, U+0301 ×7 |
| be | SILENT U+0301 ×17 | ACCEPTED U+0301 ×17 |
| ba | SILENT ӊ ×11, ѳ ×7, U+0301 ×5 | ACCEPTED U+0301 ×5 |
| mn | SILENT ъ ×9, ї ×8, U+0301 ×3 | ACCEPTED U+0301 ×3 |

`referee-eval.ts`, before → after, on every language touched (and on ru/uk/mk/kk/bg, which the core fold could
have moved and did not):

```
chv 78/84 → 78/84   (raw exact 36 → 37: выльӑх now matches the referee BEFORE the ʲ fold, not only after)
tt  35/69 → 35/69      ky 805/888 → 805/888     mn 704/1342 → 704/1342, 39/118 → 39/118
tg  3183/3245, 2965/3243, 2741/3245 — all three unchanged
ba  976/2395 → 976/2395    ab 166/206, 677/979 → unchanged    be 7056/7259 → 7056/7259
ru 4306/4540 + 125/128 · uk 47563/50000 · mk 62375/63024 · kk 1207/1400 · bg 45836/46034 + 47388/47616
```

⚠ **Flat is the expected reading and not a null result.** These referees fold `ʲ` away by configuration (chv
explicitly), the ⟨ь⟩ languages' referee rows contain no ⟨ь⟩ headwords in the folded stratum, and the
homoglyph words are not referee headwords at all. The meter that CAN move is `raw exact`, and it moved once,
in the right direction. Nothing regressed.

`corpus-diff.ts emit`/`compare` — lines changed, and the defect counters (DIGIT / SLOT-GAP / RAWMARK /
ZERO-WIDTH / RAW-CAPS / DROP / THROW) **identical before and after in all eight languages**:

```
chv 228/453 (50.3% — ⟨ь⟩ is frequent)   ab 18/404   be 13/458   mn 12/451   ba 8/460
tg 3/454   ky 2/455   tt 2/456
```

`review.ts --lang` — the FAILING count is unchanged for every language (ab 2, tg 2, the other six 1 each,
all of them pre-existing: a missing `normalize.ts`, or DROP classes that predate this work).

`npx tsc --noEmit` clean. `npx vitest run`: **244 files, 4,140 passed, 5 skipped, 0 failed** — including
`test/onnx-optional.test.ts`, which did not time out on this run.

**One golden changed, and it had to.** `test/normalization-silent-deletion.test.ts` pins the whole key set of
`ORTHOGRAPHIC_SILENCE`, which was `["*", "mt"]`. It is now `["*", ab, ba, be, chv, ky, mn, mt, tg, tt]`, and
the test was extended rather than merely widened: it now asserts that tt/tg/ky exempt ⟨ь⟩ and that **chv does
NOT**, which is the whole finding of Run 5 expressed as an invariant.

New tests: 4 in `cyrillic-confusables.test.ts` (the fold, the decomposed ѓ ќ ѐ ѝ that must survive it, the
non-Cyrillic base it must not touch, and a 13-language "one word in, one word out" sweep), 1 each in
chuvash / bashkir / abkhaz and 2 in mongolian, all quoting the pre-fix reading.
