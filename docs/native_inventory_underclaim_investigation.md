# #1140 — the UNDER-claim: a letter the g2p can read, folded away before it arrives

`test/native-inventory.test.ts` asked one question — *does an engine claim a letter its own g2p drops?* That
is the OVER-claim, and it is loud: the letter vanishes. The opposite is silent. A letter the g2p **does** have
a rule for, sitting **outside** `NATIVE_CLASS`, is folded by `makeNativiser` before `phonemizeWord` ever runs,
and a folded letter still produces a sound — so nothing downstream looks broken. It had already cost `lg` its
velar nasal (#1131) and `ak` a deliberate ⟨ŋ⟩ rule (#1139), both found by a human reading a comment.

## Run 1 — 2026-08-28 — building an instrument that is not mostly false positives

**Question.** #1140 recorded that the naive probe does not work: 295 raw candidates, dominated by the
character appearing as an IPA *output*; 29 when restricted to input keys; and of 15 probed, 15 folded — but
folding is CORRECT for most, since ⟨ɛ⟩ genuinely is not Welsh orthography. What discriminator actually works?

**First scan** (fold-rewritten letters × per-language `NATIVE_CLASS` × keys of jsonc orthographic tables
*plus* `c === "x"` comparisons in the .ts): **37 candidates across 20 languages.**

Then the decisive check — inspect every `:code` hit rather than trusting the heuristic:

    spanish.ts:52    if (stop === "ɡ" && prev === "n")             an IPA-OUTPUT test
    catalan.ts:207   if (flag === "e" && segs[stress]!.ph === "ɛ") an IPA-OUTPUT test
    irish.ts:67      segs[L-1]!.ph === "ɡ" && segs[L-2]!.ph === "ŋ"  an IPA-OUTPUT test
    welsh.ts:35      if (v.long || v.ph === "ə")                   an IPA-OUTPUT test

**Every one of the 24 `:code` hits was an output-side comparison, not an orthographic input rule.** ⚠ That is
the finding that made the test possible: the source of truth is the **declared input tables in the jsonc**,
and adding the code heuristic makes the instrument broader and *entirely* false-positive. Restricting to
`graphemes / consonants / vowels / letters / digraphs / trigraphs` keys leaves **13 candidates in 3
languages** — a set small enough to triage by hand, which is what #1140 asked for.

## Run 2 — the triage

### `ast` ⟨ḷ⟩ — REAL, and the module's comment said the opposite

`asturian.jsonc` maps the digraph **⟨ḷḷ⟩ → t͡ʂ**, the *che vaqueira* of western Asturian — a different phoneme
from ⟨ll⟩ → ʎ. `asturian.ts` carried, verbatim, the same false note #1131 removed from Luganda:

> ⚠ ḷ Ḷ ARE DELIBERATELY ABSENT: the g2p has no rule for them, and drops them outright

Both halves false. The g2p has a rule, and the letter was never dropped — it was FOLDED (the under-dot
stripped), so ⟨ḷḷ⟩ arrived as ⟨ll⟩ and the contrast was collapsed. ⚠ **And it is in this language's own mined
corpus, not a synthesised probe** — six words, against **0** in the golden, which is why 200 rows could not
see it:

| word | before | after |
|---|---|---|
| `Ḷḷena` | `ʎena` | `t͡ʂena` |
| `ḷḷendáu` | `ʎendau` | `t͡ʂendau` |
| `ḷḷindes` | `ʎindes` | `t͡ʂindes` |
| `Munieḷḷos` | `munjeʎos` | `munjet͡ʂos` |
| `vaḷḷes` | `baʎes` | `bat͡ʂes` |
| `Viḷḷapedre` | `biʎapedɾe` | `bit͡ʂapedɾe` |

Second-order check (the #1131/#1139 trap): a lone ⟨ḷ⟩ still reads `l` through the existing fallback, so
admitting the letter creates no over-claim and takes nothing away.

### `naq` ⟨ā ē ī ō ū â ê î ô û⟩ — REAL, and it is both of the language's diacritic contrasts

`nama.jsonc`'s own `letters` table declares them and says what they are: macron = LONG, circumflex =
NASALIZED, annotated there as **phonemic** (`ǂgâ`, `ǀî`). All ten sat outside a class of `[a-zA-Zǀǁǂǃ]`, so
the mark-stripping fold erased both contrasts before the g2p ran:

    ǃkhās   ᵏǃʰas  → ᵏǃʰaːs        ǂgâ   ᵏǂa → ᵏǂã        ǀî   ᵑ̊ǀˀi → ᵑ̊ǀˀĩ

⚠ **naq has no golden and no corpus artifact in this repo**, so no differential can witness this and the
tests are the entire instrument for that language.

### `mt` ⟨à ò⟩ — a FALSE positive, and worth recording as one

`maltese.jsonc` declares all five grave vowels; the class carried only ⟨è ì ù⟩. But measured before changing
anything, the graves read the **same quality** as their plain counterparts (`kafà`/`kafa` → *kafa*,
`kafò`/`kafo` → *kafɔ*), so the fold was reaching the right answer by the wrong route. Added to the class for
truth — the class is a claim about the g2p and the claim was false — with **zero** output change.

## Run 3 — the frame artifact the fix exposed

Adding ⟨à ò⟩ made the **over**-claim test fail: *"mt claims à but drops it"*. It does not. The probe framed
the letter as `ka` + ⟨à⟩ + `o`, and ⟨à⟩'s [a] merges with the frame's OWN preceding `a`, so the letter looks
inert — while `kafà` → *kafa* shows it contributing perfectly.

That is the same lesson this file's header already records for Serbian/Bosnian scripts — *measuring in the
wrong frame produces a finding about the frame* — reappearing on the vowel axis instead of the script axis.
Fixed by requiring a letter to be inert in **every** frame before it counts as dropped, with three frames
that vary the adjacent vowel (`ka_o`, `ko_i`, `si_a`).

⚠ **Both probes were then verified to still have teeth, by injection rather than by argument:**

    inject þ into lg's NATIVE_CLASS (lg drops unknown letters)  → "lg claims þ but drops it"   ✓ caught
    remove ḷ from ast's NATIVE_CLASS                            → "asturian keys on ḷ …"        ✓ caught

⚠ A first teeth-check injected ⟨þ⟩ into **Spanish** and was NOT caught — correctly: es has a `latinPhone`
fallback and reads ⟨þ⟩ as [t], so it was never an over-claim. Recorded because "the test did not fire" is
ambiguous until you check whether it should have.

## Gates

    goldens        0 rows changed fleet-wide (ast ×0 in golden input, naq has no golden, mt inert)
    parity fleet   136 languages, 26,827 rows, 0 differ
    differential   ast 130 lines × sync AND async = 260 comparisons, 0 differ, 0 throws, 0 PortPending
    TS suite       5,695 passed      dotnet test  2,712 passed      tsc + package fence clean

Only `ast` of the three is ported to C#, so it took the one `NativeClass` change; `naq` and `mt` are TS-only
so far and the port will inherit the corrected classes.

⚠ **What this does and does not settle.** The standing test now fails loudly if a new grapheme row is added
without a class update — that is the recurrence guard #1140 asked for. It does NOT cover the ASCII hole the
file's header documents separately (43 engines claim `a-z` while their g2p drops part of it), and it cannot
see a rule that lives in CODE rather than a declared table, because keying on code comparisons is exactly
what made the instrument 100% false-positive.
