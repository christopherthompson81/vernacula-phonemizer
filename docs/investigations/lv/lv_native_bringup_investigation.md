# Latvian (latviešu, lv) bring-up — Baltic, ~1.5M

Latvian, the second Baltic language after Lithuanian (lt). Latin script with macrons (ā ē ī ū = LENGTH) and
palatal diacritics (ģ ķ ļ ņ). Referee: **wikipron `lav_latn_narrow`** (human, CUNY-CL/wikipron, 1,657 headwords;
the broad set is 404). The narrow set is heavily marked (length ː, syllable TONE àáâ, open/close ⟨e⟩ quality).

## Run 1 — 2026-07-25 21:00 — rule g2p (simpler than Lithuanian)

**Latvian is MORE tractable than Lithuanian** on the axes that made lt hard:
- **Stress is FIXED on the first syllable** (not free/lexical like lt) → we EMIT first-syllable stress ˈ (real,
  predictable), and fold it against the referee (which marks tone on the stressed vowel, not a plain ˈ).
- **Length is WRITTEN** (the macron ā/ē/ī/ū → [aː eː iː uː]) → we EMIT ː from the macron (recoverable, not folded).
- **Palatalization is WRITTEN** (ģ=ɟ, ķ=c, ļ=ʎ, ņ=ɲ) → direct grapheme→IPA, NO contextual Cʲ-spread rule (unlike lt).

**Rules (derived empirically from the referee):**
- Palatals ⟨ģ ķ ļ ņ⟩ → ɟ c ʎ ɲ; affricates ⟨c dz dž č⟩ → t͡s d͡z d͡ʒ t͡ʃ, ⟨š ž⟩ → ʃ ʒ; ⟨h⟩ → x; ⟨v⟩ → v (~w).
- **Native ⟨o⟩ → [uɔ]** (the diphthong: loks→luɔks, roka→ruɔka) — but LOANS/names keep [o]/[oː] (Monako, Andora).
  This is LEXICAL (the Slovene l-vocalization pattern) → to be MEASURED (o→uɔ vs o→o) on the name-heavy referee.
- **Diphthongs** ⟨ai au ei ui⟩ → vowel + non-syllabic offglide [i̯ u̯]; ⟨ie⟩ → [iɛ] (rising).
- **⟨e/ē⟩ open/close** [æ] vs [ɛ]/[e] is LEXICAL/positional (cena→t͡sæna vs ceļš→t͡sɛʎʃ; not spelling-predictable) →
  we emit [ɛ] and FOLD æ→ɛ (the Lithuanian treatment).
- Regressive VOICING assimilation + n→ŋ before a velar (the shared Baltic/Slavic machinery).

**Folds (referee-eval `lv.jsonc`):** TONE (combining àáâ, BACKBONE-stripped); ⟨e⟩ quality æ→ɛ; the offglide
notation (referee j~i̯, w~u̯); v~w; length inconsistencies on loan vowels. Length ː from macrons is EMITTED, not
folded (written). First-syllable stress ˈ is emitted + folded (predictable). Numbers = standard Latvian cardinals
(no numeric referee).

## Run 1 results — 2026-07-25 21:40

`npx tsx tools/referee-eval/eval.ts lv`: **84.0% folded / 96.6% symbol accuracy** (1,657 headwords). The path:
- **First pass: 79.8%.** Then a batch of "clear" fixes (offglide→[j]/[w], regressive devoicing-only) DROPPED it to
  77.0% — the offglide change over-corrected: the narrow referee is INCONSISTENT, writing offglides as both [j]/[w]
  (maize→majzɛ) AND [î]/[û]→[i]/[u] (vai→vaî, augsts→aûksts). Neither pure emission wins.
