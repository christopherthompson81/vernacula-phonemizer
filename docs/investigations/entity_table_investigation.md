# The named-entity table in `core/markup.ts` — 23 entities that occur and are not decoded

Chronological log for the `b/entity` run. The handover: 38 distinct named entities occur across the mined
corpora and 23 of them are absent from `NAMED`. The `gn` run had already reported one of them by hand —
`&thinsp;` reaching the IPA as *tˈhinsp* — and declined to fix it in a language commit because
`src/core/markup.ts` is shared by all 193 engines.

The file has a stated opinion, and it is the frame for everything below:

> An unknown entity is deliberately left literal … which is right for a name nothing can render. These are
> listed because each maps to a character the engine ALREADY reads.

So the test for adding a row is **not** "does the entity occur". It is "does the engine read what it decodes
to?" — and the `<sub>` comment in the same file states the corollary that decided most of this run: *a
transform is only a repair if something downstream can read what it produces.*

## Run 1 — 2026-08-13 (reproduce the count, do not trust it)

**Question.** Are there really 38 distinct entities and 23 absent ones, and which language does each come
from?

**Command.**

```
grep -ohP '&[a-zA-Z][a-zA-Z0-9]*;' tools/corpus/mined/*.jsonc | sort | uniq -c | sort -rn
```

**Raw finding.** 38 distinct, and the handover's 23 reproduce exactly. Counts are long-tailed: `&nbsp;`
×2,305, `&ndash;` ×64, `&amp;` ×22, then `&thinsp;` ×17 and `&egrave;` ×16, and 15 of the 23 occur exactly
once. Per-language attribution:

```
thinsp gn la    lrm pnb    zwnj kaa    bull qu    fnof lo    gamma gd    phi lambda sn
Pi alpha nu si  real image yo  ocirc ps
aacute agrave ccedil eacute egrave ecirc iacute icirc ograve  — all nine oc
```

**Implication.** A frequency argument would add `&thinsp;` and stop. It is the wrong argument for this file,
and 15-of-23-at-×1 is exactly the shape that tempts someone to paste a full HTML5 table instead. Each one
needs its own end-to-end measurement.

## Run 2 — 2026-08-13 (what each of the 23 does today, literal vs decoded)

**Question.** For each entity, in the language it actually occurs in: what does the literal read as, and what
would the decoded character read as?

**Command.** `npx tsx probe-entity.scratch.mts` — each entity in a frame `xa … ax`, against the decoded
character in the same frame and against the bare frame as a baseline.

**Raw finding.** The literal is audible garbage nearly everywhere, and the mechanism is uniform: the symbol
tier reads the `&` as the language's conjunction and then the entity NAME as a word, plus a spurious clause
break.

```
si  &Pi;&alpha;&nu;   → sˈahə pʰˈaᶦ , sˈahə ˈæɫfə , sˈahə nˈuː     ("and pie, and alpha, and new")
yo  &real;            → a˩ti˧ ɾe˧a˧l ,                             ("and real")
oc  &ccedil;          → ksedil ,                                    (word split in three)
gn  &thinsp;          → tˈhinsp ,
```

The decoded side splits four ways, and only the first is a clean win:

| decoded to | fate | entities |
|---|---|---|
| a letter the engine reads | READ | the nine oc accents, `ocirc` |
| a space / a break | correct silence | `thinsp`, `bull` |
| an invisible control | stripped | `lrm`, `zwnj` |
| a character with no rule | SILENT DELETION | the six Greek, `real`, `image` |
| a character that survives raw | LEAK | `fnof` → `ƒ` in the IPA |

**Implication.** Three of the four groups need a fleet measurement before anything is decided, because a
per-language frame cannot tell "this engine has no rule" from "no engine has a rule".

## Run 3 — 2026-08-13 (the fleet, per character)

**Question.** For each of the 23 decode targets, across every registered engine: is it READ, SILENT, or does
it LEAK into the phoneme stream?

**Command.** `npx tsx probe4.scratch.mts` — 188 engines × 23 characters, classified by comparing
`xa <char> ax` against `xa ax` and testing the output for the character itself and for the `ZERO-WIDTH` class.

**Raw finding.**

