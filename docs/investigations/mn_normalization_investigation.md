# Mongolian (mn) normalization — investigation log

Chronological. Each entry: the command, the question it answered, the raw finding, and what it changed.
Negative results and dead ends are kept deliberately — they are the point of the log.

## Run 1 — 2026-08-14 ~15:40 — environment and haystack

`npx tsx tools/normalization/sources.ts --lang mn`, with `ESPEAK_NG` / `ESPEAK_PORTABLE` set.

⚠ With those two variables UNSET the tool reports a confident `[NONE]` for every class, in every language —
the same answer for every input, which playbook trap 57 says is not a gate. Set, it reports
`letter-names espeak 35 letters — WIREABLE`, `decimal-point espeak _dpt + espeak _.`,
`fraction-series part`. Everything below assumes they are set.

There is **no FLEURS corpus for Mongolian**. The tier is `tools/corpus/mined/mn.jsonc` (452 segments
retained from a 233,098-paragraph mn.wikipedia dump) plus `attest.ts` against **that same wiki** — a bigger
sample of ONE source, never two. Every `--corpus` flag below is `mined:mn`.

Baseline emitted BEFORE any edit:
`corpus-diff.ts emit --lang mn --corpus mined:mn --out …/mn.before` → 451 utterances.

## Run 2 — 15:50 — read the corpus, then probe the engine on what it actually writes

`mine.ts scan` reported 9 defect classes / 116 instances. The class NAMES were misleading and reading the
instances was required (trap 2): `DROP exponent ×17` is mostly `1206-1635`, a RANGE; `DROP math-sign ×24`
is `250000+орчим`, "over"; `DROP minus ×11` is largely the same hyphen.

Probing the engine on the attested surface forms (the defect list is what the engine produces, not what one
assumes) gave the table now in `normalize.ts`'s header. Three results were worse than expected:

* `3 ° C` → `ɢʊrəf sˈiː` — the Latin scale letter read through the **English** fallback as *see*. Trap 56.
* `3,780km²` → `… ˈʊkm skwˈɛɹd` — an English phrase inside a Mongolian phoneme string, from the same route.
* `АНУ` → `an`, `ОХУ` → `ɔχ`, `МЭӨ` → `me`. The deep orthography's word-final short-vowel DELETION applies
  to acronyms, so they come out **shorter than they went in**. No counter sees this.

## Run 3 — 16:05 — the language-specific checks the brief asked for

**Trap 21 (a plausible count deserves the same suspicion as an absurd one).** `grep -cP '^_[\x{0400}-\x{04FF}]\s'`
on `$ESPEAK_NG/dictsource/mn_list` → 35 rows; `grep -c '\$'` over that block → **0**. They are genuine letter
NAMES (`_б be`, `_л el`, `_й xagas'i:`), not `$directive` rows, and ⟨й⟩/⟨ъ⟩/⟨ь⟩ carry Mongolian's own terms
rather than Russian's, so it is a Mongolian table and not a copy. The seam is genuinely feedable.

**Trap 15 (the same bound suffix is also written with a space) — MEASURED, not assumed.**
`grep -oE '[0-9] (нд|ны|ний|ийн|ийг|аас|ээс|д|т|н|г|р)( |[.,;:]|$)'` → **exactly ONE** spaced instance in
452 segments (`6 сарын 10 нд`), against ~130 glued. So no spaced arm: admitting one for a morpheme the
corpus spaces once is a misfire generator (trap 9). Glued inventory: `-р` ×72, `-нд` ×24, `-ны` ×5,
`-аас` ×5, `-ийг` ×4, `-д` ×4, `-аад` ×4, `-т` ×3, `-ний` ×3.

