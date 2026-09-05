# Iraqi Arabic (acm) native bring-up

Iraqi Arabic / اللهجة العراقية — the Baghdadi **gilit** dialect, ~15M+ speakers (Mesopotamian Arabic). The 4th
Arabic variety on the shared engine (after arz/apc/apd): a one-file shift table (`iraqi.jsonc`) applied on the MSA
g2p output — the "restore MSA → transform to the variety" path.

## Data availability (checked up front)

- **wikipron acm_arab broad** — 108 human pairs (PRIMARY). Small, but an independent human dialectal-IPA source.
- No kaikki acm, no epitran acm → single independent referee (a `secondaryGap`).

## The Iraqi fingerprint

The dialect is literally named for its reflex of *qultu* → **gilit**: the signature is **ق → [ɡ]**. Otherwise
Iraqi is conservative, which is what distinguishes it from the western dialects:

- **ق → [ɡ]** (gilit). [q] survives in learned/MSA-loan words — a lexical tail we don't model (default ɡ). The
  referee shows the ɡ~q split directly (2:2 on the 4 qaf words in the tiny scrape).
- **ج KEPT [d͡ʒ]** (the affricate — unlike Egyptian [ɡ], Levantine/Libyan [ʒ]).
- **خ KEPT [x]** (unlike Gulf/Libyan [χ]).
- **Interdentals ث/ذ/ظ KEPT** as [θ ð ðˤ] (the eastern-Bedouin pattern; Egyptian/Levantine/Moroccan merge them to
  stops). Referee confirms θ/ðˤ/ð present.
- Historical **diphthongs monophthongize**: بيت bajt→[beːt], يوم jawm→[joːm].

So the whole variety is `ق→ɡ` + the two diphthong rules — everything else is MSA.

## Run — vs the referee

**18.5% folded** (20/108), same pausal + gemination folds as MSA. The comparable consonants (the gilit ق→ɡ, the
kept ج/interdentals/خ) match; the residual is the **short-vowel restructuring** — the MSA diacritizer restores MSA
vowels, not Iraqi (Iraqi centralizes/reduces short vowels, and the gilit dialect has its own epenthesis), which is
the same data-blocked wall documented for arz/apc. The 108-word referee also makes the number noisy.

## Verdict — 🟡 Reliable + data-blocked vowel tail

The consonant fingerprint (the audible Iraqi character) is done and referee-checked; the vowels are the documented
ceiling (a dialect diacritizer would recover them, as for arz). Numbers share the MSA composer.
