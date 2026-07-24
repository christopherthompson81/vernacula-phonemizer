# Mongolian (Khalkha, mn) bring-up — investigation

Bring up Standard Khalkha Mongolian (mn), Cyrillic script, espeak-independent canonical IPA. A FLEURS-102 benchmark
language, Mongolic family, ~6M speakers. Cyrillic Mongolian is a **DEEP orthography** — the written vowels do NOT
map cleanly to pronunciation (non-initial short-vowel reduction/deletion, vowel harmony, "hidden" epenthetic vowels,
palatalization via ь/ъ) — so a pure greedy g2p has a real ceiling; the question is how high.

## Run 1 — 2026-07-24 — referee availability + phonology scoping

Goal: find independent referees and scope the Cyrillic Khalkha phonology before writing any g2p.

## Run 2 — 2026-07-24 — first engine + iterative folds (34.5% → 49.2%)

Built the module: `mongolian.jsonc` (letter tables), `g2p.ts` (greedy scan, local back-harmony for г→ɢ/х→χ, iotated
е/ё/я/ю, palatalizing ь), `mongolian.ts` (deep-orthography reduction + final devoicing + tokenizer). Referee =
en.wiktionary Mongolian (1460 → **1342 after dropping 118 traditional-Mongolian-script entries**, out of scope for a
Cyrillic engine). Iteration on the folded backbone:
- 34.5% first pass (all vowels written, б→p/д→t, л→ɮ, final н→ŋ).
- **з→t͡s, ж→t͡ʃ UNASPIRATED voiceless** (not d͡z/d͡ʒ — Mongolian's contrast is aspirated-vs-unaspirated like б=p/д=t) +
  local harmony (Герман г→ɡ next to е) → 37.6%.
- **Final-vowel deletion + epenthesis + rounding reduction** (хурга→xʊrəɢ: final а deletes, ə breaks the r-g cluster;
  Орос→ɔrʊs: non-initial о reduces to ROUND ʊ, not ə — quality tracks the original letter) → 40.5%.
- **Final г stays voiced** (хаг→xaɡ; only в→f devoices) + **н→ŋ keyed on ORIGINAL spelling position** (заан→tsaːŋ but
  хаана→xaːn — its н is followed by a deleting-а, so stays n) → 43.9%.
- bound-morpheme -suffix entries (leading vowel reduces) + ʉ/β folds → 44.3%.
- **fold alveolo-palatal t͡ɕ/d͡ʑ → t͡ʃ/d͡ʒ** (the referee mixes both places for ч/ж) → **49.2%.**

NEGATIVE result (kept): turning OFF non-final reduction (keep full vowels) → 40.5%, WORSE than 49.2% — the native
short-vowel reduction wins more than the loanword full-vowels lose, so it's both linguistically correct AND
higher-scoring. The ~40% loanword/place-name share of the Wiktionary category (Албани→alpan, Итали→ital keep full
non-initial vowels) is the main ceiling driver, plus 279/748 misses are edit-distance ≥2 (structural: epenthesis
placement, loanword clusters). Reduction is KEPT (canonical-consistency + explicitness principle).

## Run 3 — 2026-07-24 — stop-voicing + reduced-vowel folds → 52.7%, ship 🔷

The narrow referee writes the UNASPIRATED stops variably voiced/voiceless (аадар д→d, аагаар г→k, but хаг г→ɡ) and
the ONE reduced-vowel phoneme with several symbols (ə~ɐ~ɪ). Since the backbone already folds aspiration ʰ (the REAL
stop contrast), the residual voicing must fold too, and the reduced-vowel allophones fold to ə:
- fold velar/uvular stop voicing [ɡɢq]→k, plus b→p / d(?![ʒʑ])→t (b/p, d/t already collapse via the aspiration fold) → 50.0%
- fold ɐ→ə (reduced a) → 51.0%
- fold ɪ→ə (reduced и: алим→alɪm, ажилтан→atʃɪltəŋ) → **52.7%.**

**Landed 🔷 single-source at 52.7% folded** (native/common words 49.8%, proper nouns 41.5% — proper nouns are only
8% of the set, so the ceiling is the deep orthography broadly, not just loans). 418/635 remaining misses are
edit-distance 1: loanword non-initial full vowels (need a lexicon), specific reduction-quality choices, the бай-
copula forms (ай→a before a velar — verb-specific, not generalised), and narrow-transcription residue. The engine
output is verified SOUND on common vocabulary (Монгол→mɔŋɢʊɮ, хот→χɔtʰ, өдөр→ɵtɵr, сургууль→sʊrɢuːɮ, гурав→ɢʊrəf,
"Сайн байна уу?"→saiŋ pain ʊː ?), so the folded % understates quality (the bn situation: a narrow single-source
referee). Files: src/languages/mongolian/{mongolian.jsonc, manifest.ts, g2p.ts, mongolian.ts}; registry `case "mn"`;
tools/referee-eval/langs/mn.jsonc; goldens test/mongolian.test.ts; floor mn:0.50.

**Deferred:** cardinal-number compositor, a loanword/proper-noun lexicon (the path past ~53%), and a
traditional-Mongolian-script (Mongol bichig) front-end (the 118 dropped referee entries).

## Run 4 — 2026-07-24 — adversarial review fixes (52.7% → 51.9%, honest)

Two review agents on the PR. Fixes applied:
- **Removed the `ʊ→u` fold** — it collapsed у(ʊ)/ү(u), a GENUINE Mongolian phonemic contrast, to gain only +0.8pp
  (papering over referee inconsistency). Per the canonical-consistency principle (fold conventions, never real
  contrasts), removed it → honest **51.9%** (from 52.7%). Floor stays 0.50 (1.9pp margin).
- **ю harmony bug** — ю (emitted back ʊ) wasn't counted in `nearestBack`, so г/х next to ю wrongly got front place;
  added ю to the back-harmony set.
- **Doc contradiction** — the jsonc `convention.stops`/`devoicing` notes described ж=[d͡ʒ]/з=[d͡z] + "г→k devoicing",
  but the table + engine emit ж=t͡ʃ/з=t͡s everywhere (unaspirated voiceless) and only в→f devoices; corrected the
  notes to match the code.
- **Dead fold** — `ʃt͡ʃ→t͡ʃ` never matched (the backbone strips tie-bars first, so the live string is `ʃtʃ`); removed.

Refuted (kept as-is): the ь vowel-fronting (морь→mœr) is REFEREE-BACKED (Говь→ɢœw̜, аль→æɮ, амь→æm all front the
vowel), not a bug. The `bound` (-suffix) path being reachable only via direct phonemizeWord (not text()) is by design
— it exists for the referee's -suffix entries. Landed **🔷 51.9%**.