**Trap 14.** `-р` is not a case suffix — it is the ORDINAL `-дугаар`/`-дүгээр`, and the corpus spells the
series out beside its figures (нэгдүгээр ×5, хоёрдугаар ×5, гуравдугаар ×2, дөрөвдүгээр, тавдугаар ×4,
Зургаадугаар ×2, долоодугаар, аравдугаар ×2). Composing `cardinal + дугаар/дүгээр` under the manifest's own
`backVowels` reproduces **8 of 8** attested spellings, so 8 and 9 are supplied by the rule rather than
guessed. The genuine case suffixes were DECLINED: the range/ablative needs suppletive stems
(зуу→зуунаас, хорь→хориос) that nothing in this tree attests.

## Run 4 — 16:20 — sourcing, and the sense checks that killed one candidate

`attest.ts --lang mn --words хасах,квадрат,дөрвөлжин,куб,цэг,хувь,нэмэх,үржих,километр,метр,сантиметр,миллиметр,килограмм,доллар,төгрөг`

All fifteen came back `attested`, and reading the examples is where the work was:

| word | count/articles | what the examples say | verdict |
|---|---|---|---|
| `хувь` | 112/19 | the % article names its own sign: `хувийн тэмдэг (%)`; `80 хувь нь ислам` | **take** |
| `доллар` | 90/20 | `"$45"-ийг "дөчин таван доллар" ХЭМЭЭН УНШИНА` — a sentence about how the sign is SPOKEN | **take** |
| `цэг` | 74/20 | `Цэг (.) — нь цэг таслал юм`, plus espeak `_dpt tseg` AND `_. tseg` | **take** |
| `хасах` | 33/18 | `хасах ТЕМПЕРАТУРТАЙ болсон үед`; `хасах цэнэгтэй`; corpus `(хасах тэмдэг)` | **take** |
| `куб` | 37/18 | `КУБ МЕТР нь СИ системийн эзэлхүүний нэгж`, naming `дм³` beside it | **take** |
| `квадрат` | 36/18 | bare = the SHAPE and the quadratic function (trap 37); the COLLOCATION `Квадрат километр` is a wiki cross-reference | **take, cautiously** |
| `дөрвөлжин` | 82/17 | every bare hit is `Дөрвөлжин булш`, a bronze-age SQUARE-GRAVE culture; unit use only inside `хавтгай дөрвөлжин километр` ×1 | record as competitor |
| `үржих` | 24/18 | **every** example is biological REPRODUCTION — `өсөж үржих`, bacteria, breeding | **REFUSE `×`** |
| `нэмэх` | 34/15 | attested in the physics paradigm, but the corpus's `+` has a third sense (`250000+орчим`, "over") it does not say | **REFUSE `+`, leave RED** |

Unit articles were the surprise: every one names its own abbreviation in BOTH scripts in its first sentence
(`Километр (Тэмдэглэгээ: км, km)`, `Килограмм (тэмдэглэгээ: монгол. кг, англи. kg)`, `Сантиметр (товчоор см)`).
Key and word in one place — the strongest sourcing a unit table can get.

Letter-name orthography derived from espeak's phonetic mnemonics and **round-tripped through this engine's
own g2p**: all 33 return espeak's segment skeleton once the manifest's three documented conventions are
applied (unaspirated/aspirated series, ⟨л⟩→ɮ, final ⟨н⟩→ŋ, ⟨в⟩→w). Residue: vowel LENGTH on the six
bare-vowel names, left to espeak's mnemonic rather than doubled into an orthography the language does not write.

## Run 5 — 17:00 — first corpus diff, and the defect it found that no probe did

`corpus-diff.ts compare` → 205/451 changed, DROP 98 → 35. **Reading the sampled changes** (not the counts)
found the single worst bug of the run:

* `arəf kʰm ,` unchanged — the unit step's right-hand guard carried `.` and `,`, so it **declined every
  clause-final unit figure**: `4205 м.`, `610 км,`, `14620 км².`, `150 мм.`, `78 кг,` — **25 instances**.
  The guard bought nothing (a dotted version is rejected by the LEFT anchor before the right one is
  consulted). This is Luganda's review finding #3 reproduced verbatim on another language.

## Run 6 — 17:05 — adversarial-neighbour probes (trap 8)

Probing shapes the corpus does NOT contain found three more, all of which the diff had scored as clean:

