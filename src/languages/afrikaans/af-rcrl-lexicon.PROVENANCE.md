# af-rcrl-lexicon.tsv — provenance

**Artifact:** `src/languages/afrikaans/af-rcrl-lexicon.tsv` — 26,872 word→IPA entries, the **shipped**
Afrikaans pronunciation lexicon. Built by `tools/afrikaans/build_af_lexicon.ts` from the in-repo
referee (no network); re-runnable.

## Source and licence

**RCRL Afrikaans Pronunciation Dictionary v1.4.1** — © 2010 Centre for Text Technology (CTexT),
North-West University, South Africa — redistributed by **`ttslab/za_lex`** `data/afr/` (Multilingual
Speech Technologies, NWU; © 2016 The Department of Arts and Culture, Government of the Republic of
South Africa).

**Licence: Creative Commons Attribution-Share Alike 2.5 South Africa** (`CC BY-SA 2.5 ZA`). Share-alike,
**not** NonCommercial. This is a **shipped** §3 share-alike artifact (LICENSES/PROVENANCE.md), fenced per
file inside the MIT repo exactly like `french/lexicon.tsv` (Lexique) and `afrikaans/af-stems.txt`.
Derived work inherits CC-BY-SA. Full derivation of the underlying referee:
`tools/referee-eval/referees/af.rcrl-apd.PROVENANCE.md`.

## Why it exists

The rule engine scores 79.5% word-exact on the primary referee and 65.2% on RCRL — but **~87% on
running text**. A dictionary-shaped referee over-samples rare, long, Latinate words; ordinary text is
short and native, and the rules already handle it. The lexicon is worth having anyway because of where
the remaining errors fall:

| | |
|---|---|
| RCRL coverage of running-text **tokens** (mined corpus) | **86.2%** |
| rule engine exact on those tokens, frequency-weighted | **87.4%** |
| with the lexicon | **99.5%** |
| net | **≈10.5pp of ALL running-text tokens** |

That is the largest single lever left for shipped output, and the same tiering `da`, `nb`, `fr` and
`en` already use.

## ⚠ Shipped path only — the eval must not move

`phonemizeWordRules`, which the referee eval scores, **does not consult this file**. RCRL is one of
this language's two referees, so scoring a lexicon built from it would be scoring the answer key. This
is the house pattern (en-GB, tl, ilo, km do the same), and the check is concrete: **the eval numbers
are byte-identical before and after this lexicon landed** — primary 1765/2220, secondary 17,885/27,428.

## Precedence

1. **`af-lexicon.tsv`** (44 curated proper nouns/opaque loans) — consulted FIRST and wins. It is
   hand-adjudicated and carries values RCRL does not, e.g. `Afrikaans` → `afrikɑ̃ːs` with its nasal,
   against RCRL's `afrikɑːns`.
2. **this file** (27,428 entries).
3. the rule engine.

## Normalization to the engine's inventory

⚠ **Not copied raw.** Review of #770 caught `af-lexicon.tsv` shipping referee-narrow symbols that the
eval's own folds hide, so they reached users unmeasured. The full set of deltas — verified exhaustive
by diffing the symbol inventories — is:

| RCRL | ours | why |
|---|---|---|
| `x` | `χ` | the ⟨g⟩ fricative; we write the uvular symbol throughout |
| `æ` | `ɛ` | ⟨e⟩ before /r l/ — RCRL narrow-transcribes the lowered allophone |
| `ʊ` | `u` | the ⟨oo⟩ centering-diphthong onset [ʊə]~[uə] |
| `ɡ` | `χ` | a few rows write ⟨g⟩ as a stop; this engine has no /ɡ/ |
| `əu` | `œu` | ⟨ou⟩/⟨au⟩ — **notation, not disagreement**: RCRL is 325:0 for [əu] and en.wiktionary 34:0 for [œu], each internally unanimous |

### Three exclusions, every one found by an existing golden failing

⚠ **Wholesale import was wrong, and the test suite is what said so.** 27,428 → **26,872**:

1. **Single letters** (4: `n`→ə, `a`→a, `o`→œu, `'n`). A bare letter in Afrikaans text is SPELLED, not
   sounded — ⟨C⟩ is "see" [siə] (#761) — and a lexicon hit shadows that rule. ⚠ **This is the second
   time:** review of #770 caught exactly this in `af-lexicon.tsv`, where stray `j`/`q` rows made ⟨J⟩
   read [jɛ]. Same language, same trap, different source.
2. **⟨ê⟩ ⟨û⟩ ⟨ô⟩ ⟨uu⟩ words** (552). RCRL has **no `ɛː`, no `œː` and no `yː` at all** — it writes
   `aangelê` ɑːnxəlɛ and `aangestuur` ɑːnxəstyr — so importing them would silently delete a length
   distinction the engine marks and the primary corroborates (`ɛː` ×16, `yː` ×3). This is an inventory
   gap in the source, not a disagreement about the language. ⟨ô⟩ joins them on the same evidence: RCRL
   *has* `ɔː` (150 rows) yet writes `môre` short against the primary's `ˈmɔː.rə`. The rules get all of
   these right from the spelling, so dropping the entry beats importing a flattened one.
3. **Word-initial ⟨v⟩ written [v]** — normalized to [f] rather than dropped. Both sources agree
   overwhelmingly (RCRL 2363:69, en.wiktionary 184:13) and Run 6 established the f→v class is
   transcription noise. A dictionary's per-word value normally beats a majority rule — that is the point
   of a lexicon — but not when the majority is 97% **across independent sources** and the minority has no
   environment of its own. Left in, it would have shipped `vitamien` → [v]itamin on the strength of one row.

**Stress marks and syllable dots are stripped.** The engine emits neither, and a lexicon carrying them
would make shipped output inconsistent with every word the rules produce. (The referee keeps them —
they are the raw material for the stress work, see `docs/afrikaans_stress_investigation.md`.)

## Known limits

- Single pronunciation per headword; RCRL records no variants (verified: 0 headwords with two distinct
  phone strings).
- Coverage is dictionary vocabulary, so inflected forms outside it, proper nouns, and English loans in
  Afrikaans text still fall through to the rules — that residue is the OOV tail, and is the natural
  target for a neural tier now that af has 27k pairs independent of the primary referee.