- **Fix — emit offglides as plain vowels [i]/[u] + fold the whole glide space** (j→i, w→u, v→u; ⟨v⟩ is one
  phoneme's [v]~[w]~[u̯] realizations, which the referee writes all three ways): **83.9%**. This is the honest
  treatment of a genuinely-ambiguous notation axis (like the v/w merge), not a defect.
- **Regressive DEVOICING-only** (not the reverse voicing): the referee keeps [atɡ] in atgriezt (a voiceless stop
  does NOT voice before a voiced one across a boundary), while draugs→drauks IS the regressive devoicing (g→k before
  s). Devoicing-only matches; the reverse direction was removed.
- **+ h→x and ə→ɔ folds → 84.0%** (⟨h⟩=[x]~[h] loan variation; the ⟨o⟩-diphthong offglide [ɔ̯]~[ə̯]).

**⟨o⟩ = [uɔ] MEASURED and KEPT (unlike Slovene's l-vocalization).** Native ⟨o⟩ → [uɔ̯] vs loan ⟨o⟩ → [o] is lexical,
and the referee is name/loan-heavy (~74 loan-[o] vs ~51 native-[uɔ]). But measured directly, **o→[uɔ] scores 83.9%
vs o→[ɔ] 82.0%** — the native diphthong is BOTH linguistically correct AND referee-better (+1.9pp), so it stays the
default. The residual is dominated by the loan-[o] tail (Monako, atoms, avokado, administratore, hroms) — a loanword
lexicon is the honest fix (deferred), but here the rule default is right.

**Status: 🔷 (single-source, small narrow referee).** wikipron lav_latn_narrow (1,657; the broad set is 404) is the
only committed referee; no kaikki lav / epitran lav exists. The written palatals + length + first-syllable stress +
regressive devoicing are standard Latvian phonology. **Deferred:** a loanword-⟨o⟩ lexicon; the syllable tone
(level/falling/broken — unwritten, folded); the lexical ⟨e⟩ quality (folded); a 2nd referee.

## Run 2 — 2026-07-25 22:30 — review (5 angles) → 4 real bugs fixed → 83.7% / 96.5%

The review confirmed the core is sound (native o→[uɔ̯] referee-verified, devoicing-only + NO final devoicing correct,
first-syllable stress correct) and found real bugs:
- **Number compositor (HIGH):** `group()` rendered the thousands count with `sub100` (0–99 only), so 100 000 →
  "**undefined** tūkstoši" and 234 000 → "undefined četri tūkstoši". Fixed: render the count via `sub1000`. Also
  added the Latvian **last-digit-1 singular agreement** (21 000 → "…viens **tūkstotis**", not tūkstoši; but 11 000 →
  tūkstoši) and "**viens** miljons" (the numeral is kept for millions, dropped for thousands). Numeral GENDER
  (feminine viena/divas) is a documented deferral (masculine default; unverifiable without a referee).
- **⟨ō⟩ dropped from the tokenizer (HIGH):** the TOKEN regex omitted ō/Ō, so ōpera split to "pɛra". Added ōŌ.
- **Offglide over-generated (MEDIUM):** the "any vowel + i/u" rule made non-Latvian diphthongs (eu in ne+uzmanība,
  long-vowel āi). Restricted to the real falling pairs only (ai ei ui / au iu); everything else is hiatus.
- **⟨v⟩ handling refined:** replaced the broad `v→u` eval fold (which the review flagged as masking onset /v/ into a
  vowel) with a real engine rule — **coda-⟨v⟩ → [w]** (dievs→diɛws), onset-⟨v⟩ stays [v] and is now MEASURED
  (Valmiera→valmiɛra); the eval folds only w→u. A bug in the first cut (⟨o⟩ isn't in the short-vowel table, so v+o was
  mis-read as coda) was fixed. Net −0.3pp vs the masked 84.0% — the honest cost of measuring onset-v.
- Doc fixes: the manifest "word-final devoicing" claim was wrong (Latvian has none) → corrected; ⟨ie⟩ relabeled
  "falling" (i is the nucleus). Cleanup: simplified applyVoicing to `isVoiced(p) && isVoiceless(next)`.