1. `1974,1977 онуудад` → *…дөрөв ЦЭГ мянга…* — a comma-separated LIST OF TWO YEARS read as one decimal,
   with the clause pause deleted. The comma arm is now capped at two fractional digits (comma+1 ×16,
   +2 ×5, +3 = a thousands group, +4 = a list ×2); the dot arm needs no cap.
2. `5%-д` → `5 хувь-д` — the bare percent arm consumed the sign and stranded an unhandled suffix. It now
   refuses a following hyphen outright (trap 53: refuse the whole match, never half of it).
3. `20° 30'` claimed as a temperature. The coordinate refusal now allows the space, though `° \d` is ×0
   here — widening a REFUSAL can only cost a reading, never invent one.

A guard was also **measured and then NOT added**: a percent redundancy guard. `%[^.!?]{0,25}хув` returns
exactly one hit and it is a false positive (`2.4% байсан бол ядуурлын ХУВЬ` — the ordinary noun "rate" in
the next clause). That is Luganda's review finding #2 caught before shipping.

## Run 7 — 17:10 — second corpus diff, and the id `US$` defect

Reading again: `$15 саяыг` → *арван тав ДОЛЛАР саяыг*, "fifteen dollars million". The magnitude word is
part of the quantity and the currency name goes after all of it — the corpus states its own order three
times in the sign-less form (`$2,5 тэрбум АМ.ДОЛЛАР`, `26,8 тэрбум АМ.ДОЛЛАР`, `10 их наяд АМ.ДОЛЛАРТАЙ`).
A CASE-MARKED magnitude now refuses the whole match, because the case belongs on `доллар` and this layer
cannot move it.

## Run 8 — 17:20 — gates

* `tsc --noEmit` clean; `vitest run` 4285 passed / 1 pre-existing environmental flake (`onnx-optional`
  times out at its 5 s limit under four concurrent agents; it passes on a quiet run and touches nothing here).
* `mine.ts scan`: percent 31→0, currency 16→0 (2 now REDUNDANT), exponent 17→2, degree 10→3, minus 11→4.
* `review.ts --lang mn`: **deliberately 2 FAILING** — `minus` and `plus` are absent from
  `ACCEPTED_SIGN_SILENCE` because each is a sourcing gap with a reading still to find.
* `referee-eval mn`: byte-identical before and after (256/1342 raw, 704/1342 folded, 87.0% symbol accuracy).
  Proved twice — once by disabling the call and re-running, and once by checking that of **1,463 referee
  tokens exactly ONE is altered by the normalizer**: `ХДХВ`, whose referee transcription is
  `xeː.teː.xeː.ˈweː` — хэ дэ хэ вэ — i.e. an independent third source for four of the 33 letter names.

## Run 9 — 17:22 — baseline integrity (concurrent-agent hazard)

The session scratchpad root is SHARED between the four language agents in this batch, and one of them had a
file clobbered mid-run. The baseline was therefore re-derived rather than trusted: a detached worktree at
the branch point `ef8f24a`, `emit` from there, and `diff` against the original — **byte-identical**. Then
re-run once more with MY `defects.ts` copied into the pinned tree, so the RULER is the same on both sides
and only the ENGINE differs: same result, 207/451 changed, DROP 98 → 36. Worktree removed afterwards.

## Residue — deliberately left

* `minus` RED: the range hyphen (112 digit-hyphen-digit shapes) needs the ablative, which is suppletive and
  unattested here. `plus` RED: `250000+ орчим` and the judo weight classes `+100 кг` mean "over", which
  `нэмэх` does not say.
* `version-dot` ×227 corpus-wide: every `\d.\dX` in the RETAINED text is a decimal glued to a unit and the
  unit step (which runs first) claims it, so there is no evidence here to build a `802.11n` guard from.
  This is the fleet-level ordering gap trap 46's last bullet records as not done.
* `kW` ×8, `mb` ×1, `₮` (the sign is ×0), the clock (2 of 14 colons are times of day and both already carry
  `цагт`), the era phrase, the rate.

