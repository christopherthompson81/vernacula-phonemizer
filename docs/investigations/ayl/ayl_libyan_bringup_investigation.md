# Libyan Arabic (ayl) native bring-up

Libyan Arabic / اللهجة الليبية (Tripolitanian) — ~6M+ speakers. The 7th Arabic variety on the shared engine: a
one-file shift table (`libyan.jsonc`) on the MSA g2p output.

## Data availability (checked up front)

- **wikipron ayl_arab broad** — 166 human pairs (PRIMARY). Small, independent human dialectal IPA.
- No kaikki ayl, no epitran ayl → single independent referee (a `secondaryGap`).

## The Libyan fingerprint

Libyan sits **between** the Maghrebi and eastern-Bedouin patterns — it takes one feature from each:

- **ق → [ɡ]** (the Bedouin voiced reflex; referee-dominant 28).
- **ج → [ʒ]** (the Maghrebi fricative — referee-dominant 9; unlike the eastern [d͡ʒ] of Iraqi/Gulf). This is the
  feature it shares with its Maghrebi neighbours.
- **خ → [χ]** (uvular; referee-dominant 12).
- **Interdentals ث/ذ/ظ KEPT** as [θ ð ðˤ] — the Bedouin-conservative feature (unlike Egyptian/Levantine/Moroccan,
  which merge them to stops). This is the feature it shares with the eastern dialects.
- Historical **diphthongs monophthongize**: ħajtˤ→[ħeːtˤ], jawm→[joːm] (referee confirms ħeːtˤ, aːko).

## Run — vs the referee

**12.0% folded** (20/166), same pausal + gemination folds as MSA. The comparable consonants (ق→ɡ, ج→ʒ, خ→χ, kept
interdentals) match; the residual is the **short-vowel restructuring** — Libyan reduces/backs short vowels (the
referee shows heavy [ə] and emphatic-backed [ɑ]) which the MSA diacritizer does not produce. Same data-blocked wall
as arz/apc, on a small (166-word) referee.

## Verdict — 🟡 Reliable (consonants) + data-blocked vowel tail

The consonant fingerprint (the Maghrebi/Bedouin blend — ق→ɡ, ج→ʒ, خ→χ, interdentals kept) is correct and
referee-corroborated. The vowels are the documented ceiling. Numbers share the MSA composer.
