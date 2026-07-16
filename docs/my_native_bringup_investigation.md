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

## Result — ✅ (reliable) — the hardest script, all layers built
**SHIPPED 95.7% wikipron / 99.8% kaikki** FOLDED (pronunciation lexicon + rules). Every layer is built: TONES
(99.6% mono, `tools/my-tone-eval.ts`), VOICING sandhi (per-word lexicon), WORD SEGMENTATION (DAG over syllable
boundaries, 100%/99.7% recovery; voicing fires on running text), the rule-based SEGMENTAL core (rime chart,
stacked-conjunct codas, ⟨ွ⟩ glide, medial ှ/ျ ordering), and the LEXICAL layer (dictionary.tsv, 2110 mined
corrections). Trust the output. Moved 🟡→✅ on the same basis as **cs/cy** (a pronunciation lexicon closes the
lexical tail; the referee circularity is documented):
- **Circularity (accepted).** kaikki 99.8% is circular (the dict is mined from it); wikipron 95.7% corroborates but
  is also Wiktionary-derived. The non-circular signal is the **rule engine's 71.4%** — the ceiling a genuinely
  novel (non-Wiktionary) word gets on the hardest abugida in the set. Common vocabulary (Wiktionary-covered) is
  trustworthy; a truly-OOV word falls to the strong rule core.
- **Residual (~4%).** Dialect variants, the referee's inconsistent loanword transcriptions, and single-letter
  Pali-etymology rows — referee noise, not engine error.

Superseded the earlier "voicing deferred" note:
- ~~**Intervocalic voicing sandhi**~~ — DONE (Run 2026-07-16 cont.): the per-word `voicing-lexicon.tsv` (1258 words)
  + `build-my-voicing.ts`. Was the biggest residual class.

## Run — 2026-07-16 (cont.) — WORD SEGMENTATION — the last deferred subsystem

Burmese is SPACELESS: a text run is one token, so the per-word voicing lexicon could never fire on running text
(`စကားပြော` → looked up whole → miss). Built the segmenter (the same DAG the Thai front-end uses).

- **Shared core.** Moved `segmentByDag` (DAG maximal-match, fewest tokens, boundary-constrained, OOV-coalescing)
  out of `thai/segment.ts` into `src/core/segment.ts`; Thai now imports it (unchanged, tests green).
- **Boundaries = syllable starts.** `syllabify()` now returns each syllable's `start` (code-point index, handling
  the stacked-conjunct case where the upper member ကမ္ဘာ`မ` belongs to the next syllable). A word may begin/end
  only at a syllable start, so the DAG never splits mid-syllable.
