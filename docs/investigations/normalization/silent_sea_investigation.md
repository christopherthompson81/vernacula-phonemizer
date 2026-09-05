# Silent deletion in `nan cdo shn bo ti` — Sinitic romanization diacritics, Shan, Tibetan, Tigrinya

`silentCharsIn` (`tools/normalization/defects.ts`) reports a character only when EVERY corpus word containing
it reads identically without it. This log triages the findings in five languages: Min Nan's POJ ⟨o͘⟩, Min
Dong's Bàng-uâ-cê breve, Shan's silent consonants, Tibetan's subjoined ⟨ྥ⟩ and Tigrinya's labiovelar fidel.

Per character the outcome is one of: **legitimate** (→ `ORTHOGRAPHIC_SILENCE`, reported as a note),
**defect** (→ fixed, with the reading sourced), or **undecided** (→ left reported, with the reason). A wrong
reading is worse than a silence.

---

## Run 1 — 2026-08-14 — the baseline, re-derived through `mine.ts scan`

**Command.** `npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/<l>.jsonc --lang <l>` for
`nan cdo shn bo ti`, plus `npx tsx tools/referee-eval/eval.ts <l>` for each.

**Question.** What does the shipped code path actually report? (The brief's figures came from a probe with a
filter disabled and were expected to over-report.)

**Raw finding — the SILENT lines, as shipped:**

| lang | reported |
|---|---|
| nan | `͘ U+0358 ×366` — inert, 8 words — `tō͘ → tə˥` ; `sò͘ → sə˥` ; `Lō͘ → lə˥` |
| cdo | `̆ U+0306 ×295` — inert, 8 words — `Dṳ̆ng → tyŋ˥˥` ; `kṳ̆ → kʰy˥˥` ; `lṳ̆k → lyʔ˥` |
| shn | `က ×76`, `န ×70`, `အ ×59`, `ည ×41`, `ၻ ×34`, `ၿ ×22`, `ꧦ ×10` |
| bo | `ྥ U+0FA5 ×35`, `ཿ U+0F7F ×7`, `ྋ U+0F8B ×3` |
| ti | `ኲ U+12B2 ×28`, `ቊ U+124A ×6` |

⚠ **The brief's `bo ཱ U+0F71 ×47` DOES NOT REPRODUCE.** U+0F71 A-CHUNG appears in no SILENT line of the
shipped scan — it contributes, and the over-reporting probe invented it. Conversely the shipped scan finds
two Tibetan characters the brief did not name (`ཿ`, `ྋ`) and one Shan one (`ၿ`), and every count differs
(nan 366 not 234, cdo 295 not 175). **The re-derivation was not a formality.**

**Referee baseline** (folded backbone / symbol accuracy):

| lang | referee | words | folded | symbol |
|---|---|---|---|---|
| nan | wikipron hokkien broad [primary] | 5 535 | 95.3 % | 97.4 % |
| cdo | kaikki Module:cdo-pron [primary] | 1 514 | 99.9 % | 100.0 % |
| shn | wikipron shn_mymr_broad [primary] | 2 607 | 98.4 % | 99.1 % |
| bo | JIPA Lhasa [primary] | 40 | 100.0 % | 100.0 % |
| bo | kaikki Module:bo-pron [secondary] | 1 281 | 63.9 % | 89.6 % |
| ti | kaikki tir [primary] | 26 | 96.2 % | 99.2 % |
| ti | epitran tir-Ethi [secondary] | 898 | 94.3 % | 98.8 % |

**Implication.** Five independent investigations. Note that nan's and cdo's referees are **Han-input,
single-character** sets read through the shipped dictionary, while the silent characters live on the **Latin
romanization** path — so a romanization fix can be correct and leave those referees untouched.

---

## Run 2 — 2026-08-14 — nan ⟨◌͘⟩ U+0358: a DEFECT, and the root cause deletes far more than the dot

**Command.** `phonemize(w,"nan")` on `tō͘ tōo too tō to sò͘ soo gō͘ o͘ oo`, then a cluster census of the
mined corpus against `minnan.ts`'s `NATIVE_CLASS`.

**Question.** Is POJ ⟨o͘⟩ (= Tâi-lô ⟨oo⟩ = /ɔ/, against plain ⟨o⟩ = /ə/) reaching `pojToTailo`, which
already declares a fold for it?

**Raw finding.**