```
accented Latin (10)   READ 186-188 / 188      (fr still drops á í ò; cdo passes ç through raw)
thinsp lrm zwnj bull  SILENT 188 / 188, ZERO-WIDTH leaks 0 / 188
gamma phi lambda      SILENT 186, READ 2      (el, grc only)
Pi alpha nu
real image            SILENT 188 / 188        — not read by el either
fnof                  LEAK-SELF 93, READ 88, SILENT 7
```

**Implication, and the first real surprise.** The invisible-control hazard the handover flagged is measured
and **absent**: `&zwnj;`/`&lrm;` decode to characters the fleet already strips, with zero `ZERO-WIDTH` leaks.
`&fnof;` is the opposite — decoding it would put a raw U+0192 into the IPA of 93 engines including lo's, the
one language it occurs in. That is a trade of a wrong word for a leak, and it is a decline.

**Negative result kept.** `fr` is SILENT on `á í ò` and `cdo` passes `ç` through raw. Neither is caused by
this change and neither blocks it — they are the residual tail of the accent work (`f269a4b`), which fixed
the engines that route through `latinPhone` and the five with their own scanner. Recorded so the next reader
does not attribute them here.

## Run 4 — 2026-08-13 (the Greek letters are contextual, not unreadable)

**Question.** The fleet says a Greek letter is silent in 186 of 188. But si's corpus line phonemized
`&Pi;&alpha;&nu;` to *pan* when decoded. Which is it?

**Command.** `npx tsx probe8.scratch.mts` — a lone Greek letter and a Greek RUN, in five host languages.

**Raw finding.** Both, and the discriminator is run length.

```
si  xa γ ax    → ɡzˈæ ˈæks        (deleted)      sn/gd/yo/en: identical
si  xa Παν ax  → ɡzˈæ pan ˈæks    (READ)         sn/gd/yo/en: identical
si  xa αβγ ax  → ɡzˈæ avɣ ˈæks    (READ)
```

A run of two or more Greek letters is routed to the Greek reader by the script router, in every host
language. A lone letter is not, and is dropped.

The corpus instances fall on both sides:

```
si  (&Pi;&alpha;&nu;; lit. all)      a RUN     — decoding would give *pan* in place of six spurious words
gd  &gamma;-iarann                    LONE     — decoding would DELETE it (the literal reads kˈamə, "gamma",
                                                 which is accidentally close to right for γ-iron)
sn  (&phi;)  (&lambda;)               LONE     — literal leaks raw ASCII `phi` / `laᵐbɗa` into the IPA
yo  &real;(z)  &image;(z)             n/a      — ℜ ℑ are read by nothing, run or not
```

**Implication.** This is the measured trade the handover asked for, and it does not resolve to a per-entity
answer. A table keyed on the entity NAME cannot express "decode when it is part of a run". Adding
`Pi`/`alpha`/`nu` because si happened to write a run, while declining `gamma`/`phi`/`lambda` because gd and
sn happened to write lone letters, would make the decoder's behaviour depend on which letters a corpus
reached for — and would silently delete the other three the first time a corpus wrote them alone.

**Decision: all six Greek plus `real`/`image` plus `fnof` are DECLINED**, with the reasons written into the
file. The defect worth fixing is the lone-foreign-letter deletion in the router/foreign fall-through — the
same silent-deletion class a sibling is building a detector for. si's `Παν` is recorded in `markup.ts` as the
one instance that a fix at that layer would convert from six spurious words to *pan*.

## Run 5 — 2026-08-14 (the decode TARGET matters: the space family is not interchangeable)

**Question.** `&nbsp;` decodes to an ASCII space, not to U+00A0 — an infidelity nobody had explained. Before
adding `&thinsp;` beside it, does it matter which space character is produced?

**Command.** `npx tsx probe10.scratch.mts` — `1<SEP>904<SEP>569 et 250<SEP>000` across all 188 engines, with
SEP ∈ {ASCII, U+00A0, U+2009, U+202F}, reporting every language where the four disagree.

**Raw finding.** **42 of 188 languages disagree.** They de-group a thousands separator on an ASCII space and
on nothing else — their grouping classes are `[ ]`, not `[    ]`.

