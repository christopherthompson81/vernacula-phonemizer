# Sinitic initialisms — reading Latin letters in wuu, cmn and yue

All three Sinitic engines routed an embedded Latin initialism to the **English** phonemizer, so
`中国GDP总量` came out *…ɡˈiːdˈiːpʰˈiː…* — English [iː], English stress marks, and **no tone at all** inside
a tonal utterance. This is the record of fixing that in wuu (2026-08-09), then in cmn and yue.

The wuu-specific half is in `wuu_normalization_investigation.md` Run 4; this file holds what is SHARED, and
in particular the two places where the three languages had to differ.

---

## Run 1 — 2026-08-09 20:00 — the defect is phonology, not letter identity

| | before |
|---|---|
| cmn `中国GDP总量` | ʈ͡ʂoŋ˥˥ kuo˧˥ **ɡˈiːdˈiːpʰˈiː** t͡soŋ˨˩˦ liɑŋ˥˩ |
| yue `中國GDP總量` | t͡sʊŋ˥ kʷɔːk̚˧ **ɡˈiːdˈiːpʰˈiː** t͡sʊŋ˧˥ lœːŋ˨ |
| yue `DVD播放機` | **dˌiːviːdˈiː** pɔː˧ fɔːŋ˧ kei˥ |
| cmn `CEO` | **sˈiːʲiːʲˈoᶷ** |

**What a Sinitic speaker says is the ENGLISH letter NAME in the LOCAL phonology.** Sourced: espeak-ng's
`cmn_list` carries a block headed *"Latin letters with Chinese accent"* — `a ei51 · b pi51 · c sei55 ·
d ti51 · w ta35pliou` ("double-u") `· x ai35ks`. The names are English-derived across Sinitic; only the
phonology is native. So the fix is **orthographic**, not phonetic: spell the name in the language's own
script and let the existing pipeline read it — the shape ja already uses (letter → katakana → g2p), and
what the playbook prefers over emitting a pronunciation (trap 6).

⚠ **espeak has that block COMMENTED OUT**, and its reason is in the file: *"This will make letter within
English sentence translated not correctly. i.e. 'ma is a horse'. 'a' will be translated as ei51."* That is
an argument against a **blanket** letter rule, not against an all-caps-scoped one — and it is why every
guard below exists.

## Run 2 — 2026-08-09 20:10 — where the three languages must differ

### yue: the table was already shipped, and unused

`cantonese/normalize.ts` deferred this class *"for want of a letter-name table the shipped rime-cantonese
dict does not have"*. The dict has **541 Latin keys**, including **69 whole acronyms with their readings**,
and the engine's Latin arm never looked at any of them — it went straight to `foreign()`. So the fix is
first a LOOKUP, not a table: `DVD di1 wi1 di1`, `ATM ei1 ti1 em1`, `USB ju1 e1 si4 bi1`, `GPS zi1 pi1 e1
si4`, `OK o1 ke1`. That is `core/initialisms.ts`'s own architecture — a known acronym's reading is a
lexical fact and resolves through the lexicon; only an OOV one is spelled.

The per-letter table is then **mined** from the same file, two ways:

- the **13 single-letter keys** — D di1, J zei1, K kei1, L eu1, M em1, N en1, P pi1, Q kiu1, R aau1,
  T ti1, X ik1 si4, Y waai1, Z ji6 set1;
- **per-letter alignment of the acronym entries** for the other 11, with vote counts: B bi1 ×14, C si1 ×11,
  O ou1 ×11, A ei1 ×10, I aai1 ×9, V wi1 ×6, E ji1 ×4, G zi1 ×4, U ju1 ×2, plus the two-syllable
  **F e1 fu4** (`FF e1 fu4 e1 fu4`) and **S e1 si4** (`GPS` and `USB`, two independent entries).

⚠ **Two votes are rejected, and reading the source entry is what rejects them.** `CLS ci1 lan2 sin3` is
黐撚線, a **profanity spelled with letters** — not letter names; left in, it would have shipped `S = sin3`.
`WP win1 pei1` and `LM lau4 ming4` are names. Playbook trap 2 in miniature: the count was there, the sense
was not.

⚠ **H and W are in no source at all** — no single-letter key, no acronym, and **espeak ships no Cantonese
letter table** (`yue_list` has zero Latin entries). Rather than invent them, a run containing an unsourced
letter is left **whole** on the English reader: half-Cantonese, half-English inside one token is worse than
either. Measured cost: 3 of the artifact's 13 all-caps tokens (`HK`, `NSW`, `NPWS`).

### cmn: the conventional table is correct *because* Mandarin is what it was built for

cmn has no Latin keys anywhere, so it takes a Han letter-name table like wuu's — but **unchanged from the
standard Chinese transliteration**, and that is the interesting part. The convention was built for
Mandarin, which lost the Middle Chinese voiced series, so it is internally consistent there:

