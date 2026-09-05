# Raw ASCII Latin surviving into the IPA — building the detector

## Why

Four agents hit the same defect from four directions in one week and no gate saw any of it:

- `hmn` — `syllableToIpa("km")` returned its own input and appended a tone letter.
- `cdo` — `baseToIpa` did the same; `2,133 km²` read `… km˥˥`.
- `mos`/`hmn` — every gate except the corpus diff was byte-identical across a change that
  repaired 14 utterances. hmn's referee is a perfect 455/455 and stayed perfect while `km`
  reached the IPA ×13.
- `ig` — `48 kg` was *pronounced* `iɾi anɔ na asatɔ kɡ`.

The instrument gap is structural, not an oversight. **Every existing leak counter keys on a
SIGN.** `LEAK_CLASSES` holds DIGIT, SLOT-GAP, RAWMARK, ZERO-WIDTH — four output-only regexes
over non-letter characters. A Latin run in a Latin-script language is indistinguishable from a
word by any test of that shape.

## The design problem, stated before any code

The naive detector flags everything. IPA is *written in* ASCII Latin — `m n s a i k p t b d e o
u l r j w h f v z q x y` are all IPA symbols — so `/[A-Za-z]/` over the output is not a detector,
it is a tautology. And in a Latin-script language a real word may legitimately phonemize to a
string identical to itself (`na` → `na`), so a naive source↔output differential is barely
better.

So every candidate below is scored on its FALSE-POSITIVE RATE over the mined fleet before it is
allowed anywhere near `defects.ts`.

## Run 1 — 2026-08-13 — the naive detector, and two obvious repairs

**Command.** A scratch harness phonemizing `hard` + `sample` of one artifact (`ig`, 460 lines)
and scoring four candidate rules.

**Question.** How bad is the naive rule really, and do the two cheap fixes — a unit-abbreviation
list, and a "run sits next to a digit" filter — buy anything?

**Raw finding (ig, 460 lines).**

| candidate | lines fired | rate |
|---|---|---|
| A `/[A-Za-z]/` over the IPA | 460 | **100.0 %** |
| C source↔output token differential, any ASCII run ≥ 2 | 442 | **96.1 %** |
| E differential ∧ run ∈ a 50-entry unit-abbreviation list | 97 | 21.1 % |
| G differential ∧ run is digit-adjacent in the source | 203 | 44.1 % |

**Implication.** A and C are dead on arrival, exactly as predicted — Igbo `na` (and, with) reads
`na`, so it is a "token present verbatim in both" on nearly every line. But E and G are dead too,
and *for a reason worth writing down*: their hits are not units and not numbers.

    E's hits:  in (English preposition), ha (Igbo "they"), mi, ft
    G's hits:  na ×14, nke ×8, ka, maka, dika, elu, the, some

Both rules are *proxies* for "this cannot be a word" and both proxies are wrong: a
two-letter unit abbreviation is spelled like a two-letter word, and Igbo function words swarm
around numerals. **A rule that leans on the CONTEXT of the run cannot fix a rule that is wrong
about the RUN.** Rejected: A, C, E, G.

## Run 2 — 2026-08-13 — the run must be unpronounceable, not merely short

**Question.** Is there a property of `km` / `kg` / `mm` / `th` that no *word* has, and that is
cheap and language-independent to test?

**The idea.** A phonemized word has a syllable. `km`, `kg`, `cm`, `mm`, `th`, `nd`, `pdf`, `mln`
have **no vowel**. `na`, `in`, `ha`, `mi`, `nke`, `dika` do. So:

> **RAWLATIN** — an ASCII run of ≥ 2 letters in the SOURCE that contains **no vowel letter**
> (`aeiouy`, either case) and that survives **verbatim as a whole token** into the IPA.

The differential is still needed: it is what separates "the engine echoed the input" from
"the engine produced a vowelless cluster of its own". Two details the first draft got wrong and
that the measurement forced:

- **Fold ASCII `g` → IPA `ɡ` (U+0261) before comparing.** ig's `48 kg` reads `kɡ`: the engine had
  already mapped the ASCII `g` to the IPA one, so a byte-identical comparison **misses the very
  defect in the brief.** `g` is the only ASCII letter that is not also an IPA symbol, and that
  single codepoint is enough to hide the class.
- **Strip suprasegmentals from the output token before comparing.** cdo's leak is `km˥˥` — the
  tone letter is appended to the echoed input, so the raw token never equals the raw run.

