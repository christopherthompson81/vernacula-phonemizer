# ASCII character classes in a Unicode fleet — the `[^\W\d_]` sweep

A confirmed defect in `ak` (`[^\W\d_]` used as "a letter", which under `/u` is still ASCII), and the
fleet-wide sweep for every other spelling of the same assumption: `\w` `\W` `\b` `\B`, `\d` vs `\p{Nd}`,
`[a-zA-Z]` as "a letter", and locale-blind `toLowerCase`/`toUpperCase`/`sort`.

The census is the deliverable. Most hits are CORRECT and stay — a probe for ASCII residue *should* be
ASCII — but "correct" is a verdict that had to be earned per hit, and the ones that are only correct
*because of something else in the pipeline* are the interesting rows.

---

## Run 1 — 2026-08-13 — reproduce the ak defect

Question: is `src/languages/akan/normalize.ts:401` actually broken, or only suspicious?

    s = s.replace(/(?<=[^\W\d_])\.(?=[^\W\d_]\.)/gu, "");   // step 7, dotted abbreviations

Ran `normalizeAkan` on synthetic dotted forms, ASCII and native side by side:

    "A.B.C."  → "ABC."     correct
    "U.S.A."  → "USA."     correct
    "A.Y.B."  → "AYB."     correct        (the era marker the rule was written for)
    "Y.B."    → "YB."      correct
    "Ɔ.K."    → "Ɔ.K."     UNCHANGED
    "K.Ɲ."    → "K.Ɲ."     UNCHANGED
    "Ɛ.Ɔ.A."  → "Ɛ.Ɔ.A."   UNCHANGED
    "D.M.Ŋ."  → "DM.Ŋ."    HALF-APPLIED — the first dot goes, the one before ⟨Ŋ⟩ stays

Confirmed, and the half-applied case is the diagnostic one: the rule does not fail, it stops working
exactly at the language's own alphabet. `\w` is defined on `[A-Za-z0-9_]` by the spec and the `u` flag
does not widen it (it only makes `\W` match a lone surrogate pair as one unit), so `[^\W\d_]` reads
"not-a-non-ASCII-word-char, and not a digit, and not underscore" = "an ASCII letter". Akan's ⟨Ɔ Ɛ Ŋ Ɲ⟩
are none of those. Implication: fix with `\p{L}`, as `ee` did in `bf1ba66`, and sweep for the shape.

## Run 2 — 2026-08-13 — the exact-spelling sweep

`grep -rn '\[\^\\W\\d_\]' src/ tools/ test/` — 4 hits, and only one of them is code that runs:

| hit | verdict |
|---|---|
| `src/languages/akan/normalize.ts:401` | **LIVE** — fixed this run |
| `src/languages/ewe/normalize.ts:312-313` | CORRECT — a comment, recording the trap after `bf1ba66` fixed it |
| `test/ewe.test.ts:151` | CORRECT — same, in a test comment |
| `tools/normalization/filter-by-language.py:341` | **CORRECT** — Python, and `re.UNICODE` is the default in py3: `\W` there *is* Unicode-aware. The idiom is only an ASCII trap in JavaScript. |

Implication: the JS/Python asymmetry is why this idiom spread — it is genuinely correct in the one
place it was probably copied from.

## Run 3 — 2026-08-13 — the fix, and what it did to the corpus

Replaced with `/(?<=[\p{L}\p{M}])\.(?=\p{L}\p{M}*\.)/gu`. `\p{M}` on both sides so a letter carrying a
combining mark is still a letter (trap 23); the lookahead keeps the original "exactly one letter, then a
dot", so no widening of what the rule claims. Re-ran Run 1's readings: all eight now correct
(`Ɔ.K.` → `ƆK.`, `D.M.Ŋ.` → `DMŊ.`), and the four ASCII cases are byte-identical to before.

`corpus-diff.ts emit`/`compare`, `--lang ak --corpus mined:ak`, HEAD vs this tree:

    changed 0/237 (0.0%)
    before  DIGIT 0, SLOT-GAP 0, RAWMARK 0, ZERO-WIDTH 0, RAW-CAPS 0, DROP 26, THROW 0
    after   identical

