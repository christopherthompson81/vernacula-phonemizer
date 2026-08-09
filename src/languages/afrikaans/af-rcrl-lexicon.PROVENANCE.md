# af-rcrl-lexicon.tsv — provenance

**Artifact:** `src/languages/afrikaans/af-rcrl-lexicon.tsv` — 25,112 word→IPA entries, the **shipped**
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

### Vetting: every entry is checked against the RULE output

⚠ **Wholesale import was wrong.** The first draft vetted only at the SYMBOL level — "these four symbols map
to those four" — which structurally cannot see a narrow transcription that differs as a *sequence* or as a
*rule*. Review of #776 found three shipping defect classes it missed. The dictionary is now vetted against
`phonemizeWordRules`, which is the right relationship between the two: **the dictionary wins on lexical
knowledge** (which vowel this loan takes, where its stress falls), **the rules win on systematic phonology**
(devoicing, length, what the inventory contains). 27,428 → **25,112**:

| check | action | n |
|---|---|---|
| the INDEPENDENT primary referee already corroborates the rules | drop — see below | 1,294 |
| the rules emit a long vowel this source **cannot write** | drop | 985 |
| word-final obstruent **devoicing** | repair to the engine's coda | — |
| **schwa epenthesis** in /rm, lm/ (arm→arəm, film→fələm) | take the rule's form | — |
| a **dropped onset** (tsaar → sɑːr, i.e. rules minus the first phone) | take the rule's form | — |
| edit distance from the rules beyond a threshold (`abe` → əib) | drop as a source error | 33 |
| **single letters** | drop | 4 |

Three of these deserve their reasoning recorded:

- **The primary referee overrules this dictionary.** Where en.wiktionary has the word and already agrees
  with the rules, the lexicon may not override: the two sources conflict there, and the tiebreaker should be
  the one that is *not* the lexicon's own source. It is only 2,220 words, but they are the adjudicated ones —
  `môre` (primary ˈmɔː.rə vs RCRL ˈmɔ.rə, and the manifest documents ⟨ô⟩ = long), `Afrika`, `polisie`,
  `subsidie`, `telefoon`. **This guard is what took regressions against the primary from 29 to zero.**
- **The length check is keyed on the source's INVENTORY, not on spelling.** "The rules have ː and the entry
  does not" is the wrong test — it also drops every row that correctly says SHORT where our rules over-apply
  length (`kanon`, RCRL ka.ˈnɔn against our kɑːnɔn, is exactly what a lexicon exists to fix). The source *has*
  ɑː, øː and ɔː, so a short value there is a real lexical claim; it has **no ɛː, œː or yː at all**, so a short
  value there is an inventory gap. The missing set is derived by scanning the source, not typed out.
- **Single letters** (`a`, `n`, `o`, `u`). A bare letter is SPELLED, not sounded — ⟨C⟩ is "see" [siə]
  (#761) — and a lexicon hit shadows that rule; `802.11n` read *…elf ə*. ⚠ **The second time:** review of
  #770 caught the identical trap in af-lexicon.tsv, where stray `j`/`q` rows made ⟨J⟩ read [jɛ]. ⚠ ⟨'n⟩ is
  **kept** — it is two characters, and its value `ə` matches the rule.

Also normalized: **word-initial ⟨v⟩ written [v] → [f]** (both sources ~97% [f]: RCRL 2363:69, primary
184:13; Run 6 established the class as noise). Left in, it shipped `vitamien` → [v]itamin on one row.

**Measured on the INDEPENDENT primary referee: rules 79.5% → shipped 86.1%, +147 words, 0 regressions.**

**Stress marks and syllable dots are stripped.** The engine emits neither, and a lexicon carrying them
would make shipped output inconsistent with every word the rules produce. (The referee keeps them —
they are the raw material for the stress work, see `docs/afrikaans_stress_investigation.md`.)

## Known limits

- Single pronunciation per headword; RCRL records no variants (verified: 0 headwords with two distinct
  phone strings).
- Coverage is dictionary vocabulary, so inflected forms outside it, proper nouns, and English loans in
  Afrikaans text still fall through to the rules — that residue is the OOV tail, and is the natural
  target for a neural tier now that af has 27k pairs independent of the primary referee.
