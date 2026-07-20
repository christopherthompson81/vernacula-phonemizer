# Persian (fa) short-vowel restoration via abjad→IPA — investigation

Persian is 🟡: the Perso-Arabic **abjad omits short vowels** (a/e/o), so the g2p produces the consonant +
long-vowel skeleton with a DEFAULT [a] for the omitted shorts, and the restoration subsystem is deferred. Two
ideas (from Chris) reframe the fix:

1. **Train/lookup on abjad↔IPA pairs, not abjad↔harakat.** The current restorer leans on Arabic **Tashkeela**
   harakat silver (machine-diacritized). But harakat is a lossy intermediate — it can't encode the **ezafe** (-e
   linker), final **ه** (/e/ in خانه vs /h/), or **و** (v/u/o/ow). `abjad → IPA` end-to-end keeps them.
2. **Use a Tajik parallel text as a data source.** Persian and Tajik are the same language; Tajik Cyrillic writes
   the very short vowels the abjad drops (and disambiguates homographs the abjad collapses). Shared classical
   literature published in both scripts (Shahnameh, Hafez, Rudaki) is a positionally-aligned parallel corpus for
   the frequent/native lexicon.

## Run 1 — the abjad→IPA gold already exists, and the headroom (2026-07-19)

**Finding: the abjad→IPA training gold is not missing — fa just isn't using it.** wikipron `fas_arab` is a large,
HUMAN, fully-voweled abjad→IPA source: **9,257 unique words (broad)** / 10,712 (narrow; +1,696 broad-lacks).
It is currently wired only as a *folded* eval referee (the short vowels are folded away as "unrecoverable"), and
fa's restorer trains on Arabic Tashkeela silver instead of this Persian human gold.

Built the cleaned gold `tools/fa-restoration/fa-abjad-ipa-gold.tsv` (broad, deduped, homograph variants kept as
tab fields, single-letter name citations dropped) and measured fa's CURRENT output through the *same* normalization
pipeline twice (`tools/fa-restoration/measure.ts`):

| metric | score | meaning |
|---|---|---|
| **FOLDED** (short vowels ignored) | **71.3–71.9%** | the consonant + long-vowel SKELETON (= the current eval basis; official eval 71.3%) |
| **UNFOLDED** (short vowels counted) | **30.1%** | the REAL pronunciation |
| **HEADROOM** | **~42 pp** | what short-vowel restoration is worth, on 9,256 human words |

So the skeleton is already ~72% right, but the full pronunciation is only ~30% — **short-vowel restoration is the
dominant error source and is now a measured target** (the folded metric hid it). (The stale memory figure "42.9%"
is superseded: the current official folded is 71.3%.)

**Honest ceiling:** ~9% of broad words are homographs with >1 valid pronunciation that only *sentence context*
resolves (مرد mard 'man' ~ mord 'died'; آخر ʔaːxir ~ ʔaːxar). Word-level restoration — from wikipron, Tajik, or
harakat — can store variants and pick the frequent one, but can't fully disambiguate context-free. This caps a
word-level restorer below 100% regardless of source.

## Plan

- **Phase 1 (this run, done):** cleaned abjad→IPA gold + the unfolded baseline measurement. fa's restoration is
  now scored (30.1% → skeleton ceiling ~72%), not hidden by the fold.
- **Phase 2:** an abjad→IPA restorer — **lexicon-first** (the 9.3k gold + the 1.7k narrow-only words cover the
  frequent lemmas directly), then a model for the OOV tail. Trained/evaluated on abjad↔IPA (idea 2), replacing the
  Arabic-silver harakat detour. Target: move UNFOLDED up toward the skeleton ceiling.
- **Phase 3:** Tajik parallel-text cognate mining (idea 1) to extend coverage past the wikipron gold — remapping
  Tajik→Persian (the majhul merger ō→u / ē→i, and ɔ→ɒ) — for the shared classical/frequent lexicon.
