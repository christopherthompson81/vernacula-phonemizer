# The flap before a secondary-stressed vowel — investigation log

Found while triaging every divergence between this engine and misaki's `us_gold.json` — the
lexicon hexgrad/Kokoro-82M was trained on — over its 80,222 single-reading words.

## Run 1 — 2026-09-16 12:30 — the guard does not implement the context it was mined from

`englishArpabet.ts` line 184:

    // FLAP (mined t:V_V0=ɾ79 / d:V_V0=ɾ64): t/d intervocalic before a NON-primary vowel → voiced flap.
    ... && next.stress !== 1

`V_V0` is the mined context and the `0` is the ARPABET stress digit: the flap was measured
before an **unstressed** vowel. `!== 1` admits stress 0 **and 2**. At some point the prose was
rewritten to match the code — "a NON-primary vowel" — so the rule documented itself and the drift
became invisible.

Scored against gold, 80,222 words:

| | count |
|---|---|
| we flap immediately before a 2° mark | 1,112 |
| gold does | 47 |
| words where we do it and gold agrees | 4 of 1,109 (**0.4%**) |
| we flap before a **1°** mark | 0 (gold 16) |

The primary-stress guard already existed and fired correctly. That asymmetry is what says this
was an oversight rather than a position. American flapping requires the FOLLOWING vowel to be
unstressed; a secondary-stressed syllable takes a real onset, so `acetate` is `ˈæsətˌeɪt`, not
"assa-date".

## Run 2 — 2026-09-16 12:40 — `=== 0` alone is not enough, and costs 37 words

Changing the guard to `=== 0` took exact agreement 41.10% → 41.38%, but left **403**
pre-secondary flaps. They were 91% dictionary-sourced: `accent-lexicon.tsv` is a PRE-RENDERED
cache and still carried `ˈæsət̬ˌeᶦt` from the old rule. `tools/english/en_rebuild_lexicon.mts`
exists for exactly this and says so in its header — *"A RULE CHANGE ALONE SPLITS THE TWO PATHS
APART."* Baseline round-trip on a clean tree is 100.00% / 0 rows, so every row the rebuild
changes is attributable to the rule.

The 37 losses were the interesting part. All 37 were words where **our** stress differs from
gold's, not where the rule is wrong — and 14 of them were OOV, where the BiLSTM labels an
ordinary unstressed suffix as stress 2 (`pettish`, `mutism`, `snottier`, `blotto`). Verified by
narrowing the guard to `=== 2`: every one of them flapped, which is only possible if the
following vowel really is labelled 2. **A latent tagger-stress defect the loose guard had been
masking.**

## Run 3 — 2026-09-16 12:50 — reading the post-clash stress: tried, and REJECTED on review

`thirty` is `TH ER1 D IY2` in the dictionary. Its 2° is adjacent to the 1°, so the
secondary-stress **clash rule** drops the mark and the word renders `θˈɝd̬iː` with no 2° in the
output at all — the flap was reading a beat that is not in what we emit. The obvious repair is to
have the guard read an `effStress[]` computed from the clash condition, and that is what the
first version of this change shipped to review.

It looked good on the headline number:

| | exact | gained | lost |
|---|---|---|---|
| baseline | 41.10% | — | — |
| `=== 0` on the raw digit | 41.63% | 462 | 37 |
| `=== 0` on the post-clash stress | **41.67%** | 456 | 2 |

**The headline number was the wrong metric.** Scored on the thing this rule is actually about:

| | flap errors vs gold | spurious flap tokens |
|---|---|---|
| baseline | 2,214 | 1,785 |
| **raw digit** | **1,290** | **796** |
| post-clash stress | 1,334 | 917 |

The post-clash variant is WORSE on flaps and wins on whole-word exact only because its gains land
on words where the flap was the last remaining difference, while its losses land on words that
were already wrong for other reasons. Head-to-head on the 218 words where the two disagree: raw
right on 6, post-clash right on 35, **neither right on 177**.

