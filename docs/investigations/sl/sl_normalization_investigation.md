# Slovenian (sl) text normalization — investigation log (#562)

Chronological. Each run: the command, the question it answered, the RAW finding, what it implies next.
Negative results and dead ends are kept deliberately.

Corpus: FLEURS `sl_si`, `$ASR_ALIGN_ROOT/corpus/fleurs_transcripts/data/sl_si/{train,dev,test}.tsv`,
**column 3 (0-indexed 2)** — the cased original. 3,695 rows → **1,903 unique cased utterances**.
Artifact: `tools/corpus/mined/sl.jsonc` (already committed; 1,899 segments, 23/30 cells).

---

## Run 1 — 2026-08-02

**Baselines emitted before touching anything** (playbook §"Working concurrently", rule 2 — never `git stash`).

```
npx tsx tools/normalization/corpus-diff.ts emit --lang sl --corpus sl_si --out …/sl.before
  → emitted 1903 utterances
npx tsx tools/referee-eval/eval.ts sl
  → raw exact 88/5177 (1.7%) · folded backbone 4995/5177 (96.5%) · symbol accuracy 99.4%
```

**Question:** is there anything already in `src/languages/slovenian/` to build on?
**Finding:** no `normalize.ts`, and **no symbol tier at all** — `slovenian.ts` calls `assembleClauses` on the
raw input. So every sign class in this language is currently unread. `numbers.ts` already carries a
FOUR-WAY count selector (`agree`: 1 → sg, 2 → dual, 3–4 → paucal, else gen-pl), which is the answer to the
`slavicCountForm` question before it is asked: the shared three-way selector is wrong for Slovene, and this
engine's own data already says what the right one is.

## Run 2 — 2026-08-02 — the `N.` tabulation, and the ordinal-period decision

```
node tab.mjs            # classify what follows every /(?<![\d.,])(\d{1,4})\.(?!\d)/ in column 3
```

