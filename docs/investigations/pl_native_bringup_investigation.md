# Polish (pl) bring-up investigation

West Slavic, Latin script with diacritics. NOT a shallow mapping — real rule systems (palatalization, nasal
vowels, voicing assimilation). Modelled on the Czech engine (scan → rules → voicing). Two strong referees:
wikipron pol_latn broad (HUMAN, 129,736) PRIMARY + epitran pol-Latn on the same wordlist SECONDARY.

## Run 1 — 2026-07-17 — rule g2p vs two referees

Engine (g2p.ts): scan (digraphs ch/cz/sz/rz/dz/dź/dż + the ⟨i⟩ palatalizer) → nasal-vowel realization → voicing.

The **⟨i⟩ palatalizer** has three classes: coronal soft {c,s,z,n}(+dzi) + i → the SOFT series t͡ɕ/ɕ/ʑ/ɲ/d͡ʑ (i
silent before a vowel — siano→ɕanɔ; the [i] vowel before a cons/end — zima→ʑima); everything else + i + VOWEL → a
[j] glide (pies→pjɛs, kiedy→kjɛdɨ). Velars are NOT specially palatalized — the wikipron convention writes [kj]/[ɡi],
not epitran's [kʲ]/[ɡʲ] (removed that branch after the referee showed 89→ it).

**Nasal vowels ą/ę** → oral vowel + a homorganic nasal element by the FOLLOWING consonant's place: m (labial), n
(dental/alveolar/retroflex, incl. fricatives — wąs→vɔns, mąż→mɔnʂ), ŋ (velar, incl. x — wąchać→vɔŋx), ɲ (palatal
affricate), a [w̃] nasal glide before a palatal fricative (gęś→ɡɛw̃ɕ), pure vowel-nasalization before a sonorant;
**ą word-final → [ɔw̃]**, **ę word-final → [ɛ]** (denasalized).

**Voicing**: regressive assimilation + word-final devoicing; v (from w) and ⟨rz⟩ [ʐ] are TARGETS but do NOT trigger
(they devoice progressively after a voiceless obstruent — świat→ɕfjat, przez→pʂɛs) — the Czech ř/v pattern. ⟨rz⟩
carries a flag distinguishing it from ⟨ż⟩, which DOES trigger regressive voicing (także→taɡʐɛ).

**Progression: 56.3% → 89.4%** (velar-glide fix + ⟨y⟩ ɘ~ɨ fold) → **98.2% wikipron** (ą-final ɔw̃, homorganic nasal
before fricatives, n→ŋ before velars, au→aw, ŋ~n fold). epitran stays 84.5% — its ą-final [ɔ̃] and simpler
nasal-fricative convention diverge from wikipron's standard; wikipron (human) is the authority. Residual ≈ 1.8% is
loanword/proper-noun noise (dubbing, bravissimo, altocumulus, degeminated banner). **✅.** Numbers deferred.

## Run 2 — 2026-07-28 18:00 — cardinal number compositor (numbers were deferred)

Question: `phonemize("<int>", "pl")` spoke nothing (the number branch emitted `""` unless a `foreign`
phonemizer was injected, and none ever was). Probe: `npx tsx probe.mts pl` → 110/110 EMPTY.

**Pattern B** (`src/languages/polish/numbers.ts` + a `numbers` block in `polish.jsonc`). Pattern A was
rejected: the shared `westernNumberWords` stores ONE string per magnitude, and a Slavic magnitude noun agrees
with its count.

Source: pl.wikipedia per-number articles (`1 (liczba)` … `1000 (liczba)`) for every unit / teen / round ten /
round hundred; the standard paradigm for tysiąc·tysiące·tysięcy, milion·miliony·milionów, miliard·miliardy·miliardów.

**Finding that changed the implementation:** Polish does NOT follow the shared `slavicCountForm` (ru/cs) on
compounds ending in "jeden". Corpus check on pl.wikipedia: `"dwadzieścia jeden tysięcy"` 3 hits,
`"dwadzieścia jeden tysiąc"` **0 hits**; `"sto jeden tysięcy"` 1 hit. So the singular is reserved for an EXACT
count of 1 and the compound takes the genitive plural — a Polish-specific `agree()` rather than the shared
selector (which would have emitted the Russian-shaped *dwadzieścia jeden tysiąc). Compare ru двадцать одна тысяча.

Judgment calls: 1000 / 10^6 / 10^9 are read as the bare tysiąc / milion / miliard (no *jeden), parallel to the
bare hundred "sto". "jeden/dwa" are the MASCULINE citation forms (a bare numeral has no counted noun to agree
with) — same deferral as the ru/lv engines. n ≥ 10^12 falls back to digit-by-digit.

Result: probe **CLEAN** for 0–100, 101, 111, 555, 999, 1000, 1001, 12345, 10^6, 10^9. Tests in test/polish.test.ts.
Also removed the now-dead `ForeignPhonemizer` seam (it existed only to render digits and was never wired).
