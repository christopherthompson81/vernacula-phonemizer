# Luxembourgish stress — emitting a computed mark, and measuring the heuristic behind it

Third and last of the engines flagged by the stress audit that opened with
`docs/investigations/af/afrikaans_stress_investigation.md`. `af` computed stress for vowel quality and discarded the mark;
`is` had no stress concept at all; `lb` is the third shape — it computes a placement, the file
records a measurement of it, and the mark is still not written.

Referee: `tools/referee-eval/referees/lb.wikipron-ltz-broad.tsv` (wikipron ltz_latn_broad, human,
3893 headwords). Baseline: folded backbone **2815/3893 (72.3%)**, symbol accuracy 93.0%.

## Run 1 — 2026-08-17 — what is already there

`realizeE()` computes `stressTok` — the token index of the stressed nucleus — as *the first vowel, or
the second past an unstressed `ge|be|ver|er|zer|ze` prefix* — and uses it only to decide whether a
short ⟨e⟩ surfaces as [æ] or reduces to [ə]. The comment above the regex reads: *"measured net
+3.9pp over always-first-syllable, so kept."*

So unlike the other two, this placement has been **under measurement all along** — just refracted
through vowel quality rather than stated outright. That is also the argument for emitting it: the
mark exposes a decision the engine is already making and already being scored on. It adds no new
claim about the language.

The counter-argument, and the reason this is not as clean as `is`: the placement here is a
**heuristic that is known to be wrong sometimes** (the comment names `besser`, `Erd`), where
Icelandic's fixed-initial rule is exceptionless. Emitting a mark from a fallible rule needs the
fallibility quantified, not just acknowledged.

## Run 2 — 2026-08-17 — can the referee check stress? No, and then yes

`grep -c "ˈ"` on the referee → **0**, across all 3893 rows. Same as `is`, same as the whole
wikipron-broad family. And `tools/referee-eval/config.ts` strips `[ˈˌ]` from both sides for every
language. Direct validation is impossible.

**But the referee can check it indirectly, and precisely.** The unstressed-prefix vowel is always the
letter ⟨e⟩, and the referee writes a reduced vowel there when the syllable is unstressed:

    Besuch      b e z u χ          ← reduced ⇒ prefix, rule right
    Gemeng      ɡ e m æ ŋ          ← reduced ⇒ prefix, rule right
    Verhalen    f ɐ h aː l ə n     ← reduced ⇒ prefix, rule right
    Belsch      b æ l ʃ            ← FULL    ⇒ root, rule wrong
    Becher      b æ χ e ʀ          ← FULL    ⇒ root, rule wrong

So `{ɐ, ə, e}` in the first syllable = the referee agrees it is unstressed; `æ` = it does not.

⚠ **The test is only valid where the vowel in question is a plain ⟨e⟩.** A first pass applied it to
the whole vocabulary and produced 186 "errors" — `Brëscht`, `Drëpp`, `Hënn`, `Mound`, `Mous`. All
spurious: Luxembourgish ⟨ë⟩ **is** phonemically /ə/ and is perfectly stressable, and the ⟨ou⟩
diphthong's nucleus is written ə as well. "The referee wrote ə" says nothing about stress there. The
prefix population is safe because its vowel is always ⟨e⟩.

## Run 3 — 2026-08-17 — the measurement

Implemented the mark: `realizeE` now also sets `stress` on the chosen token, and `phonemizeWord`
prefixes `ˈ` to it. The flag rides the **token**, not an index, because `degeminate()` splices tokens
out downstream — it only ever removes a non-vowel duplicate, so the nucleus survives.

Over all 3893 referee headwords:

| check | result |
|---|---|
| rows differing after stripping `ˈ` | **0 / 3893** (before the Run 4 change) |
| rows with >1 mark | 0 |
| rows with no mark | 2 — `'t`, `d'`, the vowelless clitics |
| rule shifts stress off σ1 on | 272 words (7.0%) |
| referee agrees on those | **261 / 272 = 96.0%** |
| always-first-syllable on the same 272 | 11 / 272 = 4.0% |

The 11 misses are exactly the failure mode the original comment named — a disyllabic root that merely
*begins* with the prefix letters: `Becher`, `Bensin`, `Besserung`, `Gellecht`, `Zebra`, `Zelleri`,
`germanesch`, `zecken`. Note the `vowelIdx.length > 1` guard had already removed the monosyllabic
collisions (`Bett`, `Geck`, `Geld`, `Zeck`, `Zell`, `Zelt`) — a regex-only count says 19 misses, the
actual rule makes 11. Fixing the rest needs a morpheme lexicon, not a better regex.

## Run 4 — 2026-08-17 — the complement, and a defect it surfaced

