# Italian (it) native bring-up

Italian is a shallow, near-phonemic Latin orthography — the g2p is rule-based (like es/id/tl). The only
genuinely non-derivable axes are the **stressed mid-vowel openness** (⟨e⟩=/e/~/ɛ/, ⟨o⟩=/o/~/ɔ/), **intervocalic
s-voicing** (casa /s/ vs rosa /z/), and **⟨z⟩ voicing** (/t͡s/ vs /d͡z/) — all lexical, none recoverable from
spelling. These are folded against the referee (as es/id fold their mid/lax axes). Everything else is a rule:
c/g softening before e/i, ⟨ci⟩/⟨gi⟩+V silent-i, ⟨sc⟩→ʃ, ⟨gl⟩i→ʎ, ⟨gn⟩→ɲ, ⟨ch⟩/⟨gh⟩→k/ɡ, ⟨qu⟩→kw,
gemination (doubled consonants — the referee's own convention), i/u glides, penultimate/accent stress.

Referee: **wikipron ita_latn broad** (89,608 rows, human). Gemination is written as DOUBLED consonants (gatto→
`ɡ a t t o`), NOT ː — so we emit doubled consonants too (a real Italian contrast the shared backbone would strip
if we used ː). No stress marks in the referee.

## Run 1 — 2026-07-15
Initial authored g2p + jsonc + referee wired. **Raw 0.0%, folded 79.4%.** Residual was dominated by TWO
self-inflicted bugs, not lexical noise:
- The non-silent soft-c/g branch consumed the triggering vowel (risorge→`risordʒ`, geocentrica→`dʒotʃntrika`) —
  it should consume only the consonant, leaving the e/i as a pronounced nucleus.
- The ⟨ci⟩/⟨gi⟩+V silent-i branch was off by one and ate the *following* vowel too (Bilancia→`bilantʃ`).
Fixed both; added i/u OFFglides (falling diphthongs: the referee writes aura→`awra`, mai→`maj`). → **82.7%.**

## Run 2 — 2026-07-15
Discovered my tie-bearing folds (`d͡z`→`t͡s`) were DEAD: the shared backbone strips tie bars (U+0361) *before*
the folds run, so affricates are tie-free (`tʃ dʒ ts dz`) by then. Rewrote the fold set tie-free and added:
- geminate-affricate degemination (our doubled `tʃtʃ` AND the referee's stop+affricate `ttʃ` → `tʃ`) — a notation
  fold; first attempt only matched the referee shape (missed our `tʃtʃ`), fixed with `(?:t|tʃ)tʃ`.
- glide/hiatus neutralisation (`j`→`i`, `w`→`u`) — the referee is INCONSISTENT (mai→`maj` yet voi→`voi`), and
  glide-vs-hiatus is largely lexical, so grade neither.
- the three lexical axes: mid-vowel openness (ɛ→e, ɔ→o), ⟨z⟩ voicing (dz→ts), ⟨s⟩ voicing (z→s).
→ **97.8% folded.**

## Result — ✅
97.8% folded vs the 89,608-row human wikipron primary. Residual is textbook referee-limited: diffuse foreign
proper nouns the referee reads with source-language phonology (David→`devid`, Wikipedia→`vikipedia`,
Vorarlberg→`forarlberg`), letter-name rows (Q→`ku`, J→`dʒei`), and one small genuine lexical tail — the stressed
⟨-ia⟩ hiatus (epidemiolog**ia**, bug**ia**) where spelling can't distinguish the stressed Greek-suffix hiatus from
a silent-i affricate. The only other unmarked-lexical class is **antepenultimate stress** (sdrucciole: zùcchero,
tàvolo) — Italian orthography does not mark it, so the penult default is the best rule-based choice and antepenult
words are a documented tail (a stress lexicon would close both, as for the mid-vowel openness). Committed anchor:
`test/italian.test.ts` (hand-verified common words, our convention). Numbers: compositional with the tens+unit
fusion (ventuno, ventotto, ventitré) and un-apocope (un milione).
