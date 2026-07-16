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

## Phase 2 — 2026-07-15 — Aksara Jawa (Hanacaraka) front-end ✅
Added the native abugida as a SECOND script front-end. Rather than the generic `core/abugida.ts` (which returns a
string and doesn't model coda-signs/medials), a focused scanner `aksara.ts` produces the SAME `Seg[]` the Latin
g2p does — so the shared `applyPhonology` (extracted from the Latin path: a→ɔ, laxing, final-k→ʔ, stress) runs
unchanged. `phonemizeWord` routes by script; `text()` also tokenises Aksara word runs, angka digits (→ the ngoko
compositor) and pada punctuation. The model: base consonant + inherent /a/, sandhangan vowel signs (taling ꦺ = e,
**taling + tarung ꦴ = o**, pepet ꦼ = ə), medial signs (cakra ꦿ = -r-, pengkal ꦾ = -y-, **keret ꦽ = -rə-**), coda
signs (cecak ꦁ = ŋ, layar ꦂ = r, wignyan ꦃ = h), pangkon ꧀ = virama.

Validated against **1,268 Aksara-Jawa→IPA kaikki pairs**. First pass 75.2%; the residual was one dominant class —
**ꦲ "ha" is the zero-onset VOWEL CARRIER** (silent [h]: ꦧꦁ→abang not *habang, ꦧꦲꦸ…→bau… not *bahu…; a real /h/
coda is wignyan ꦃ). Making ꦲ a silent carrier → **83.5%**, then a ɲ-before-affricate precision fold (the script
writes ꦚ ɲ explicitly where the referee writes plain n) → **84.5%**, right alongside the Latin 86.2%. The two
front-ends share one phonology (ꦥꦶꦠꦶꦏ꧀ and "pitik" both → pit̪ɪʔ). This also **closed the secondaryGap** — the
script path is now a genuine second referee. Payoffs realised: Aksara input carries the pepet/taling and
dental/retroflex distinctions the Latin ⟨e⟩/⟨t⟩ blur.

LIMITATION: Aksara Jawa is traditionally written WITHOUT inter-word spaces; a space-less script run is treated as
one token (glued), so connected space-less text would need a segmenter (Thai/Wu pattern). Per-word (the referee,
and modern spaced usage) works.

## Run (2026-07-16) — REVIEW: cross-script ⟨e⟩ lexicon (Punjabi pattern) + homorganic-nasal rule

Bucketed the residual (kaikki Latin, 187 misses): diffuse — dominated by lexical a→ɔ loan exceptions (denta, ora,
angsa) + harmony-spread + the folded ⟨e⟩ tail. Two candidate rules DIED on measurement: final-obstruent devoicing
(referee devoices only 17/152 → lexical) and a~ɑ (ɑ appears 2× total → negligible).

The stated ⟨e⟩ tail: Latin ⟨e⟩ defaults to pepet ə, but taling words (pangeran, bebek, raden) are [e]/[ɛ] — and
it is UNRECOVERABLE from Latin orthography (no rule). CROSS-SCRIPT TRANSFER (the Punjabi approach): the Aksara Jawa
script writes pepet ꦼ vs taling ꦺ distinctly. Transliterated each kaikki-Aksara word → its Latin key (Aksara→Latin
is deterministic, collapsing pepet/taling→⟨e⟩, exactly the ambiguity) and phonemized it via our OWN Aksara
front-end (resolves ⟨e⟩); pinned the resolved form to the Latin word where the Latin default differs. **130 entries**
(all pure ⟨e⟩ resolutions), shipped-Latin-only (Aksara input resolves natively; numbers bypass it — the taling
homograph seket ≠ the number 50 [səkət̪]). Rule-only Latin 0/130 correct → shipped 130/130.

Also found a RULE (the user's "even better"): homorganic nasal n→ɲ before a palatal affricate (kanca→kaɲt͡ʃɔ,
banci→baɲt͡ʃi) — the Latin under-specified the nasal (the Aksara writes ꦚ). Eval-neutral (config folds ɲ~n),
shipped-correct. The a→ɔ closed-penult harmony spread (bangsa→bɔŋsɔ) was tested and REVERTED (net −2pp; the referee
is inconsistent on closed penults, as the code comment already warned).

Eval rule-only unchanged (86.2/84.5, the eval folds ⟨e⟩); the cross-script lexicon is a shipped-quality gain the
folded % cannot see. Suite 373/373.