**Raw finding, 10 languages, 2 676 lines.**

    shi 403  vdiff 192 (47.6%)      cs  110  vdiff 0
    hmn 113  vdiff  19 (16.8%)      cy  110  vdiff 0
    ig  460  vdiff  28 ( 6.1%)      ru   97  vdiff 0
    mos 434  vdiff  18 ( 4.1%)      sr  101  vdiff 0
    cdo 398  vdiff   6 ( 1.5%)
    km  450  vdiff   1 ( 0.2%)

**Implication.** The four control languages matter as much as the six hits. `cs`, `ru`, `sr`
were picked because they have **syllabic consonants** — Czech *vlk*, Serbian *krv* — the obvious
way this rule could have been stupid. All four are 0, because a syllabic reading is not
byte-identical to its spelling (`krv` → `kr̩ʋ`), so the differential rejects it before the vowel
test is even consulted. The two halves of the rule cover each other's blind spot.

And `shi` at 47.6 % is the honest counterexample: **Tashelhiyt Berber has genuinely vowelless
words** (`gr`, `tn`, `tg`, `ns`, `dg`, `tskflt`). Not a bug in the rule — a real phonotactic fact
that the rule cannot know. Carried forward to Run 4.

## Run 3 — 2026-08-13 — the whole fleet, and what the hits actually are

**Command.** The Run-2 rule over all 161 mined artifacts, 45 830 lines.

**Raw finding.** 2 010 lines fire (**4.4 %**), in **90 of 161** languages. Ranked by the runs
that fire, across the fleet:

    km:749  mm:83  mw:60  mln:46  pr:34  pp:29  mlrd:29  ft:26  kg:26  th:20
    nd:13   cm:11  st:10  mph:9   sm:9   nr:8   pl:8     lpp:7  kt:7   std:6
    BBC:5   nm:5   www:3  pdf:2   php:2  ftp:2  plkst:1  ptk:1

**This is not a false-positive distribution.** `km` alone accounts for 749 of them and it is the
literal defect in the brief. `mln`/`mlrd` are the Slavic and Turkic million/milliard
abbreviations; `lpp`, `plkst`, `ptk`, `nr`, `std` are Latvian/Estonian page-, clock- and
chapter-abbreviations; `th`/`nd`/`st` are English ordinal suffixes surviving out of `8th`. Every
one of them is a thing the normalization layer is supposed to have expanded.

**But four languages are genuinely mis-read, and they are mis-read for one shared reason.**

    mt   201/449 (44.8%)   fl ×266, bl ×43   — Maltese prepositional clitics fl-, bl-
    shi  192/403 (47.6%)   gr ×184, tlkm ×117, tn, ns, tg, dg  — Berber vowelless words
    rn    97/374 (25.9%)   nk ×40, bw ×37, kw ×36, mw ×15      — Bantu clitics/prefixes
    rw    94/444 (21.2%)   bw ×64, nk ×51, tw ×5               — same

Those four are the entire FP population above 20 %, and in every one of them the offending run is
a **function word or bound clitic that is legitimately vowelless in that language**. The rule's
assumption — "no vowel ⇒ not a word" — is false in exactly these phonologies and true everywhere
else. Note `mt`'s own `km ×76` sits in the same column: the language is both a real FP source and
a real defect site.

**Implication.** Two ways out, both measured in Run 4: (a) an explicit per-language phonotactic
exemption, or (b) a further narrowing of the rule that these four fail and `km` survives.

## Run 4 — 2026-08-13 — narrowing by numeric context: measured, and REJECTED

**Question.** Run 3 left four mis-read languages. Option (b) was to narrow the rule so those
four stop firing without naming them: require the run to sit **next to a digit** in the source,
which is where `km`, `kg`, `mm`, `8th` all live and where the normalization layer's remit is.

**Command.** The Run-2 rule ∧ "a digit within three characters either side of the run", over all
161 artifacts.

**Raw finding.**

| | lines firing | languages |
|---|---|---|
| Run-2 rule | 2 010 | 90 |
| ∧ numeric context | 1 230 | 84 |

The four problem languages:

    rn    97 → 2      ✓ fixed
    rw    94 → 4      ✓ fixed
    mt   201 → 111    ✗ still 24.7 % of the corpus
    shi  192 → 130    ✗ still 32.3 %

**Implication — rejected.** It fails on both sides at once.

- **It does not fix the two worst languages.** Maltese `fl-` is the preposition *in*, and the
  thing you are most often *in* is a **year**: `fl-1091`, `fl-2007`. The clitic is digit-adjacent
  by its own semantics. Berber `gr` (*between*) and `tn` likewise attach to measurements. The
  numeric filter and the FP population are correlated, not orthogonal.
- **It costs 780 real hits, 39 % of the class.** `pr`, `mw`, `pdf`, `www`, `php`, `ftp`, `std`
  and most bare `mm` are not digit-adjacent, and they are all genuine echoes.