Zero. Grepped the artifact for the shape and it is all-ASCII — `A.Y.` ×12, `U.S.` ×3, `D.C.` ×3,
`Y.B.` ×2, `N.W.` ×2, `e.g.`, `J.A.`, `F.C.`, `E.B.`, `A.D.`, `A.C.`; no non-ASCII letter appears before
an interior dot anywhere in it.

⚠ So this is an honest **latent-hazard closure, not a corpus mover**, and the write-up should say so.
The 237-utterance artifact is not the 36k paragraphs it was mined from, and a rule that silently
half-applies at the alphabet boundary is worth closing on a synthetic reading; but nothing in the shipped
artifact changes, no golden moves, and the claim is "the rule now means what its comment says", not
"N utterances improved". `mine.ts scan --lang ak` and `review.ts --lang ak` are byte-identical before and
after (still 2 FAIL: `DROP minus`, which the file's header documents as deliberately red until an Akan
negative-number word is attested).

## Run 4 — 2026-08-13 — `\b` and `\B` across the fleet

`\b` is the one the prompt flagged as having bitten most often, so it got the most attention. Raw grep
for a boundary escape in `src/` and `tools/` is 213 lines across 80 files; dropping comment lines (most
of the hits are the fleet's own `⚠ never \b` notes) leaves **131 real uses**.

The classification turns on *which side of the boundary the non-ASCII character is on*, and the two
failure modes are opposite:

* **`\b` before/after a NON-ASCII literal → never matches.** A boundary needs a `\w` on one side, and if
  the pattern's own literal is non-ASCII there is none. This is the Romanian `km/oră` bug already
  recorded in that file.
* **`\b` around an ASCII literal, in non-ASCII text → matches too much.** A non-ASCII letter is not `\w`,
  so it *creates* a boundary: `\bam\b` finds an "am" glued to Cyrillic.

Grepped specifically for the first mode — `\b` directly adjacent to a non-ASCII character or to a `${…}`
interpolation of language words:

    grep -rnP '\\\\?b(?=[^\x00-\x7F$])|(?<=[^\x00-\x7F}])\\\\?b(?![a-zA-Z0-9_])' src/ tools/

**Zero hits.** The fleet has already been swept for that mode; every surviving `\b` sits against an ASCII
literal. Also checked the trailing-`\b`-after-an-interpolated-group cases by hand (`es:238`, `fr:281`,
`pt:245` — `\b1 de (${MONTHS})\b`): every month name in all three languages ends in an ASCII letter, so
the boundary resolves. Correct, if only by luck of the orthography.

That leaves the second mode. Probed the strongest candidates by running the real normalizers:

    fr   "É. Zola"        → "É. Zola"            unchanged
    fr   "e. zola"        → "e zola"
    ro   "măsura"         → "măsura"             unchanged
    ro   "găsit"          → "găsit"              unchanged
    ro   "160 km/oră"     → "160 kilometri pe oră"
    my   "၅ m"            → "၅ မီတာ"
    cs   "24. 8. dočasně" → "dvacátého čtvrtého osmého  dočasně"
    mk   "Панамam"        → "Панампретпладне"    ← spurious
    ig   "ọ25th"          → "ọnke 25"            ← spurious

Findings, one per probe:

* **fr `\b([a-zà-ÿ])\.` (`french/normalize.ts:185`) — CORRECT, but not for the reason it looks.** The
  class carries `à-ÿ` and the `\b` in front of it cannot match an accented initial at all (space then
  `É`: two non-`\w`, no boundary). It is dead weight rather than a defect only because `LETTER_NAME` has
  no accented keys — the callback returns the match unchanged for any letter outside `a`–`z`. Two
  independent things would have to change together for this to bite. Left alone; noted here so the next
  person to add `LETTER_NAME["é"]` knows the `\b` has to go in the same edit.
* **ro `\bm\b` / `\bg\b` / `\bmm\b` (`romanian/normalize.ts:55-57`) — CORRECT.** `măsura` and `găsit`
  survive because the `UNITS` table's regexes are *never applied raw*: step 9 rebuilds each one as
  ``(\d)\s*(?:${re.source.replace(/\\b/gu, "")})(?![\p{L}])`` — it strips its own `\b` and requires a
  digit — and `BARE_UNITS` reads only the literal out of the source. The `\b` in that table is inert
  text. Fragile-by-construction but not wrong today.
* **my `\bm\b` / `\bg\b` (`burmese/normalize.ts:57-58`) — CORRECT**, and interestingly it is the *second*
  failure mode working as intended: Burmese script is not `\w`, so a bare Latin `m` embedded in Burmese
  gets its boundaries for free. `၅ m` reads. (It reads because `foldNativeDigits` — see Run 5 — has
  already made ၅ an ASCII 5 by the time the rule sees it.)
* **cs `do\b` (`czech/normalize.ts:242`) — CORRECT, and redundant.** The alternation it sits in is
  `(?:do\b|\d{4}|[.,\p{Ll}]|$)`, and `\p{Ll}` already subsumes every string `do\b` could claim. Removing
  it would change nothing; leaving it changes nothing.
* **mk `\bam\b` / `\bpm\b` (`macedonian/normalize.ts:210-211`) — LATENT.** `Панамam` → `Панампретпладне`
  proves the shape: a Latin `am` glued to Cyrillic is claimed, because Cyrillic supplies a boundary the
  author did not intend. I could not produce a corpus instance, and Macedonian's Latin runs are
  space-separated names, so this is a hazard and not a defect. Not changed — a `(?<![\p{L}\p{M}])`
  rewrite here is a behaviour change with no evidence behind it, which is how latent hazards become live
  ones.
* **ig `\b(\d+)(?:st|nd|rd|th)\b` (`igbo/normalize.ts:191`) — LATENT**, same shape: `ọ25th` is claimed
  because ⟨ọ⟩ makes a boundary. Contrived; Igbo does not write digits glued to letters.
* Everything else in the 131: `\b` against ASCII unit abbreviations after a digit (`km`, `kg`, `°C`,
  `°F`, `km/h`), against ASCII abbreviation tables (`\b(${ABBREV_ALT})\.` in `es fr pt de id ceb hil`),
  against digits in clock/fraction/date patterns, or inside source-code-reading tooling
  (`review.ts`, `sources.ts`, `coverage.ts`, `registry-map.ts`, `derive-normalization.py` — all matching
  TypeScript identifiers, which are ASCII by construction). **CORRECT.**
* `tools/normalization/mine.ts:702`, ``new RegExp(`\\b${run}\\b`, "gu")`` — **CORRECT**, and worth stating
  because it looks alarming: `run` comes from `rawLatinIn`, so it is by definition an ASCII Latin run.
  The `\b` is matching ASCII against ASCII.
* `src/languages/russian/numbers.ts:58` — CORRECT, and it is the fleet documenting the trap in place:
  the comment reads "тысяча is feminine (JS `\b` fails on Cyrillic)" and the code uses `/два$/` instead.

Implication: **no live `\b` defect remains in the fleet.** The two latent ones (`mk`, `ig`) are recorded
rather than changed. That is a negative result and it is the point of the run.

## Run 5 — 2026-08-13 — `\w` / `\W` outside the `[^\W\d_]` idiom

27 non-comment uses. Every one is CORRECT, and they fall into three groups:

* **source-code and identifier parsing** — `review.ts:288,307,309,325,326,419,424,473`,
  `sources.ts:94,98,859,967,1146`, `coverage.ts:124`, `registry-map.ts:41`, `cells.ts:214`,
  `derive-normalization.py:39,44,68`, `masking-coefficient.ts:94`. These read TypeScript source and
  Markdown tables. Identifiers are ASCII by construction.
* **markup, URL and version syntax** — `malay/normalize.ts:103` (`&(?!\w+;)`, an HTML-entity guard;
  entity names are ASCII), `english/normalize.ts:154` (`NOT_VERSION`, `802.11\w`),
  `wikidump-to-text.py:187-188`, `mine.ts:502`.
* **English-only rules** — `english/normalize.ts:291`, `\b([A-Za-z](?:\.[A-Za-z]){1,4})\.(?!\w)`. This is
  ak's step 7 in its English incarnation, and here the ASCII class is *right*: it is guarding an English
  initialism rule against claiming anything else.

One row deserves a flag rather than a fix:

* `tools/normalization/mine.ts:500`, `PERSONAL = /[\w.+-]+@[\w-]+\.[a-z]{2,}|…/` — **LATENT, with a
  privacy edge.** This is the PII scrub that keeps addresses out of a mined artifact, and `\w` means an
  internationalised address with a non-ASCII local part or host is not recognised. Not changed here: it
  is a mining-time filter, widening it changes what 193 artifacts would contain on a re-mine, and that is
  a decision with its own evidence requirement rather than a side effect of a class sweep. Recorded so
  the next mining run can make it deliberately.

## Run 6 — 2026-08-13 — `\d` vs `\p{Nd}`, and the one fact that decides 386 hits

Question asked first, because it decides everything downstream: **is there a fleet-wide fold of native
digits to ASCII, and does it run before the `\d` rules?**

Answer: **yes.** `foldNativeDigits` (`src/core/unicode.ts`) is called from the `text()` shadow in
`getPhonemizer` (`src/registry.ts`, the `FOLD_OPT_OUT.has(lang) ? pre : foldNativeDigits(pre)` line) for
every language, with a single opt-out — `te`, because ౦ U+0C66 is a homoglyph for ం and Telugu folds
itself after its own homoglyph rule. Verified at runtime across ~25 native-digit languages: `ps as my sat
syl bn hi pa or ta te kn ml ur fa sd bal ug dv bo km lo th ne mr gu`.

So the census verdict for the bulk is: **386 `\d`/`[0-9]` hits across 287 files, and essentially all of
them are CORRECT — but correct *derivatively*, because of a fold two layers up, not because the class is
right in isolation.** That is a distinction worth keeping: the same `\d` in a file that runs *before* the
fold is not safe.

Which is exactly the LATENT set. Four places run ahead of `foldNativeDigits` in the registry's
composition (read the nesting in `registry.ts`: the repairs are applied inside-out and the digit fold is
the outermost call):

| site | why it is latent |
|---|---|
| `src/core/markup.ts:104` `SUP_TAG` | ⚠ another agent's file this round — reported, not touched |
| `src/core/unicode.ts:407` `CARET_RE` (`foldCaretExponents`) | a caret exponent written with native digits escapes the ASCII guard |
| `src/core/unicode.ts:480` vulgar-fraction spacing | same |
| `src/core/roman.ts:144` | same |

None changed: all four want a native digit in a position (superscript tag, caret exponent, beside a
vulgar fraction, beside a Roman numeral) that no corpus in the fleet has been shown to write. Recorded
with the ordering fact that makes them reachable, which is the part that would otherwise be lost.

⚠ **The one genuinely LIVE digit finding — the async/neural entry point bypasses the registry wrapper
entirely, so nothing on that path is folded — is owned by a different agent this round and is NOT fixed
here.** It is cited so this census is not read as clearing it.

Implication, and the reason `src/core/unicode.ts` is in this commit: that file's own doc comment said the
fold is "applied per engine rather than fleet-wide at the registry, deliberately", which is the *opposite*
of what `registry.ts` now does, and a second comment 40 lines down repeated it. A reader auditing any of
the 386 `\d` hits would have gone to that file to check whether they were safe and been told they were
not. Corrected in place, with the opt-out and the ordering constraint stated.

## Run 7 — 2026-08-14 — `[A-Z]` as "a capital letter", and the line that was copied six times

Question: does anything in the fleet use an ASCII letter class where it means "a letter of this
language"? Grep for `[A-Z]` / `[A-Za-z]` / `[a-z]` in `src/languages/` returns 101 non-comment lines,
and one *identical* line appears in six of them:

    s = s.replace(/(?<=[A-Z])\.(?=\s+[A-Z])/gu, "");

⚠ **And in all six the line DIRECTLY ABOVE it is the same rule written correctly**, with `\p{Lu}`:

    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=[A-Z])\.(?=\s+[A-Z])/gu, "");                       // ← the same class, ASCII