## One observation for `src/core` — reported, NOT edited

`makeUnreadableTest`'s consonant-run rule breaks a 3+ run only when it contains an **ASCII** `[lr]`, so for
Cyrillic the Mongolian liquids ⟨л⟩/⟨р⟩ never satisfy it. It is the same family as trap 1's `\b`. No
Mongolian instance changes verdict because of it (the corpus's caps runs are decided by the vowel test or
by an onset/coda rule first), so this is a latent robustness issue, not a live defect — but it applies
equally to ky, ru, uk and tg, which is why it belongs to a reviewer and not to this commit.

⚠ **SUPERSEDED BY RUN 16 — it is LIVE, not latent.** The claim above was made by inspecting the acronyms and
not by measuring the word types. `ХӨГЖЛИЙН`, an ordinary word inside a shouted title in an otherwise
lowercase paragraph, IS spelled out today. See Run 16 for the numbers.

---

## Run 12 — 2026-08-14 ~18:05 — review findings, reproduced before anything was changed

Seven findings arrived from review. Every one was RE-RUN through `normalizeMongolian` + `phonemize(…,"mn")`
before a line was edited, because a finding is a hypothesis until it is executed. All seven reproduced:

```
"АНУ"                 → "АНУ"                    → an          ⚠ the ⟨У⟩ eaten
"ОХУ"                 → "ОХУ"                    → ɔχ
"УИХ"                 → "УИХ"                    → ʊəx
"ОУ"                  → "ОУ"                     → ɔ           ⚠ one phoneme for two letters
"НҮБ"                 → "НҮБ"                    → nup
"МЭӨ 200"             → "МЭӨ 200"                → me …
"Төсөв 500 € Европт"  → "Төсөв 500 Европт"       ⚠ sign DELETED, no word emitted
"350 000, 160 000."   → unchanged                → … tʰæw tʰeɡ , … t͡ʃar tʰeɡ .
"$2.5 тэрбум ам.доллар" → "2 цэг 5 тэрбум доллар ам доллар"    ⚠ said twice
"$2,5 тэрбум ам.доллар" → "2 цэг 5 тэрбум ам доллар"           ✓ the comma form was fine
"5°f"                 → "5 хэм"                  ⚠ a confident CELSIUS reading of a Fahrenheit figure
"5°F"                 → "5°F"                    ✓ correctly refused
"5 км-т"              → "5 километр-т"           → … kʰiɮɔmetʰr tʰ
"1 234 567"           → "1234 567"               (latent, ×0 here)
```

The decisive one is the first block: **the acronyms the header cites as the seam's own motivation are
exactly the ones the seam does not claim.** `isUnreadableMongolian` returns FALSE for all six — they are
vowel-bearing with legal onsets and codas — `isRecorded` is hard-false, and `acronymLetters` was `[]`, so
the pass returned them untouched. 17 shapes closed, ~38 retained instances left open, in the corpus's
second-largest cell (`initialism` ×53329).

## Run 13 — 18:10 — the acronym question, decided on evidence rather than on the default

The manifest argued for the empty list: *"a readable string is left readable… the conservative direction."*
That premise is **false in this orthography**, and the file's own trap-56 paragraph says why: `mongolian.ts`
deletes a word-final short vowel and reduces every non-initial one, so the fallback is not a word reading,
it is a SHORTER STRING. The choice is not "letters versus word", it is "letters named versus letters gone".

The manifest also claimed the empty list put Mongolian "in the same position as Kyrgyz, Tajik and Russian".
`grep -n acronymLetters src/languages/*/*.jsonc` — **Russian's list is fifteen entries long** (сша, днк, тв,
ссср, рф …) with its own "deliberately NOT listed" block (СМИ, ООН, НАТО). So the cited precedent was half
wrong, and the half that is right (ky, tg) is the half with no evidence either way.