A narrowing that deletes two of every five true positives while leaving the largest false
positive untouched is strictly worse than naming the four languages. Rejected.

## Run 5 — 2026-08-13 — writing the rule down broke it twice, and the tests are what found it

**Question.** The rule was measured in a scratch harness. Does it survive being written as the shipped
`rawLatinIn` with adversarial tests either side of it?

**Command.** `npx vitest run test/normalization-defects.test.ts` — 30 cases, half of them negative.

**Raw finding.** 3 failures, and two were real defects in the detector, not in the tests.

1. **`8th` did not fire.** The output token is `8th`: the digit leak and the letter leak are the *same
   token*, so a whole-token comparison sees a string matching no source run and reports **neither**.
   The scratch harness had the same hole and I had read its `th:20` as full coverage. Fix: strip
   `\p{Nd}` from the output token before comparing — the digit is `LEAK DIGIT`'s business. Maltese
   `fl-1091` was failing for the same reason.

2. **⚠ Czech `krk` → `kr̩k` DID fire, and this is the serious one.** Run 2's whole claim was that the
   differential rejects syllabic-consonant words. It does — *until you strip `\p{M}` from the output
   token*, which is exactly what the implementation did in order to handle tone and length marks.
   Folding U+0329 away makes `kr̩k` compare EQUAL to its own spelling and the detector reports Czech
   as leaking. The measurement never caught it because the cs artifact happens to contain no such
   word; only a hand-written adversarial case did.

   Fix: the syllabicity diacritics U+0329 ◌̩, U+030D ◌̍, U+0325 ◌̥ are **a veto, not a strippable mark**.
   A token carrying one is a syllabic reading and can never be an echo.

**Implication.** The negative half of a test file is not ceremony here. A fleet measurement can only
find false positives that some corpus happens to contain, and the single most likely way this rule
could be catastrophically wrong — reporting every syllabic-consonant word in every Slavic language —
was invisible to a 45 830-line sweep and visible to one four-word assertion.

## Run 6 — 2026-08-13 — the shipped detector across all 161 artifacts

**Command.** `rawLatinIn` + the `RAW-CAPS` `LEAK_CLASSES` row over every mined artifact,
`hard` + `sample`.

**Raw finding.**

    161 artifacts, 45 830 lines
    LEAK RAW-LATIN                1 477 lines   3.22 %   in  87 of 161 languages
    LEAK RAW-CAPS                   100 lines   0.22 %   in   1 of 161 languages  (hmn)
    ACCEPTED-PHONOTACTIC            700 lines            in   4 languages
    ACCEPTED-MARKUP                   8 lines            in   6 languages
    clean                                                    74 languages

The firing runs, fleetwide:

    km:774  kg:79  mm:79  ft:45  mln:44  pp:38  th:38  mlrd:23  pr:19  nd:16
    st:15   pm:13  lpp:13 mph:12 nm:11   cm:9   mg:9   tv:8     sm:8   kt:8
    www:7   nr:6   pdf:5  lb:4   klm:4   vs:4   php:2  ftp:2    plkst:1 ptk:1

Worst-affected languages:

    lt   96/464 20.7%   km:36 pr:18 mln:11 mlrd:10 mm:8 kt:7 lpp:5
    kaa  82/443 18.5%   km:48 mln:14 mlrd:12 mm:9
    hmn  19/113 16.8%   BBC Ch Wp GDP BC TV NSW NT  (+ RAW-CAPS on 100 lines)
    et   74/464 15.9%   km:40 mm:5 nt:5 nr:4
    tk   61/430 14.2%   km:40 mln:15 mm:8 kg:5
    ltg  48/394 12.2%   an 54/448 12.1%   lv 49/460 10.7%   gn 43/433 9.9%

**These are real defects, and the three the brief names all reappear.** cdo reports its `km`; ig
reports `th ×8, st ×4, pp ×4, ft ×3, nd ×2`; mos reports `th ×12`; hmn lights up on both classes.

**The exemption behaves as designed.** rn falls to **0** residual hits and rw to **5**; mt falls from
201 lines to **31**, and those 31 are `km ×28, ft ×2, pm ×1` — the language is excused for `fl-`/`bl-`
and still fails for its units. shi falls from 192 to **27**, all of them `km ×25` / `kg ×3`, held by
`ALWAYS_REPORTED` overriding the wildcard.

**⚠ The residual false positives, counted honestly: 3 lines in 45 830.** All three are the same
shape — **a text talking ABOUT its own letters**:

    ha   "tabbatar da furta r da rr daban"      (Hausa contrasting ⟨r⟩ and ⟨rr⟩)
    nci  "ll. Cē yehuac L, ahmo iuhquin lluvia" (Nahuatl on the digraph ⟨ll⟩)
    ig   "…site ka ndị…" listing ⟨gb⟩ and ⟨kp⟩  (Igbo on its own digraphs)