The first claims a RUN of initials (`J. S.`); the second claims a SINGLE initial before a capitalised
word (`George W. Bush`). Two lines, one idea, and the class silently narrowed between them. This is the
`[^\W\d_]` trap in the spelling that looks least like a mistake — `[A-Z]` does not *look* like an
assumption, it looks like a definition.

Probed all six by running the real normalizer on a minimal pair, an ASCII surname against one beginning
with a capital the language actually writes:

| lang | ASCII capital — claimed | native capital — NOT claimed |
|---|---|---|
| `ha` Hausa | `"M. Bello"` → `M Bello` | `"M. Ɗanjuma"` → **unchanged**, `"A. Ɓalarabe"` → **unchanged** |
| `ga` Irish | `"S. Mac Gearailt"` → `S Mac Gearailt` | `"S. Ó Riain"` → **unchanged**, `"P. Ó Conaire"` → **unchanged** |
| `ca` Catalan | `"J. Puig"` → `J Puig` | `"J. Àlvarez"` → **unchanged**, `"M. Òdena"` → **unchanged** |
| `cy` Welsh | `"D. Wyn Jones"` → `D Wyn Jones` | `"R. Ŵyn Jones"` → **unchanged** |
| `ff` Fula | `"A. Boyi"` → `A Boyi` | `"A. Ɓoyi"` → **unchanged** |
| `az` Azerbaijani | (same shape; ⟨Ə⟩ is the exposed capital) | |

