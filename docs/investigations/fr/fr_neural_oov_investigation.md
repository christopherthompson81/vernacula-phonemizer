# French neural OOV — should the rule g2p get a BiLSTM too? (the English follow-up)

Question (user): French has a similar lexicon-first architecture — should we re-examine its OOV path like English?

**Architecture check.** French is **lexicon-first** (Lexique 3.83, ~125k forms, `lexicon.tsv`) → a **rule-based** g2p
(`g2p.ts` `toIpa`) for OOV. NOT a perceptron and NOT an n-gram (the fleet's perceptron is the POS tagger). So the
analogous question to English is: is the *rule* OOV worth a BiLSTM?

## Run 1 — 2026-07-25 — measured on a clean Lexique held-out

Same clean protocol as English (md5 90/10 split of Lexique; `tools/french/fr_g2p_bilstm.py`, char-based IPA, SEP=""):

| Lexique held-out (12,586 words) | word-exact | symbol accuracy (1−PER) |
|---|---|---|
| **rule g2p** (`toIpa`) | 76.6% | 94.3% |
| **BiLSTM** (char→IPA-chunk, the bn/nb pattern) | **94.9%** | **99.1%** |

**+18.3 pts word-exact; phone errors 5.7% → 0.9% (84% fewer)** — a *larger* lift than English. Counter-intuitive
(French is a regular orthography), but that regularity is exactly why the BiLSTM nears the ceiling (99.1% symbol) while
the hand-written rules leave real gains on the table.

**The rule errors are GENUINE gaps, not a foldable convention** (categorised the 2,949 mismatches):
- **`del→∅` (1477, ~half):** the rule VOICES the silent 3rd-person-plural verb ending `-ent`/`-aient` as `[ɑ̃]`
  (abolissent → rule `abɔlisɑ̃` vs Lexique `abolis`; abreuvaient, absorbaient…). This is the French `-ent` homograph
  (noun/adj `-ent`=[ɑ̃] like *content* vs verb `-ent`=silent) — undecidable without morphology/POS. The BiLSTM learns
  the pattern statistically from Lexique.
- **vowel quality:** `ɛ→e`/`ɛ→ə` (187+63 — loi de position / schwa), `œ→ø`/`ø→œ` (113+31 — abreuvage rule `ø`/lex `œ`).
- **assimilation/devoicing:** `b→p` before /s/ (absence → `apsɑ̃s`), `s→z`/`s→t`.

**Verdict: YES — a BiLSTM OOV tier is worth it for French, and the build is THINNER than English** (French emits IPA
directly → fits the shared `createWordStructuralTagger` factory like nb, no ARPABET intermediate / stress-render).
**Caveat:** the held-out is Lexique-word-distributed (verb-heavy), so the `-ent` advantage is amplified; real French
OOV (proper nouns, foreign words) has fewer `-ent` verbs, so the real-target lift is likely somewhat smaller than
76.6→94.9 — the same distribution caveat as English (a proper-noun-partition held-out would sharpen it).

## Run 2 — 2026-07-25 — PRODUCTIONIZED (the thin build)

Shipped the French neural OOV tier — the low-barrier version, since French emits IPA directly (no ARPABET intermediate,
no stress-render). It reuses the shared `createWordStructuralTagger` factory with **no postprocess** (nb-style thin
wrapper), unlike English which needed a bespoke ARPABET tagger:
- `frenchTagger.ts` — a ~10-line wrapper over the shared factory (lowercase+NFC preprocess only).
- `frNeural.ts` — async `phonemizeFrNeural`: pre-pass tags each distinct OOV word once, injects as the sync engine's
  new `oovOverride` (threaded through `french.ts` phonemizeWord/text: lexicon → tagger → rule g2p). Lexicon/number/
  liaison/accent output byte-identical to `phonemize(text, "fr")`.
- Model: full-Lexique, dynamic-int8 (9.1MB→2.3MB), 43 chars / 81 tags.

Verified: gribouillissent → `il ɡʁibujˈi` (silent -issent) vs the rule's `il ɡʁibujisˈɑ̃`; Macronisme → `makʁɔnizm`
(-isme=/izm/) vs rule `makʁɔnism`; Zorplex → `zɔʁplɛks` vs rule `zɔʁplə`. Full suite 1047/1047, tsc 0 errors. Opt-in
(import from src/frNeural.ts); the sync `phonemize(text, "fr")` is unchanged.