A metalinguistic mention is a genuinely hard case — the correct reading is to *name the letter*, so
arguably these are defects too — and at 0.2 % of the class it is not worth a guard that could hide a
real one. Left reported, and recorded here so the next reader does not re-derive it.

Everything else inspected resolves to an abbreviation the layer should have expanded: `pr.` (lt,
*prieš Kristų*), `ir kt.` (lt), `lpp.`/`plkst.` (lv), `ptk.` (et), `hwd` (kmr, *û hwd* = etc.), `frv.`
(is), `v. gr.` (la), `sq mi` (so), `bn` for billion (tn, pcm) and as Arabic *ibn* in a name (wo),
`tv`, `www`, `pdf`, `php`, `ftp`, `htm`.

## Run 7 — 2026-08-13 — where it plugs in, and one drift found on the way

**Question.** Which table does this belong in — `LEAK_CLASSES`, `DROPPABLE`, or neither?

**Finding, and the decision.** It is **two mechanisms, in two places**, because the class has two
halves with different information requirements.

- **`RAW-CAPS` → a `LEAK_CLASSES` row.** No IPA symbol is an uppercase ASCII letter; the small
  capitals ⟨ʀ ɢ ɪ ʏ ʟ ɴ ʙ⟩ are separate codepoints. So this half is decidable **from the output
  alone**, which is precisely the shape a `LEAK_CLASSES` row is — `(name, regex over the IPA)`.
- **`rawLatinIn` → a third mechanism, an exported function.** The differential half needs the
  **source** and the output. A `LEAK_CLASSES` row cannot express that; it never sees the sentence.
- **Neither belongs in `DROPPABLE`,** and this is the load-bearing bit. `DROPPABLE` means *the symbol
  vanished*, tested by substituting it and comparing readings — raw Latin is the exact opposite
  failure, a thing that **survived**. Worse, `DROPPABLE` cascades into `review.ts:604`, which asserts
  every class maps to a probe string, and into `sources.ts`'s pre-flight rows. That assertion is
  right and I am not going to satisfy it dishonestly: **there is no universal probe for this class.**
  A probe would have to be a unit abbreviation whose correct reading is a *word of the language*, so
  the probe is language data, not a fleet constant. Putting the class in `DROPPABLE` would mean
  either breaking a deliberate assertion or writing a fake probe to quiet it.

Both are consumed by `mine.ts scan` (which `review.ts --lang` runs) and by `coverage.ts`.

**⚠ AND `coverage.ts` WAS NOT ACTUALLY CONSUMING `LEAK_CLASSES` AT ALL.** It carried its own literal —
`\p{Nd}` plus the RAWMARK set — two of the table's four classes, blind to `SLOT-GAP` and
`ZERO-WIDTH`. That is the same drift `defects.ts` was extracted to end, still live in one caller.
Now derived from the table.

**The cost of closing it was measured before closing it**, over every `hard` line of all 161
artifacts:

    SLOT-GAP     0 lines,  0 languages
    ZERO-WIDTH   0 lines,  0 languages
    RAW-CAPS    68 lines,  1 language   (hmn)

So the widening reports one real defect and invents nothing.

**Gates.** `npx tsc --noEmit` clean. `npx vitest run` — 242 files, 3 889 passed, 5 skipped, 0 failed
(`test/onnx-optional.test.ts` included and passing). `mine.ts scan` on cdo, hmn, mt. `review.ts
--lang` on cdo, ln, ig — each now surfaces its raw-Latin leaks in the `artifact scan` row, and mt's
194 `fl-` lines print as `ACCEPTED-PHONOTACTIC` rather than failing it.

## What is left for someone else

The 1 477 leaking lines are **not fixed by this branch** — this branch builds the instrument. The
distribution says where to point it: `km` alone is 774 of them across 87 languages, so a shared
bare-unit pass reaching the remaining engines would close most of the class in one move. `mln`/`mlrd`
(Slavic/Turkic), the `lpp`/`plkst`/`ptk`/`pr.`/`kt.` family (Baltic and Estonian), and the English
ordinal suffixes `th`/`st`/`nd` leaking through Latin-script African-language corpora are three
smaller, well-defined follow-ups.

hmn is a category of its own and should be looked at first: 100 of its 113 sampled lines carry raw
uppercase Latin into the IPA, which means the engine is passing unreadable words through verbatim
rather than failing on them — a much larger hole than the `km` that led here, and one its 455/455
referee cannot see.
