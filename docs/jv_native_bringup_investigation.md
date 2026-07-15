# Javanese / Basa Jawa (jv) native bring-up

Austronesian (Malayo-Polynesian), ~80M speakers, Java. Written today predominantly in **Latin** (the target here)
and historically in **Aksara Jawa** (a Brahmic abugida — a separate second script, see the follow-up phase note).
Ported from the espeak-ng-portable authored `jv` bring-up into a vernacula rule-based g2p (the id/tl pattern), and
— crucially — validated against a **real human referee** the original never had: **kaikki jav** (Wiktionary).

## The signature Javanese processes (what distinguishes it from Indonesian)
- **The ⟨a⟩→[ɔ] rule** — /a/ in a word-final OPEN syllable → [ɔ], and the harmony reaches back ONE syllable (a
  penult /a/ one consonant away also → [ɔ]): apa→ɔpɔ, mata→mɔt̪ɔ, Jawa→d͡ʒɔwɔ, sanga→sɔŋɔ. A closed final syllable
  blocks it: mangan→maŋan, dalan→d̪alan.
- **Dental vs retroflex** — ⟨t d⟩→t̪ d̪ vs ⟨th dh⟩→ʈ ɖ (retroflex, NOT aspirates — the Indic-family fingerprint,
  from Aksara Jawa's Brahmic inheritance). Indonesian lacks this contrast.
- **Closed-syllable laxing** (i→ɪ u→ʊ o→ɔ) + **word-final ⟨k⟩→ʔ** (pitik→pit̪ɪʔ, wong→wɔŋ).
- **The ⟨e⟩ problem** — Latin writes pepet /ə/, taling-é /e/ and taling-è /ɛ/ ALL as bare ⟨e⟩. We default bare
  ⟨e⟩→ə (most frequent) and honour é→e, è→ɛ. An unmarked taling word reads with ə — the documented lexical tail.
- ngoko **numbers** (irregular: -likur/-welas, suppletive seket/sewidak, combining multipliers) — the compositor
  ported verbatim.

## Referee: kaikki jav (human)
No wikipron jav (404); epitran jav-Latn exists but is a flat segment map (no a→ɔ, no laxing, no stress) — too
crude to grade the contextual rules, so not wired as a second source. kaikki (Wiktionary) marks the signature
features (mata→mɔtɔ, bantu→bant̪u, pepet ə) and gives **1,362 Latin word→IPA pairs** — though note **most kaikki
Javanese headwords are actually in Aksara Jawa** (2,691 script vs 137 pure-Latin), and my Latin referee is mostly
their romanizations. That fact motivates the Aksara Jawa follow-up (below).

## Runs — 2026-07-15
- **Run 1** — ported the engine (a→ɔ, dental/retroflex, laxing, final-k, e-diacritics, ngoko numbers) + built the
  kaikki referee. First measure was polluted (the referee mixed Aksara-Jawa headwords my Latin engine can't read →
  empty output); filtering to Latin/romanized forms fixed it. **84.4% folded.**
- **Run 2** — the referee earned its keep: it caught that my a→ɔ harmony **over-spread to the antepenult**
  (wahana→*wɔhɔnɔ*, pratama→*prɔtɔmɔ*). Javanese reaches back only ONE syllable; changed the iterating spread to a
  single penult step. **→ 85.9% folded.**

## Result — 🟡
85.9% folded vs the human kaikki referee; the residual is diffuse and referee-limited: Sanskrit-loan a→ɔ
exceptions (denta, sastra keep [a]), register variants (dinten *krama* vs dina *ngoko*), the referee's OWN
inconsistent multi-syllable harmony (hanacaraka fully harmonises → hɔnɔt͡ʃɔrɔkɔ, yet wahana stops at penult),
and optional h-dropping (hasti~asti). 🟡 for the documented **⟨e⟩ pepet/taling ambiguity** (the lexical tail) and
the deferred breathy/slack-voice register on the "voiced" stops.

## Follow-up phase — Aksara Jawa (Hanacaraka) front-end
Worth doing as a SECOND script front-end for `jv`: it's a Brahmic abugida → reuses `core/abugida.ts`, then the
SAME phonology above. Two payoffs: (1) it **resolves the ⟨e⟩ ambiguity** — Aksara Jawa writes pepet vs taling with
distinct sandhangan, and dental vs retroflex with distinct aksara, so script input is *more* phonemic than Latin;
(2) it is **better refereed** — 1,693 Aksara-Jawa→IPA pairs in kaikki (vs 137 pure-Latin). Wrinkles: pasangan
(subjoined cluster consonants instead of a visible virama), sandhangan vowel signs, pangkon (final vowel-killer),
angka/pada. A focused abugida bring-up on existing infrastructure.