ADMISSION CRITERION, chosen so it can be re-run rather than re-argued: *the expansion is written out beside
the acronym*, which is what distinguishes an initialism of separate words from a syllabic acronym said as a
word. `attest.ts --lang mn` against the wiki:

```
товчоор АНУ                     1/1   attested   `Америкийн Нэгдсэн Улс (ТОВЧООР АНУ; Англи: United States…)`
Оросын Холбооны Улс            10/5   attested   `…албан ёсоор Оросын Холбооны Улс (ТОВЧООР ОХУ, орос. …)`
Нэгдсэн Үндэстний Байгууллага  16/5   attested   `Нэгдсэн Үндэстний Байгууллага ТОВЧ. НҮБ (англи. United Nations…)`
Улсын Их Хурал                 66/8   attested   corpus: `Монгол Улсын Их Хурлын дэд даргаар … УИХ-ын гишүүнээр`
манай эриний                   29/20  attested   `…Манай эриний өмнөх анхны зуун … МЭӨ анхны зуун` (one article)
Олон улсын                     51/9   attested   `Олон улсын хөлбөмбөгийн холбоо (ОУХБХ)` — the ОУ- prefix, spelled
товчоор УИХ / МУ / УБ           0      absent
```

So `ану, оху, уих, нүб, мэө, мэ, оу` are admitted and `МУ` ×4 / `УБ` ×4 are NOT — no definitional shape
anywhere, and they lose no letter today ([mʊ], [ʊp]). Also declined: `ДОХ` (AIDS, said as the word *дох*),
`МИАТ`, `МАН`, `ДАШТ`, `ТЭЗҮ`, `ШУА`, `ӨМӨЗО` — the СМИ/ООН row of the Russian file.

Two negative checks, both run:
* Every letter name used (а н у о х м э ө и ү б) was re-read row by row out of `$ESPEAK_NG/dictsource/mn_list`
  (`_а a:`, `_н en`, `_у U:`, `_о O:`, `_х xe`, `_м em`, `_э e:`, `_ө 8:`, `_и i:`, `_ү y:`, `_б be`).
  Nothing is invented; the table was already espeak-derived and this only uses it.
* All seven lowercase forms are **×0** as running words in both `mined/mn.jsonc` and `attest/mn.jsonc`, so
  none of them can spell out an ordinary word of the language.

## Run 14 — 18:15 — the other five, and one judgement call that went the other way

* **`€` inside `Европ`.** A `евро(?!п)` arm would still have claimed `Евроази(йн)` ×2. Counted the
  continuations instead — `Европын` ×12, `Европ` ×4, `Европт` ×1, `Евроази(йн)` ×2 vs `евро` ×2,
  `еврогийн` ×2 — and wrote the needle as the WORD plus an optional case suffix followed by a non-letter.
  An allowlist of the paradigm beats a blocklist of one letter, which the next `Евро-` compound would beat.
* **`GROUP_SPACE` right guard.** Dropped `.`/`,`, matching `GROUP_COMMA` one line above. ×0 in the retained
  text (its three space-grouped figures are followed by `+`, a word and `$`), so this is structural.
* **`currencyWindow`.** Split on `[.!?…](?!\d)`. Verified that step 2 has already turned `ам.доллар` into
  `ам доллар` by the time the window is sliced, so the abbreviation dot is not a terminator either.
