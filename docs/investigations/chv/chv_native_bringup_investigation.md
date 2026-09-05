# Chuvash (chv) native bring-up investigation

Target: **Chuvash** (Чӑвашла / Чӑваш чӗлхи), the **sole surviving Oghur (Bulgaric)
Turkic** language — the deepest split in Turkic, sister to all the Common-Turkic
languages the fleet already has (tr, az, tk, tt, ba, kk…). ~1M speakers (Chuvashia,
Russia), CYRILLIC (the Chuvash alphabet, + ⟨ӑ ӗ ҫ ӳ⟩). Canonical IPA, espeak-independent.

## Run 1 — referee landscape

- **kaikki Chuvash**: 930-line extract, but only **93 IPA sound entries → 73 Cyrillic
  multi-char pairs** (thin, like tt/quc).
- **wikipron**: NO `chv_cyrl` (404 for broad + narrow).
- **epitran**: NO `chv-Cyrl` mapping (DatafileError).
- **English Wiktionary category** ("Chuvash terms with IPA pronunciation", 93 members):
  the K'iche' avenue. ★ KEY: the pronunciations are **literal human `{{IPA|cv|/…/}}`**
  (code `cv`, the 639-1 code — NOT `chv`; and NOT module-generated like cdo/bo) → HUMAN
  attestation, not reference-parity. Scraped via the MediaWiki API (categorymembers +
  revisions + `\{\{IPA\|cv\|…\}\}`), Anatri/standard form preferred over Viryal variants
  → **84 pairs**. This supersedes the 73-pair kaikki subset (same source, fuller).

🔷 single-source. Thin (84) but HUMAN and phonologically consistent — the % is a real
quality signal here (unlike loan-polluted tt/ba), just on a small sample.

## Run 2 — the phonology mined from the 84-pair referee

★★ **HALLMARK 1 — allophonic intervocalic/post-nasal VOICING** (Chuvash has NO phonemic
voicing contrast; the letters ⟨п т к ч с ҫ ш х⟩ are underlyingly voiceless and voice
between vowels or after a nasal):
- ⟨п⟩→[b]: апат→aˈbat, упа→uˈba, эпир→eˈbir, манпа→manˈba, хыпар→χɯˈbɑr
- ⟨т⟩→[d]: тата→taˈda, айта→ajˈda, вӑтӑр→ˈvŏdər
- ⟨к⟩→[ɡ]: акак→aˈɡak, вӑкӑр→ˈvəɡər, така→taˈɡa, ҫӑкӑр→ˈɕəɡər
- ⟨ч⟩→[d͡ʑ]: ача→aˈd͡ʑa, кӑвакарчӑн→…ˈɡard͡ʑən
- ⟨с⟩→[z]: эсӗ→ˈezɘ, эсир→eˈzir, вӑлсем→ʋəlˈzem
- ⟨ҫ⟩→[ʑ], ⟨ш⟩→[ʐ]: миҫе→miˈʑe, мӗншӗн→ˈmŏnʐɘn
- ⟨х⟩→[ɣ]: чухӑнлӑх→ˈtɕuɣənləχ, ӳхӗ→ˈyɣɘ
- ★ **GEMINATES BLOCK voicing** (the underlying "strong" consonants): иккӗ→ˈikːɘ,
  саккӑр→ˈsakːər, виҫҫӗ→ˈviɕːɘ, пиллӗк→ˈpilːɘk, вуннӑ→ˈvunːə. Doubled letter → single
  long voiceless [Cː].

★★ **HALLMARK 2 — reduced-vowel-sensitive STRESS.** Chuvash has two REDUCED vowels
⟨ӑ⟩→[ə] and ⟨ӗ⟩→[ɘ] that CANNOT bear stress. Stress falls on the **last FULL (non-reduced)
vowel**; if the word has only reduced vowels, on the **first syllable**. Attested:
- last-full: вӑлсем→ʋəlˈzem (ӑ red → е), сӑмах→səˈmax (ӑ red → а), Раҫҫей→raˈɕːej,
  кӗҫнерникун→kɘɕnerniˈɡun (ӗ red → last full у)
- all-reduced → first: вӑкӑр→ˈvəɡər, вӑтӑр→ˈvŏdər, тӑххӑр→ˈtŏχːər
- full-then-reduced → the full: иккӗ→ˈikːɘ, эпӗ→ˈepɘ, пиллӗк→ˈpilːɘk
(This is FOLDED away by the backbone's stress-strip, so it doesn't move the %, but it is
the signature prosodic rule → implemented for canonical correctness; NFD-aware nucleus.)