**LIVE, six times.** The surviving dot is not cosmetic: it reaches the clause assembler as a sentence
terminator, so the name gets a spurious pause inside it. And the Irish row is the worst of the six —
⟨Ó⟩ is not an exotic letter there, it is *the* surname particle, so the rule works on Irish names only
when they are not Irish.

Fixed all six to `(?<=\p{Lu})\.(?=\s+\p{Lu})`, each with the minimal pair recorded at the line.

`corpus-diff` on all six mined artifacts: **0/107 ff, 0/104 ha, 0/109 cy, 0/118 ga, 0/105 ca**, and az's
single change is Run 8's, not this one. So — same honesty as Run 3 — this is proven by reading and not by
artifact: the ~100-utterance artifacts do not happen to carry an initial before a native capital. The
minimal pairs are real orthography, not invented shapes, which is what makes it a defect rather than a
hazard; the artifacts are simply too small to contain it.

## Run 8 — 2026-08-14 — the Turkic dotted I, which is the case half of the same trap

`.toLowerCase()` is `[a-z]`-thinking with a method call instead of a character class, and Turkish and
Azerbaijani are where it stops being cosmetic. Probed the shipped engines:

    tr  "IMF raporu"    → "i me fe raporu"          ⚠ `I` is the DOTLESS capital; its TDK name is *ı*
    tr  "İBB açıkladı"  → /ˈibː at͡ʃɯkɫadˈɯ/         ⚠ read as a WORD — the pass did nothing at all
    tr  "İETT otobüsü"  → /iˈetː …/                 ⚠ same
    az  "IBM sistemi"   → /ˈɯbm sistemˈi/           ⚠ same
    az  "İTV kanalı"    → /ˈitv kɑnɑɫˈɯ/            ⚠ same

