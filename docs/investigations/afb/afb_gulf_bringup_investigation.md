# Gulf Arabic (afb) native bring-up

Gulf Arabic / اللهجة الخليجية (Khaleeji) — ~15M+ speakers across Bahrain/Kuwait/Qatar/UAE/eastern Saudi. The 5th
Arabic variety on the shared engine: a one-file shift table (`gulf.jsonc`) on the MSA g2p output.

## Data availability (checked up front)

- **wikipron afb_arab broad** — 763 human pairs (PRIMARY). Independent human dialectal IPA.
- No kaikki afb, no epitran afb → single independent referee (a `secondaryGap`).

## The Gulf fingerprint

- **ق → [ɡ]** (the Bedouin voiced reflex; referee-dominant, 80:30 over retained [q]).
- **خ → [χ]** (uvular fricative — the referee consistently writes χ, 34:1, NOT the Egyptian/Iraqi [x]). This is the
  one place Gulf differs from Iraqi on the consonants.
- **ج KEPT [d͡ʒ]** and **interdentals ث/ذ/ظ KEPT** [θ ð ðˤ] (the conservative eastern pattern).
- Historical **diphthongs monophthongize** (ay→eː, aw→oː).
- **Deferred lexical tails** (conditional/lexical, not modelled): the Gulf ج→[j] reflex (yaʕal — 11 referee
  tokens), ق/ك affrication before front vowels (ق→[d͡ʒ], kaškaša ك→[t͡ʃ]).

## Run — vs the referee

**3.3% folded** (25/763) — **the lowest in the Arabic-variety family, and honestly so.** Gulf is the deepest vowel
wall: it reduces short vowels to **schwa [ə]** pervasively (radd→[rəd], zaff→[zəf], ħaʃʃ→[ħəʃ]) and realizes the
feminine ة as **[ə]** (ħāra→[ħɑrə], marra→[mərə]). The MSA diacritizer restores MSA short vowels (a/i/u), so almost
every word mismatches on the vowels even when the **consonants agree** (ħ, sˤ, d͡ʒ, ʃ, the ق→ɡ and خ→χ shifts all
land). Because Gulf words are short (2–3 phones), one vowel mismatch fails the whole word under exact-match.

This is not a bug — it is the arz/apc data-blocked vowel ceiling taken to its extreme. The only machine-readable
Gulf-vowel source is the referee itself, so a vowel restorer is data-blocked (as for every variety here).

## Verdict — 🟡 Reliable (consonants) + deep data-blocked vowel tail

The consonant fingerprint (ق→ɡ, خ→χ, kept ج/interdentals) is correct and referee-corroborated. The vowels are the
documented — and here unusually large — ceiling. The low % is a referee-vs-vowel-tail artifact, not a quality
signal (see the referee-eval README's standing caveat). Numbers share the MSA composer.