```
ln  ASCII  … e˩fu˥ku˩ na˩ bi˩lu˥ⁿdu˩ li˩bwa˥ …      ("one million nine hundred four thousand …")
ln  NBSP   … mo˩˥ko˥ ka˥ma˥ li˩bwa˥ na˩ mi˥ne˩i˩ …  ("one, nine hundred four, …" — the numeral is destroyed)
also km bm mos ki rn and 37 more
```

**Implication, and the strongest finding of the run.** `nbsp: " "` is not sloppiness, it is **load-bearing
for 42 engines and 2,305 corpus instances**, and `&thinsp;` must join on the same terms — la writes
`1&thinsp;904&thinsp;569` and `250&thinsp;000`, gn writes `176&thinsp;215`.

⚠ **And the fold MASKS a real fleet defect.** Those 42 engines still lose the numeral when a dump carries the
RAW U+00A0, and no corpus can show it, because every corpus instance arrives as an entity and is folded to
ASCII before the engine sees it. This is the artifact-vs-runtime gap, and it is bidirectional:

- gn walked into it from the other side. Its step-6 grouping class needed U+00A0 written in explicitly and
  passed the corpus without it, *because the entity had already become an ASCII space by then*. The comment
  there says so, and it was caught by a test rather than by the corpus.
- The 42 engines walk into it from this side. Their ASCII-only class is invisible to every gate.

**Decision: do NOT change the fold.** Changing it would regress 42 languages to fix a shape no corpus
contains. It is recorded in the file's comment and pinned by a test that asserts `phonemize("1&nbsp;904…")`
and `phonemize("1 904…")` DISAGREE in km — so that anyone who "fixes" the infidelity is told what it costs.
Re-mining is not the answer either: it would resample every artifact, and the artifacts are not wrong — they
faithfully store what the wiki wrote.

## Run 6 — 2026-08-14 (the real corpus lines, before and after)

**Question.** On the actual mined sentences rather than a frame, what moves?

**Command.** `npx tsx probe7.scratch.mts gn la pnb kaa qu lo gd sn si yo ps oc`

**Raw finding.** oc is the language this change is for. Its dump escapes the accent INSIDE ordinary words, so
the literal does not merely mispronounce — it shatters the token into three:

```
fon&ccedil;age    fu ksedil , ad͡ʒe      → funsad͡ʒe
#&egrave;sser     eɡɾabe , se           → ɛse
peri&ograve;de    peɾi uɡɾabe , de      → peɾjɔde
N&ograve;rd       n uɡɾabe , ɾt         → nɔɾt
s&egrave;gle      s eɡɾabe , ɡle        → sɛɡle
t&iacute;tuls     t jakyte , tuls       → tituls
```

ps is the same shape in a Perso-Arabic dump: `trypa&ocirc;` *tɹˈɪpə ˈʌʃəɚk* → *tɹˈaᶦpʰaᶷ*.

la's `&thinsp;` was worse than the gn report suggested — it is a thousands separator, so the literal both
invents a word and strands the group: `250&thinsp;000` read as *dʊˈkɛntiː kʷiːŋkʷaːˈɡɪntaː **ˈtʰĩːsp** ,
**ˈnɪhɪɫ*** — "two hundred fifty, thinsp, NOTHING", the `000` becoming its own number zero.

**Negative result kept.** Decoding removes the invented word but does **not** repair la's numeral: `ˈnɪhɪɫ`
survives, because la has no space de-grouping rule at all. Verified with `probe9.scratch.mts` — ASCII,
U+00A0 and U+2009 all read `250 000` identically in la. That is a pre-existing la defect, independent of the
entity, and it is not fixed here.

qu is UNCHANGED, which is the expected result: `languages/quechua/normalize.ts` already carries a local
`ENTITY` table mapping `&bull;` to a space on this very corpus line. pnb likewise already decodes `&lrm;`
locally. Both files say in their own comments that the general fix belongs in `core/markup.ts`; both local
rules keep working (core runs first, at `registry.ts:329`, so the local rule simply finds nothing left) and
neither is removed here — pnb's arm also handles entities terminated by the ARABIC semicolon U+061B, which
the shared decoder cannot see and which is a genuinely Perso-Arabic fact.

