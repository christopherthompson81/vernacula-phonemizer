# Ancient Greek (grc) native bring-up investigation

Target: **Ancient Greek** (Ἑλληνική) — Hellenic, the POLYTONIC Greek script, targeting the **reconstructed
5th-century BCE Classical Attic** pronunciation (Allen, *Vox Graeca*). Canonical IPA, espeak-independent. The
fleet has Modern Greek (el, Greek-script) and Latin (la, the Allen-reconstruction precedent) — grc is the
classical Hellenic counterpart to the Classical-Latin bring-up.

## Run 1 — referee landscape (2026-07-28): WELL-RESOURCED but MULTI-PERIOD

- **wikipron grc_grek_broad**: **198,102 lines** — but MULTI-PERIOD: the Wiktionary {{grc-IPA}} module emits up
  to 5 transcriptions per headword, oldest-first — **5th BCE Attic**, 1st AD Egyptian Koine, 4th AD Koine, 10th
  AD Byzantine, 15th AD Constantinopolitan (Αἰάντεσι → a i̯ á n t e s i / e a n d e s i / e a n t e s i /
  ɛ a n t e s i). The FIRST per headword = the 5th BCE Attic reconstruction → our target. Filter to first-row.
- **kaikki Ancient Greek**: exists (same {{grc-IPA}} source).

## Run 2 — the phonology (5th BCE Attic, read off the referee + Allen Vox Graeca)

- **Vowels**: α→[a]/[aː], ε→[e], η→[ɛː], ι→[i]/[iː], ο→[o], ω→[ɔː], **υ→[y]/[yː]** (front rounded); the
  MACRON/BREVE mark length on α ι υ (ᾱ→aː). **Diphthongs**: αι→[ai̯], ει→[eː] (or [ei̯]), οι→[oi̯], υι→[yi̯],
  αυ→[au̯], ευ→[eu̯], ου→[uː], ηυ→[ɛːu̯]; iota subscript ῃ ῳ ᾳ → the long vowel (+offglide).
- **Consonants**: β γ δ→[b ɡ d], **aspirates θ φ χ→[tʰ pʰ kʰ]**, κ π τ→[k p t], **ζ→[zd]**, ξ→[ks], ψ→[ps],
  λ μ ν ρ σ→[l m n r s]; **γ before a velar (γ κ χ ξ) → [ŋ]** (ἄγγελος→aŋɡelos).
- **ROUGH BREATHING** (spiritus asper ῾) → prefix [h] (on a word-initial vowel or ῥ); SMOOTH breathing → nothing.
  Word-initial ῥ → [r̥]/[r] (folded).
- **PITCH ACCENT** (acute/grave/circumflex) — the referee's Attic form marks it on the vowel (á) → a
  suprasegmental; folded (strip the combining accent both sides), the Latin-stress treatment.

## Run 3 — build + tune (2026-07-28)

★ Built the **Attic referee** by filtering the 198k-line multi-period dump to the row carrying a PITCH ACCENT
(the reliable 5th-BCE Attic identifier — the later Koine/Byzantine rows drop it; the Attic form is NOT always
first): **33,709 headwords**. Self-contained NFD-based polytonic scan (ancientgreek.ts). Fold: the pitch accent
(a suprasegmental — the Latin-stress treatment).
- **v1** (vowels + aspirates + diphthongs + rough-breathing + γ-nasal): 97.3% folded / 99.5% symbol.
- **v2** (★ σ→[z] before a voiced consonant β/γ/δ/μ/ν/λ/ρ — Λέσβια→lézbia, Σμύρνα→zmýrna; υι→[yː]): 98.9% / 99.7%.
- **v3** (★ γ→[ŋ] before ⟨μ⟩ — the agma, δεδεγμένος→dedeŋménos; ★ aspirate assimilation πφ/τθ/κχ→[pʰpʰ tʰtʰ kʰkʰ]
  — Βάκχε→bákʰkʰe): **99.4% folded / 99.7% symbol**.