**Question:** Croatian (#599) needed a year-ordinal rule; Slovak (#603) measured that the same rule would
have destroyed 14 sentence-final pauses and refused it. Which is Slovenian?

**RAW:** `TOTAL N. = 124` — `lower 95`, `END 26`, `UPPER-word 2`, `COMMA 1`.

All 26 END instances are **sentence periods**, and 18 of them sit right after a YEAR:

```
    veliko nagrado Madžarske leta 2009.        i je na otoku vladala do leta 1945.
    e nad Španijo ni bilo do leta 1818.        dvisnost pa se je začela leta 1839.
    ski invaziji Afganistana leta 1979.        soten najmanj do konca sezone 2009.
    …ekala na Srednjem vzhodu leta 1967.       et pa so ga odprli šele marca 2017.
```
plus `2,2 milijona km2.`, `COVID-19.` ×2, `F1.`, `3:2.`, `1300.`, `16.`, `2010.`, `2011.`, `2005.`, `2007.`, `2016.`.
Both UPPER instances are sentence periods too (`severno od 1770. Občasno …` — 1770 is the Queensland town;
`5. septembrom 2021. Nekaj prireditev …`).

**Implication: NO year-ordinal rule.** Slovene reads a year as a CARDINAL and writes it with no ordinal
period (`leta 1683`, `leta 2002` — 144 corpus years, none dotted mid-sentence). Croatian's rule applied here
would destroy **26 utterance-final sentence pauses**. The discriminator is therefore the plain one —
a LOWERCASE follower is an ordinal, an UPPERCASE word / a quote / the end of the utterance is a sentence
period — and the invariant to measure is *zero utterance-final pauses lost*.

The one COMMA instance is a LIST (`v 11., 12. in 13. stoletju`), so the rule needs a list prefix whose
items all take the head noun's case.

## Run 3 — 2026-08-02 — probing the engine on every attested form

```
npx tsx probe.mts        # phonemize(form, "sl") on the 70 shapes the corpus writes
```

**Question:** what does the engine actually produce, before assuming anything?
**Finding:** there was **no symbol tier for Slovenian at all**, so every sign class was unread. Verbatim:

| form | before |
|---|---|
| `V 16. stoletju` | `ʋ ʃɛstnajst . stɔlɛtju` |
| `19.500 km²` | `dɛʋɛtnajst . pɛtstɔ km` |
| `400.000` | `ʃtiristɔ . nit͡ʃ` |
| `2,4 GHz` | `dʋa , ʃtiri ɡxs` |
| `ob 23.35` | `ɔp triindʋajsɛt . pɛtintridɛsɛt` |
| `93 % prebivalstva` | `triindɛʋɛddɛsɛt prɛbiʋalstʋa` (sign DROPPED) |
| `+30 °C` | `tridɛsɛt t͡s` (both signs dropped, C a bare letter) |
| `70 km/h` | `sɛdɛmdɛsɛt km x` |
| `2,2 milijona km2` | `dʋa , dʋa milijɔna km dʋa` (the ASCII 2 read as a NUMBER) |
| `1418–1450` | `tisɔt͡ʃ ʃtiristɔ ɔsɛmnajst tisɔt͡ʃ ʃtiristɔ pɛddɛsɛt` (dash dropped) |
| `pr. n. š.` | `pər . n . ʃ .` |
| `npr.` / `itd.` / `dr.` / `št.` / `oz.` | `npər .` / `itt .` / `dər .` / `ʃt .` / `ɔs .` |
| `BDP` `DVD` `GMT` `USGS` `NHK` `DNK` `UTC` `DSLR` `ZN` | `ptp` `dʋt` `ɡmt` `usks` `nxk` `dnk` `utt͡s` `tslər` `zn` |
| `B&B-ji` | `p p ji` |
| `3/4` | `tri ʃtiri` |
| `1830-ih` | `… tridɛsɛt ix` |
| `36 x 24 mm` | `ʃɛstintridɛsɛt ks ʃtiriindʋajsɛt mm` |

**Implication:** the layer has to carry the tier as well as the rules, i.e. `slovenian.ts` gets a
`makeSymbolNormalizer` declaration and a Slovene `countForm`. Core is NOT touched — the seam already exists.

## Run 4 — 2026-08-02 — the count agreement, and why the shared selector is wrong twice

**Question:** `slavicCountForm` is three-way. What does Slovene need?
**RAW (token counts, sl_si column 3):** `odstotek` ×1 (*zaposlen samo **en odstotek***), `odstotka` ×1
(*Najsilovitejša **dva odstotka** tornadov*), `odstotki` ×1, `odstotkov` ×11. **All four forms attested in
one corpus.** Also `trije` ×2, `štirje` ×2, `dve` ×10, `en` — the gendered numerals.

`numbers.ts` already selects the magnitude form with `1 ? sg : 2 ? dual : ≤4 ? paucal : plural`, and
`slovenian.jsonc` documents it. So the selector is this engine's own existing decision, not an import: four
way, keyed on the WHOLE numeral, plus a fifth slot for the genitive singular a decimal governs (`1,5 ure`
and `1,5 kilometra na sekundo` are both written in the corpus). **`slCountForm` in slovenian.ts.**

**Dead end worth keeping:** the first version passed `slavicCountForm`, which reads `2 %` as the paucal
*dva odstotki* and `21 %` as the singular *enaindvajset odstotek*. Both are wrong Slovene.

**Second finding, trap 14 in a new place.** Agreement cannot be applied to digits — but for Slovene the
problem is the NUMERAL's gender, not the noun's: the tokenizer reads a bare `1` as *ena* and `3`/`4` as
*tri*/*štiri*, all FEMININE, so a masculine counted noun read *ena odstotek* and *tri kilometri*. Exactly
four cells need repair (m: 1→en, 3→trije, 4→štirje; f: 2→dve) and it can only be done AFTER the tier,
because the noun does not exist until the tier has emitted it. Step 15.

## Run 5 — 2026-08-02 — sourcing, and the letter-name table (trap 16 (before declaring a class out of scope))

```
grep -inE 'letter|^_' $ESPEAK_NG/dictsource/sl_list
```

**Question (trap 16 (before declaring a class out of scope)):** Slovak deferred 119 initialisms to `core/initialisms.ts` and was wrong. Does
Slovenian have the data?
**RAW:** `dictsource/sl_list` opens with `// letter names` and 25 Slovene letters plus `q ku`,
`w dv#'ojniv,@`, `x iks`, `y 'ipsilon`. Every consonant is named with a following SCHWA (`b b@`, `f f@`,
`š S@`) — which Slovene spells ⟨e⟩ and this engine folds [ə]→[ɛ] by its own documented convention. So the
table transcribes back to orthography cleanly: *be ce če de e fe ge he i je ke le me ne o pe re se še te u
ve ze že*. **The seam is wired.** 132 instances over 85 acronyms.

Classifying all 85 through `makeUnreadableTest`: 47 are vowel-less or have an illegal cluster and are
spelled automatically (ZN, BDP, DVD, GMT, GPS, DNK, UTC, DSLR, NBA, FBI, ABC, USD, TV, GP …); 20 are
readable but conventionally spelled and go in `acronymLetters` (**ZDA ×11 is the corpus's single most
frequent acronym** and would have been read as the word *zda*); the rest are genuinely word-read (COVID,
UNESCO, OPEC, ISIS, ASUS, ACTA, REM, EVA, JAS, PALM) and are left to the g2p.

**Negative result:** `PALM` first classified as unreadable because `lm` was missing from `legalCodas`. It is
a legal Slovene coda (*film*, *psalm*, *album*), so the set was wrong, not the word.

**Negative result on the sign words.** espeak's `sl_list` is PHONETIC only; the portable
`data/sl/dictionary.jsonl` has just 116 entries (letters + numerals + symbols), so it adds nothing. Every
sign word therefore comes from a back-transcription of `sl_list` (`% Otst'o:tkOw` = odstotkov,
`$ d'o:laR` = dolar, `& 'i:n` = in, `+ plu:s` = plus, `= En'akO` = enako, `_, v'e:jitsa` = vejica) or from
the corpus. **Four words have no in-repo attestation at all: `štetje` (the era marker), `Celzija` /
`Fahrenheita`, and the SI stems `gigaherc` / `megabit` / `kilogram` / `centimeter`.** All are orthographic
EXPANSIONS of the abbreviation rather than lexical guesses. `deljeno` (÷) and *približno enako* (≈) are NOT
sourceable and the two signs are left unread — 0 corpus instances of either.

## Run 6 — 2026-08-02 — the two hazards the corpus, not intuition, settled

```
node -e '…/(?<![\p{L}\p{M}.,])\d+\s?g(?![\p{L}\p{M}])/…'
```

**Question:** should `g` be declared as *gram* in the tier?
**RAW:** the corpus's ONLY number-adjacent `g` is `802.11g` — the Wi-Fi standard. Declaring it would have
read that letter as *gram*: the `Il-76s` hazard, and trap 15 (the same bound suffix is also written with…)'s third bullet. **Not declared.** `mi` likewise
(it is the Slovene pronoun *we*). The eight letters glued to digits (`802.11a/b/g/n`, `Il-76s`, `JAS 39C`)
get their LETTER NAMES instead, step 19.

**Question (trap 15 (the same bound suffix is also written with…)):** is the `-ih` suffix also written with a space?
**RAW:** `grep` for `\d+ ?- ?(ih|ega|em|im)` gives 2 (`1830-ih`, `ob 5-ih`); the spaced form gives 0.
Both glued instances are the SAME morphology and neither is an ordinal — 1830-ih is the ordinal's genitive
plural *tisoč osemsto tridesetih*, 5-ih the cardinal's locative plural *petih* — and both are stem + `ih`
because the ordinal's stem IS the cardinal there. One rule, guarded on a consonant-final stem so `dva`/`tri`
(whose -ih forms are irregular) are declined rather than guessed.

## Run 7 — 2026-08-03 — the corpus diff, and the one defect only it could see

```
npx tsx tools/normalization/corpus-diff.ts compare --before …/sl.before --after …/sl.after
  → changed 285/1903 (15.0%)
    before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 6, THROW: 0 }
    after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 0, THROW: 0 }
```

**All 285 changes were read, not just the 12 the tool prints.** One defect, invisible to every unit probe
and to the tool's own counters:

```
### 355  … končal z ubojem vrhovnega poglavarja Tupue Tamaseseja Lealofija III.
-  … lɛalɔfija tri .
+  … lɛalɔfija trɛtjɛɡa          ← the SENTENCE PERIOD is gone
```

The regnal rule consumed the ordinal period, which here was doing double duty as the utterance's sentence
end. Fixed by routing it through `keepFinal`. Re-measured afterwards:

```
utterance-final pauses LOST: 0        (and 6 GAINED — keepFinal restoring era-marker sentence periods)
clause-final pause tokens: before 2306 → after 2115   (−191)
```

The −191 is the spurious breaks the layer exists to remove and the arithmetic accounts for it: 95 ordinal
periods + 28 grouping periods + 17 decimal commas + 16 clock marks + ~25 era-marker dots + 6 version dots
≈ 187.

**Second finding, from the artifact scan rather than the diff:** `DROP math-sign ×1` — the `+` of
`(UTC+1)`, where the sign sits between a LETTER and a digit and so escaped the `(^|[\s(])\+` guard. Added a
`(?<=\p{Lu})\+` case; scan is now clean.

**Third finding, from `review.ts`'s ordinary-text probe rather than the corpus:** `5 000` read *pet nič*.
The corpus has **0** space-grouped numbers, so this is trap 8 (zero corpus instances is not evidence of…) exactly — zero instances is not evidence of
correctness. Space de-grouping added; it changes nothing in the corpus. NBSP appears 22 times and always as
an ORDINARY inter-word space, never as a separator, so it is folded to a plain space only AFTER de-grouping.

**Fourth finding: the sourcing check was INERT.** `review.ts` greps the tier's source for
`percent: [...]` and `currency: { ... }`, and the declaration was written as `percent: F("pct")` — a helper
call. The check reported "no percent/currency/decimal word declared" and would have passed a wrong word
silently. Rewritten as literal arrays, with a test pinning them against `COUNTED` so the two copies cannot
drift, and `decimalWord` moved into `slovenian.jsonc` where the check reads it. It now reports
`dolarja, dolarji` — the regular dual-genitive and nominative-plural of `dolar`, whose lemma is in espeak's
Slovenian dictsource and whose genitive plural is in the corpus ×8. Argued, not silenced.

## Run 8 — 2026-08-03 — gates

```
npx tsc --noEmit                                              → clean
npx vitest run                                                → 201 files, 2753 tests, all pass
npx tsx tools/normalization/mine.ts scan --lang sl            → no defects
npx tsx tools/normalization/review.ts --lang sl               → all ok, one argued ?? (above)
npx tsx tools/referee-eval/eval.ts sl                         → raw 88/5177 (1.7%) · folded 4995/5177
                                                                 (96.5%) · symbol 99.4% — IDENTICAL to main
npx tsx tools/normalization/corpus-diff.ts compare            → 285/1903, DROP 6→0, 0 pauses lost
```

The referee figure is unchanged because this layer touches only text the referee's headword list does not
contain — which is the point of measuring it.

## Run 9 — 2026-08-03 — the score rule, and two misfires the corpus diff caught after it

**Question:** the corpus's non-clock `\d+:\d+` pairs and one en-dash pair — what are they, and does the
range rule claim any of them wrongly?

```
node -e '…/(?<![\d.,])\d{1,2}:\d{1,2}(?![\d])/…'   # colon pairs the clock rule left behind
node tok.mjs proti                                  # 39
```

**RAW:** seven instances, none of them a time and two of them being read as a RANGE by the rule shipped in
Run 7: `zmagala 26:00 proti peti nosilki`, `s 5:3 proti Atlanta Thrashersom`, `razmerje … je torej 3:2`,
`prislužil 2:2 (diplomo nižje druge stopnje)`, `po rezultatu 6-6`, and **`Nadalov rekord v dvoboju proti
Kanadčanu je 7–2`, which read *sedem DO dva*** — a score turned into a range.

The corpus writes the joiner out twice, in exactly this function: **`zmaga za eno točko, 21 proti 20`** and
**`razmerje ena proti štirideset`** (`proti` ×39 overall). And the discriminator is DIRECTION: a range runs
upward, a score does not. So step 5a claims a non-ascending short pair, or any colon pair, as
`a proti b` — suppressed to `a b` when the sentence already writes *proti* right after it (trap 12 (a REDUNDANT symbol is a permissible drop):
`26:00 proti peti nosilki` states it once).

**Then the corpus diff caught two misfires of the new rule** (trap 9 (a guard alternative with no attested…) — widening a guard needs the same
discipline as writing one):

```
### (Larson in LaFasto, 1989: 109).
+  … dɛʋɛtinɔsɛmdɛsɛt prɔti stɔ dɛʋɛt .      ← a PAGE CITATION
### … dal 60 ali več golov od leta 1995–96, ko sta …
+  … pɛtindɛʋɛddɛsɛt prɔti ʃɛstindɛʋɛddɛsɛt  ← a SEASON
```

Both fixed by bounds the shapes themselves supply: a score field is never three digits and a score's mark is
never spaced (excludes the citation), and a 4-digit + 2-digit pair is a season, refused by both the score
rule and the range rule (Slovene reads it as the bare pair). The season was surviving only by accident
before — the rule's trailing guard happened to reject the comma after it — so the refusal is now explicit.

`2:2 (diplomo nižje druge stopnje)` is a British degree classification and is indistinguishable from a
score; *dva proti dva* is no worse than the phrase break it replaces. 1 instance, stated rather than hidden.

Final: **291/1903 changed, DROP 6 → 0, 0 utterance-final pauses lost**, mid-utterance pause tokens
3436 → 3216 (the spurious breaks removed), referee IDENTICAL to main.

## Deliberately not done, with a COUNT for each

| item | count | why |
|---|---|---|
| `0230 UTC` — a 4-digit military time | **1** | `Number("0230")` is 230, so it reads *dvesto trideset*. The leading zero is lost in the TOKENIZER's `\d+` → `Number()` path, which every language shares; a normalization rule for it would be keyed on a timezone-code follower and claim exactly one shape. Measured across the whole corpus: this is the ONLY leading-zero digit run left once the clock rule takes `07:19`. Reported, not fixed — it is a core seam. |
| `jardov/metrov` ×2, `Džakarju/Bumthangu` ×1 — the slash meaning "or" | **3** | The slash drops silently and the two words read adjacent, which is what a listener hears. *ali* is attested (×15) but choosing it is an interpretation of intent, not an orthographic fact, and the alternative (*poševnica*, espeak's word) would be worse than the silence. |
| `360-km gorska veriga`, `35-mm negativa` — the compound-adjective morphology | **2** | The hyphen is now folded so the unit WORD is right (*kilometrov* / *milimetrov*); Slovene wants the adjective *360-kilometrska* / *35-milimetrski*, which needs a derivational rule per unit. The audible defect (raw `[km]`, `[mm]`) is gone. |
| `21-letni`, `24-urne`, `100-metrska`, `53-letne`, `35-milimetrski`, `13-letni`, `16-letni`, `25-letni`, `28-letni`, `30-letni`, `48-letni`, `64-letni`, `8-krat`, `90-krat` | **14** | The hyphen is skipped by the tokenizer and the parts read as two words where Slovene writes one. No stress is emitted by this engine, so the concatenation is phonemically identical — **0 audible change** — and `8-krat` → *osem krat* is already correct. |
| `pH vrednost` — a MIXED-case initialism | **1** | Not an all-caps run, so `core/initialisms.ts` cannot see it; reads `[px]`. The same sentence writes `pH` again inside a parenthesis, so a rule would have to claim both or neither. |
| `Inc.`, `St.`, `et al.` — the DOT is removed, the word is not expanded | **3** | The pause was the defect and it is fixed. There is no Slovene source for any of the three: the corpus's only `Saint` is the composer Saint-Saëns, and `Inc`/`al` are not Slovene words. They read `[int͡s]`, `[st]`, `[al]`. |
| `2:2` read as a score | **1** | A British degree classification, orthographically identical to a score. See Run 9. |
| `÷` and `≈` | **0** | Neither *deljeno* nor *približno enako* is in the corpus, the referee, or espeak's Slovenian data. The playbook's rule is to leave the symbol unread rather than invent its word. |
| fraction denominators above 10 | **0** | The composed 2–10 table covers every shape the corpus writes and the obvious neighbours; above 10 the noun is *enajstina*, *dvanajstina* … which is regular but unattested anywhere in repo. |
| STRESS | n/a | `slovenian.ts` emits no stress mark at all — Slovene stress is free, lexical and unwritten, and a stress lexicon is the deferred fix recorded in `docs/investigations/sl/sl_native_bringup_investigation.md`. Not this layer's seam. |

## A core gap, measured and NOT fixed

`review.ts`'s sourcing check greps the tier's source for `percent: [...]` and `currency: { ... }`. A
declaration written through a helper (`percent: F("pct")`) makes the check silently INERT — it prints
"no percent/currency/decimal word declared" and passes. This layer worked around it by writing literal
arrays plus a drift test, but the check itself would report the same false clean for any future language
that factors its tier data. `tools/` is out of scope for this branch, so it is recorded here instead.

## Run 14 — 2026-08-03, review before merge

Rebased onto `main`. **The core gap this PR reported is already fixed there** — `review.ts`'s sourcing check
going silently inert on a helper declaration was committed as `3ddd6d4` after the report, so the gate is now
live, and this layer's literal-array workaround is what the gate wants anyway. The checklist comes back clean
on all eight lines, including `sourcing: all 5 high-traffic words attested` — the `??` the PR argued for
`dolarja`/`dolarji` is resolved by main's inflection-tolerant matching, so there is nothing left to argue.

The review worked the 9-item "deliberately not done" list. **One item was misattributed and is now fixed;
one claim was verified rather than accepted; the rest hold.**

### `0230 UTC` — deferred as a core seam, and it is not one (trap 17 (a "too big to do here" item is a count))

The reasoning was: `Number("0230")` is 230, the loss happens in the tokenizer's `\d+` → `Number()` path that
every language shares, so it is core. The first half is true and the second does not follow — **the layer
never has to let those digits reach the tokenizer.** Before:

```
(0230 UTC)  →  dʋɛstɔ tridɛsɛt u tɛ t͡sɛ      "two hundred thirty UTC"
```

This is the same shape Oromo and Luxembourgish each claim in their own layers (`12.00 GMT`, `15.00 UTC`), and
the machinery was already in this file: `clock()` plus the governing-preposition slot. Added as an arm of
step 3:

```
(0230 UTC)            → (druga ura trideset u te ce)          nominative, no governing preposition
ob 0230 UTC v sredo   → ob drugi uri trideset u te ce v sredo  locative, from *ob*
(1500 po UTC)         → (petnajsta ura po u te ce)
```

**The zone label is the whole licence**, and that is what makes the rule safe: a bare four-digit run is a
YEAR far more often than a time, and this corpus writes **116** of them. Pinned in both directions —
`leta 1230`, `leta 2010 in 1995` and an unlabelled `ob 0230` are all untouched.

Trap 17 exactly: the deferral was a framing, not a count.

### The ×14 hyphen compounds — the claim is TRUE, and now proven rather than asserted

The largest item on the list, deferred on the grounds that *"this engine emits no stress, so the
concatenation is phonemically identical — 0 audible change"*. That is a claim about the g2p, and it would be
false if any word-boundary phonology existed (Slovene has final devoicing and voicing assimilation, so a
split compound could plausibly differ at the seam). Measured:

| written | split reading | one-word reading | identical |
|---|---|---|---|
| `21-letni` | `ɛnaindʋajsɛt lɛtni` | `ɛnaindʋajsɛtlɛtni` | ✓ |
| `24-urne` | `ʃtiriindʋajsɛt urnɛ` | `ʃtiriindʋajsɛturnɛ` | ✓ |
| `100-metrska` | `stɔ mɛtərska` | `stɔmɛtərska` | ✓ |
| `8-krat` | `ɔsɛm krat` | `ɔsɛmkrat` | ✓ |

Verified and pinned, so that if a stress lexicon or boundary rule is ever added the test fails and the
deferral is revisited — which is the point of pinning a claim rather than a behaviour.

(`360-km` is NOT identical, and in the right direction: the hyphen-fold expands the unit to *kilometrov*
where the bare concatenation leaves `km` raw. My first comparison string was artificial.)

### The rest, upheld

- **the slash meaning "or" ×3** — *ali* is attested but choosing it is an interpretation of intent, and
  espeak's *poševnica* is worse than the silence. Consistent with xh (10 instances) and Malay's `ela/meter`,
  both left for the same reason, and the operands read as separate tokens either way.
- **`360-km` / `35-mm` compound-adjective morphology ×2** — the audible defect (raw `[km]`, `[mm]`) is gone;
  *360-kilometrska* needs a derivational rule per unit.
- **`pH` ×1** — mixed case, so `core/initialisms.ts` cannot see it by construction.
- **`Inc.` / `St.` / `et al.` ×3** — the pause was the defect and it is fixed; no Slovene source exists for
  any of the three, and the corpus's only `Saint` is the composer Saint-Saëns. Identical evidence to sk
  (#603), where I reached the same conclusion independently.
- **`2:2` ×1** — a British degree classification, orthographically identical to a score; *dva proti dva* is
  no worse than the phrase break it replaces.
- **`÷` `≈` (0), fraction denominators above 10 (0)** — unsourceable, zero instances.
- **STRESS** — `slovenian.ts` emits none; that is the bring-up investigation's deferred fix, not this seam's.

### Verification

Delta against the PR as submitted: **1 utterance**, the `0230 UTC` sentence.

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 201 files, **2798 tests, 0 failed** (2 new blocks) |
| `mine.ts scan --lang sl` | 122 lines, **no defects** |
| `review.ts --lang sl` | **checklist clean, all 8 lines** — including sourcing, now that main's gate fix landed |
| `corpus-diff` sl_si | **291/1903 (15.3%)**, DIGIT 0 / SLOT-GAP 0 / RAWMARK 0 / **DROP 6 → 0** / THROW 0 |
| `referee-eval sl` | **unchanged**, run from both checkouts: 88/5177 raw · 4995/5177 (96.5%) · symbol 99.4% |
