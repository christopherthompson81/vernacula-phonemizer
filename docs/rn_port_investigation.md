# Kirundi (rn) — C# port investigation

Chronological log of the runs behind the rn port. rn was picked by the queue's own rule — highest speaker
population among unported codes with a golden: **11M**, ahead of ilo (10M) and the 9M band.

## Run 1 — 2026-08-28 07:10 — what is there to port?

    wc -l src/languages/kirundi/*.ts
        84 kirundi.ts · 24 manifest.ts · 667 normalize.ts · 29 numbers.ts = 804

No shared-core change was needed, and **the compositor was already ported**: rn shares Kinyarwanda's numeral
system, so `numbers.ts` is a 3-line wrapper around `composeRwandaRundi` and `manifest.ts` reuses rw's
`RwandaRundiNumbers` type. The C# mirrors that exactly — `Kirundi/Numbers.cs` calls
`Kinyarwanda.Numbers.ComposeRwandaRundi` with rn's own table. `Registry.cs` already routed
`case "rn": return Create("kirundi")`.

⚠ **AND THAT IS THE ONLY THING rn SHARES WITH rw.** The TS header is emphatic that Kinyarwanda is not a
source for Kirundi, and lists seven normalizer rules that diverge after re-measurement — the one that
matters most being SQUARED, where rw's `kare` is the Kirundi ADVERB "early" (20 hits / 15 articles on
rn.wikipedia, every one adverbial) and rn's word is `kwadarato`. Porting rw's table unmeasured would have
read every area figure as "early kilometres". Nothing was inherited from the sibling file; every pattern was
taken from rn's own.

⚠ **THIS FILE OWNS THE SHARED-TIER CALL**, which the port has to reproduce as a SEQUENCE rather than a
wrapper: de-grouping must run before the tier (rn's whole `version-dot` cell is grouped thousands glued to
an abbreviation, which `NOT_VERSION` refuses) and the decimal spell-out after it. Nine steps, the tier at 7.

⚠ **THE SEPARATOR CLASSES WERE AUDITED BY CODE POINT BEFORE THE FIRST RUN** (the nso lesson, #1109), and
every one in the C# is written as an ESCAPE rather than a literal character — a literal NBSP in C# source is
invisible to review and to every corpus line but one.

⚠ **`saidNear` READS THE PRE-REPLACEMENT STRING**, as JS's `replace` callback argument does, so each of the
nine passes snapshots `s` before its own `Replace`. ⚠ rn does NOT carry rw's `INSERTED` sentinel — rw needed
it because its five degree arms had to hide their own emissions from a later arm's guard; rn's TS has no
such marker, so the C# reproduces the plain behaviour rather than importing the sibling's fix.

**Parity: `dotnet run --project csharp/tools/parity -- rn` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED.

## Run 2 — 2026-08-28 07:20 — the widenings, and what is NOT available

⚠ **rn HAS NO FLEURS CORPUS** — the catalogue says `fleurs 0` and there is no `rn` transcript directory — so
PORTING.md's widening (1), the corpus-wide differential, **does not exist for this language**. Stated rather
than left as a gap: the weight falls entirely on widening (2), the off-golden probes, plus the two artifacts
that do exist.

    .probe/rn/all.txt = 2,158 unique lines
        1,601  tools/referee-eval/referees/rn.epitran-run-latn.tsv, column 1 (the referee WORDLIST)
          390  tools/corpus/mined/rn.jsonc + tools/corpus/attest/rn.jsonc
          200  the golden's own unique text
          176  hand-built off-golden probes (.probe/rn/probes.txt)
    × sync AND async = 4,316 comparisons

**Result: 4,316 comparisons, 0 differ, 0 throws, 0 BLOCKED**, sync output equals async on every row (rn has
no neural path), and a sweep of every C# output for a raw digit or a `$ € £ % ² ³ ° / &` returns **0 lines
of 2,158**.

What the haystack contains, per source — and the honest reading of it:

| step | construct | mined+attest (390) | golden (200) | referee (1,601) | probes (176) |
|---|---|---|---|---|---|
| 1 | dotted capital run | 6 | **0** | **0** | 8 |
| 2 | dotted `d.m.yyyy` date | 1 | **0** | **0** | 7 |
| 3 | comma grouping | 21 | 7 | **0** | 15 |
| 3 | period grouping | 21 | 3 | **0** | 7 |
| 3 | space grouping | 5 | **0** | **0** | 5 |
| 4 | unit before its number | 3 | **0** | **0** | 6 |
| 5b | slash span | 8 | 6 | **0** | 8 |
| 5c | dash span | 9 | **0** | **0** | 13 |
| 6 | degree sign | 7 | 6 | **0** | 16 |
| 6d/7 | percent | 15 | **0** | **0** | 6 |
| 7 | currency sign | 3 | 1 | **0** | 6 |
| 8 | bare denominator | 5 | 1 | **0** | 4 |
| 8b | `N:NN` colon | 3 | 1 | **0** | 5 |
| 9 | decimal | 6 | 2 | **0** | 15 |

⚠ **THE GOLDEN REACHES ONLY FOUR OF THE NINE STEPS.** Steps 1, 2, 4, 5c and 6d are ×0 in it, and so is
space grouping. ⚠ **AND THE 1,601-LINE REFEREE LIST IS A WORDLIST — it carries ONE digit in total**, so it
exercises the g2p broadly and the normalizer not at all. Counting it toward "2,158 lines" would overstate
the coverage badly; it is listed separately for that reason. Five of the nine steps rest on the mined
artifact and the hand probes, and two of those (the dotted date at ×1, unit-before-number at ×3) rest on
counts small enough that the probes are doing the real work.

## Run 3 — 2026-08-28 07:32 — the whole-fleet gate

`dotnet run --project csharp/tools/parity` → **135 languages byte-identical, 26,627 rows ok, 0 differ, 0
BLOCKED**; `dotnet test` → **2,566 passed, 0 failed** (84 new `KirundiTests` cases + the
`KirundiManifestIsFullyMapped` structural check).

## Run 4 — 2026-08-28 07:34 — reading for correctness

Three findings. All are reproduced IDENTICALLY by both engines, so all three are FILED rather than fixed
here (PORTING.md: the fix lands in the TypeScript first, with a test and regenerated goldens).

### FINDING 1 (#1135) — a CUBE reads as a SQUARE in two of rn's three exponent paths

`normalize.ts` states the refusal plainly:

> ⚠ NO CUBE WORD IS DECLARED. `m³` and `km³` are ×0 in rn and no Kirundi cube word is attested — the trap 51
> floor, recorded rather than guessed.

The tier honours it. **The two LOCAL arms do not.** Step 4 (unit-before-number) and step 8 (bare
denominator) both put `³` in the pattern's alternation and then map *every* exponent to `SQUARED`:

```ts
(_m, key, exp?) => (exp === undefined ? noun : `${noun} ${SQUARED}`)
```

So one construction reads three different ways in one language, depending only on where the number sits:

    km³ 517       → ibirometero kwadarato 517        step 4  — a CUBE stated as a SQUARE
    (233/km³)     → kuri kirometero kwadarato        step 8  — the same
    517 km³       → ibirometero³ 517                 the tier — refuses to name it (and strands the ³)

A dropped exponent is a lossy reading; a cube ANNOUNCED as a square is a false one, and it is the trap-53
shape the playbook names — half a reading is not a reading. The sibling layers refuse it explicitly
(`sepedi/normalize.ts`: *"no cube word exists for nso"*, returning the whole match), so this is not a fleet
convention, it is rn's own gap. **×0 in the corpus, so latent** — but the guard costs one comparison and the
file already argued for it in prose.

### FINDING 2 (#1136) — step 3's space-grouping arm eats an ASCII exponent digit, and `km` then leaks raw

Step 4's own comment anticipates the ASCII exponent:

> ⚠ THE KEY IS BOUNDED ON BOTH SIDES and the SPACE IS MANDATORY … The unspaced shape means something else
> entirely — `km2` is `km²` with an ASCII exponent — and an optional space would let this rule read that `2`
> as the unit's NUMBER.

The mandatory space does hold. What the comment does not anticipate is that **step 3 runs first** and its
space-grouped-thousands arm matches `2 517` inside `km2 517` — head `2`, block `517`, and the lookbehind
`(?<![\d.,])` is satisfied because the preceding character is `m`:

    km2 517  →  km2517  →  *km ibihumbi bibiri na amajana atanu na icumi na indwi*

The exponent digit is glued onto the number, the figure is read as 2,517 instead of 517, and `km` reaches
the phoneme stream RAW — which is the very leak step 4 exists to close. Same for `km3 517`. Also ×0 in the
corpus (all four corpus instances write the superscript), so latent; the fix is a letter-boundary guard on
the grouping head, and it belongs in the TS with a test. ⚠ AND IT GENERALISES PAST UNITS — the lookbehind
admits any preceding LETTER, so `R2 500` → `R2500` too.

### FINDING 3 (#1137) — the `US$` compound key cannot match any of the three shapes it was declared for

`normalize.ts` says:

> Both the bare `$` and the compound `US$` key are declared, because the corpus writes `US $ 4,000`,
> `US $ 7.34` and `US $ 0.18` with the country prefix

The compound key matches `US$4,000` and `US$ 4,000`. It does **not** match `US $ 4,000` — the space between
`US` and the sign — and that is how **all three** of rn's corpus instances are written:

    US $ 4,000   → US amadorari 4000      the `US` survives as a word
    US$4,000     → amadorari 4000         the shape the key was written for — ×0 in this corpus

The TS header's own "what was broken" table lists `US $ 4,000 → us kane , zeɾu` — "sign dropped, and `US`
read as the word *us*". Half of that defect is fixed (the sign is now read); the other half is still
shipping, and the file believes it is not. This is the only one of the three findings that is **LIVE rather
than latent** — 3 of 3 corpus instances — and it is pinned as it SHIPS in `KirundiTests`, with the note, so
the port does not quietly bless it.

### Recorded, not filed — the manifest's stale `convention` block

`kirundi.jsonc`'s `convention.affricates` reads `⟨c⟩→t͡ʃ, ⟨j⟩→ʒ, ⟨sh⟩→ʃ` — Kinyarwanda's value for ⟨j⟩,
contradicting the same file's header ("ONE confident delta: ⟨j⟩ → d͡ʒ"), its own grapheme table (`"j":
"d͡ʒ"`) and the shipped reading (`jana` → *d͡ʒana*, verified). Above the number block a second leftover reads
"Cardinal number words (Kinyarwanda) … makumi abiri = 20", naming the fused rw form that rn's corrected
comment two lines below explicitly rejects. `convention` is metadata neither engine reads, so nothing is at
stake in the output — but it is the one place a reader looks up the rw/rn difference, and on that question
it currently gives the wrong answer twice.

## Verdict

    parity rn               200/200 byte-identical, 0 BLOCKED — first run
    parity fleet            135 languages, 26,627 rows, 0 differ
    differential            4,316 comparisons (sync + async), 0 differ, 0 throws
    dotnet test             2,566 passed, 0 failed
    leak sweep              0 of 2,158 outputs carry a digit or an unread symbol
    findings                3, all reproduced identically by both engines → FILED (#1135, #1136, #1137)
    ⚠ NO FLEURS             widening (1) is unavailable for rn; the probes carry it, and the golden
                            reaches only four of the nine normalizer steps

## Run 5 — 2026-08-28 07:55 — rebase onto lg + #1134, and the recount

**Question.** #1133 (the lg port) and #1134 (the TS-side fix for lg's ⟨ŋ⟩ finding) both landed while rn was
in review. rn was branched from the same `main` as lg, not stacked on it, so what does the rebase move?

    git rebase origin/main       3 conflicts, all BOOKKEEPING

The conflicts were exactly the three files two independent ports must both touch, and none of them is code
that runs: `Bootstrap.cs` (adjacent registration lines — keep both), `ManifestMappingTests.cs` (adjacent
`[Fact]` blocks — keep both), and `STATUS.md` (the shared counters and the `Ported:` list — union, and the
lg section kept verbatim as its author rewrote it in Run 5 of that doc).

⚠ **AND THE BASE HAD MOVED UNDER THE FIRST MEASUREMENT, WHICH IS THE REASON TO RE-RUN RATHER THAN TO
RE-STATE.** #1134 touches `src/languages/luganda/`, `data/languages/luganda/` and `test/` only — no shared
core — so rn's readings should be untouched. "Should be" is not a measurement, so the whole gate was run
again on the rebased branch rather than carried over:

    parity rn        200/200 byte-identical, 0 BLOCKED
    parity fleet     136 languages, 26,827 rows, 0 differ      (135 / 26,627 before lg landed)
    dotnet test      2,677 passed, 0 failed                     (2,566 before, + lg's cases)
    differential     4,316 comparisons, 0 differ, 0 throws
    ⚠ byte-diff of the C# output against the PRE-REBASE run: **0 of 2,158 lines changed**

So the expectation held, and it is now measured rather than assumed. The counters in this doc's Runs 2–3 are
left at the figures that were true when those runs happened; the current-state numbers are the ones above
and in `csharp/STATUS.md`.

## Run 6 — 2026-08-28 08:20 — #1135 fixed, and the fix is NOT the one the issue proposed

**Question.** Finding 1 said a cube is announced as a square in steps 4 and 8. The issue proposed the nso
shape — *refuse the whole match*. Is that right for rn?

**No, and the shared tier says why.** `core/normalizeSymbols.ts` already has a reasoned convention for a
power a language has not declared, and it argues against refusing:

> ⚠ NO MEASURE WORD DECLARED — emit the UNIT and hand the exponent back rather than abandoning the match.
> Returning `whole` loses the QUANTITY too, not just its power: the abbreviation reaches the phoneme sink
> verbatim. Re-emitting the exponent keeps the unit's reading and leaves `²` where the leak gate can see it,
> turning an invisible missing reading into a visible missing WORD in one language's data.

And rn's step 4 states its own purpose in the same terms:

> The output is the SAME SHAPE the tier's `unitPrefix` produces for the other 15, from the same table … so
> the two orders converge on one reading and neither can drift.

So the arm whose job is to converge with the tier must also FAIL the way the tier fails. Refusing would have
made the three paths differ in a *new* way instead of the old one — and would have put `km³` raw into the
phoneme stream, which is the leak step 4 exists to close. Both arms now share one `exponentPhrase` helper,
so they cannot drift from each other either.

**What moved.**

    km³ 517       ibirometero kwadarato 517   →  ibirometero³ 517
    (233/km³)     kuri kirometero kwadarato   →  kuri kirometero³
    (233/km3)     kuri kirometero kwadarato   →  kuri kirometero³      ← ASCII, and see Run 7
    3372 hab/km3  kuri kirometero kwadarato   →  kuri kirometero³
    517 km³       ibirometero³ 517            →  unchanged (the tier, and now the reference)
    km² 517       ibirometero kwadarato 517   →  unchanged — the square HAS a word
    517 km²       ibirometero kwadarato 517   →  unchanged
    (233/km²)     kuri kirometero kwadarato   →  unchanged

End to end the ³ is dropped by the g2p, so all three cube paths now SAY the same thing —
*ibiɾometeɾo amad͡ʒana atanu na it͡ʃumi na indwi* — where before two of them said *kwadarato* and one did not.

⚠ **THE ASCII SPELLING IS NOT COVERED IN STEP 4, AND THAT IS #1136 RATHER THAN AN OVERSIGHT.** `km3 517`
never reaches step 4: step 3's space-grouping arm eats the `3` first. The TS test says so at the point where
the assertion would otherwise go, so the two defects stay separately measurable.
⚠ **STEP 8's ARM HAS NO SUCH BLOCKER, AND ITS ASCII FORM IS WHERE THE FIRST CUT OF THIS FIX WENT WRONG** —
see Run 7. The table above records step 8's ASCII rows because this PR does change them.

**Gates** (TS first, then the goldens, then C# — PORTING.md's order):

    npx vitest run test/kirundi.test.ts     26 passed  (1 new test, 8 assertions)
    npm test                                288 files, 5,677 passed, 5 skipped
    npx tsc --noEmit                        clean
    tools/gen_parity_goldens.mts rn         **0 rows moved** — as predicted, ×0 in the corpus
    parity fleet                            136 languages, 26,827 rows, 0 differ
    dotnet test                             2,679 passed, 0 failed
    differential                            4,328 comparisons (12 new cube probes), 0 differ, 0 throws

⚠ **THE GOLDEN CANNOT SEE THIS FIX** — 0 rows moved in either direction, which is exactly what a ×0-in-corpus
finding predicts and exactly why the differential probes had to carry it. The 12 new cube lines in
`.probe/rn/probes.txt` are the only thing that measures it.

**Checked, and it is not a fleet class.** Every other language with this callback shape either declares a
cube word and discriminates (rw, hu, ko, mn) or admits only `[²2]` in its alternation so a cube can never
match (zu). nso refuses. rn was alone in admitting `³` and then not distinguishing it.

## Run 7 — 2026-08-28 08:30 — the first cut of the fix INVENTED A NUMBER, and the gate could not see it

**What review caught.** Handing the exponent back is right for the superscript and wrong for the ASCII
digit, and step 8's denominator arm reaches the ASCII alternation with no #1136 blocker in front of it. So
the first cut turned a wrong WORD into an invented QUANTITY:

    (233/km3)      before  …kuɾi kiɾometeɾo kwadaɾato       "per SQUARE kilometre"   — wrong word
                   cut 1   …kuɾi kiɾometeɾo ɡatatu          "per kilometre THREE"    — invented number
                   now     …kuɾi kiɾometeɾo                 "per kilometre"          — missing word
    3372 hab/km3   same three states

The cause is one character: `³` is dropped by the g2p, but `3` is a DIGIT, so the tokenizer claims it and the
number path speaks it. Re-emitting the exponent "where the leak gate can see it" only works for a character
the reader cannot say. **The fix is to hand a cube back as the SUPERSCRIPT regardless of how it was
written** — visible to the gate, silent to the reader, and no invented quantity.

⚠ **AND THE ORDERING OF HARMS IS NOW EXPLICIT IN THE CODE, because this run is what established it:**
*missing word ≥ wrong word ≫ INVENTED NUMBER.* The PR's original framing ("a wrong word is worse than a
missing one") was right as far as it went and did not rank the third case, which is the one the first cut
produced.

⚠ **NOTHING IN THE GATE SET COULD SEE IT, WHICH IS THE REAL LESSON.** The golden moved 0 rows (×0 in
corpus). The TS↔C# differential compared 4,328 rows and passed — **because both engines moved together**: a
differential proves the two engines AGREE, and both were newly wrong in the same way. `.probe/rn/probes.txt`
already carried `(233/km3)` and `3372 hab/km3`, so the shapes were present and the harness still reported
green. Only reading the OUTPUT against the previous output found it. That is PORTING.md's own warning —
"the parity gate cannot ask 'is this right?' for you" — arriving against a change of my own rather than
against inherited code.

**A separate, pre-existing finding this surfaced (filed as #1145, not fixed here).** The SHARED TIER does the same
thing: `517 km3` reads *ibiɾometeɾo ɡatatu amad͡ʒana atanu…* — "kilometre three, five hundred and seventeen"
— on origin/main, before and after this change. `normalizeSymbols.ts`'s undeclared-power branch re-emits
`exp` verbatim, and for an ASCII exponent that is a spoken digit in any language that declares one power and
not the other. rn is merely where it was noticed; the fix belongs in the tier and affects every such
language, so it is filed rather than patched from here.

**Re-gated after the correction:**

    npx vitest run test/kirundi.test.ts   26 passed (the cube test now carries the ASCII denominator too)
    npm test                              288 files, 5,677 passed, 5 skipped
    parity fleet                          136 languages, 26,827 rows, 0 differ
    dotnet test                           2,681 passed, 0 failed
    differential                          4,328 comparisons, 0 differ, 0 throws
    gen_parity_goldens.mts rn             0 rows moved

## Run 8 — 2026-08-28 09:15 — #1136, and the guard the issue proposed would have broken a real number

**The defect.** De-grouping's SPACE arm claims a head digit preceded by a LETTER, so `km2 517` — the ASCII
spelling of `km² 517`, which this corpus writes four times with the superscript — matched as `2 517`:

    km2 517  →  km2517  →  *km ibihumbi bibiɾi na amad͡ʒana atanu na it͡ʃumi na indwi*

Three failures at once: the exponent glued onto the number (517 read as **2,517**), the space deleted, and
`km` left in the phoneme stream RAW — the leak the unit rule exists to close, reached because that rule ran
second and never saw the token.

**⚠ THE FIX THE ISSUE PROPOSED IS WRONG, and the counter-example is a shape this language writes.** The
issue said: *"a letter boundary on the grouping head — the head should not be allowed to start immediately
after an ASCII letter."* Measured before implementing:

    R2 500  →  R2500      ✓ CORRECT TODAY — a grouped thousand with a currency prefix, 2,500

A letter-boundary guard rejects that head and leaves `R2 500`, which the tokenizer then reads as **two
numbers**, *kabiri … amajana atanu* — "two, five hundred". The guard would have traded a latent defect for a
live one. **The discriminator is not the letter, it is whether the letters are a UNIT KEY** — which is
exactly what the unit rule already knows.

**So the fix is an ORDER, not a guard: the unit-before-number rule now runs BEFORE de-grouping** (steps 3
and 4 swap, and are renumbered so the file still reads in execution order). The unit becomes a WORD before
de-grouping ever looks, so no later arm can see a letter-adjacent head that is really an exponent.

⚠ **THE OLD ORDER'S STATED REASON DOES NOT SURVIVE READING.** It was *"AFTER step 3, so a grouped operand
(`km 1,965`) is already one digit run"* — but the rule's lookahead is `(?=[  ]\d)`, which needs the
operand only to START with a digit. It never needed the de-grouping, and the four spaced corpus forms
(`km 1,965`, `km 1 965`, `mm 1.000`, `km² 517`) are byte-identical either way. Verified, not assumed.

**What moved, over the whole 2,169-line differential set: exactly two rows.**

    km2 517   km ibihumbi bibiɾi na amad͡ʒana atanu…  →  ibiɾometeɾo kwadaɾato amad͡ʒana atanu…
    km3 517   km ibihumbi bitatu na amad͡ʒana atanu…  →  ibiɾometeɾo amad͡ʒana atanu…

Nothing else — not one line of the mined corpus, the golden text or the 1,601-word referee list. And the
second row is a bonus: **#1135's cube handling was unreachable for the ASCII spelling** because this defect
ate the token first, which that PR recorded as a known gap. Fixing the order closes it.

⚠ **CASE IS COVERED FOR FREE** — the unit rule carries the `i` flag, so `Km2 517` and `KM2 517` read
correctly, where a hand-written lookbehind guard in the de-grouping arm would have needed the case variants
spelled out (that arm has no `i` flag).

⚠ **AND THE FIRST CUT OF THIS FIX WAS NARROWER THAN THE ARM IT GUARDS — the same defect one axis over.**
Review caught it. The unit rule's lookahead carried `[space, NBSP]` while de-grouping's space arm carries
`[space, NBSP, NNBSP, thin space]`, so a NNBSP or a thin space between the unit and its figure made the unit
rule DECLINE and let de-grouping claim the exponent after all:

    km2<NNBSP>517  →  km2517       ← verbatim the failure this ordering exists to prevent
    mm3<NNBSP>517  →  mm3517       ← and #1135's cube handling unreachable again

Two classes that must agree, character for character, and the reorder is only as wide as the narrower one.
The lookahead now carries all four. ⚠ THE ASSERTIONS FOR THIS ARE ON THE READING, not the intermediate text:
the separator itself survives normalization (it is whitespace, and `tidy` only collapses RUNS), so what has
to be equal is what is SPOKEN.

⚠ **THE MULTI-GROUP CASE IS AMBIGUOUS, AND THE TEST NOW SAYS SO INSTEAD OF PRESENTING ONE ANSWER.**
`km2 517 000` → `ibirometero kwadarato 517000` reads km² + 517,000; the competing reading is `km` + a
misplaced space inside 2,517,000. Glued `km2` is the ordinary ASCII spelling of `km²` while the alternative
needs the writer to have DROPPED the space after `km`, so the exponent reading is the likelier one — but it
does change the quantity, which is this file's own worst class, so it is recorded rather than assumed. The
old behaviour was not the safe side either: `km2517000` leaked `km` AND read 2,517,000. ×0 in the corpus.

⚠ **WHAT IS STILL NOT FIXED, SAID RATHER THAN IMPLIED.** `km2,517` and `km2.517` — the ASCII exponent with
NO space — remain `km2517`. The unit rule's space is mandatory (`km2` unspaced is `km²`, and an optional
space would let the rule read the `2` as the unit's number — trap 28), so it declines them and the comma and
period arms still claim the head. Both shapes are ×0 in the corpus and neither is a plausible way to write a
squared kilometre; recorded so the next reader does not think they were missed.

**Gates** — TS first, then the goldens, then C#:

    npx vitest run test/kirundi.test.ts   27 passed (1 new test)
    npm test                              288 files, 5,680 passed, 5 skipped
    npx tsc --noEmit                      clean
    gen_parity_goldens.mts rn             **0 rows moved**
    dotnet test                           2,704 passed, 0 failed
    parity fleet                          136 languages, 26,827 rows, 0 differ
    differential                          4,364 comparisons (13 new probes), 0 differ, 0 throws

## Run 9 — 2026-08-28 09:45 — #1137, and it is a CORE fix rather than an rn one

**The defect.** rn declares `US$` and `$`. The compound key is matched as a LITERAL, so it never matched the
shape rn's corpus actually writes — all three instances are `US $ 4,000`, with a space between the letters
and the sign. The bare `$` claimed the amount and `US` was left to reach the g2p as the word *us*:

    US $ 4,000  →  US amadorari 4000  →  *us amadoɾaɾi ibihumbi bine*

The TS header lists exactly this as a defect it closed (`US $ 4,000 → us kane , zeɾu`). Half of it was
closed; the half that needed the compound key was not, and the file recorded it as done.

**⚠ AND IT IS NOT AN rn DEFECT.** `US$` is declared by **36 language layers**, and the matching lives in
`core/normalizeSymbols.ts`. Fixing it in rn's own table (by declaring `"US $"` as a second key) would have
left 35 other layers with the same gap and put a workaround where the bug is not. So the fix is in the tier:
a compound key admits the tier's own optional separator **at its letter→sign seam**.

⚠ **ONLY AT THAT SEAM, AND THE ALL-LETTER CASE IS WHY.** The separator is inserted where a run of letters is
followed by a run of non-letters, so `US$`, `AUD$` and `CN¥` gain it and `PLN`, `zł`, `Frw` do not. A code
with no seam must not admit a space, or the key would match across the gap between two real tokens — pinned
as `USD 400` ✓ against `US D 400` ✗.

⚠ **AND THE LOOKUP HAD TO FOLLOW THE PATTERN.** The matched text is now `US $`, while the table is keyed
`US$`; indexing on the literal alone threw a TypeError out of `money()` on the very shape the seam was opened
for. Both engines consult the literal first and the seam-closed form second.

**What moved, fleet-wide: `tools/gen_parity_goldens.mts` regenerated ALL 169 goldens and TWO rows changed.**

    rn   …ja **us** amadoɾaɾi ibihumbi bine…       →  …ja amadoɾaɾi ibihumbi bine…
    ilo  …ŋˈɛm **ʔˈus** mˈajsa pˈunto dwˈa lˈima dˈoljaɾ…
                                                   →  …ŋˈɛm mˈajsa pˈunto dwˈa lˈima dˈoljaɾ tˈi ʔɛstˈados ʔunˈidos…

Both are the stray `us` disappearing, and ilo's row additionally gains the fuller noun its own table
declares for `US$` — *doliar ti Estados Unidos*, which ilo sourced from its corpus's definitional sentence
*"Ti doliar ti Estados Unidos (senial: $; kodigo: USD)"*. ⚠ ilo's own layer header records this class as
`US$53.9 milion → ʔˈus limapˈulo…  the sign dropped ×98`, so the spaced form was a live defect there too and
nobody had measured it.

⚠ **THE FLEET-WIDE BLAST RADIUS WAS MEASURED BEFORE THE CHANGE WAS TRUSTED, NOT AFTER.** 36 layers declare a
compound key and 46 golden input rows carry the unspaced form; the question was how many carry the SPACED
one, and the answer is two. A first scan suggested ~42 rows across 22 languages and was WRONG — it matched
the last letters of an ordinary word before a sign (`of $1000`), which no declared key can claim. The
authoritative measurement is regenerating every golden, not grepping for a shape.

⚠ **AND TWO SIBLING LAYERS HAD PINNED THE DEFECT AS THE ANSWER.** The full TS suite failed on
`test/kinyarwanda.test.ts`, whose currency test asserted `US $ 115,600,000` → **`US` amadolari 115600000` —
the leak, frozen as expected behaviour. (The very next line in that file carries a comment beginning *"THIS
LINE USED TO PIN THE DEFECT AS THE ANSWER"* about a different assertion, so the file has form.) rw declares
`US$` and had the same live defect; its golden happens to carry no such row, so only the unit test saw it.
Corrected with the note, not deleted.

⚠ **AND THE FIRST CUT OF THE SEAM ATE AN AFRIKAANS PRONOUN.** Review caught it. The seam was
`^(\p{L}+)(\P{L}+)$` — no minimum on the letter run — so it also widened the ONE-letter code `U$` that
Afrikaans declares, and ⟨U⟩ is that language's capitalised polite second-person pronoun:

    U $50 skenking is ontvang    before  ˈyː fˈəiftəχ dˈɔlər skˈɛŋkəŋ …      "you fifty dollar donation"
                                 cut 1   fˈəiftəχ **fˈiə ˈɛs** dˈɔlər …      the pronoun GONE, and a plain
                                                                             dollar sum re-read as a US one

Two harms at once: a word deleted and a currency changed. `{2,}` on the letter run keeps every compound key
declared today (`US$ AS$ AUD$ CN¥ HK$ NZ$ VS$`) and excludes exactly the one that is also a word. ⚠ THE
HEADER'S SAFETY ARGUMENT HAD REASONED ONLY ABOUT `US`/`AUD`/`CN` — it never considered a letter run short
enough to be a word, which is the whole hazard class.

⚠ **A SECOND, NARROWER TRADE-OFF, RECORDED RATHER THAN FIXED.** Where `US` is a standalone country mention
AND a number follows, the mention is now consumed: `In the US $4,000 was raised` (tl) loses its *ʔˈus*.
Unspaced `US$4,000` is unambiguously a currency prefix; the spaced form is not. It is per-layer: the ~20
layers whose `US$` form names the country (rn `amadorari`, ilo *doliar ti Estados Unidos*, rw, sq, om, su,
mad, st, km, nan, yo …) read correctly, and the ~10 whose form does not (tl, pcm, ig, sn, tn, nso, wo, haw,
mi, gu, kea) drop the mention. Left as it is: the currency reading is the commoner shape by far, and the
alternative is to refuse the spaced form entirely, which is the defect this fix exists to close.

**Gates:**

    npx vitest run test/normalize-multilang.test.ts   85 passed (2 new core tests)
    npm test                                          288 files, 5,683 passed, 5 skipped
    npx tsc --noEmit                                  clean
    gen_parity_goldens.mts (ALL)                      2 rows moved, in 2 files, both correct
    parity fleet                                      136 languages, 26,827 rows, 0 differ
    dotnet test                                       2,719 passed, 0 failed
    rn differential                                   4,372 comparisons, 0 differ, 0 throws
    tools/extract_regexes.mts                         re-extracted (the seam pattern is new)