**Final: 99.4% folded / 99.7% symbol** on 33,709 Attic headwords — near-CEILING, among the cleanest bring-ups
in the fleet (the Latin/Ancient-reconstruction situation, even higher because the Attic referee is internally
consistent). Verified EXACT (incl. the pitch accent placement) on common words: λόγος→lóɡos, θεός→tʰeós,
ἄνθρωπος→ántʰrɔːpos, ἵππος→híppos (rough breathing), αὐτός→au̯tós, ἄγγελος→áŋɡelos. The ~0.6% residual is (a) a
handful of wikipron DATA ERRORS (γενήθητε → the referee attaches γίγνεται's IPA), and (b) the archaic digamma
⟨ϝ⟩ (we emit [w], the referee drops it — Attic had lost it). ★ HONESTY: the referee is MODULE-GENERATED (the
Wiktionary {{grc-IPA}} converter from the standard reconstruction) → **🔷 reference-parity-adjacent** (like
cdo/bo — "does our independent converter reproduce Wiktionary's?"), BUT the underlying reconstruction is the
scholarly Allen *Vox Graeca* standard, and our rules were authored from Allen + the referee samples (not lifted
from the module). Fold: the pitch accent only. Deferred: the Koine/Byzantine/other reading traditions (a
`period` param, like Latin's Ecclesiastical), numbers (the alphabetic numeral system), vowel-length on
unmarked α ι υ (macron often not written).

## Run 4 — 2-agent review (2026-07-28)

**Phonology reviewer — strong sign-off** (vs Allen *Vox Graeca*). CONFIRMED: the vowels (η=[ɛː], ω=[ɔː], υ=[y]);
the aspirates θφχ→[tʰ pʰ kʰ] (stops, not Koine fricatives); **ζ→[zd]** (Allen's Attic value, referee-corroborated
Βυζάντιον→byzdántion); the γ-nasal incl. **γμ→[ŋm]** (agma) AND the correct **γν→[ɡn]** non-nasalization; the
σ-voicing trigger set {β γ δ μ ν λ ρ} incl. sonorants (προσλάβοι→prozláboi̯); aspirate assimilation; breathing
placement on initial diphthongs (αὑτός→hau̯tós); iota subscript; the diphthongs (ει→[eː] and ου→[uː] confirmed
for late-5th Attic). ★ ONE FIX APPLIED: **word-initial ῥ and ⟨ρρ⟩ → the VOICELESS [r̥]** (ῥήτωρ→r̥ɛː́tɔːr,
Πύρρα→pýr̥r̥a — was plain [r]); the referee has 463 [r̥] rows. Golden added.

**Code/wiring reviewer — CLEAN, no bugs.** Verified all 9 combining-mark codepoints (no paste errors), the
rough-breathing logic (hPrefix assigned not concatenated → no double-h; word-initial-only in orthography), the
diaeresis-breaks-diphthong, the accent/ph separation (aspirate-assimilation compares pure ph). ★ REFEREE
INTEGRITY confirmed: 33,709 rows, 0 spaces in IPA, 10,242 with aspirates, **0 Koine fricatives leaked** — cleanly
the 5th-BCE Attic row. ★ TWO HONESTY NITS APPLIED: (1) the 3 declared grc.jsonc accent folds were **no-ops** —
the shared BACKBONE already strips the whole U+0300–U+036F block before per-language folds run → REMOVED them
(folds:[]) and reworded (the accent + the r̥ voiceless-ring are backbone-stripped fleet-wide, not per-language;
score unchanged 99.4%). (2) the un-emitted voiceless initial-ῥ — resolved by the phonology fix above (we now
EMIT [r̥], canonical, backbone-folded for the referee like the digamma).

**Final: 99.4% folded / 99.7% symbol on 33,709 Attic headwords. 🔷 reference-parity-adjacent (module-generated
referee) but the Allen-standard reconstruction, authored independently. Floor 0.95.** Full suite green, typecheck
clean. Deferred: the Koine/Byzantine reading traditions (a period param), alphabetic numerals, unmarked-macron
length on α ι υ, the archaic digamma ϝ (emitted [w], the referee drops it).

## Run 5 — cardinal numbers (2026-07-29)

**Question.** `phonemize("<int>", "grc")` leaked the digit string. Do fully-accented POLYTONIC numerals survive
the g2p, and what magnitude structure should a Greek compositor use above 10,000?

**Command.** `npx tsx <scratch>/numwords.mts grc` (48 candidate numerals standalone), then
`npx tsx <scratch>/probe.mts grc`.

**Raw findings.**
- All 48 numerals phonemize non-empty and the diacritics do real work: `εἷς`→[heː́s] — the rough breathing sits
  on the SECOND element of the ⟨ει⟩ diphthong and the engine's "rough on the 2nd vowel of an initial diphthong"
  branch catches it, so the [h] is not lost. A bare unaccented ⟨εις⟩ would have. `μυριάς`→[myriás],
  `χίλιοι`→[kʰílioi̯], `καὶ`→[kaí̯] (grave and acute are the same emitted mark, so the pre-word grave costs
  nothing phonetically). Fully-accented polytonic spellings are therefore mandatory in the table.
- **★ Compound order (the judgment call).** Smyth §347 lists BOTH `εἷς καὶ εἴκοσι` (units-first) and
  `εἴκοσι καὶ εἷς` (tens-first) for 21–99. Chose TENS-FIRST/descending and applied it uniformly at every
  magnitude: one rule then covers 25, 555 and 12,345 alike, and the spoken order tracks the written digit
  order — the property that matters when reading figures aloud. Units-first would invert only the last two
  elements and read against the digits. EXCEPTION kept: 13/14 use Smyth's own units-first phrases
  `τρεῖς καὶ δέκα` / `τέτταρες καὶ δέκα`, which are the attested forms there (15–19 are fused -καίδεκα).
- **★ Magnitude structure: MYRIAD (10⁴) grouping, not a thousands ladder.** Greek's top simple magnitude is
  μύριοι/μυριάς = 10,000, and the nesting is genitive (Archimedes' μυριὰς μυριάδων = 10⁸). So the compositor
  decomposes in base 10,000, composes each 4-digit group with the <10,000 machinery (which uses the
  multiplicative χίλιοι series: δισχίλιοι, τετρακισχίλιοι…), and tags each group `μυριάδες` + one `μυριάδων`
  per extra level. Consequences: 10⁶ = `ἑκατόν μυριάδες`, 10⁹ = `δέκα μυριάδες μυριάδων`. A Western
  million/billion ladder was rejected as an anachronism for a 5th-c. Attic engine.
- 0 → `οὐδέν` (no Classical zero cardinal); flagged in the module header, not naturalised silently.
- Citation form for the inflecting 1–4 and the -κόσιοι/-χίλιοι adjectives: masculine nominative
  (εἷς, δύο, τρεῖς, τέτταρες). ATTIC `τέτταρες`, not Ionic/koine `τέσσαρες`, matching the engine's target.

**Result.** Probe CLEAN for the whole target set. Implementation: `src/languages/ancientgreek/numbers.ts`
(Pattern B — grc has no `.jsonc`), cited to Smyth §§347–354.