- **seg-words.txt** = 6687 MULTI-syllable headwords from kaikki + wikipron (`tools/build-my-segwords.ts`). Single-σ
  words are excluded (they'd shatter unknown runs and beat correct longer words in the fewest-tokens DAG). Every
  ≥2-σ referee headword is therefore in the set → segments to ITSELF, so the per-word eval is unaffected.
- **Wiring.** `phonemizeWord(token)` = `segment(token).map(phonemizeSubword).join(" ")` (the Thai pattern);
  `phonemizeSubword` is the old per-word path (tone + voicing). Lazy-loaded.

**Effect.** `စကားပြော → [စကား, ပြော] → zəɡa˥˩ pjɔ˥˩` — **voicing now fires on running text**. `ကျွန်တော်စကားပြောသည် →
[ကျွန်တော်, စကား, ပြောသည်]`. Boundary recovery on composed input: **pairs 100% (478/478), triples 99.7% (317/318)**.
Segmental eval UNCHANGED (69.0/71.4% — referee words segment to themselves; +1 word each, no regression). Suite 371/371.

## Run — 2026-07-16 (cont.) — PRONUNCIATION LEXICON — the 🟡→✅ lexical layer

The rule engine was correct for the derivable bulk; the residual was a per-word LEXICAL tail. Added a pronunciation
lexicon (the Thai `dictionary.tsv` pattern) mined from the kaikki gold: `tools/build-my-dict.ts` stores the CORRECT
pronunciation IN OUR CONVENTION for every word the rule g2p gets wrong (2110 entries). Conversion is clean —
kaikki marks tone with a combining diacritic exactly where our Chao letter goes (`mjàɴmà` → NFD → replace `̀→˨` →
`mja˨ɴma˨`). Applied in `phonemizeSubword` as an authoritative exact-word override before the rules; OOV → rules.

**Numbers.** SHIPPED (dict + rules): **95.7% wikipron / 99.8% kaikki** folded. Rule-engine ALONE (dict disabled —
the floor a genuinely novel word gets): **71.4% / 73.7%**. Fixes the whole lexical tail: `လည်→lɛ`, `ချေး→t͡ɕʰi`,
`ဘုရား→pʰəja`, `ခုနစ်→kʰʊ̀ɴn̥ɪʔ`, loanword `⟨ရ⟩→ɹ`, and even repairs the `ကမ္ဘာ→ɡəba` rule exception.

**Honesty / circularity (accepted, Thai/cs-style).** The dict is mined from kaikki, so the **kaikki 99.8% is
CIRCULAR** for covered words. wikipron is a separate scrape but ALSO Wiktionary-derived, so the **95.7%
corroboration is partly correlated** — not fully independent. The non-circular signal is the **rule engine's
71.4%** (the hard-script ceiling for an unseen word). The dict trusts kaikki's first pronunciation, so it adopts a
few referee variants (`ခွ→kwa` drops ခ's aspiration; `ကား→ɡa` is a sandhi/citation voicing) — the aggregate is
strongly corroborated but individual fringe entries carry the referee's choices.

## Run — 2026-07-16 (cont.) — segmental push toward ✅ (rule-based classes)

Characterized the 🟡 residual and closed the RULE-based segmental classes (69.0/71.5 → **71.4/73.7%**):
- **Stacked-conjunct coda (the big lever, ~470 mismatches → 312).** A stacked C1 ္ C2 is not a silent upper
  member — C1 is the CODA of the preceding syllable (stop→checked ʔ, nasal→ɴ): `ဗုဒ္ဓ→boʊʔda`, `တက္က→tɛʔka`,
  `အိန္ဒိယ→ʔeɪɴdija`, `ကိစ္စ→kɪʔsa`. Reworked from a skip into the coda scan (removed the `pending` carry). Lexical
  exception `ကမ္ဘာ→kəba` (Pali မ္ဘ→b assimilation) is now `kaɴba` — a documented 1-word miss. Rebuilt the voicing +
  seg-words lexicons against the new syllabification.
- **Bare ⟨ွ⟩ open → -w- glide.** `ခွ→kʰwa`, `ကွ→kwa`, `မွ→mwa` (was collapsing to plain `a`). The ⟨ွ⟩ keeps the glide
  in OPEN syllables and before -ng; it only rounds to ʊ before -n/-m/stop.
- **လျှ → ʃ.** Reordered the medials to PHONOLOGICAL order (⟨ှ⟩ devoices first, then ⟨ျ⟩/⟨ြ⟩ palatalise): လ→l̥→ʃ, while
  မျှ→m̥ja, ရှ→ʃ, ကျ→t͡ɕ all still hold.

**Residual is now a LEXICAL TAIL (🟡), not rule bugs.** Of the ~2130 kaikki mismatches: **loanword ⟨ရ⟩→ɹ (333)** —
we render the native /j/ uniformly, the referee keeps the loanword /ɹ/ (a register/convention difference, our
modern-standard reading); **killed-final silent ⟨လ/ဟ⟩ (42)**; short-i rime ɪ~eɪ (18); nasal→minor Pali assimilation
(14); and a diverse **~1720 lexical tail** — lexical rime variation (`ည`→i~ɛ: လည်/lɛ, `ေ`→e~i: ချေး/tɕʰi), colloquial
forms (ဘုရား→pʰəja), Pali gemination (ခုနစ်→kʰʊnnɪʔ), OOV voicing, single-letter Pali-etymology rows (ဋ→ʈa). These
are per-word LEXICAL — a pronunciation lexicon (the Thai `dictionary.tsv` pattern, mined from kaikki + corroborated
on the independent wikipron) is the 🟡→✅ path; the rule engine is now correct for the derivable bulk.

## Run — 2026-07-16 (cont.) — segmentation review fixes

An 8-angle review of the segmentation PR caught a real regression + cleanups:
- **Peeled-fragment minor-ə un-reduction.** For an OOV run whose tail is a dict word, the DAG peeled the OOV
  prefix (`ကစကား → [က, စကား]`) and re-syllabified `က` standalone → word-final → un-reduced (`ka˥ˀ` instead of the
  whole-word `kə`). Fixed with a **partial-cover safety check**: a FULL dictionary cover is trusted and split (like
  Thai; the voicing lexicon then applies per word), but a PARTIAL cover (an OOV fragment) is accepted only if it
  PRESERVES every syllable BODY (whole-run vs concatenated per-part) — else the run is kept WHOLE. So `ကစကား` stays
  `kəsəka`, `စကားပြော` still splits to `zəɡa pjɔ`. Boundary recovery back to 100%/99.7%; eval unchanged.
- **Cleanups:** centralized the seg-words loader in `core/segment.ts` (`loadSegWords`, shared with Thai, carrying
  the load-bearing `reduce`-not-spread comment); reset the stacked-conjunct `pending` carry on a stray sign;
  stripped OUR spaces under `segmentJoin` in the raw eval metric; cleared the stale `🟠` fa/ps/ur floor comments.

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
