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
