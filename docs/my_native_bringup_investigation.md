# Burmese / မြန်မာ (my) native bring-up

Sino-Tibetan (Lolo-Burmese), ~43M speakers — the **hardest script/bring-up** in the project. The Mon-Burmese
abugida (Unicode U+1000–U+109F) is stored in LOGICAL order (consonant-first, no visual reordering), but the RIME
system is deeply contextual: a vowel's quality depends on its coda. Validated against two large human referees:
wikipron mya (8,288) + kaikki mya (8,107).

## The rime chart (the core difficulty)
A syllable = base consonant → medials → RIME. The rime is a 2-D function of the **vowel sign × coda class**:
- **Diphthongs surface only in CLOSED syllables**: ောင်→aʊɴ (aung), ိုင်→aɪɴ (aing), ိန်→eɪɴ (ein), ုန်→oʊɴ (oun).
- **A bare (inherent) rime takes the coda letter's historical vowel**: င်→ɪɴ, န်→aɴ, က်→ɛʔ, စ်→ɪʔ, တ်→aʔ.
- **⟨ွ⟩ labialisation** rounds the inherent vowel (ဝန်→wʊɴ, ကွန်→kʊɴ); with a vowel sign it is a plain -w- glide.
- **Minor-syllable reduction**: a bare open non-final syllable → [ə] (ဗမာ→bəma, ဆရာ→sʰəja).
- **Medials** palatalise velars (ကျ→t͡ɕ) and the **⟨ှ⟩** medial devoices sonorants (မှ→m̥, နှ→n̥, လှ→l̥).
- **Stacked consonants** (ကမ္ဘာ): the U+1039 stacker's upper member is silent.

## Runs — 2026-07-15
The number climbed the whole way as the model was corrected: flat "inherent-a + coda-type" **14%** → historical
killed-coda vowels **32%** → the full 2-D rime chart (vowel × coda class) **38%** → ⟨ွ⟩ labialisation + minor-
syllable ə **49%** → stacked consonants + the ော် tone-marker (not a checked coda) **50.5% / 52.1%**.

## Run — 2026-07-16 — TONES (Phase 2) + segmental fixes

Picked up the sole remaining 🟠 language. Attacked the biggest deferred subsystem (tones) plus the segmental
residual classes surfaced by the eval.

**Segmental fixes** (50.5/52.1 → **54.2/55.9%** folded):
- **`ေါ` tall-aa variant (U+102B).** The `ော=au` combo detection only tested `ာ` (U+102C), so `ေါ` fell to plain
  `a`: `ပေါ→pa` not `pɔ`, `ခေါင်→kʰaɴ` not `kʰaʊɴ`, `ဒေါ်→da` not `dɔ`. Accept both aa variants → +1.1.
- **`ငြ→ɲ`.** The palatal map lacked the velar nasal, so `ငြိမ်→ŋjeɪɴ` not `ɲeɪɴ`. Added `ŋ→ɲ`.
- **`ွ` before `-ng`.** `ွ`/onset-`ဝ` rounds the inherent rime to ʊ (`ကွန်→kʊɴ`), BUT before the velar-nasal `င်`
  coda it stays a `-w-` glide (`လွင်→lwɪɴ`, `ကွင်း→kwɪɴ`, `ဝင်→wɪɴ`) — the front `-ɪɴ` rime blocks rounding.
  Coda-specific, decided after the coda is known.

**TONES (Phase 2 — the deferred subsystem, now DONE).** Burmese tone is ORTHOGRAPHIC and rule-derivable (no
lexicon). Rendered as Chao letters (repo convention): **low ˨ / high ˥˩ / creaky ˥ˀ**, checked = the ʔ coda (no
letter), inserted after the nucleus (before a ɴ/ʔ coda). Rules: explicit marks win — visarga `း`→high, dot-below
`့`→creaky, asat-on-vowel `ော်`→low; else a CLOSED (nasal) syllable is low; else OPEN by vowel — `ော`/`ဲ`→high,
bare-inherent / short `ိ`/`ု`→creaky, else (long `ီ`/`ူ`, `ာ`, `ေ`, `ို`) low. Minor `ə` syllables are toneless.
The dot-below can sit between the coda letter and its asat (`ကန့်`) — handled in the coda scan.

**Tone eval** (`tools/my-tone-eval.ts`, tone-category sequence ours-Chao ↔ referee-diacritics): **99.6% mono
(2010/2019), 97.6% per-syllable aligned** vs kaikki (same vs wikipron) — beats the prior bring-up's 92.2%. The
whole-word sequence is 79.9%, deflated almost entirely by syllable-count mismatch (1340 length vs 290 tone), i.e.
the still-deferred minor-syllable-reduction problem, not the tone rules. The segmental eval folds the creaky `ˀ`
(a tone marker) like vi.

