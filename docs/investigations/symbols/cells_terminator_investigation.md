# The native sentence terminator, and the fleet-wide cell it deserves

The `syl` run (`b9ccace`) found `⁕` U+2055 — the Sylheti corpus's sentence terminator, ×476, more than
every other mark in the language combined — completely undeclared, so it read as nothing. It fixed the
manifest and the token class, and then STOPPED: by the playbook's own rules the mark also deserves a CELL
in `tools/normalization/cells.ts`, but `cells.ts` is a fleet file and adding to it makes every committed
artifact stale. That deferral is this document's starting point.

Two questions had to be answered before touching anything: **is this Sylheti's problem or the fleet's**
(playbook trap 47, local vs core), and **what exactly does adding a cell break** — because the answer
"re-mine 160 artifacts to make the gate green" would destroy every count recorded against those artifacts
in `defects.ts` comments and in a dozen other investigation docs (trap 24), and is not available.

## Run 1 — 2026-08-12 14:05 — how much is already stale?

**Question.** `review.ts` fails a language whose artifact is not measured against today's inventory. Before
adding a cell, how many of the 160 artifacts are stale TODAY? If most are already stale, one more cell is
noise; if none are, the change flips the whole fleet at once.

**Command.** A script over `tools/corpus/mined/*.jsonc` calling `staleness()` from `cells.ts` directly.

**Raw finding.**

```
inventory size 35
current 160 stale 0
minedAgainst histogram [ [ 35, 160 ] ]
missing-cell histogram []
```

**Implication.** The worst case. The fleet has fully caught up — all 160 artifacts were mined against the
current 35 cells, no dead keys anywhere. So adding a 36th cell moves the fleet from **160 current / 0 stale**
to **0 current / 160 stale** in one commit, and `review.ts` fails on `artifact current` for every language
that has an artifact. This is not a partial regression that a few re-mines could mop up; it is total.

Note the contrast with the comment in `cells.ts`, written when the check was added: *64 of 67 artifacts
stale*. That was a real, informative signal — five cells had never been evaluated for anybody. The fleet
then did the work. A gate that goes red for all 160 the moment anyone adds a cell, and can only go green
again after 160 re-fetches, is a gate that will be permanently red, and a permanently red gate teaches
readers to skip the line. That constraint shaped the rest of this work.

## Run 2 — 2026-08-12 14:20 — is any of this already covered?

**Question.** Does any existing cell match `⁕`, or any other script-specific sentence mark? If one does,
there is nothing to add.

**Command.** Test every `CELLS[].re` against a Sylheti sentence carrying each candidate mark in turn, for
30 marks across 12 scripts.

**Raw finding.** `NO CELL` for all 30. Devanagari `। ॥`, Arabic `، ؛ ؟ ۔`, Syriac `܀ ܁ ܂`, Ethiopic
`። ፣ ፤ ፥ ፦`, Burmese `၊ ။`, Tibetan `། ༎`, Khmer `។ ៕`, Ol Chiki `᱾ ᱿`, Syloti Nagri `꠨ ꠩ ꠪ ꠫`, Vai `꘎`,
Lisu `꓿`, UCAS `᙮`, and `⁕` itself — not one is matched by any of the 35 cells.

**Implication.** The inventory has no punctuation-boundary cell at all. Every cell in it is a NUMBER shape
or a letter-ish shape (`zero-width`, `quote-letter`, `ampersand`, `iteration` are the only non-numeric ones,
and `iteration` is the closest precedent: a script-specific mark, `langs: 1`, admitted because it was the
largest single defect in the one language that had it). The gap is categorical.

## Run 3 — 2026-08-12 14:35 — local or shared? (trap 47)

**Question.** Trap 47 says a phenomenon that fires for one language belongs in that language's data, not in
the shared list. Does `⁕` fire for one language, or is it one instance of something fleet-wide?

**Command (a).** Count each candidate mark's occurrences across the text of all 160 mined artifacts.

**Raw finding (a).** Non-Latin boundary marks, by number of languages whose artifact contains them:

```
، arabic-comma       langs=18  total=7639   ug:1643 arz:1316 ps:1163 ary:1097 skr:1009 pnb:887 …
। danda              langs=14  total=4819   awa:1162 mag:1151 mai:1139 bpy:745 ne:110 bn:105 …
؛ arabic-semicolon   langs=13  total=202
؟ arabic-question    langs=7   total=43
॥ double-danda       langs=5   total=27     syl:14 awa:8 mag:2 mai:2 mt:1
۔ arabic-full-stop   langs=4   total=2806   skr:1370 pnb:1333 ur:76 bal:27
። ፣ ፤ ፥ ፦ ethiopic   langs=2   total=2057   ti / am
။ ၊ burmese          langs=2   total=3881   shn / my
། ༎ tibetan          langs=2   total=2583   bo
។ ៕ khmer            langs=2   total=1015   km
᱾ ᱿ ol-chiki         langs=1   total=1372   sat
⁕ syl-terminator     langs=2   total=985    syl:982 pcm:3
```

