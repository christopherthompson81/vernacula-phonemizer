# Belarusian (be) native bring-up

East Slavic, Belarus (~5M L1), Cyrillic. Sibling of Ukrainian (uk, already a rule engine in the repo). Goal: an
espeak-independent canonical-IPA rule g2p. Belarusian orthography is **phonetic** — it *writes* akanne (unstressed
о→а, е→я: вада not вода), so unlike Russian there is no stress-conditioned vowel reduction to model. The natural shape
is the Ukrainian iotated-vowel/palatalisation engine with Belarusian data + a voicing pass.

## Run 1 — 2026-07-24 — referee + iterative segmental build

**Referee:** wikipron `bel_cyrl_narrow` — 7,259 HUMAN entries, space-segmented, narrow. (broad is 404.) Read off the
data: ⟨а⟩=a, ⟨о⟩=o (only stressed — akanne spelled), ⟨у⟩=u, ⟨ы⟩=ɨ, ⟨э⟩=ɛ; ⟨г⟩=ɣ; retroflex ⟨ж ш ч⟩=ʐ ʂ t͡ʂ; the
unique ⟨ў⟩=[u̯] after a vowel / [w] elsewhere; **⟨і⟩ is iotated** — word-initial → [ji] (Іван→jivan), unlike Ukrainian's
plain [i]; dark ⟨л⟩=ɫ; final devoicing (горад→ɣorat, хлеб→xlʲep).

Mirrored the `uk` module: iotated vowels (я е ё ю і → jV initial / Cʲ+V after a consonant), palatalisation before ь/і/
iotated, dark-l. Belarusian-specific: **⟨г⟩→ɣ** (not ɦ), retroflex hushers, **⟨ў⟩** and the **⟨дз дж⟩** affricate
digraphs handled in code, ⟨в⟩→v (no allophony, simpler than uk), and — the piece Ukrainian lacks — **regressive voicing
assimilation + word-final devoicing** (a right-to-left pass over the phoneme list; ⟨в⟩ is a target but not a trigger).

**First measurement: 90.9% folded.** Strong — the segmental skeleton + iotation + voicing were right first time.

**Regressive palatalisation — the iterative lever (the residual was almost all this).** A coronal directly before a
palatalised consonant softens (везці→vʲesʲt͡sʲi, Боснія→bosʲnʲija). But the referee is *inconsistent* (my `belarusian_convergence`
note from the espeak-portable repo flagged exactly this "bidirectional palatalisation assimilation, referee inconsistent").
Tuned it down data-driven, each step re-measured:
- Naïve (any palatalised C triggers, т д з с ц н targets): **90.9%** (net-zero — fixed везці but broke the -скі ending
  Заборскі→zaborsʲkʲi, since a palatalised VELAR kʲ was wrongly triggering).
- Coronal-only trigger (drop velars/labials), drop т д as targets: **92.8%** (-скі fixed).
- **Sibilant/affricate targets only** (с з ц дз, drop н too), trigger = palatalised coronal OR labial (not velar):
  **94.4%** — because н is an unreliable target (Пенсільванія→pʲensʲilʲvanʲija keeps hard н) while с/з/ц/дз soften
  reliably before both coronals (Боснія) and labials (Зміцер→zʲmʲit͡sʲer, Мацвей→mat͡sʲvʲej).
- **+ н→[nʲ] before a palatalised AFFRICATE only** (the -нцін/-нць cluster: Аргенціна→arɣʲenʲt͡sʲina, Валянцін,
  Канстанцін — 5 words, reliable) **+ affricate gemination** (цц→t͡sʲː, чч→t͡ʂː: Аўдоцця, Нямеччына): **96.6%**.
- **+ дл gemination** (ɫ→lʲ before a soft l: Наталля→natalʲːa): 96.6% (+4 words).

**Result: 96.6% folded, NO folds needed** (a clean narrow referee). Residual (all ≤2× buckets):
- **loanword ⟨г⟩→[ɡ]** — foreign place/proper names keep [ɡ] not [ɣ] (Гана/Ghana, Рыга/Riga, Сінгапур, Уганда — 46
  rows carry ɡ). Genuinely lexical (Belarusian ⟨ґ⟩ exists for [ɡ] but these are spelled with ⟨г⟩). A lexicon tail.
- rare cluster assimilations (шс→s in чэшскі, зш→ʂ in ЗША, з→ʐ before d͡ʐ in аб'язджае) — 1–2× each.

**Verdict: 🔷 single-source, rule g2p at 96.6%.** wikipron bel is Wiktionary-derived (kaikki be / epitran bel would be
correlated / rule-based). Floor 0.95. Wired: registry (`case "be"`), eval PHON, `langs/be.jsonc` (no folds),
`test/belarusian.test.ts` (6 tests), catalogue row, maturity row. NB: the `belarusian_convergence` memory note is the
OTHER repo (portable-espeak, shim-parity) — this is a fresh vernacula bring-up; the phonology hints (і→ji,
geminate→length, referee-inconsistent assimilation) transferred, the approach did not.

## Run 2 — 2026-07-24 — code review fixes

3-agent review found two clean correctness fixes (both referee-confirmed) + a cleanup:
- **Sibilants weren't softening before a soft л** — PALC omitted `l`, so абразлівы→abrazlʲivɨ where the referee has
  abrazʲlʲivɨ (44 softened / 0 hard — 100% consistent). Added `l` to the trigger class.
- **⟨в⟩ was wrongly devoicing to [f]** — нерв→nʲerf but the referee keeps [v] (2/2): Belarusian /v/ vocalises to
  [u̯]/⟨ў⟩, it never devoices like Russian. Removed ⟨в ф⟩ from the voicing maps (both inert now).
- Hoisted the two per-word `new RegExp(...)` (the regressive-palatalisation patterns) to module constants — they were
  recompiling on every word.
- **→ 97.2% folded** (+0.6pp). Goldens added (абразлівы, нерв). Full suite 1009/1009.

Not changed (out of scope / acknowledged): the shared Slavic number compositor renders 1000→"адзін тысяча" (masculine)
where Belarusian wants feminine "адна тысяча" — inherited from the uk path, fleet-wide, numbers aren't referee-scored.