## Run — 2026-07-16 (cont.) — VOICING SANDHI (lexicon) — the second deferred subsystem

Intervocalic voicing sandhi was the BIGGEST residual class (`က→ka` vs referee `ɡa`). A ceiling probe (fold both,
allow onset-voicing substitutions) said **+14.1 pts recoverable** (55.9→70.0% on kaikki) — worth a lexicon.

Voicing is LEXICAL (compound-boundary governed, ~68% rule-predictable → over-applies as a rule), so it is a
per-word lexicon like the old espeak-ng-portable bring-up. Refactored the g2p into `syllabify()` (onset + body) so
voicing can target an onset without re-parsing, added a `voicing` map (k→ɡ, t→d, s→z, t͡ɕ→d͡ʑ, θ→ð, aspirates→plain
voiced) + `voicing-lexicon.tsv` (word → per-syllable '0'/'1' flags). `tools/build-my-voicing.ts` mines it: syllabify
each kaikki word, greedily align our syllables to the folded gold allowing each onset to voice; if the whole gold is
reproduced and ≥1 onset voiced, emit the flag string. **Word-INITIAL voicing is refused unless the syllable is a
minor ə** (ကစား→ɡəza ok; ကား→ɡá is a compound-sandhi citation artifact, wrong in isolation → skipped). The pass only
ADDS voicing; OOV words keep the careful voiceless reading, so it can't regress an uncovered word.

- **1258 words** get a voicing pattern. Segmental **54.2→69.0% wikipron / 55.9→71.4% kaikki**.
- **Honest signal = wikipron 69.0%** (independent human transcription): the kaikki-mined voicing is CORROBORATED
  on wikipron at **+1210 / −4** — the two independent sources agree the words voice. The **kaikki 71.4% is partly
  circular** (self-referential for the 1258 covered words). Spot: `စကား→zəɡa˥˩`, `ကမ္ဘာ→ɡəba˨`, `ကတော့→ɡədɔ˥ˀ`.
- The 4 wikipron regressions are genuine kaikki-vs-wikipron disagreements on a medial onset (e.g. မီးခတ်) — negligible.

## Result — 🟠 (scope-limited; the hardest abugida) — tones + voicing now done
**69.0% wikipron / 71.4% kaikki** FOLDED segmental (the backbone strips TONE — the referees' à/á/a̰ diacritics + our
Chao letters). TONES done (99.6% mono, `tools/my-tone-eval.ts`) and VOICING sandhi done (per-word lexicon, wikipron
corroborated +1210/−4). Common vocabulary correct (`မြန်မာ→mja˨ɴma˨`, `ကျောင်း→t͡ɕaʊ˥˩ɴ`, `စကား→zəɡa˥˩`). Still 🟠 —
**ONE** whole subsystem now remains DEFERRED:
- **Word segmentation** — Burmese has no inter-word spaces, so raw running text is one token; the word tokenizer +
  per-word phonemization is reliable for pre-segmented / space-delimited input (and the referee eval is per-word, so
  the 69% is a real word-level signal). A DAG maximal-match over a kaikki word-list (reusing the Thai segmenter) is
  the remaining lift; the voicing lexicon also keys on whole words, so segmentation would extend voicing to running
  text. Plus the minor tail: lexical rime variation (`ည` → i ~ ɛ) + minor-syllable reduction.

Superseded the earlier "voicing deferred" note:
- ~~**Intervocalic voicing sandhi**~~ — DONE (Run 2026-07-16 cont.): the per-word `voicing-lexicon.tsv` (1258 words)
  + `build-my-voicing.ts`. Was the biggest residual class.

## Run — 2026-07-16 (cont.) — review fixes (8-angle review of the tones+voicing PR)

- **Independent-vowel TONE gap.** Standalone vowels (ဦး ဩ ဧ ဣ …, ~106 referee words) bypassed the tone logic →
  emitted toneless (ဦး→ʔu not ʔú). Added `independentTone` defaults (referee-verified: ဣ/ဥ creaky, ဤ/ဦ/ဧ/ဪ low,
  ဩ high) + a trailing visarga/dot override. Rare independent-vowel + coda (ဣန်) still splits — a noted minor gap.
- **Tone-eval measurement bug.** `my-tone-eval.ts` counted an ONSET ʔ (from အ / independent vowels) as a checked
  tone, injecting phantom K and excluding glottal-initial words. Fixed to count ʔ only as a syllable-final coda →
  honest **99.6% mono (2010/2019, +370 words now scored), 97.6% per-syllable**.
- **Lazy lexicon load** (registry imports every language eagerly — matches the riders' lazy pattern), **deduped the
  VOICE map** (builder now reads it from the manifest, so mined flags can't drift from the runtime), single NFC
  normalize, removed a dead `void this.foreign`. Suite 365/365.