## Run 7 — 2026-08-14 (the change, and the gates)

**What was added — 14 of 23.**

| rows | decoded to | why |
|---|---|---|
| `thinsp` `bull` | ASCII space | Run 5. A bullet's reading IS a break; U+2022 is read by nothing |
| `lrm` `zwnj` | the real control characters | Run 3: zero `ZERO-WIDTH` leaks in 188/188, and U+200C's join-suppression is honoured by 26 Indic engines |
| the nine oc accents + `ocirc` | the precomposed letters | Run 3: READ in 186-188/188, which is true only because of the accent work in `f269a4b` |

**What was declined — 9 of 23.** `fnof` (would leak `ƒ` into the IPA of 93 engines), `real` `image` (read by
nothing at all, el included), and the six Greek (contextual — Run 4).

**Gates.**

`npx tsc --noEmit` — clean.

`npx vitest run` — 4070 passed, 4 failed, all four TIMEOUTS rather than assertions: `onnx-optional` (the
known 5 s limit, and it fails identically on the pristine baseline worktree) and three Arabic-family
`referee-eval` rows at the 30 s limit. Re-run in isolation, `referee-eval` passes **completely**, `acw` `ar`
`ary` included — they are load artifacts of a full-suite run, not regressions. No golden's expected value
changed anywhere in the suite.

`corpus-diff emit`/`compare`, baseline emitted from a detached worktree pinned at the start commit (no
`git stash`, no `git checkout <path>` — the procedure `corpus-diff.ts`'s own header prescribes):

| lang | changed | DROP before → after | note |
|---|---|---|---|
| oc | 9/452 (2.0%) | 109 → 103 | the nine accents; whole words restored |
| la | 8/460 (1.7%) | 143 → 139 | `&thinsp;` in thousands separators |
| pnb | 3/449 (0.7%) | 16 → 16 | `&lrm;` |
| gn, ps, kaa | 1 each (0.2%) | ps 39→38, kaa 131→130 | |
| **si, sn, gd, yo, lo, qu** | **0 (0.0%)** | unchanged | the six DECLINE languages — inert, as intended |
| **hi, ta, km, ln, tr** | **0 (0.0%)** | unchanged | five languages named nowhere in this run — inert |

`DIGIT`, `SLOT-GAP`, `RAWMARK`, `ZERO-WIDTH`, `RAW-CAPS` and `THROW` are unchanged at their previous values
in all seventeen. `ZERO-WIDTH` in particular stays at 0 in kaa and pnb, which is the check the `lrm`/`zwnj`
rows were on probation for.

⚠ The five inert languages are the point of running them. A `core/markup.ts` change reaches all 193 engines,
so "it improved the six corpora I aimed at" is not a result until it is paired with "and it moved nothing
anywhere else". km and ln were chosen deliberately: both are among the 42 ASCII-only-grouping engines from
Run 5, so they are where a careless change to the space rows would show first.

`mine.ts scan` on gn, oc, si, kaa, pnb, diffed against the same baseline. gn, si and pnb are byte-identical.
The only movement in the whole gate is **`DROP ampersand` falling** — oc ×14 → ×6, kaa ×4 → ×3 — which is
the intended effect read from the other end: those were the entity ampersands being counted as dropped
symbols, and a decoded entity has no `&` left to drop. **No new silence, in any class, in any of the five.**

**Follow-ups recorded, not fixed here.**

1. **42 engines cannot de-group on a raw U+00A0 / U+2009 / U+202F** (Run 5). The decoder's ASCII fold hides
   this from every corpus-driven gate. The fix is in those engines' grouping classes; gn already has the
   correct class and its comment explains why.
2. **A lone foreign letter is silently deleted** by the router/foreign fall-through (Run 4). This is what
   blocks the six Greek entities, and it is the class the silent-deletion detector is being built for. si's
   `&Pi;&alpha;&nu;` is the ready-made regression case.
3. **la has no space de-grouping rule at all** (Run 6), so `250 000` reads as "two hundred fifty, nothing"
   regardless of which space character it is written with. A la normalization matter.
4. **fr still deletes `á í ò`, and cdo passes `ç` through raw** (Run 3) — the residual tail of `f269a4b`.