```
"tō͘"  U+0074 U+014D U+0358 => "tə˥"     "tōo" => "tɔ˥"     "to"  => "tə˥"
"tê"   U+0074 U+00EA        => "te˥"     "te"  => "te˥"     ← tone 5 lost, not just the dot
"hó"   => "hə˥"   "kú" => "ku˥"   "bí" => "bi˥"   "tâi" => "tai̯˨˦"   "ta̍k" => "tak̚˥"
```

**Two defects, one cause.** `NATIVE_CLASS` was `[A-Za-zàáâāǎÀÁÂĀǍ̀-̍]`. `makeNativiser` tests each cluster
**after NFC**, so a precomposed ⟨ê ī ū ō î ó í ô ē ò ú é û è ì ù ń ǹ⟩ is ONE codepoint the class did not
contain and was folded to a bare vowel — tone and all. The `̀-̍` mark range only ever rescued the
marks with no precomposed form (tone 8 ⟨a̍⟩, syllabic ⟨m̄ ŋ̍⟩), which is exactly why `tâi` and `ta̍k` read
correctly and hid the hole. U+0358 is in neither list, so the ⟨o͘⟩ cluster was flattened to ⟨o⟩ *before*
`pojToTailo` — the fold the engine already ships never ran.

Census of clusters failing the class in the mined corpus: **ê 1 541 · ī 1 164 · ū 696 · ō 684 · î 560 ·
ó 470 · í 423 · ô 396 · ē 368 · ò 354 · ú 303 · é 279 · û 277 · è 216 · ì 185 · ù 147 · ń 23 · ǹ 16**
= **8 772**, against 366 for the U+0358 dot the detector reported. ⚠ **The silent-deletion class found a
×366 vowel deletion and the character next to it was a ×8 772 TONE deletion that no class in the repo can
see** — a tone diacritic is not silent, it changes the reading of its own cluster, so the differential
correctly says it "contributes"; it contributes the *wrong* thing.

**And a third, found by counting the other spelling.** 146 corpus instances write ⟨o͘⟩ with a free-standing
MIDDLE DOT (`un-tō·`, `Kó·-lōng-sū`). `pojToTailo` folds `[͘·‧]` — but U+00B7 is
`Script=Common`, so the tokenizer's Latin word arm **ends at it** and the dot was never inside the token.
Counted: 145 of the 146 follow an ⟨o⟩ in one spelling or another (`ō· 61, ó· 37, ò· 16, o· 16, ô· 13,
O· 2`); the one that does not follows a hyphen and is left alone.

**Why the suite was green.** Every POJ golden in `test/minnan.test.ts` calls `phonemizeWord`, which goes
straight to `tailoToIpa` — the nativiser and the normalization layer are on the `phonemize` TEXT path only.
A word-level golden cannot see a tokenizer-level defect.

**Changed.** `NATIVE_CLASS` gains the ⟨e i o u n⟩ precomposed series in both cases and U+0358, and its mark
range narrows from `̀-̍` (which swept in U+0303 TILDE and U+0306 BREVE — the hazard `makeNativiser`'s own
note names) to the seven `TONE_MARK` keys plus U+0358. `normalizeMinNan` gains a step 0 folding
`⟨o⟩ + MIDDLE DOT` → `⟨o⟩ + U+0358`. New test block asserting the TEXT path.

**After.**

```
"tō͘" => "tɔ˧"   "tê" => "te˨˦"   "hó" => "hə˥˩"   "un-tō·" => "un˧ tɔ˧"   "TÂI" => "tai̯˨˦"
```

**Gates.** `mine.ts scan`: `SILENT ͘ U+0358 ×366` → **gone**; every other line identical.
`corpus-diff compare`: **415/447 lines changed (92.8 %)**, DROP 40 → 40, THROW 0, all five leak classes 0 →
0 — the change is tone and vowel quality, nothing gained or lost structurally. Spot-checked against the
shipped sandhi table: `Chúi-un` ˧→˥ (tone 2 → sandhi 1), `tī` ˥→˧ (citation tone 7), `hoān-ûi` → ˨˩ ˨˦
(7→3 sandhi, then citation 5).
`referee-eval nan`: **95.3 % / 97.4 % → 95.3 % / 97.4 %, IDENTICAL.** ⚠ Expected and not a null result: the
nan referee is wikipron **single Han characters** read through `dict.tsv` → `tailoToIpa`, a path the
nativiser never touches, *and* the eval strips tones. The referee cannot see either half of this fix. It is
recorded as "a live path to a regression that it did not take".
`vitest test/minnan.test.ts`: 30 passed, no golden's expected value changed.

