# Czech (cs) bring-up / maturity investigation

Standard Czech, canonical IPA, espeak-independent. Rule g2p (g2p.ts): palatalization di/ti/ni→ɟ/c/ɲ, ř→r̝̊,
voicing assimilation, syllabic r̩/l̩, ě→je/ɲɛ, ou→oᶷ. See czech.jsonc.

## Run 1 — 2026-07-14 — referee swap epitran→wikipron ces (69.9→94.8%); residual is loanword-lexical

The maturity note ("referee itself is epitran-buggy (deflates); loanword lexicon portable from espeak cs_list")
was HALF right. The epitran ces referee is systematically buggy — před→"bret", protože→"brotoʒe", proč→"brot͡ʃ"
(a **p→b-before-liquid** bug), něco→"njet͡so" (no ě-palatalization) — deflating our score to 69.9% where OURS IS
CORRECT. Swapped the primary to **wikipron ces_latn narrow** (human, 65k, intersected with the 50k corpus → 17787
words; the same source espeak-ng-portable used). Epitran demoted to secondary (corroboration). Also cleaned a
redundant offglide fold (the backbone already strips the referee's combining u̯/n̩).

RESULT: **69.9% → 94.8%**. The residual is now REAL and, as the note's second half predicted, dominated by
**loanword lexical** pronunciations a rule G2P can't derive:
- **di/ti/ni NON-palatalization** (~429): loanwords spell ⟨di⟩⟨ti⟩⟨ni⟩ but keep HARD [dɪ][tɪ][nɪ] — stadion→stadɪjon
  (ours staɟɪjon), studie, stadium, technik→tɛxnɪk (ours tɛxɲɪk). Native words correctly palatalize (tisíc→cɪsiːts ✓).
- **loanword long í** (ablativ→ablatiːf) + **foreign proper nouns** (Chicago→t͡ʃɪkaːɡo, Caesar→t͡sɛːzar, Afghánistán).

The note's claim that this is "portable from espeak cs_list" is WRONG — espeak's cs_list is 395 entries (mostly
letter names + ~5 loanwords); it does NOT contain the de-palatalization list. espeak-ng-portable's own czech
convergence doc reached the same wall ("87.8% is near the RULE-BASED CEILING… lexical exception list needed") and
left the loanword class as the documented residual. There is no INDEPENDENT source for the list (only wikipron,
which is the referee — building from it would be test-set memorization). So the loanword class is the rule ceiling.
STAYS 🟡 (bounded lexical class), but the NUMBER is corrected 69.9→94.8% — the epitran deflation is gone.
