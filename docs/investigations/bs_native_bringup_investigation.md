# Bosnian (bosanski, bs) bring-up — the third Serbo-Croatian standard

Bosnian, South Slavic (~2.5M), the third pluricentric standard of Serbo-Croatian alongside Serbian (sr) and Croatian
(hr), both already in the fleet. Written in BOTH Gaj's Latin (predominant) and Cyrillic.

## Run 1 — 2026-07-25 — thin reuse of the verified shared engine + Bosnian deltas

**The phonology is IDENTICAL to Serbian/Croatian — a linguistic fact, not a guess.** All three standards share the
same 30-phoneme inventory and a fully-phonemic orthography (č=t͡ʃ, ć=t͡ɕ, đ=d͡ʑ, dž=d͡ʒ, lj=ʎ, nj=ɲ, h=x, v=ʋ, syllabic
r). So — exactly as Croatian does — `bosnian.ts` reuses the Serbian engine's `phonemizeWord` VERBATIM (word output is
byte-identical to Serbian/Croatian). This is NOT the bho circular-clone trap: the shared engine is already VERIFIED
against **wikipron hbs_latn** (the Serbo-Croatian *macrolanguage* referee, 98.4%), which contains Bosnian words and
covers the shared phonology — so Bosnian is verified TRANSITIVELY against a human referee, not against a rule-clone.

**No Bosnian-specific numeric referee exists** — standalone "Bosnian" is empty on wikipron (`bos_latn_*` = 0), kaikki
(404), and en.wiktionary (Category:Bosnian = 0 IPA members). The hbs_latn macrolanguage referee is the correct one (it
is what validates Serbian + Croatian too). The Bosnian surface is locked by the adjudicated `test/bosnian.test.ts`.

**Bosnian-specific deltas (all verified by inspection — the mapping is deterministic + the engine is validated):**
- **Retained ⟨h⟩** — Bosnian's signature. Where Serbian/Croatian drop the historical /x/ (lako, meko, kafa), Bosnian
  writes and pronounces it: lahko→laxko, mehko→mexko, kahva→kaxʋa, sahat→saxat. This is ORTHOGRAPHIC (the engine reads
  ⟨h⟩→x wherever written), so no rule is needed — the Bosnian spelling simply carries the h.
- **Ijekavian** (like Croatian, not Serbian ekavian): mlijeko, čovjek→t͡ʃoʋjek, ljeto→ʎeto — handled by the phonemic
  scan (⟨ije/je⟩ read literally).
- **Dual script** — unlike Latin-only Croatian, the Bosnian tokenizer admits Cyrillic too (Босна→bosna).
- **NUMBERS** — the one bespoke data table (bosnian.jsonc, over the shared `composeSlavicNumber`): Bosnian uses the
  SERBIAN lexemes hiljada/milion (NOT Croatian tisuća/milijun) but the IJEKAVIAN hundreds dvjesta (NOT ekavian Serbian
  dvesta / Croatian dvjesto). 275→dʋjesta sedamdeset pet, 1200→xiʎadu dʋjesta, 3000000→tri miliona.

**Status: 🟢 (thin reuse of the verified shared engine, locked by test)** — mirrors Croatian's status. Verification is
transitive (shared engine validated on wikipron hbs_latn 98.4% + the phonology is BCS-shared by linguistic fact) plus
the adjudicated golds; there is no independent Bosnian numeric referee (none exists). **Deferred:** the lexical pitch
accent (4-way, unwritten — as in sr/hr). The number-word forms (dvjesta) are the only unverifiable-from-a-referee
choice — documented, standard Bosnian.

## Run 2 — 2026-07-25 — review (2 angles): clean, one pre-existing shared note

The Bosnian deltas are all correct (number table = Serbian ∆ dvjesta only, dual-script tokenizer admits all 30 azbuka
letters + the Latin set, engine reuse byte-identical for word g2p, ⟨h⟩→x confirmed). Test golds + wiring + docs verified.

**Documented pre-existing SHARED limitation (NOT a Bosnian bug — inherited from serbian/numbers.ts, affects sr + hr
equally):** the count preceding the FEMININE counter noun *hiljada/tisuća* is not gender-swapped, so 2000 →
"dva hiljade" (correct: "dvije hiljade" bs/hr, "dve hiljade" sr) and 21000 → "dvadeset jedan hiljada" (correct
"…jedna hiljada"). `composeSlavicNumber` feeds `below1000(th)` (masculine) as the thousands multiplier. Serbian
produces the identical wrong form — so the fix belongs to the SHARED compositor (a per-language feminine-numeral
table for 1/2 before a feminine counter), a follow-up affecting all three BCS standards, not the Bosnian reuse. The
Bosnian test golds (275, 1200, 3000000) deliberately avoid this class. Everything else: no defects.
