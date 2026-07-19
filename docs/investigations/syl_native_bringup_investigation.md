# Sylheti (syl) native bring-up

Sylheti / ꠍꠤꠟꠐꠤ ꠘꠣꠉꠞꠤ (syl) — Eastern Indo-Aryan (Bengali-Assamese group); ~11M speakers (Sylhet region of
Bangladesh + Barak Valley, Assam, + a large diaspora). This bring-up was flagged as a **scope risk** — the
Chittagonian (ctg) case, where a "largely spoken" language with no adopted written standard was built and removed.

## Scope gate — PASSES (the bho/awa pattern, not ctg)

The decisive difference from ctg (which had *three competing scripts and no adopted standard*): Sylheti has a
**dedicated historical script — SYLOTI NAGRI** — with a real **puthi literature**, a Unicode block (U+A800), and,
crucially, **Wiktionary documents Sylheti *in Syloti Nagri***: wikipron `syl_sylo_broad` (397 human IPA entries)
and kaikki Sylheti (492 IPA entries, 925 Syloti-Nagri headwords). So phonemising Syloti Nagri **follows** an
existing community practice rather than inventing one — exactly the reasoning that admits bho/awa/hne (real
Devanagari traditions). We target Syloti Nagri specifically (NOT Bengali-script Sylheti, which would be
prescriptive). **The bring-up works** — contrary to the "might not work" flag.

## Run 1 — the g2p, 78.1% folded

Read by the **generic abugida engine** (core/abugida.ts), inherent vowel **/ɔ/**, with Bengali-style
inherent-vowel deletion (final drop after a single coda; medial Ohala deletion). The consonant values were
**DERIVED from wikipron** (word-initial alignment) — because Sylheti's defining feature is **SPIRANTISATION**, its
split from Bengali:
- ⟨ꠇ ꠈ⟩ (ko kho) → **[x]** (Bengali /k kʰ/ → velar fricative)
- ⟨ꠌ ꠍ⟩ (co cho) → **[s]** (Bengali affricates /t͡ʃ t͡ʃʰ/)
- ⟨ꠎ ꠏ⟩ (jo jho) → **[z]**; ⟨ꠙ⟩→**[ɸ]**, ⟨ꠚ⟩→**[f]**; ⟨ꠡ⟩→**[ʃ]**, ⟨ꠢ⟩→**[ɦ]**. Aspiration LOST on the voiced
  stops (ꠊ→ɡ, ꠗ→d̪, ꠜ→b).

Calibration from the referee: the **DVISVARA ꠂ → [i]** (diphthong second vowel, ꠌꠂ→sɔi), the **ANUSVARA ꠋ → [ŋ]**
(a plain velar nasal — aŋɡuɾ, aŋʈi — NOT homorganic/vowel-nasalising, so handled as a consonant not the engine's
anusvara), and the independent **ꠅ (O) → [ɔ]**.

**TONE:** Sylheti developed a **HIGH/LOW tone** (from lost breathy voice) — the referee marks HIGH with an acute
accent — but it is **NOT in the orthography**, so it is DEFERRED (folded), the standard treatment for unwritten
tone.

**Result.** `npx tsx tools/referee-eval/eval.ts syl` → **78.1% folded (311/398)**, raw 52.5%. Folds: tone (acute),
non-syllabic mark, tie-bar, geminate CC~Cː, r~ɾ, a~ɑ, dental bridge (n̪), u~ʊ. Spot-checks: ꠀꠇꠟ→axɔl, ꠀꠇꠔꠣ→axt̪a,
ꠉꠞꠝ→ɡɔɾɔm, ꠀꠋꠉꠥꠞ→aŋɡuɾ, ꠝꠣꠛꠥꠖ→mabud̪.

**The ~22% residual is genuinely hard / variable**, not a systematic engine gap:
- **Context-sensitive spirantisation**: a GEMINATE ⟨ꠌꠍ⟩ keeps the affricate [t͡ʃː] (ꠀꠁꠌ꠆ꠍꠣ→aitʃa), unlike the
  singleton ⟨ꠌ⟩→[s]. Our blanket ꠌ→s over-spirantises the ~8 geminate cases.
- **Hiatus glide**: i+V → [ijV] (ꠁꠔꠤꠀꠍ→itijas) — but the referee is itself variable (itijas ~ itiaʃ), so not folded.
- **Lexical ⟨ꠇ⟩ variation**: ꠇ is [x] modally (21) but [k] in a lexical minority (13) — ꠃꠇꠂꠘ→ukɔin, not uxɔin.

## Verdict: 🔷 single-source

Sylheti is a legitimate, referee-backed bring-up (scope passes on the real Syloti Nagri tradition; a human wikipron
referee at 78.1% with the core spirantisation working). One human referee *family* (wikipron + kaikki, both
Syloti-Nagri Wiktionary) → 🔷. Deferred: **TONE** (H/L, unwritten), the context-sensitive geminate-affricate, and
**numbers** (Syloti Nagri has no digits — Bengali/Arabic numerals are used). Gold: `test/sylheti.test.ts`. Floor
`syl: 0.76`.