Two different mechanisms wearing one symptom, and the second is the one that hides:

1. `"I".toLowerCase()` is `"i"`. Turkish `I` and `İ` are **different letters** with different names
   (*ı* and *i*), so the letter-name table was asked for the wrong one and answered confidently.
2. `"İ".toLowerCase()` is **not `"i"`** — it is `i` + U+0307 COMBINING DOT ABOVE, two code points. No
   letter-name table can key on that, so `spellOut` returns `undefined` and *correctly* declines to emit
   a partial reading. The token then falls through to the phonotactic test, which sees a vowel, says
   "pronounceable", and the acronym is read as a word. **The pass fails by doing nothing**, which is
   invisible to every gate — and it fails only on the one letter that causes it, so every other acronym
   in the language spelling out correctly is what makes it look fine.

Both are in `src/core/initialisms.ts`, which had `.toLowerCase()` written out inline in three places.
Added an optional `lower?: (s: string) => string` to `InitialismData` (default `toLowerCase`, so the
other ~40 consumers are untouched) and routed all three through it; `tr` and `az` now pass the `trLower`
/ `azLower` their own g2p already owns, so there is one definition of the language's lowercase and not
two. Readings after:

    tr  "IMF raporu"   → /ˈɯ mˈe fˈe ɾapoɾˈu/       ı, correct
    tr  "İBB açıkladı" → /ˈi bˈe bˈe at͡ʃɯkɫadˈɯ/    spelled out
    tr  "İstanbul şehri" → /istˈanbuɫ ʃehɾˈi/       ordinary words untouched
    az  "BMT qərarı"   → /bˈe ˈem tˈe ɡæɾɑɾˈɯ/      unchanged (was already right)
    az  "ABŞ prezidenti" → /ˈɑbʃ pɾezidentˈi/       unchanged (lexically a word)

