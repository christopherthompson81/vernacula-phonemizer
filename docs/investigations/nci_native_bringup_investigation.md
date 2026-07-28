# Classical Nahuatl (nci) native bring-up investigation

Target: **Classical Nahuatl** (nāhuatlahtōlli), Uto-Aztecan, the language of the Aztec Empire (16th-c.
Central Mexico), the traditional Spanish-based Latin orthography. Canonical IPA, espeak-independent. **The
fleet's FIRST UTO-AZTECAN family.** Reference: **Andrews, *Introduction to Classical Nahuatl*** (§2 Phonology).

## Run 1 — referee landscape (2026-07-28)

WELL-RESOURCED (a real quality signal — like Cherokee, unlike the recent referee-poor ones):
- **wikipron `nci_latn_broad`** (886 rows) — broad IPA, space-separated segments, clean inventory (t͡ɬ t͡s t͡ʃ kʷ
  ɬ ʃ, saltillo ʔ, vowel length ː). → **PRIMARY.**
- **kaikki Classical Nahuatl** (2544 IPA entries) — HUGE, with stress ˈ, syllable dots, raising, coda ɬ. →
  SECONDARY.
- Andrews grammar (§2.2–2.6) — the g2p phonology anchor.

Both referees confirm the mapping: ce→[seː] (⟨c⟩ before e→s), azcatl→[aːskat͡ɬ] (z→s, tl→t͡ɬ), huehxolotl→
[weʔʃoːloːt͡ɬ] (hu→w, saltillo h→ʔ, x→ʃ), Ahuitzotl→[aːwit͡soːt͡ɬ] (tz→t͡s).

## Run 2 — the phonology (Andrews §2)