* **`°f`.** `scale.toUpperCase() === "F"`.
* **The unit arm's glued suffix — DECIDED THE OPPOSITE WAY FROM THE PERCENT ARM, DELIBERATELY.** The corpus
  writes seven: `100м-ийн`, `200м-ийн`, `265 км-т`, `4000 м-ээс`, `500 мм-д`, `100 кг-н`, `5кг-с`.
  Refusing (the percent arm's policy) would put the bare `[kʰɡ]` cluster BACK, which is the defect the step
  exists to close — the fallbacks are asymmetric even though the morpheme is the same: a refused percent
  sign is SILENT, a refused unit key is NOISE. And where the unit noun ends in ⟨р⟩ the suffix glues on with
  no morphology at all, which is the ordinal step's own mechanism and is attested in the corpus's spelled
  forms (`метрийн` ×7, `метртэй` ×2, `метртэйгээ`, `метрээр`, `метрүүдийг`): five of the seven now read
  `100 метрийн`, `265 километрт`, `4000 метрээс`, `500 миллиметрд`. `килограмм` is not ⟨р⟩-final and
  `килограммн` is not a word, so those two keep the suffix stranded exactly where it already was.
* **`1 234 567`.** Left alone, cost recorded at the rule. ×0 here, and widening the left anchor is a change
  that needs its own measurement.

## Run 15 — 18:20 — gates, and every changed line read

`corpus-diff` against the pre-change branch tip (78973ae): **34/451 changed (7.5%)**, DROP 36 → 36. A
word-level differ over the two emissions enumerated all 34 and every one is accounted for:

```
29 lines  initialism    ɔχ → ɔ xe ʊ ·  an → a eŋ ʊ ·  ʊəx → ʊ i xe ·  nup → eŋ u pe ·  me → em e ө ·  ɔ → ɔ ʊ
 5 lines  unit suffix   kʰiɮɔmetʰr tʰ → kʰiɮɔmetʰrtʰ ·  metʰr iːŋ → metʰriːŋ ·  metʰr eːs → metʰreːs ·
                        miɮɮəmətʰr t → miɮɮəmətʰrt ·  santʰimetʰr tʰ → santʰimetʰrtʰ
```

Nothing else moved: the `€`, `GROUP_SPACE`, `currencyWindow` and `°f` repairs are all ×0 in the retained
text and are structural rather than measured — stated plainly rather than counted as wins.

Whole-commit diff against the branch point `ef8f24a` (baseline re-derived in a pinned worktree with this
branch's `defects.ts` copied in, so only the ENGINE differs): **222/451 (49.2%)**, DROP 98 → 36.

`mine.ts scan --lang mn --in tools/corpus/mined/mn.jsonc` is **byte-identical before and after**
(math-sign ×15, minus ×4, degree ×3, exponent ×2, currency ×1; LEAK kg ×1, mb ×1; REDUNDANT currency ×2) —
the scan cannot see an initialism reading, which is precisely why this finding needed a human. ⚠ And it
corrects one number in the commit message: `DROP currency` is 16 → **1**, not 16 → 0; the residual 1 is
`$55 тэрбумд`, the case-marked magnitude this layer refuses on purpose.

Referee **provably unmoved**: 256/1342 raw, 704/1342 folded, 87.0% symbol accuracy — the same three numbers
as before the change. `review.ts --lang mn` stays at 2 FAILING, the same two (`minus`/`plus` sign classes,
and the artifact scan's deliberate refusals). tsc clean; 4292 tests pass.

## Run 16 — 18:25 — the shared-file defect, upgraded from LATENT to LIVE

Run 11 recorded `makeUnreadableTest`'s ASCII `[lr]` liquid exemption as latent for Mongolian. Measuring it
properly says otherwise. Over the retained text's **6491** Cyrillic word types: **859** carry a 3+ consonant
run, the ASCII exemption fires on **0** of them, and a Cyrillic ⟨л⟩/⟨р⟩ exemption would fire on **525** —
the signal is running with its brake disconnected. And one of them fires in the retained text:

```
“МОНГОЛ УЛСАА АВРАХ ХӨГЖЛИЙН ХӨТӨЛБӨР”  →  ХӨГЖЛИЙН → "хэ ө гэ жэ эл и хагас и эн"
```

`ХӨГЖЛИЙН` is an ordinary word (genitive of *хөгжил*, "development") inside a shouted programme title in an
otherwise lowercase paragraph, so the all-caps-document gate does not exempt it. ⟨гжл⟩ has no ASCII liquid,
so the run is judged unbreakable and the word is spelled out letter by letter. That is a false positive
shipping today. Still **reported, not edited** — the fix belongs in `core/initialisms.ts`, where ky, ru, uk
and tg get it at the same time, and a core change must not ride in on one language's commit.