⚠ **`az` needed a second fix, in `azerbaijani.ts`, and it is a nice illustration of ordering as a
defect.** That engine folded `İ→i, I→ı` over the **raw input**, before `normalizeAzerbaijani`. The fold's
own comment is right about why it exists (the `/i`-flag TOKEN class drops `İ` outright) but it ran too
early: `ı` and `i` are LOWERCASE, so an acronym containing either capital I stops being a `\p{Lu}{2,}`
run and the initialism pass never sees it. The `lower` hook alone therefore fixed nothing in az. Moved
the fold to after normalization, where its only remaining consumer is the tokenizer that actually needs
it.

`corpus-diff mined:az`: **changed 1/101**, and it is the defect —

    SRC  II Dünya Müharibəsində SSRİ ilə ABŞ-ın …
     -   … myhɑɾibæsindˈæ ssɾˈi ilˈæ …          SSRİ read as a WORD /ssɾˈi/
     +   … myhɑɾibæsindˈæ sˈe sˈe ˈeɾ ˈi ilˈæ … se se er i — the letters, correctly

`corpus-diff mined:tr`: **changed 1/96** —

    SRC  Denizaltılar I. Dünya Savaşı ve II. Dünya Savaşı'nda …
     -   … ˈi dˈynja savaʃˈɯ …
     +   … ˈɯ dˈynja savaʃˈɯ …

⚠ **This one is correct-but-not-good, and it should be said plainly.** `ı` is the right name for the
letter `I`, so the change is right on its own terms — but the reading is still wrong, because `I.` here
is a ROMAN NUMERAL and should be *birinci*. The same utterance reads `II.` correctly as *ikinci*, so the
Roman rule is claiming two-character numerals and not one-character ones. That is a pre-existing gap in
a different rule, exposed rather than caused by this change, and it is not fixed here — it has nothing
to do with a character class and deserves its own evidence.

`corpus-diff` on three languages that use the shared pass and were NOT changed — **ru 0/97, es 0/115,
uz 0/102** — confirms the `lower` hook is inert by default.

### The one golden that moved

`test/turkish.test.ts`, `phonemize("FBI'ın uyarısı", "tr")`:

    -  "fˈe bˈe ˈi ˈɯn ujaɾɯsˈɯ"
    +  "fˈe bˈe ˈɯ ˈɯn ujaɾɯsˈɯ"

⚠ **The corpus settles this, and it settles it against the old value.** `FBI` is written with the
DOTLESS capital I, and the corpus writes the suffix `FBI'ın` — not `FBI'in`. Turkish vowel harmony takes
`ı` after a BACK vowel and `i` after a front one, so the writer's own suffix records that the final
letter was read *ı*. The old golden had encoded the JavaScript locale bug as the expected answer. The
same test's next comment already said "I→ı is the Turkish-locale lowercase fold, so FIFA is read as
*fıfa*" — the file already knew the rule, and this layer was the one place still breaking it.