---

## Run 3 — 2026-08-14 — cdo ⟨◌̆⟩ U+0306: LEGITIMATE, and the reason it is not an `ORTHOGRAPHIC_SILENCE` entry

**Command.** `phonemize(w,"cdo")` on `Dṳ̆ng/Dṳng`, `sṳ̆k/sṳk`, `să̤/sa̤`, `chiă/chia`, `hŭng/hung`; a census
of tone-marked vs unmarked BUC syllables in the mined corpus; `grep` for breve entries in
`tools/referee-eval/referees/cdo.buc-ipa.tsv`.

**Question.** cdo is the Sinitic lect NOT written in Han, so Bàng-uâ-cê IS its orthography, not a gloss —
is the engine dropping a tone?

**Raw finding — no. It reads it, and the reading is right.**

```
"Dṳ̆ng" => "tyŋ˥˥"    "Dṳng" => "tyŋ˥˥"        referee: dṳ̆ng   tyŋ⁵⁵
"sṳ̆k"  => "syʔ˥"     "sṳk"  => "syʔ˥"         referee: sṳ̆k    syʔ⁵
"gṳ̆"   => "ky˥˥"                              referee: gṳ̆     ky⁵⁵
```

The breve is BUC's 陰平 mark and `mindong.jsonc`'s `toneMark` carries it (`U+0306 → 1`). What makes it read
as inert is one line in `syllableParts`: `tone = tone || "1"` — **an unmarked syllable also falls back to
tone 1**, so deleting the breve cannot change the reading. Redundancy with a default is not the same thing
as being ignored, and the differential cannot tell them apart from inside the engine. The referee can, and
it agrees on every breve entry it holds.

**Two corpus numbers that matter here.**
* **The finding is 12 % of the real population.** U+0306 combining is ×295, but the corpus writes the breve
  on ⟨ŏ 772 · ĭ 700 · ă 661 · ŭ 516 · ĕ̤ 504 · ĕ 316 · Ĭ 92 · Ă 10 · Ĕ 10 · Ŭ 5 · Ŏ 1⟩ = **3 577**. The
  precomposed ones are single codepoints and are not candidates at all; the detector only ever sees the
  ⟨ṳ̆ ĕ̤⟩ cases, which cannot precompose. So the verdict has to be about the mark, not about the 295.
* **The fallback is not dead code:** 15 891 tone-marked BUC syllables against **1 420 unmarked**. Most of
  the unmarked ones are foreign (`Harry`, `Potter`, `County`, `of`, `times`, `color`, `km`), but ~200 are
  BUC spellings the corpus simply wrote bare (`ge̤ng ×26`, `gah ×18`, `sang ×14`, `nguok ×12`).

**Verdict: LEGITIMATE — and deliberately NOT added to `ORTHOGRAPHIC_SILENCE`.** That table's contract, in
its own words, is "characters that a correct engine must read as **nothing**". The breve is read as
something — 陰平 — and an entry claiming otherwise would be a false statement about Bàng-uâ-cê, and would
also pre-silence the day someone changes the unmarked default. ⚠ The line the brief warns about is exactly
here: the tempting fix is to make the fallback something other than tone 1 so the breve "contributes", and
there is no sourced reading for an unmarked BUC syllable to be. Inventing one to move a counter is the
`nya` ⟨cm⟩ error.

**Changed.** Nothing in the engine. `test/mindong.test.ts` gains a test pinning the three referee-sourced
breve readings, so the correctness claim behind this verdict is a fixture rather than a paragraph.

**Gates.** `mine.ts scan` unchanged (the SILENT line stays, correctly, and is now explained here).
`referee-eval cdo`: 99.9 % folded / 100.0 % symbol, unchanged — nothing was touched.
`vitest test/mindong.test.ts` passes with the new test.

---

## Run 4 — 2026-08-14 — shn: SEVEN characters, THREE different problems, and the brief was wrong about five

**Command.** Unicode name lookup on every reported character; a census of Myanmar-block characters the
engine's tables do not claim; `grep` of the shn referee for each; `phonemize(w,"shn")` vs `phonemize(w,"my")`.

