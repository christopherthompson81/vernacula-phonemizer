# Saraiki (skr) native bring-up

Saraiki — a Lahnda (Greater Punjabi) language of south-west Pakistan (~26M), written in an extended Shahmukhi
(Perso-Arabic) abjad with FOUR dedicated implosive letters (ٻ ɓ, ڄ ʄ, ڳ ɠ, ݙ ɗ — the retroflex ݙ coined 2002 to
differ from Sindhi's ڏ). Engine-wise it is the **non-tonal** sibling of Punjabi: where Punjabi (pa/pnb) turned its
historical voiced aspirates into TONE, Saraiki kept them as segments AND retains the implosives (like Sindhi).

**Scope gates (both pass).** (1) Real, community-adopted orthography: yes — a standardized 43-letter Saraiki
Shahmukhi (Saraiki Adabi Board etc.), deliberately distinguished from Sindhi. (2) Independent referee: yes —
wikipron skr_arab broad (human, Wiktionary, ~348 words, vowel-ful broad transcription), so NOT a bho/awa
cannot-verify clone.

**Architecture.** Reuses the shared Lahnda machinery via `makeNativePunjabi(..., { saraiki: true })`: the Shahmukhi
front-end (scanShahmukhi), gemination→length, homorganic nasal assimilation, weight stress. The flag toggles the
three tonal/orthographic-ambiguity behaviors OFF: (1) tonogenesis; (2) the aspirated-sonorant strip (Saraiki KEEPS
لھ→lʰ); (3) the plain-ن→ɳ infinitive heuristic (Saraiki writes ɳ explicitly as ݨ). The four implosive letters were
added to the shared shahmukhi.jsonc table (Punjabi text never uses them — byte-identical pa/pnb). New module
`src/languages/saraiki/saraiki.ts`; referee config `tools/referee-eval/langs/skr.jsonc` (pnb Shahmukhi folds:
short-vowel strip + majhūl و/ی + notation).

## Run 1 — first compile
**67.0% folded** (234/349) vs wikipron skr_arab broad. Implosives working (اٻاہل→əɓaːɦl). Immediately visible: a
FOLD bug — the referee's nasalized long vowels (ũː, ɑ̃ː, ãː) carry a combining tilde BETWEEN the vowel and ː, which
defeats the short-vowel preFold's `(?!ː)` lookahead → the referee's LONG vowels get stripped as if short
(نوں nũː → "n"). Fix: strip the nasalization tilde in a preFold that runs BEFORE the short-vowel strip.

## Run 2 — nasalization preFold + gemination, 67.0 → 75.1%
Fixed the tilde-before-ː preFold ordering (nasalized long vowels no longer mis-stripped): **67.0 → 75.1%** folded
(262/349). A second attempt to add combining-aware gemination folds (t̪t̪, tie affricates) went net-NEGATIVE
(75.1→74.8%) — the eval's built-in backbone already normalizes multi-codepoint geminates, so the extra folds
double-processed and broke a match; reverted to the plain `(.)\1+`. (Lesson: the standalone probe fold ≠ the eval
pipeline — trust the harness number, not a hand-rolled fold.)

**Residual (~87 misses), characterized:**
- **hamza-ya ائی/ائے over-segmentation** (~5): ترائے/سرائیکی — we emit aː+iː where the referee has a single ɛː/eː
  or an aeː diphthong (the hamza between two vowel letters is a hiatus the referee absorbs). In the SHARED
  scanShahmukhi → not touched (risk to pa/pnb); left as a documented tail.
- **word-final ہ/ہہ** (~6): تریہہ→t̪ɾeːh, ݙینہہ→ɗĩːh, چھیں→t͡ʃʰĩːh̃ — the final heh realizes as [h]/[h̃] or aspirates
  a neighbor (اٻاہل→ɓɑːlʰ), where we read it as ɦ + inherent aː.
- **nasal-place before a stop** (~5): مونڈھا (referee keeps n before ɖʰ), پنجھتر (referee ŋ before d͡ʒʰ) — the
  referee is itself inconsistent (ونڄݨ has ɲ), so this is referee narrow-notation noise, not an engine class.
- **short-vowel + gemination tail** (rest): UNRECOVERABLE from the abjad (no shadda / no written short vowel) —
  the same wall as pnb/ur/sd. The referee's phonetic vowels (o in چھوہر) and geminates can't be predicted.

**Verdict: 🔷 single-source.** wikipron is the only referee and it is a single (Wiktionary) tradition — no
independent second source to triangulate. (A future independent source, e.g. Grierson's LSI "Lahnda", would be the
sd path to a firmer status.) The engine is verified on the recoverable consonant + long-vowel + implosive backbone;
a diagnostic gold (src/languages/saraiki/saraiki.test.ts) pins the four implosives + voiced/sonorant aspirates.

**pa/pnb byte-identical** (73.6% / gold 100% / 56.5% unchanged); typecheck clean; punjabi.test.ts + skr gold green.
**Deferred:** short-vowel restoration lexicon (the pnb/ur path), numbers (reusing Punjabi's for now), C# mirror
(no C# port in-tree; the {saraiki} flag defaults off so pa/pnb C# — if ported elsewhere — are unaffected).
