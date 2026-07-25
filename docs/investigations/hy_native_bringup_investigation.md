# Armenian (hy) native bring-up

Indo-European (its own branch), Armenia (~5M), the Armenian alphabet. Goal: an espeak-independent canonical-IPA rule
g2p. There is no close relative in the repo (own script), but Armenian is very nearly one letter ↔ one phoneme, so a
left-to-right greedy scan + a few code rules fits. EASTERN Armenian (Yerevan standard) is the target.

## Run 1 — 2026-07-24 — referee, segmental, and the epenthesis lever

**Referee:** wikipron `hye_armn_e_broad` — 18,090 HUMAN Eastern-Armenian entries (also a Western set `hye_armn_w`, a
*different dialect* — not a 2nd referee). Read off the data:
- three-way stops/affricates: ⟨բ պ փ⟩=b/p/pʰ, ⟨գ կ ք⟩=ɡ/k/kʰ, ⟨դ տ թ⟩=d/t/tʰ, ⟨ձ ծ ց⟩=d͡z/t͡s/t͡sʰ, ⟨ջ ճ չ⟩=d͡ʒ/t͡ʃ/t͡ʃʰ.
- uvulars ⟨խ⟩→χ, ⟨ղ⟩→ʁ; tap ⟨ր⟩→ɾ vs trill ⟨ռ⟩→r; ⟨հ⟩→h, ⟨ շ ժ⟩→ʃ ʒ.
- vowels ⟨ա⟩=ɑ, ⟨ի⟩=i, ⟨է⟩=e, ⟨ը⟩=ə, ⟨օ⟩=o; the ⟨ու⟩ (ո+ւ) = **u** digraph.
- WORD-INITIAL glides: ⟨ե⟩→je (Երևان→jerevɑn), ⟨ո⟩→vo (որդի→voɾtʰi), ⟨և⟩→jev; bare e/o/ev elsewhere.

Authored the module (greedy scan over a flat letter→IPA table + the ու digraph + the word-initial glides + the ligature
և→ev). **First measurement: 73.6% folded.**

**Schwa epenthesis — the lever.** The residual was dominated by Eastern Armenian's [ə] insertion in consonant clusters
(Գնел→ɡənel, Զварт→zəvɑɾtʰ, Езр→jezəɾ). This is Vaux (1998) syllabification. Two dead ends before the win:
- **Blanket "word-initial/final CC → CəC": 73.6%→70.7% (−2.9pp).** Over-applies — Armenian allows valid clusters (s+stop
  onsets սպ→sp; falling-sonority codas ɾtʰ).
- Adding SONORITY: word-initial ə after C1 unless s+stop (գն→gən, but սպ→sp, սկս→skəs); word-final ə only for a
  RISING pair (obstruent+sonorant, եզр zɾ→zəɾ) while a falling coda stays (զварт ...ɑɾtʰ). **→ 80.6% folded (+7pp).**

**Dead ends this run (all net-negative on this referee — reverted):**
- **Medial epenthesis** (a full left-to-right syllabifier that also breaks medial clusters): individually correct
  (ادрбejanakan→ɑdəɾb, анхр→ɑnhəɾ) but **80.6%→72.6%** — the referee is very proper-noun/foreign-name heavy, and
  FOREIGN names keep their source clusters (ادрιана→ɑdɾjɑn, Трιποли→tɾipoli, no ə), which a rule can't distinguish from
  native. So only the (more reliably native) word-initial/final epenthesis is applied.
- **Degemination** (лл→l, Аполлон→ɑpolon): **−0.9pp** — the referee mostly KEEPS doubled consonants (no ː marks; ll
  written as two segments), so Аполлон is the exception, not the rule.
- **ի-before-vowel → j hiatus** (Адрιана→ɑdɾjɑn): **−0.9pp** — helps some foreign names but the referee keeps i.a hiatus
  in others; net-negative.

**Result: 80.6% folded, NO folds.** The number is REFEREE-BOUNDED, not a quality ceiling: the corpus is proper-noun/
foreign-name heavy (place names, surnames, transliterations) which carry (a) un-epenthesised source clusters and (b)
irregular voicing/aspiration (Абхазιа→ɑpʰχ…, final voiced-stop→aspirated in some names). A capitalisation/length split
shows real-word ≈ overall (~81%); the single-letter + all-caps-acronym "letter-name schwa" noise is only ~1% (151 rows).

**Verdict: 🔷 single-source, greedy g2p + Vaux epenthesis at 80.6%.** wikipron hye_armn_e is Wiktionary-derived; Western
Armenian is a separate dialect, not a corroborating referee. Floor 0.79. Wired: registry (`case "hy"`), eval PHON,
`langs/hy.jsonc` (no folds), `test/armenian.test.ts` (5 tests), catalogue row, maturity row. **Outstanding — the path
up:** native-vs-loan discrimination for medial epenthesis (a lexicon, the cs/sk precedent) + the name voicing tail.

## Run 2 — 2026-07-24 — code review fixes

3-agent review found two referee-confirmed correctness fixes:
- **Final schwa over-inserted before /m/** — the word-final rising-sonority rule fired for obstruent+m (կոմունիզմ→
  komunizəm), but the productive -իզմ/-թմ class keeps a bare coda (referee 75:1 bare). Excluded /m/ from the final
  sonorant test; obstruent+n and obstruent+liquid still take ə (եզр→jezəɾ kept).
- **Word-initial ⟨ո⟩→vo over-applied to the ов exceptions** — ов→vov but the referee has ov; ⟨ո⟩ before ⟨վ⟩=v is [o]
  (haplology, avoiding *vov: ov→ov, ovasis→ovɑsis). որдi→voɾdi is unaffected (next is ր, not վ).

**→ 81.1% folded** (+0.5pp). Goldens added (կոմունիզմ, ов). Full suite passes. Noted-but-not-changed (consistent with
the uk/be fleet, no number referee): 1000→"мek հазар" (vs bare "հազар"); and the Slavic/Western number composer is now
a 3rd copy (be/uk/hy) — a candidate for extraction to core/numbers.ts in a dedicated refactor.