**Question.** "A consonant reading as nothing is a strong signal the token class or grapheme table has a
hole" — which hole, per character?

**Raw finding — the seven split three ways, and the first split is a surprise.**

```
U+1000 က MYANMAR LETTER KA        ×76 ┐
U+1014 န MYANMAR LETTER NA        ×70 │
U+1021 အ MYANMAR LETTER A         ×59 ├─ BURMESE. Not Shan letters at all.
U+100A ည MYANMAR LETTER NNYA      ×41 │
U+1001 ခ MYANMAR LETTER KHA       ×30 ┘
U+107B ၻ MYANMAR LETTER SHAN DA   ×34 ┐  Shan's own letters, missing from `onsets`
U+107F ၿ MYANMAR LETTER SHAN BA   ×22 ┘
U+A9E6 ꧦ SHAN REDUPLICATION       ×10    a repetition mark, claimed by the header and never implemented
```

⚠ **The referee holds ZERO instances of any of the seven** (wikipron shn, 2607 words), so nothing here
could be adjudicated against it and nothing here can move it. Sourcing had to come from outside.

### (a) ⟨က န အ ည ခ⟩ — BURMESE TEXT IN A SHAN CORPUS

15 of the corpus's 407 lines are Burmese: quotations, Burmese-language passages, Burmese proper names
(`ပတ်ဝန်းကျင်` "environment", `တောင်ကြီး` Taunggyi, `ဗိုလ်ချုပ်အောင်ဆန်း…` Bogyoke Aung San). `silentCharsIn`
cannot filter these the way it filters an IPA gloss — its native-word test asks about the dominant SCRIPT,
and Burmese and Shan are **the same script**. This is a new member of the false-positive family the detector
investigation names in Run 2: not a gloss, but a foreign LANGUAGE sharing the host's script.

⚠ **And the silence was the lesser half.** `phonemizeWord` skips a character that is not an onset, so the
Burmese vowel signs around it latched onto whatever consonant came next:

```
ပတ်ဝန်းကျင်  shn: pat̚˨˦waː˨˦ŋaː˨˦   my: paʔwʊ˥˩ɴd͡ʑɪ˨ɴ
သည်          shn: sʰaː˨˦             my: ðɛ˨
တောင်ကြီး     shn: teː˨˦ŋaː˨˦        my: taʊ˨ɴd͡ʑi˥˩
```

That is a WRONG READING, which the brief ranks worse than a silence, and no counter in the repo sees it.
**Fixed by routing:** a run carrying a Burmese-only consonant goes to `readForeignRun`, and the script
router sends Myanmar to `my`. The set is the COMPLEMENT of the Shan inventory (⟨င တ ထ ပ မ ယ ရ လ ဝ သ⟩ are
shared and excluded), so a Shan word can never match it. Measured: **123 distinct corpus tokens contain a
Burmese-only consonant and all 123 are Burmese — no false positive.** ⚠ The converse is NOT claimed and is
recorded as a floor rather than a fence: a Burmese word built only from shared letters is indistinguishable
from Shan without language ID and still reads as Shan.

### (b) ⟨ၻ ၿ⟩ — and the two more the census found beside them

U+1075–U+1081 is the Shan letter block. `onsets` held 1075 1076 1078 107A 107C 107D 107E 1080 1081 and
skipped **exactly ၷ 1077, ၹ 1079, ၻ 107B, ၿ 107F — the voiced series**, a contiguous hole rather than two
stray omissions. Standard Shan has no voiced plosives, which is why they were easy to miss and is not a
reason to leave them out: the corpus writes ⟨ၻ⟩ ×34 (`ၻီႇၵရီႇ` "degree" ×6, `ၻေႃႇလႃႇ` "dollar", `ၻွၵ်ႇတႂ်ႇ`
"doctor", plus Pali `ၻေဝꩪမ်မ` devadhamma), ⟨ၿ⟩ ×22 (`ၿီႇလီႇယၢၼ်ႇ` "billion", `ၿရၼ်ႇတီႇ` "brandy"),
⟨ၷ⟩ ×13 (Pali). ⟨ၹ⟩ is ×0 and is added anyway, to close the block rather than leave one member of a series
to be found later.