No other golden moved. `npx vitest run`: 242 files, the only non-passing being `onnx-optional`
(the documented 5s timeout under load) and `referee-eval`'s `ajp` row, which times out in the full run
and passes on its own — both unrelated.

## Run 9 — 2026-08-14 — what was left alone, and why

The census is the deliverable, so the unchanged rows are recorded with the same care as the changed ones.

**LATENT, recorded, not changed:**

| site | shape | why not changed |
|---|---|---|
| `mk` `\bam\b`/`\bpm\b` | ASCII `\b` in Cyrillic text | shape proven (`Панамam` → `Панампретпладне`), no corpus instance. A rewrite here is a behaviour change with no evidence behind it. |
| `ig` `\b(\d+)(?:st\|nd\|rd\|th)\b` | same | `ọ25th` is contrived; Igbo does not glue digits to letters |
| `fr` `\b([a-zà-ÿ])\.` | `\b` cannot match before an accented initial | harmless only because `LETTER_NAME` has no accented keys. **Two things must change together** — noted at the line for whoever adds `LETTER_NAME["é"]`. |
| `ro` `\bm\b`/`\bg\b`/`\bmm\b` in `UNITS` | dead `\b` in a table | the call site strips it (`re.source.replace(/\\b/gu, "")`) and requires a digit. Inert today; a future reader reusing the table entry directly would reintroduce it. |
| `mine.ts:500` `PERSONAL` | `[\w.+-]+@[\w-]+` | a PII scrub that cannot see an internationalised address. Widening it changes what 193 artifacts contain on a re-mine — a decision with its own evidence requirement, not a side effect of a class sweep. |
| `unicode.ts:407`, `unicode.ts:480`, `roman.ts:144` | ASCII `\d` upstream of the digit fold | see Run 6 |
| `uz` `([A-Z])\.` lone-initial | `[A-Z]` | Uzbek Latin capitals are ASCII (`Oʻ`/`Gʻ` begin with ASCII O/G). Correct for Latin; would miss Cyrillic-script Uzbek, which this engine does not claim. |
| `tr` `DOTTED_ABBREV[ab.toLowerCase()]` | locale-blind case | correct *because* no key contains `i`/`I` (`vb vs dr no`). Add one — `İng.` — and it breaks. |

**CORRECT, and the reasons are worth keeping** (a future sweep should not re-litigate these):

* `filter-by-language.py:341` `[^\W\d_]+` — Python, where `\W` **is** Unicode-aware. The idiom is only a
  trap in JavaScript, which is very likely how it spread.
* All source-code-reading tooling (`review.ts`, `sources.ts`, `coverage.ts`, `cells.ts`,
  `registry-map.ts`, `derive-normalization.py`, `masking-coefficient.ts`) — TypeScript identifiers and
  Markdown tables are ASCII by construction.
* `mine.ts:702` ``new RegExp(`\\b${run}\\b`)`` — `run` comes from `rawLatinIn`, so it is ASCII by
  definition. ASCII matched against ASCII.
* `english/normalize.ts:291` `[A-Za-z]` initialisms — English, where the ASCII class is the correct one.
* `russian/numbers.ts:58` — the fleet documenting the trap in place: the comment says "JS `\b` fails on
  Cyrillic" and the code uses `/два$/` instead.
* **Collation: there is no risk to find.** Every `.sort()` in `src/` sorts by LENGTH or by a numeric
  score, not by string order; the three `localeCompare`-free string sorts are all in `tools/` and all
  sort ASCII keys (language codes, dictionary keys) for stable output files.

**Found in another agent's file, reported not touched:** `src/core/markup.ts:104` `SUP_TAG` uses an
ASCII-only digit class and runs upstream of the fleet-wide digit fold — same latent class as the
`unicode.ts` pair in Run 6.

**Found and routed elsewhere:** the async/neural entry point does not go through the registry's `text()`
shadow, so **none** of the folds — digits included — are applied on that path. That is the one genuinely
LIVE digit finding in the whole census, and it is owned by another agent this round. Cited here so this
document is not read as clearing it.