| | cmn | wuu |
|---|---|---|
| B 比 / P 皮 | [pi] / [pʰi] ✓ a real contrast | [pi] / **[bi]** — 皮 is Wu's *B* |
| D 迪 / T 提 | [ti] / [tʰi] ✓ | [diʔ] / **[di]** — both voiced |

**So wuu had to re-choose its characters by the Wu reading (B 皮, P 披, D 地, T 梯, R 阿尔) and cmn does
not.** Same fact from two sides, and the reason the two manifests carry different tables rather than one
shared one.

Validated against espeak's letter phonetics via cmn's own `chars.tsv` pinyin: **20 of 26 agree exactly**,
2 more share the rime (G 吉 ji vs zhi, H 艾尺 ai-chi vs ei-chi). The 4 that differ are kept on the written
convention, since espeak is phonetic and cannot supply orthography: C 西 [ɕi] (espeak `sei55`, not a
syllable Chinese writes), J 杰, K 开, L 艾勒.

## Run 3 — 2026-08-09 20:40 — two guards the corpus changed my mind about

### ⚠ The window is 2–3, not 2–4 — and cmn is what proved it

wuu shipped 2–4 first, on its own count: 110 all-caps tokens at 2–4 letters, all initialisms, against 4
tokens at 5+ of which three were English words (PROJECT, LAWSON, LOUBAT). Extending the rule to cmn showed
the real boundary is at **four**:

```
lang  band     tokens / distinct   English-word tokens
cmn   2-3       27 / 24            2
cmn   just 4    16 /  9            9   ← FIFA ×7, BANK, SEAL
wuu   just 4    18 / 13            4   ← COOH, DASH, TURE, NASA
yue   2-3       10 / 10            0
```

At exactly four letters **more than half of cmn's tokens are English words**, and `FIFA` read out as six
letter names is loud nonsense. **The cost is asymmetric, and that is the whole argument:** a genuine
4-letter initialism left on the English reader (SNCF, ISBN, ISSN, LGPL, FTIR) still says the RIGHT LETTER
NAMES in the wrong accent — a much smaller error. Whether an acronym is a word or letters is a LEXICAL
fact, `core/initialisms.ts` says so, and none of these three has a Latin lexicon that could decide it.
All three were narrowed to 2–3, including wuu retroactively.

⚠ **yue is the exception, and deliberately**: its DICT LOOKUP has no length cap, because a recorded
reading *is* the lexical fact the guard exists to substitute for. Only the spelling fallback is capped.

### ⚠ The pass must run AFTER the symbol tier — caught by the corpus diff, invisible to probes

In cmn the rule started as a step inside `normalizeMandarin`, which the engine calls as
`SYMBOLS(normalizeMandarin(input))`. The shared symbol tier reads a temperature's **scale letter**, so
running first rewrote the ⟨C⟩ of `20°C` to 西 and the tier could no longer see the unit at all:
`二十摄氏度` became `二十度西`. No probe would have shown it — it needed the diff. `spellInitialisms` is now
a separate export called last. (wuu was already correct: its symbol tier is step 9 and the letter rule
step 14.)

### Two other guards, carried across all three

- **`[IVX]{2,3}` excluded.** `core/roman.ts` runs in the registry *wrapping* `engine.text()`, so it has
  already claimed every numeral it will; what reaches these layers is what it declined (`第II次`). Of wuu's
  65 distinct all-caps runs, 7 parse as Roman numerals and **only two are** — CD/DC/ML/MV/XL are
  initialisms — so a blanket validity test would lose five to protect two.
- **A lone letter only where it touches Han** (`X光`, `地铁B线`, `A股`): all 6 Han-adjacent single uppercase
  letters in the wuu artifact are letter-reads, while every math/chemistry single (`f(x)`, `C 9 H 8 O 4`,
  `m = 2`) is Latin-flanked and untouched.
- **The letters are SPACE-SEPARATED**, which is load-bearing in all three: the front ends segment Han by
  greedy longest match, so a letter string run together is swallowed as a real word with its sandhi.
  Measured on wuu, 10 of 676 letter pairs contain a dict word spanning the boundary — 地区 (DQ) "region",
  西欧 (CO) "Western Europe", 娃娃 (YY) "doll".

## Run 4 — 2026-08-09 20:50 — gates

**The same pre-existing leak in all three engines**: `MP3` phonemized to the **string `MP3`**. Each
engine's whole-string romanization fast path (`WUGNIU`, `PINYIN_INPUT`, `JYUTPING`) was case-INSENSITIVE,
so an all-caps letters-plus-digit token matched it, found no syllable, and was returned verbatim by the
"leave the romanization visible" fallback. All three flags dropped; the real romanized paths still work.