★ **8 VOWELS** = /a e i o/ × length (aː eː iː oː). LENGTH is marked by a MACRON (ā ē ī ō) but "in traditional
texts vowel length is indicated in only a few exceptional instances" (§2.2) — wikipron uses the traditional
(macron-less) spelling, so length is UNWRITTEN → we emit SHORT vowels; the eval backbone strips the referee's
ː (the recurring unwritten-length pattern). No diphthongs (§2.6 — vowel sequences are separate syllables).
★ **15 CONSONANTS**: /p t k kʷ ʔ/, /t͡s t͡ɬ t͡ʃ/, /s ʃ/, /m n l/, /w j/. NO voiced obstruents (loans aside).
★★ **THE SPANISH-ORTHOGRAPHY CONTEXT RULES (§2.4)** — the crux:
- **/k/**: ⟨c⟩ before a/o and syllable-final (ca co, ac oc ec ic); ⟨qu⟩ before e/i (que qui).
- **/s/**: ⟨z⟩ before a/o and syllable-final (za zo, az oz…); ⟨c⟩ before e/i (ce ci). (⟨ç⟩→s too.)
- **/kʷ/**: ⟨cu⟩ before a vowel (cua cue cui); ⟨uc⟩ syllable-final (auc euc iuc ouc).
- **/w/**: ⟨hu⟩ before a vowel (hua hue hui); ⟨uh⟩ syllable-final (auh euh iuh ouh). [voiceless coda [w̥]~[ɸ].]
- **saltillo /ʔ/** = ⟨h⟩ (NOT in hu/uh); ⟨x⟩→ʃ; ⟨tz⟩→t͡s, ⟨tl⟩→t͡ɬ, ⟨ch⟩→t͡ʃ.
- ★ **THE ⟨chu⟩ TRAP (§2.3.4 note)**: ⟨ch⟩ before ⟨u⟩+vowel is NOT the affricate — it is ⟨c⟩[k]-coda +
  ⟨hu⟩[w] (cachuah = /kakwa/). So ⟨chu⟩+V → [k]+[w], not [t͡ʃ].
- ★ **⟨u⟩ is NEVER a vowel** in native words (§2.6) — only part of cu/uc/hu/uh. (Bare ⟨u⟩ = a loan vowel.)
★ **PROSODY**: stress is regular PENULTIMATE (§2, unmarked in wikipron → folded).
★ **Allophony** (disclosed/folded): syllable-final /l/→[ɬ] (voiceless; kaikki marks it, wikipron keeps [l] —
we emit [l], matching the primary), /n/→[ŋ] before /k/, vowel raising o→u/e→i (optional), coda /w/→[w̥ ɸ].

## Run 3 — architecture + measurement

Engine (nci.ts): a POSITION-AWARE scan (the context rules can't be a flat digraph table — c/cu/uc/hu/uh/chu
all need lookahead/lookbehind). Referee: wikipron primary + kaikki secondary.

First pass: **wikipron 93.1% folded / 98.8% symbol; kaikki 92.1% / 98.3%** — two HUMAN referees corroborating
tightly (a genuine quality signal). Residuals are ALL 1× singletons — no systematic bug: Spanish proper-noun
loans (California, Juan→ʃiwaːn, Pátzcuaro), unwritten lexical saltillo (Tezcatlipoca→teskatliʔpoka) + unwritten
intervocalic /w/ (kokoa→kokowa) + glide (chia~chiya), and optional vowel raising (e/i, o/u — §2.2). One real
fix (APPLIED): **word-initial ⟨h⟩→[ʔ] was wrong** — the saltillo occurs only AFTER a short vowel, never
word-initially (§2.3.3), so "he"→[e], not [ʔe]; gated ⟨h⟩→[ʔ] to a post-vowel position (yehhuatl→jeʔwatl still
correct). Also dropped an over-eager ɾ→l fold (loans keep [ɾ], which we emit).

The engine handles every tricky context rule (verified): the ⟨chu⟩ trap (cachuah→kakwaʔ), the ⟨uc⟩/⟨uh⟩ codas
(teuctli→tekʷt͡ɬi, cuauhtli→kʷawt͡ɬi), ⟨cu⟩/⟨hu⟩ onsets, ⟨c⟩→[s]/[k] (cihuatl→siwat͡ɬ), ⟨qu⟩→[k], the saltillo,
the affricates ⟨tz tl ch⟩. Goldens in test/nahuatl.test.ts.

**Final: 🔷 well-resourced, two human referees corroborating at ~93% folded / ~98.8% symbol. The fleet's FIRST
UTO-AZTECAN language, authored from Andrews.** The segmental mapping is grammar-grounded + doubly-corroborated;
the residual is proper-noun loans + unwritten lexical saltillo/length + optional raising. Deferred: penultimate
stress (unmarked in the broad referee), the unwritten vowel length + lexical saltillo (need a lexicon), the
syllable-final l→ɬ / n→ŋ / coda-w allophony (folded), numbers.

## Run 4 — two-agent review (2026-07-28)

**Code/wiring reviewer — CORRECT, no bugs.** Traced the rule ordering char-by-char (cu/hu+V and the chu-trap
all fire before the bare ch/c/h rules, pairwise-disjoint on c1 — no shadowing); confirmed the undefined-handling
at word boundaries (isVowel/isFront(undefined)=false, so word-final uc/uh→kʷ/w, word-initial h→dropped, and
the saltillo reads the previous INPUT char); TOKEN coverage complete; folds valid, ɬ-note accurate; wiring +
goldens consistent. Flagged two harmless latents (APPLIED): a bare loan ⟨q⟩ not in ⟨qu⟩ silently dropped → added
q→[k] fallback; a dead ⟨z⟩ in the gemination fold class → removed.

**Phonology reviewer (with grammar access) — SOUND, no gross errors, no correctness fix required.** Verified
every §2.4 context rule and the three traps against Andrews with §-citations: the ⟨chu⟩=/kw/ trap (§2.3.4,
"cachuah represents /kakwa/"), the saltillo-after-a-vowel gate (§2.3.3, "occurs only after short vowels, never
word-initially"), and the ⟨uc⟩/⟨uh⟩-coda "not-a-vowel"=syllable-final logic (§2.4 + §2.5: syllable-initial /kʷ
w/ is ALWAYS respelled ⟨cu hu⟩ at a boundary, so ⟨uc uh⟩ is guaranteed syllable-final in native words — the
test cannot misfire). Confirmed the short-vowel choice (§2.2), and that no fold neutralises a real contrast.
Two touch-ups (APPLIED): (1) reworded the ɬ-fold note — Andrews' coda /l/ is a voiceless lateral APPROXIMANT
[l̥] (kaikki writes the fricative [ɬ]); (2) the colonial ⟨qua/quo⟩=/kʷ/ spellings (Andrews Appendix F) were
unhandled (all ⟨qu⟩→[k]) → added a guarded ⟨qu⟩+a/o→[kʷ] rule (quauhtli→kʷawt͡ɬi; standardized orthography never
writes ⟨qua/quo⟩, so it only fires on colonial input — no downside, no score change since the referee has zero
such forms). The one acknowledged residual class (Spanish loans with a genuine /u/ vowel, e.g. Juan→ʃiwaːn) is
inherent to the "⟨u⟩ is never a vowel" design and disclosed.

Both reviews signed off; the segmental core needed no correctness fix. Full suite green, DB implemented=191.