**Command (b).** Grep every `src/languages/*/` layer for the same marks — `langs` in a cell is defined as
"treated languages that authored a rule in that category", so this is the field's own metric, not a proxy.

**Raw finding (b).**

```
। U+964:  20  assamese awadhi bengali bhojpuri bishnupriya chhattisgarhi gujarati hindi kannada
              magahi maithili malayalam marathi nepali odia punjabi rangpuri sylheti tashelhit telugu
、 U+3001: 14  cantonese gan hakka hmong japanese jin madurese mandarin mindong minnan sinitic wu xiang zhuang
。 U+3002: 13  (same family)
، ؟ U+60C/61F: 10 each  arabic balochi central-kurdish pashto persian punjabi sindhi tashelhit urdu uyghur
۔ U+6D4:   7  arabic balochi pashto persian punjabi sindhi urdu
። ፣ ፤ …:   2  amharic tigrinya
။ ၊:       2  burmese shan
។ ៕ ៖:     1  khmer      ᱾ ᱿: 1 santali      ། ༎: 1 tibetan      ꧈ ꧉: 1 javanese
꠨ ꠩ ꠪ ꠫ ⁕: 1 sylheti

DISTINCT language dirs referencing any such mark: 50
```

**Implication.** Decided: **shared cell, not language data.** Fifty treated layers already declare a
script-specific boundary mark. That is not merely "more than one language" — at `langs: 50` this cell would
rank FIRST in the whole inventory, ahead of `exponent` (24), `degrees` (22) and `ordinal-native` (21), and
the inventory has never had a cell for it. Trap 47 cuts the other way here: putting `⁕` in Sylheti's data
would be filing a fifty-language category under one language's name, which is how the next language repeats
the mistake. `iteration` (`langs: 1`) is already in the list on far weaker evidence; the bar is not the
issue.

The mark set is the boundary marks with **no ASCII identity**. Deliberately excluded, with reasons:

- **Fullwidth `！？；：`** — these are ASCII characters at a different width; that is a width-folding
  problem (NFKC), not an undeclared-mark problem. `。` and `、` have no ASCII identity and ARE included.
- **ASCII `|`** — present in 49 artifacts, 252 occurrences (`syl:33 awa:31 mai:26 hyw:20 …`), and it is
  table-markup residue that survived plain-text extraction, not a terminator. It belongs to
  `filter-markup.py`, and admitting it would make the cell fire on markup noise in half the fleet.
- **`٫ ٬`** — Arabic decimal separator and thousands separator: those are `decimals` and `grouped`.

## Run 4 — 2026-08-12 15:10 — can the staleness marker be satisfied without re-mining?

**Question.** Re-mining is the obvious way to clear the 160 stale artifacts and it is forbidden here, for
two independent reasons. Is there an honest alternative?

**Why re-mining is off the table.** (1) `counts` in an artifact is a WHOLE-CORPUS count over `raw.txt`, and
`raw.txt` is not in the repo — re-mining means re-fetching 160 wikis, and the artifact header itself warns
that a reconstructed invocation silently loses tiers (`km` lost its 200-entry sample; `my` went 35/35 →
33/35 for a missing `--terms`). (2) Re-mining resamples, so every count recorded against these artifacts
elsewhere — the `×33` and `22.1% of the corpus` figures in `defects.ts` and in the per-language
investigation docs — would silently refer to a different sample. Regenerating the fleet to turn a gate green
is precisely trap 24.

**The alternative, and what makes it honest.** An artifact retains its own text: the `hard` tier and the
`sample` tier. A new cell can be evaluated against THAT retained text without re-fetching anything and
without moving a single existing number. What it yields is not a corpus count — the `hard` tier is
adversarially selected and means nothing as a frequency — but it is a sound **lower bound on presence**: if
the mark occurs in the retained text, the language demonstrably writes it, which is the question the cell
exists to ask. Run 3(a) is in fact exactly that measurement, taken by hand.

So the artifact format gains a **separate** `"backfill"` block. It never touches `counts`, it is documented
in the file as a retained-text lower bound rather than a corpus count, and `review.ts` prints it as such on
every run — the gate does not get to say "mined against all 36 cells" when one of them was backfilled.

**Implication.** Proceed: add the cell, backfill it across the fleet from retained text, and keep the
distinction visible forever rather than laundering it into `counts`.

## Run 5 — 2026-08-12 16:20 — the cell, and what it does and does not claim

**Command.** Added `native-terminator` at `langs: 50`, then tested its class against 24 marks it must claim
and 12 it must refuse.

**Raw finding.** `MISSED: none` / `FALSE+: none`; inventory 35 → 36. The refused set is
`| ! ? . , ; : ！ ？ ； ： ٫ ٬`.

**Implication.** The cell is a character class, like `zero-width` and `iteration` — the two cells it most
resembles — rather than a shape with context, because a boundary mark's defect is that it is UNDECLARED, and
an undeclared character is invisible regardless of what surrounds it. Both directions of the class are
guarded by tests in `test/normalization-mine.test.ts`, since "which marks are in" is exactly the kind of
decision that erodes silently.