```
referee eval   cmn 84.7% folded / 94.9% symbol   UNCHANGED
               yue 70.9% folded / 89.2% symbol · gold 18/18 100%   UNCHANGED
corpus diff    cmn changed 21/144, yue 7/79 — leak classes 0 throughout, both sides
               wuu 15/436 changed by the 2-4 → 2-3 narrowing alone
3,251 tests pass · tsc clean · review.ts clean for cmn and wuu
```

⚠ `review.ts --lang yue` reports one FAIL, `DROPPED: plus-minus`. **Pre-existing** — verified by running
the same command in a worktree at the parent commit — and untouched by this change; the ± class in yue is
its own question.

**Reading the changed lines** is where the wins are, including two the probes would not have found:
`MS` was being read as the English WORD *mˈɪz* and `FIC` as *fˈɪ*; both are now letter-read. Also
`UTC` → juː tʰiː siː · `PC` → pʰiː siː · `TMZ` → tʰiː ɛːm jiː sɛːt̚ (Z's two syllables) · cmn `NHK` →
ən aⁱ ʈ͡ʂʰʐ̩ kʰaⁱ · cmn `US` → jioᵘ aⁱ sɹ̩, while `the U.S.` inside an English sentence correctly stays
English.

**Left undone, with the numbers**: H and W for yue (3 of 13 artifact tokens); 4-letter initialisms in all
three, which need a lexical tier none of them has; and the lowercase Latin loans in yue's dict (`bar baa1`,
`account aa6 kaan1`), which are NOT claimed because nothing in the surface form separates a Cantonese loan
from the quoted English the corpus also carries.

## Run 5 — 2026-08-09 20:57 — PR review (#789), and one live defect it caught

Reviewed the three commits as a diff. **Five findings, four of them documentation drifting from the code
across three rounds of changes — and one real misfire no gate had reported.**

### The real one: ⟨度⟩ in the coordinate-range class rewrote a negative as a range

`wu/normalize.ts` step 2 turns the dash between two coordinates into 到, keyed on `[度分秒]`. On plausible
input that is wrong:

```
温度-5度   →  温度到五度      "the temperature TO five degrees"
```

A genuine negative, read as a range, on exactly the shape a listener would notice. It survived every gate
because **the corpus contains no negative** — the whole `ACCEPTED_SIGN_SILENCE.wuu` minus entry says so —
so the corpus diff, the artifact scan and the review checklist were all silent. Only reading the rule
against invented adversarial input found it (playbook trap 8: *zero corpus instances is not evidence of
correctness*).

The fix costs nothing: **both** attested coordinate ranges have 分 before the dash (`121°48´-121°57ˊ`,
`29°08ˊ-29°13ˊ`) and none has a bare 度, so narrowing the class to `[分秒]` keeps every real case and
removes the misfire. Pinned in `test/wu-normalize.test.ts`.

### The four documentation findings, one of which is the claim this work refuted

1. **`cantonese/normalize.ts` still asserted the refusal.** Its header said embedded Latin stays on English
   because "the shipped rime-cantonese dict does not have" a letter-name table — the exact statement this
   PR disproved by mining 541 Latin keys out of that dict. Worse, it argued the back-derivation was
   impossible because *"S is si1 inside PC/ABC and si4 inside GPS"* — **those are two different letters**:
   PC/ABC align C→si1, while GPS/USB align S→`e1 si4`, a two-syllable name whose second syllable is that
   si4. The conflict was an artifact of assuming one syllable per letter. Rewritten, with the error kept
   rather than deleted, since it is the reason the class sat deferred.
2. **The `％` CORE LIMITATION note in the same header was out of date** — `core/normalizeSymbols.ts` now
   matches `[%٪％]` itself. Corrected rather than removed, because the next CJK layer cited it; the local
   fold is kept only for `／`, which the fraction rule still needs, and now says so.
3. **`wu.jsonc` still described a 2–4 window** after the narrowing to 2–3.
4. **`cantonese.ts`'s `latinRun` doc said "Length 2–4"** while the code caps *spelling* at 3 and leaves the
   *dict lookup* uncapped — the asymmetry that is the point of that function.

### One asymmetry left in deliberately, with the count

wuu and cmn claim a lone uppercase letter that touches Han (`X光`, `地铁B线`); **yue does not**. Counted
before deciding: the yue artifact has **zero** Han-adjacent single uppercase letters, against 9 in cmn's and
6 in wuu's. Widening a guard for a shape the corpus does not contain is how misfires get invented
(trap 9), so it stays unclaimed and the reason is recorded at the function.

### Gates after the review fixes

```
wuu   DROP 89→28, DIGIT 23→0        cmn 21/144, yue 7/79, leak classes 0 both sides
referee  cmn 84.7% / 94.9%   yue 70.9% / 89.2% + gold 18/18   ALL UNCHANGED
3,251 tests · tsc clean · review.ts clean for wuu and cmn
```