Question: the run above validates where the rule *fires*. What about the 3619 words where stress
stays on σ1 — is it wrongly there? Restricting to the valid population (first vowel letter is a plain
⟨e⟩, 572 words) and looking for an unambiguously reduced `ə`/`ɐ`:

10 hits, and **5 of them are one fixable bug**:

    vereelzt      f ɐ ʔ eː l t͡s t
    vereinfachen  f ɐ ʔ ɑ ɪ̯ n f ɑ χ ə n
    veruechten    f ɐ u ə̯ χ t e n
    veräisen      f ɐ æː ɪ̯ z ə n
    veränneren    f ɐ æ n ə ʀ ə n

All genuinely `ver-` prefixed, all written by the referee with a reduced first vowel — and the rule
declined to fire on every one, because `^(ge|be|ver|er|zer|ze)[^aeiouyäëéô]` **requires a consonant
after the prefix**. `ver-` before a vowel never matched.

Relaxing the guard for ⟨ver⟩ alone (`^(ge|be|er|zer|ze)[^aeiouyäëéô]|^ver`) captures 8 referee words
— the 5 above plus `Veräin`, `Veräiner`, `vereenegen` — and the referee writes a reduced first vowel
in **8 of 8**. The guard is kept for the other five prefixes, where the root collision is real
(`Becher`, `Bett`, `Zebra` are all `be`/`ze` + consonant).

Measured end to end:

| | folded backbone | symbol accuracy |
|---|---|---|
| baseline | 2815/3893 (72.3%) | 93.0% |
| + relaxed ⟨ver⟩ guard | **2818/3893 (72.4%)** | 93.1% |

The score moves by only +3 because the eval sees this change only where an ⟨e⟩ is involved; the
placement improvement is larger than the score gain and invisible to the harness, which is the whole
reason the vowel-quality probe above exists. Post-change placement agreement: **269/280 = 96.1%**.

### The out-of-sample risk, checked against real text

The referee only has 8 ver+vowel words, which is thin evidence for removing a guard. The guard exists
to stop a *root* being read as prefix+vowel, so the question is whether such roots exist. Counting
every ver+vowel form in the FLEURS `lb_lu` transcripts (all three splits): **65 distinct forms, 314
tokens**, and every one is a genuine `ver-` prefixed word — `verursaacht` ×34, `verännert` ×20,
`verantwortlech` ×18, `verëffentlecht` ×16, `Vereenegte` ×14, `verurteelt`, `veraarbecht`,
`Veranstaltungen`, `Veräin`… **Zero root collisions.**

The only forms where the shift is not clearly right are `verifizéiert` ×4 and `Verifikatiounen` ×2 —
Latin `verus`, not the Germanic prefix, and stressed on `-éi-`/`-ou-`. But always-σ1 is wrong on those
too, so it is a wash, not a regression. This is why the exemption is ⟨ver⟩ **only**: `be`/`ze`/`ge`
before a consonant collide with real roots constantly (`Becher`, `Bett`, `Zebra`), and ⟨ver⟩ before a
vowel does not collide at all.

The other 5 complement hits are not bugs to fix here: `Meloun`, `Televisioun`, `reflexiv` are the
Romance penult-stress class the engine header already declares un-modelled, and `mer`/`se` are
unstressed function words — sentence prosody, not lexical stress.

## Run 5 — 2026-08-17 — test churn

35 IPA literals in `test/luxembourgish.test.ts` changed. Each new value was **predicted from the rule
and then run**; two `Dag` assertions were missed on the first pass and caught by the suite, the other
33 passed as predicted. Diff audit: the 35 removed and 35 added lines are an **identical multiset
once `ˈ` is stripped**.

Added a dedicated test pinning the placement, including `Becher → bəχˈær` — the known-wrong output,
**pinned rather than hidden**, so the failure mode is visible to the next reader and a future
morpheme lexicon has a regression target.

## Not done

**Secondary stress / compounds.** `kvˈadratkilomətər` gets one primary mark and no secondary. Same
constraint as Icelandic: no compound decomposer.

**The Romance penult class.** Named in the header, confirmed here by `Meloun`, `Televisioun`,
`reflexiv`. It needs a loan lexicon or a suffix rule — real work, not a guard tweak.

**A morpheme lexicon for the prefix/root collision.** 11/280 (4%), the remaining error. A regex
cannot distinguish `Besuch` from `Besserung`.

## Audit closed

All three engines flagged by the stress sweep are now fixed: `af` (#828), `is` (#829), `lb` (this).
`sl`/`sr`/`hr` remain deferred, and that deferral **is** justified — they are pitch-accent languages
whose placement is lexical and not derivable, and no stress-marked source is committed for them.