## Run 6 — 2026-08-12 16:45 — the backfill sweep, and whether anything moved

**Command.** `mine.ts backfill` over `tools/corpus/mined` (160 artifacts), then
`git diff --stat` and a check for removed lines.

**Raw finding.**

```
backfilled 160 artifact(s); 0 already complete
160 files changed, 1760 insertions(+)
removed lines: 0
```

Eleven added lines per file, identical in shape everywhere: seven comment lines, the `"backfill"` block, one
entry, the close. **Not one existing byte changed in any artifact.**

Presence in retained text, by language — 55 languages non-zero, 105 zero:

```
pnb 404  bo 404  skr 400  wuu 394  my 392  sat 374  shn 370  ug 355  km 346  awa 340  ti 333
gan 328  bpy 326  mai 318  ary 314  mag 302  ps 290  syl 287  arz 211  cmn 129  za 106  am 101
ne 98  bn 93  or 90  as 87  ja 84  hi 84  pa 80  hsn 80  yue 79  ur 73  sd 63  bal 59  ar 47
ckb 45  hak 42  fa 41  cdo 41  cjy 38  shi 4  tg 2  … 14 more at 1
```

**Implication, and the two findings worth keeping.**

- `syl` reads **287 of its 322 retained segments** — 89% of the artifact's own text carries the mark whose
  cell did not exist. That is the deferral vindicated: this was never a Sylheti detail.
- The **zero** list is the more interesting half, because it contains languages whose LAYER declares a
  danda: of Run 3(b)'s twenty danda-declaring layers, `gu kn ml mr te` read **0** here while their eleven
  siblings with an artifact all read well above it (`awa 340 mai 318 bpy 326 mag 302 syl 287 ne 98 bn 93
  or 90 as 87 hi 84 pa 80`, plus `shi 4`; `bho` and `hne` have no artifact). The layer declares the mark;
  the retained text does not show it, and the split falls cleanly along Dravidian plus Gujarati and
  Marathi. That is a lead, not a finding — a
  presence lower bound of 0 is not evidence of absence, and the artifact says so in its own words. But
  "declared and never once observed in the retained corpus" is precisely the shape of a rule written from a
  grammar rather than from the corpus, and it is now visible per language for the first time.
- `nan 0` and `hak 0` are consistent with the two commits directly before this branch: those corpora are
  romanised, not Han, so the CJK marks correctly do not appear.

## Run 7 — 2026-08-12 17:15 — the gates, before and after

**Question.** Does any language go stale, and does any gate change state?

**Command.** `review.ts --lang` for `syl` and five unrelated languages, run against the committed tree
before the change and again after; `mine.ts scan` on syl; `npx tsc --noEmit`; `npx vitest run`.

**Raw finding.**

| lang | before | after |
| --- | --- | --- |
| syl | `[ ok ] artifact current  mined against all 35 cells` | `[ ok ] artifact current  35/36 cells mined \| 1 backfilled from retained text, NOT corpus-counted: native-terminator` |
| my | `[ ok ]` … 35 cells | `[ ok ]` … 35/36, 1 backfilled |
| am | `[ ok ]` … 35 cells | `[ ok ]` … 35/36, 1 backfilled |
| hi | `[ ok ]` … 35 cells | `[ ok ]` … 35/36, 1 backfilled |
| nb | `[ ok ]` … 35 cells | `[ ok ]` … 35/36, 1 backfilled |
| bo | fails earlier — `normalizer … missing`, no artifact check reached | unchanged |

Failing checks are IDENTICAL before and after in every case: `syl` 2 FAILING (`sign classes DROPPED: minus`,
`artifact scan DROP minus ×1`), `my` and `am` 1 FAILING each (`DROPPED: minus plus-minus`), `bo` 1 FAILING
(missing normalizer), `hi` and `nb` clean. Fleet staleness after the change: **160 current, 0 stale**, with
inventory 36. `mine.ts scan --in tools/corpus/mined/syl.jsonc --lang syl` reports the same
`DROP minus ×1` and nothing new. `tsc --noEmit` clean; `vitest run` 240 files, 3764 passed, 5 skipped —
including `onnx-optional`, which did not time out on this run.

**Implication.** Zero languages went stale and zero recorded counts moved. The `bo` result is worth keeping
as a negative: Tibetan has 404 retained segments carrying `།`, the second-highest in the fleet, and its
review still fails before the artifact check is even reached because the language has no normalizer at all.
The cell does not fix that; it makes it findable, which is the whole claim being made for it.

## What a reader should do

Nothing, for any language, unless they are re-mining it anyway. `native-terminator` reads as a backfill in
all 160 artifacts and will keep saying so on every `review.ts` run until that language is next re-mined from
a corpus, at which point the block disappears and a real count takes its place in `counts`. The 55 non-zero
languages have the pattern established. The 105 zeroes are unproven either way — `an empty cell is not
evidence` applies exactly as the artifact header states, and the five danda-declaring layers among them are
the natural place for the next person to look.