**Sourced:** Wikipedia *Help:IPA/Shan and Tai Lue* consonant table — ၻ [d], ၿ [b], ၷ [ɡ] ("in foreign
words"), ၹ [z] ("in Burmese loanwords"); Wikipedia *Shan alphabet*, same five rare consonants, inherited
from Burmese for non-native sounds.
⚠ **NOT neutralised toward the native inventory** (⟨ၻ⟩→t, ⟨ၿ⟩→p). That would make a loan letter
indistinguishable from ⟨တ⟩/⟨ပ⟩, it is not what the cited tables say, and it is not the convention this table
already follows for the two loan letters it DID carry — ⟨ရ⟩ → r and ⟨ႀ⟩ → θ are equally absent from native
Shan.

### (c) ⟨ꧦ⟩ — a rule the header has claimed since bring-up

`shan.ts`'s own header says "the ໆ-style repetition mark" and nothing implemented it. **Two holes had to
close**, which is why the character is a good advertisement for the detector: it is not an onset (so the
syllable scan stepped over it), *and* U+A9E6 is in Myanmar Extended-B, which the TOKEN class did not admit
— `[က-၉၌-ႏႚ-႟ꩠ-ꩿ]` covers the main block, Extended-A and the two tails and skips `ꧠ-꧿`. So the word was cut
in two before `phonemizeWord` could see the mark, and fixing either hole alone changes nothing.

All ten corpus instances follow a COMPLETE syllable and intensify it — `ႁတ်းꧦႁၢၼ်ꧦ` (ႁတ်းႁၢၼ် "bold" →
"boldly"), `တႅမ်ႈꧦမၢႆꧦ`, `လၢႆꧦ` "various", `ငၢႆႈꧦ` "easily", `တႄႉꧦ`, `ဝႃႈꧦ` — which is exactly how Lao ໆ and
Thai ๆ behave, and `lao.ts` already reads its own mark by copying the last syllable. Same rule, same shape.

**After.**

```
ၻွၵ်ႇ → dɔk̚˩      ၿီႇလီႇယၢၼ်ႇ → biː˩liː˩jaːn˩     လၢႆꧦ → laːj˨˦laːj˨˦
ႁတ်းꧦႁၢၼ်ꧦဝႃႈ → hat̚˥hat̚˥haːn˨˦haːn˨˦waː˧˧˨      ပတ်ဝန်းကျင် → paʔwʊ˥˩ɴd͡ʑɪ˨ɴ (= the `my` reading)
```

**Left reported, deliberately.** The same census found the Shan **Pali** letters ⟨ၷ ꩪ ꩡ ꩦ ꩧ ꧤ ꧡ ꩮ ꧠ ꧣ⟩ at
1–13 occurrences each. ⟨ၷ⟩ is fixed above because it is a member of the voiced series; the Myanmar
Extended-A/B Pali letters are a coherent second family needing per-letter sourcing, they are below the
detector's 3-probe-word floor and so are not reported, and guessing at them is the error this log is for.
Named here rather than narrowed around.

**Gates.** `mine.ts scan`: **all seven SILENT lines gone**, every DROP/LEAK line identical.
`corpus-diff compare`: 61/406 lines changed (15.0 %), DROP 67 → 67, THROW 0, leak classes 0 → 0.
`referee-eval shn`: 98.4 % / 99.1 % → **98.4 % / 99.1 %, identical** — and necessarily so, the referee
containing none of the seven characters. `vitest test/shan.test.ts` 14 → 17 passing, no existing golden's
expected value changed. `review.ts --lang shn` reports its one pre-existing FAIL (no `normalize.ts`),
unchanged by this work.

---

## Run 5 — 2026-08-14 — bo: the brief's ⟨ཱ⟩ does not exist, ⟨ྥ⟩ was reading its own carrier, and ⟨ྋ⟩ stays undecided

**Command.** Unicode names for every reported character; all corpus contexts for each; `grep` of both bo
referees; `phonemize(w,"bo")` before and after.

**Question.** bo has NO normalization layer and its `review.ts` fails before the artifact check, so this is a
g2p question only: which of these is a defect?

### ⚠ First, the negative result: `ཱ` U+0F71 A-CHUNG ×47 IS NOT REPORTED

The brief's largest bo finding does not appear in the shipped scan at all. U+0F71 contributes — it is the
long-⟨a⟩ vowel sign and changes its syllable's reading — and the over-reporting probe invented it. The
shipped scan instead names two characters the brief does not: ⟨ཿ⟩ ×7 and ⟨ྋ⟩ ×3.

### ⟨ྥ⟩ U+0FA5 SUBJOINED PHA ×35 — DEFECT, fixed

Every one of the 35 instances is the digraph ⟨ཧྥ⟩ (Wylie *hpha*), and its 31 distinct forms are all Western
loans: `ཧྥ་རན་སི` France, `ཨ་ཧྥེ་རི་ཀ` Africa, `ཧྥོ་ལོ་རི་ཌ` Florida, `ཧྥུ་ནན` Funen, `ཧྥི་ཤར` Fischer,
`ཧྥེ་མན` Fehman, `ཧྥེས་ལི་པེན` Philippines, `ཧྥུའུ་ཨེར་ཅ` — **/f/ in the source language in every case, no
counter-example**. Tibetan has no native /f/, and this is the digraph that fills the gap.

⚠ **"Inert" understates what was happening.** `parseSyllable` treats ⟨h⟩ as neither a superscript nor a
subscript, so the subjoined ⟨ྥ⟩ was dropped and the stack read as a bare ⟨ཧ⟩ — the graphic CARRIER was read
and **the actual consonant letter thrown away**. `ཧྥ་རན་སི → ha˥ɻɛ̃ː˥si˥`: France with an /h/.

**Sourcing, and its limit, stated.** No external reference documents this digraph's IPA. Wikipedia *Tibetan
alphabet* documents the SISTER convention — ⟨ཕ༹⟩, pha + tsa-'phru U+0F39, for /f/ in **Chinese** loans —
which confirms both that Tibetan lacks /f/ and that ⟨ཕ⟩ is the base letter used to write it, and the corpus
contains **zero** tsa-'phru. Neither bo referee holds a single ⟨ྥ⟩. So the 31-form corpus correspondence is
the evidence, and the note in `tibetan.ts` says so rather than implying a citation it does not have.
⚠ Recorded there too: if /f/ is ever disputed the fallback is **/pʰ/**, the subjoined letter's own value —
never /h/, which is what reading the carrier produces.

### ⟨ཿ⟩ U+0F7F RNAM BCAD ×7 — DEFECT (half of it), fixed

Unicode §13.4: "U+0F7F … is the visarga". Its Tibetan name means "cutting off", and it terminates its
syllable — which the splitter did not know. `ཀཿཐོག`, the monastery **Kaḥtog**, parsed as ONE stack; ⟨ཀ⟩ was
taken for a prefix and DELETED; the word read `tʰoʔ˥`. A whole syllable lost, and the detector saw only that
the mark itself said nothing.

Resolved over all 7 corpus instances: **5 improve** — `ཀཿཐོག → ka˥tʰoʔ˥`, `ཀཿདཔལ`, `ན་མཿཨཪྱ`,
`ན་མཿཧི → na˩ma˥hi˥`, `ཨོཾ་ཨཱཿཧཱུཾ → ʔõ˥ʔa˥hũ˥` — and **2 are unchanged** (`བྷཿ`, `བི་དྷིཿ`, word-final).
Zero regressions.

⚠ **Its own value is deliberately left unread.** Wikipedia glosses it "ḥ /h/ visarga; marks post-vocalic
breath", but Lhasa Tibetan has no coda /h/ and neither referee holds an instance. Splitting is a fact;
emitting a phone would be a guess. Half the question answered, and recorded as half.

### ⟨ྋ⟩ U+0F8B GRU MED RGYINGS ×3 — UNDECIDED, left reported

All three instances stand at the head of an honorific title — `ྋཤར་རྒྱལ་བ`, `ྋགོང་ས་ལྔ་པ` (the Fifth Dalai
Lama), `ྋསྐྱབས་རྗེ` — which reads as the Tibetan practice of flagging a revered name. But the only citable
statement about the character is the Unicode Standard's: "The characters encoded in the range U+0F88..U+0F8B
are used in transliterated text and are most commonly found in Kalachakra literature." That is not a claim
that it is silent.

⚠ **NOT added to `ORTHOGRAPHIC_SILENCE`.** Every entry in that table is a claim about a writing system, and
"×3, in 3 words, plausibly an honorific mark" is not one. The surrounding words already read correctly
(`ྋཤར → ɕaː˥`, *shar*), so nothing is being damaged by leaving it; what would be damaged is the table, by an
entry that cannot be defended. Left reported, with the reason — a complete outcome, per the brief.

**Gates.** `mine.ts scan`: ⟨ྥ⟩ and ⟨ཿ⟩ gone; ⟨ྋ⟩ ×3 remains, correctly; every DROP/LEAK line identical.
`corpus-diff compare`: 25/417 changed (6.0 %), DROP 27 → 27, RAWMARK 1 → 1, THROW 0.
`referee-eval bo`: primary (JIPA, 40) 100.0 % / 100.0 % and secondary (kaikki, 1281) 63.9 % / 89.6 % — **both
identical.** Necessarily so: neither referee contains one instance of either character. That is the "live
path to a regression that it did not take", and it is also why the new goldens exist.
`vitest test/tibetan.test.ts` 19 → 21 passing, no existing golden's expected value changed.

---

## Run 6 — 2026-08-14 — ti ⟨ኲ⟩ and ⟨ቊ⟩: two missing fidel, and enumerating the block found five more errors

**Command.** Unicode names for every Ethiopic labiovelar codepoint, matched against `fidel.tsv`;
`grep` of both ti referees for each; `phonemize(w,"ti")` before and after.

**Question.** ⟨ኲ⟩ ×28 and ⟨ቊ⟩ ×6 are labiovelar fidel — why do they read as nothing?

**Raw finding — because they have no row, and `makeGeezG2P` reads a missing fidel as the EMPTY STRING**
(`out += map().get(ch) ?? ""`). So the character does not degrade, it deletes its whole syllable:
`ኲናት` "war" → `nat`, `ቊጽሪ` "number" → `t͡sʼɨɾi`, `ቱርኲ` Turkey → `tuɾ`.

**And enumerating the block turned two findings into seven.** Each labiovelar sub-series has five members,
orders ⟨ʷə ʷi ʷa ʷe ʷɨ⟩:

| sub-series | in the table before |
|---|---|
| KXW ⟨ዀ ዂ ዃ ዄ ዅ⟩ | **all five, all correct** |
| QHW ⟨ቘ ቚ ቛ ቜ ቝ⟩ | **all five, all correct** |
| QW ⟨ቈ ቊ ቋ ቌ ቍ⟩ | three — and `ቈ → kʼʷe` |
| KW ⟨ኰ ኲ ኳ ኴ ኵ⟩ | three — and `ኰ → kʷe` |
| GW ⟨ጐ ጒ ጓ ጔ ጕ⟩ | four — and `ጐ → ɡʷe` |

⚠ **The three that WERE present were an order out.** `ቈ ኰ ጐ` are ETHIOPIC SYLLABLE QWA/KWA/GWA — the **1st**
order — and were carrying the **5th** order's vowel. The file contradicts itself on this: the 1st order is
/ə/ everywhere else in it (`ሀ hə`, and the labiovelars `ዀ xʷə`, `ቘ kʼʷə`) and the 5th is /e/ (`ሄ he`). The
two complete sub-series are the internal control that makes the diagnosis certain rather than plausible.

⚠ **And the referee agrees, on 13 instances the detector could never have pointed at.** epitran tir-Ethi
holds `ቈለ qʷələ`, `ቈልዓ qʷəlɨʕa`, `ቈጽሊ qʷət͡sʼɨli`, `ኰርኰረ kʷərɨkʷərə`, `ኰዓተ kʷəʕatə`, `ተርጐመ tərɨɡʷəmə`,
`ጐልማሳ ɡʷəlɨmasa`, `ጐይታ ɡʷəjɨta` — every one of them ⟨ʷə⟩. It holds **zero** ⟨ኲ⟩ and **zero** ⟨ቊ⟩, so the two
characters the scan reported are exactly the two the referee is blind to, and the five it exposed are the
five the referee could always have caught. Two instruments, disjoint coverage, same defect.

**Changed.** `fidel.tsv`: `ቈ → kʼʷə`, `ኰ → kʷə`, `ጐ → ɡʷə` corrected; `ቊ kʼʷi`, `ቌ kʼʷe`, `ኲ kʷi`,
`ኴ kʷe`, `ጔ ɡʷe` added. ⚠ `ቌ` and `ጔ` have **zero** corpus instances and are written anyway — a series with
one member left out is the defect this run is about, and leaving the same hole in a different order repeats
it. A `#` header block in the data file records all of the above beside the rows.

**Gates.** `mine.ts scan`: **both SILENT lines gone**, every other line identical.
`corpus-diff compare`: 58/323 changed (18.0 %), DROP 12 → 12, THROW 0, leak classes 0 → 0.
`referee-eval ti`:

| referee | metric | before | after |
|---|---|---|---|
| kaikki tir [primary], 26 | folded / symbol | 96.2 % / 99.2 % | 96.2 % / 99.2 % |
| epitran tir-Ethi [secondary], 898 | **raw exact** | 321 (35.7 %) | **323 (36.0 %)** |
| epitran tir-Ethi [secondary], 898 | folded / symbol | 94.3 % / 98.8 % | 94.3 % / 98.8 % |

⚠ **The folded metric CANNOT move here and the reason is in the config**: `langs/ti.jsonc` folds
`e → ə` ("the guttural/ejective-context 1st-order vowel: referee narrows ə→[e] — Tigrinya writes the
cardinal, unify"). That fold is exactly the distinction the 1st-order correction restores, so the folded
backbone was already scoring these as agreements. **Raw exact is the metric that can see it, and it went
up.** Recorded rather than smoothed over: a fold that hides a real error is worth knowing about.
`vitest test/tigrinya.test.ts` 12 → 14 passing, no existing golden's expected value changed.
`review.ts --lang ti` reports its two pre-existing FAILs (`sign classes`, `artifact scan` — the ×1 math-sign
and ×1 minus drops), unchanged by this work.

---

## Run 7 — 2026-08-14 — the closing state

`npx tsx tools/normalization/mine.ts scan` on all five, and `npx vitest run` on the whole suite.

| lang | reported before | reported after | outcome |
|---|---|---|---|
| nan | ͘ U+0358 ×366 | — | **defect fixed** (and a ×8 772 tone deletion behind it) |
| cdo | ̆ U+0306 ×295 | ̆ U+0306 ×295 | **legitimate** — reading verified against the referee, reported on |
| shn | ７ characters, ≈312 | — | **defect fixed** ×3 (grapheme table, token class, foreign routing) |
| bo | ྥ ×35 · ཿ ×7 · ྋ ×3 | ྋ U+0F8B ×3 | **2 fixed, 1 undecided** |
| ti | ኲ ×28 · ቊ ×6 | — | **defect fixed**, and 5 more errors found beside them |

**Two findings deliberately left in the report**, because a quiet exemption is indistinguishable from a
clean scan: cdo's breve (correct reading, redundant with a default — not `ORTHOGRAPHIC_SILENCE`, which is
for characters read as NOTHING) and bo's ⟨ྋ⟩ (×3, no citable statement that it is silent). **No entry was
added to `ORTHOGRAPHIC_SILENCE` at all** — the two candidates were both refused on the table's own contract,
and `defects.ts` is therefore untouched by this work.

**Referee movement across the five, restated in one place:**

| lang | referee | before | after |
|---|---|---|---|
| nan | wikipron hokkien, 5 535 | 95.3 % / 97.4 % | unchanged |
| cdo | kaikki cdo-pron, 1 514 | 99.9 % / 100.0 % | unchanged (nothing touched) |
| shn | wikipron shn, 2 607 | 98.4 % / 99.1 % | unchanged |
| bo | JIPA 40 · kaikki 1 281 | 100 % / 100 % · 63.9 % / 89.6 % | unchanged |
| ti | epitran tir, 898, **raw exact** | 321 (35.7 %) | **323 (36.0 %)** |

⚠ **Four of the five did not move, and in every case the reason is structural rather than a null result.**
nan's referee is single Han characters read through `dict.tsv`, a path the Latin nativiser never touches,
and it strips tones. shn's holds none of the seven characters. bo's holds none of the three. cdo was not
changed. ti moved on the ONE metric that can see the change and not on the folded one, whose `e → ə` fold is
precisely the distinction restored. Every one of these is "a live path to a regression that it did not
take", and it is why each fix carries new goldens instead of leaning on the referee.

**Full suite.** `npx tsc --noEmit` clean. `npx vitest run`: **244 files, 4 140 passed, 5 skipped, 0 failed**
— including `test/normalization-silent-deletion.test.ts`, the six-case regression fixture, untouched.
No existing golden's expected value changed in any of the five languages; 9 new tests were added.
