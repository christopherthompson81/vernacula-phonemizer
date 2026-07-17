# Nigerian Pidgin / Naija (pcm) native bring-up

The first **English-lexified creole** in the project (~100M+ speakers, Nigeria's lingua franca). Authored,
beyond-any-referee: there is **no wikipron `pcm`, no epitran `pcm-Latn`, no kaikki extract** (all 404) — so the
quality anchor is a **hand-adjudicated gold** (`test/naija.test.ts`) drawn from Faraclas, *Nigerian Pidgin*
(Routledge 1996) and the Naija Languej Akademi orthography manual, with the referee gap recorded in
`tools/referee-eval/langs/pcm.jsonc` (`referees: []` + `secondaryGap`). This mirrors the Haitian-Creole precedent
in the sibling project.

## Orthography decision (user steer)
Naija has two written norms: the **academic phonemic** NLA orthography (regular, but rarely used by the public)
and the **English-etymological media** spelling (BBC Pidgin / Wazobia / social media — what people actually read
and write). We target the **media orthography** — it matches the "people read and write it" criterion and is the
useful one. Consequence: the orthography is NOT shallow (it inherits English's deep spelling for English-kept
words), so the engine is:

1. a **lexicon** of high-frequency words whose media spelling is irregular or whose mid-vowel quality needs
   adjudication (dey→dɛ, e→i, make→mek, say→se, comot→kɔmɔt, go→ɡo);
2. a **Naija-phonology rule g2p** for everything else — 7 vowels /i e ɛ a ɔ o u/, TH-stopping (th→t/d), NO schwa
   reduction (full vowels), digraphs ch→t͡ʃ sh→ʃ gb→ɡ͡b kp→k͡p ny→ɲ ng→ŋ, /r/→ɾ. Because Naija **nativises** English
   loans (reads them with Naija values), applying this rule g2p to an English-spelled token is generally MORE
   correct than routing it to the English phonemizer — so there is no automatic English fallback (the English
   phonemizer is wired as `foreign` and available, but loans are nativised by default). Deep-English un-respelled
   words (formal borrowings, proper nouns) are a documented tail.

## Deferred / out of scope
- **Tone.** Naija is tonal (H/L, from the substrate) but the media orthography does **not mark tone** — so no G2P
  can derive it. Output is segmental; tone is orthographically underivable, not an engine failure.
- **Mid-vowel openness on OOV** (⟨e⟩=/e/~/ɛ/, ⟨o⟩=/o/~/ɔ/) — lexical; the lexicon carries the frequent words, the
  rule-g2p default is documented, the OOV tail is accepted.

## Run 1 — 2026-07-15
Initial authored g2p + lexicon (~130 entries) + jsonc + gold. Probing on common words + BBC-Pidgin sentences
confirmed the architecture works: the rule g2p correctly **nativises** phonemically-spelled words (danfo→danfo,
okada→okada, suya→suja, egusi→eɡusi, jollof→d͡ʒolof) and the lexicon carries the irregular high-frequency ones
(dey→dɛ, e→i, make→mek, say→se, comot→kɔmɔt). Two fixes from the probe:
- **Degemination.** Naija has no geminates, but English media spelling keeps doubled letters (jollof, garri,
  happen) — added a `(.)\1+`→`$1` collapse at the top of the rule g2p (jollof→d͡ʒolof, garri→ɡaɾi, happen→hapen).
- **Silent-⟨e⟩ / English-kept irregulars.** OOV rule-g2p mis-read silent-e words (come→`kome`); added the
  highest-frequency ones to the lexicon (come→kɔm, name→nem, take→tek, time→taim, house→haus, thing→tin, …) plus
  the pronouns (you→ju, i→a, me→mi). The long tail of low-frequency English-kept words stays a documented tail.

Sample: `Wetin dey happen? Di pikin don chop.` → `wɛtin dɛ hapen ? di pikin dɔn t͡ʃɔp .`
        `Abeg make you no vex.` → `abɛɡ mek ju no vɛks .`

## Result — 🟡
Segmental g2p is solid on the media orthography: lexicon + nativising rule g2p, with a hand-adjudicated gold
(`test/naija.test.ts`) as the committed anchor since **no independent referee exists** (recorded as an explicit
`referees: []` + `secondaryGap` in the referee-eval config, not silently omitted). 🟡 rather than ✅ because of
three deliberate scope boundaries, all inherent to the target rather than engine defects:
1. **Tone** (Naija H/L) is unmarked in the media orthography → orthographically underivable, deferred.
2. **Mid-vowel openness on OOV** (⟨e⟩=/e/~/ɛ/, ⟨o⟩=/o/~/ɔ/) — the lexicon carries the frequent words; the OOV tail
   takes the close-mid default.
3. **Deep-English un-respelled words** (formal borrowings, proper nouns) — a lexical tail; Naija nativises them
   with the rule g2p, which is generally more correct than the English phonemizer for the creole register.
A larger adjudicated lexicon (2 & 3) and a tone lexicon (1) are the paths to ✅.

## Run 2 — 2026-07-16 — English-spelling → Naija phonetics (nativise via the English dict) + soft-c/wh

Confirmed there is genuinely NO independent pronunciation referee (unlike Min Nan): no wikipron/kaikki/epitran
pcm; the ChhoeTaigi-analogue `naijalex` (SFB1102 / discourse-lab) is a discourse-connective lexicon with NO IPA.
So pcm stays gold-anchored. But `naijalex` gives a FREQUENCY-RANKED high-frequency word list, which surfaced
real rule-g2p gaps in the commonest words.

**The reframing (user steer): conventional English spellings must collapse to Naija phonetics too.** Nigerian
Pidgin is English-lexified and real (BBC-Pidgin / media) text is a MIX — respelled forms for distinctly-Naija
items (dey, wetin, comot, sabi, pikin) and STANDARD ENGLISH spelling for the large English-derived vocabulary
(when, because, people, water, once, though). A TTS user expects Naija phonetics across the whole line. So
English-spelling→Naija is the CORE job, not a deferrable tail.

**Architecture: nativise via the English dict, rule-g2p for substrate loans.** We already ship a cleanroom
English G2P (englishG2p) that solves spelling→sound INCLUDING irregulars. New word path (naija.ts phonemizeWord):
1. Naija lexicon (respellings + substrate loans + irregulars) — first.
2. If the word is a known-English DICT hit (new `EnglishPhonemizer.knownWord` — dict-only, no OOV G2P) →
   **nativise** its CMUdict IPA → Naija: the 7-vowel system /i e ɛ a ɔ o u/ (no schwa reduction, no length),
   TH-stopping (θ→t, ð→d), NON-RHOTIC codas (water→wata, car→ka; onset r→ɾ). once→wɔns, because→bikɔz,
   while→wail, though→do, first→fɔst.
3. Rule g2p — for OOV words (substrate loans, phonemically spelled): danfo/egusi/suya/jollof stay correct because
   they are OOV in the English dict, so they never route through nativisation. The DICT-MEMBERSHIP is the clean
   routing signal (English → nativise; OOV → rule).

Also added two English spelling conventions the rule g2p had missed (they fix the highest-frequency words even
before nativisation, and help any OOV English-etymological word): **soft-c** (⟨c⟩ before e/i/y → /s/: once, since,
hence) and **⟨wh⟩→w** (when, while, what, why).

**Diaphonemic DTO — considered and DEFERRED.** A dialect-neutral lexical-set intermediate (Wells sets / the
Unisyn model) was prototyped and set aside: our GenAm CMUdict SOURCE has already merged the dialect-distinguishing
sets (TRAP≡BATH, LOT≡PALM), so a diaphonemic layer derived FROM GenAm is a faithful pipe with a lossy payload — it
can't drive en-GB correctly for the merged sets, and it buys Naija nothing over the flat nativise (same merges).
The richer right answer (a grapheme↔phoneme object carrying the transform history, so BATH is recovered from the
SPELLING where the distinction still lives) is the future foundation, to be built from a real diaphonemic source
(Unisyn) when en-GB is tackled — not bootstrapped from the one accent that merged the distinctions.

RESULT: conventional English spellings now nativise to Naija phonetics (the core creole-TTS behaviour), substrate
loans still read phonemically, gold 100%, suite 380/380. The `nativise` map inherits the GenAm-source merges
(LOT/PALM, TRAP/BATH) and the lossy schwa (people→pipal not pipul) — a documented ceiling, closable only with a
diaphonemic source. STATUS stays 🟡 (no referee; tone still unmarked/underivable).