**Vowels**: а→a, е→e ([je] initial), и→i, о→o, у→u, ы→ɯ, э→e, ⟨ӑ⟩→ə, ⟨ӗ⟩→ɘ, ⟨ӳ⟩→y;
iotated я→ja ю→ju ё→jo. **Consonants** (onset): б→b в→ʋ г→ɡ д→d ж→ʒ з→z й→j к→k л→l м→m
н→n п→p р→r с→s т→t ф→f х→χ ц→t͡s ч→t͡ɕ ш→ʂ щ→ɕ ҫ→ɕ.

Folds (allophonic notation the referee writes but we neutralise): reduced-vowel breve
ŏ~ə / ø̆~ɘ, the labial approximant w~ʋ (⟨в⟩ coda), sibilant place ʂ~ʃ / ʐ~ʒ / ʑ~ʐ,
uvular~velar x~χ and q~k, the parenthetical optional-segment notation `(ə)` in the referee.

## Run 3 — build, tune (2026-07-27)

Engine (`src/languages/chuvash/chuvash.ts`): Cyrillic scan → gemination merge → voicing pass →
reduced-vowel stress. First pass **69.0% folded / 89.4% symbol**. Tuning:
- The reduced-vowel breve must fold in **preFolds** (before the backbone strips U+0306), else [ŏ]→[o]
  and the reduced-vowel comparison fails. +6.7pp.
- Parenthetical optional-segment notation: strip the PARENS but KEEP the segment (it is a written
  ⟨ӑ⟩/⟨ӗ⟩ we emit); re-add the syllable-dot strip. +6.7pp.
- Voicing trigger tuning (see Run 4). → **91.7% / 97.7%** → **92.9% / 97.9%** after review.

## Run 4 — 2-agent review (phonology + code/wiring), 2026-07-27

**Code/wiring reviewer — 1 real bug (the recurring NFD tokenizer trap):** `text()` tokenized the raw
input before any NFC pass, and Chuvash ⟨ӑ ӗ ӳ⟩ DECOMPOSE under NFD to base+combining (U+0306/U+030B),
which fall OUTSIDE the [Ѐ-ӿ] token class → NFD input shattered words and dropped the reduction mark
(чӑваш[NFD]→"t͡ɕa ʋaʂ"). Bashkir is dormant to this (its letters don't decompose) — Chuvash is uniquely
exposed. FIX: `input.normalize("NFC")` at the top of `text()` (the [[latin_vernacula_bringup]]/shi/cdo/ee
recurring fix). Everything else (gemination i++, voicing prev/next guards, stress splice order, TOKEN
range, all wiring) verified correct.

**Phonology reviewer — 1 real rule improvement + 1 over-reach:**
- ★ **Liquid voicing (STRONG).** The blanket ⟨р л⟩ exclusion made the engine contradict its own showcase
  word вӑлсем→ʋəlˈzem. The clean generalization fitting ALL three referee cases: liquids DO trigger
  voicing, but only **before a FULL vowel** — вӑлсем (л·с·**е** full → z) vs ҫулҫӑ (л·ҫ·**ӑ** reduced → ɕ)
  and чӗрпӗк (р·п·**ӗ** reduced → p). Nasals/glide/intervocalic voice unconditionally (мӗншӗн→mŏnʐɘn
  voices before reduced ӗ). Implemented (NASAL_GLIDE unconditional + LIQUID gated on `!next.reduced`);
  recovered вӑлсем, kept ҫулҫӑ/чӗрпӗк. +1.2pp → **92.9% / 97.9%**.
- **VOICE over-reach.** Dropped ⟨ф⟩→v and ⟨ц⟩→d͡z (Russian-loan-only letters, unattested, and loans don't
  undergo Chuvash voicing) — narrows VOICE to the 8 documented native obstruents.
- Affirmed CORRECT: geminate blocking (9/9 referee cases), reduced-vowel stress (~15 traced), vowel
  mappings, the fold config (no contrastive ə~ɘ or s~z collapse — the вӑлсем miss was EXPOSED not masked).
- Informational (no action): эпӗ→epɘ is a lone referee quirk (the pronoun 'I'; the engine's regular
  voicing matches эпир/эсӗ/эпӗр); ҫулҫӑпӗтӗревҫӗ compound-internal voicing block (no morpheme awareness).

**Final: 92.9% folded / 97.9% symbol.** Floor 0.90. Goldens (5 assertions incl. вӑлсем + the NFD path),
the 148-test referee floor, and typecheck all green.