And its errors are the worse kind. The clash rule is a decision about where to PRINT a mark, not
a claim that a syllable is unstressed, so leaning on it flaps compounds whose second element
genuinely takes a beat: `sawtooth` → `sˈɔTuθ`, `detox` → `dˈiTɑks`, `cartop`, `autarch`,
`opportunistic`. A spurious flap merges /t/ with /d/ — writer/rider — which is a worse failure
than the over-careful unflapped /t/ that the raw guard leaves behind.

**`thirty` is a bad dictionary row, not a reason to bend the rule.** It is the only decade
written `IY2`; twenty, forty, fifty, sixty, seventy, eighty and ninety are all `IY0`, and gold
says `θˈɜɹɾi`. More broadly, 199 dict rows end `IY2` on a `-y` spelling and gold treats 122 of
them as unstressed against 2 as secondary (`latchkey`, `turnkey` — real compounds where "-key" is
a morpheme). So the row is corrected in `g2p-dict.tsv` and the rule left principled.

Fixing the row also shortens the vowel — `IY0` maps to `i`, not `iː` — so `thirty` becomes
`θˈɝd̬i`, which is what every other decade already reads (`fˈɔːɹt̬i`). Eleven committed
expectations carried `θˈɝd̬iː` and were updated. In Kokoro's alphabet the two are identical
(`ː` is stripped for en-us, and `d̬`/`d` both render `d`), so this changes the canonical IPA only.

Final: exact 41.10% → 41.63%, flap errors 2,214 → 1,290, pre-secondary flaps 1,112 → 5 (gold 47).

The 37 remaining losses are mostly `-otto`/`-ato` loans (`grotto`, `legato`, `falsetto`) whose
final `-o` CMUdict writes `OW2` and gold flaps anyway — the same class of dictionary stress quirk
as `thirty`'s `IY2`, left for a follow-up rather than widened into this change.

`crocodile` is the control in the other direction, and is unaffected by the choice between the
two variants: its 2° is not adjacent to the 1°, so no clash applies, and it correctly stops
flapping under either. Gold agrees — `kɹˈɑkədˌIl`, plain `d`. Two committed expectations carried
the flapped form and were wrong.

## An unexpected second beneficiary: en-GB aspiration

`english-gb.ts:134` un-flaps `t̬ → t`, because RP has no flapping. So a GenAm flap rule that RP
does not even have was firing, `continue`-ing past the ASPIRATE rule, and then being flattened to
a **plain, unaspirated** `t`. en-GB was systematically losing aspiration on /t/ before a
secondary-stressed vowel: `ˈʌndətˌeᶦk` for "undertake", now `ˈʌndətʰˌeᶦk`. Five golden rows.

## ⚠ The referee eval cannot see any of this

`en` scores **1905/4558 and en-GB 35421/76284 — byte-identical before and after.** Not because
the change is inert, but because `BACKBONE` in `tools/referee-eval/config.ts` strips combining
diacritics `U+0300–U+0335`, and our flap is `t` + **U+032C**. The class is folded away and sits
in the residual, failing nothing.

This is the same shape as the `-ong` finding in #1315, where the folds covered `ɔ~o` and `ʊ~u`
but not `o~ʊ`. **Where a fold covers a class, the referee eval is not evidence about it** — the
misaki-gold comparison was the only referee that could adjudicate here.

## Two harness mistakes, kept because they cost real time

1. **A stale binary.** After probing with the guard temporarily set to `== 2` I restored the
   source but did not rebuild, then ran a full 80k sweep. It reported the lexicon rebuild as a
   1.5-point REGRESSION with 1,737 words worse — entirely an artifact. The tell was visible and I
   nearly explained it away: pre-secondary flaps went *up* after a change that can only reduce
   them, and "correct" flaps like `abettor` vanished. Every sweep since is preceded by running
   the binary on known probes and asserting the answers.
2. **A test that could not fail.** The first version asserted `phonemize("acetate")`. Both probe
   words are flat-lexicon hits, so it pinned the RECORDED IPA and passed with the rule reverted.
   The mutation check caught it. The tests now drive `makeArpabetToIpa` directly, with a separate
   case asserting the lexicon agrees with the rule that generated it — the two-path split, tested
   as two paths.
