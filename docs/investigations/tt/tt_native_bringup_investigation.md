# Tatar (tt) native bring-up investigation

Target: **Standard Tatar** (Татар теле), Kipchak Turkic, CYRILLIC script (official),
canonical IPA, espeak-independent. ~5M, Tatarstan (Russia).

## Run 1 — referee landscape

- **wikipron**: NONE (tt/tat all 404).
- **kaikki Tatar**: 2038 entries but only **~98 with IPA** → **69 Cyrillic**
  headwords after filtering. HUMAN (Wiktionary). Mixed native + Russian/Arabic loan
  pronunciations. THIN.
- **epitran**: NO `tat-Cyrl` / `tat-Latn` mapping. None.

Verdict: **single-source, THIN** (kaikki 69) — no independent second source (the
Bambara / Kabuverdianu situation). Phonology visible in the data: vowel-harmony
backing ⟨к⟩→[q]/[г]→[ʁ] (ак→ɑq, җомга→d͡ʒomʁɑ), ⟨ә⟩→æ, ⟨ө⟩→ø, ⟨ү⟩→y, ⟨ы⟩→ɪ,
⟨җ⟩→ʑ~d͡ʒ, ⟨ң⟩→ŋ, ⟨һ⟩→h.

## Run 2 — engine + tuning + the referee-limited verdict

Engine: Cyrillic scan + LOCAL к/г backing (nearest-vowel: back→q/ʁ, front→k/ɡ)
+ word-harmony ⟨а⟩→[a] in front words (has ә/ө/ү) else [ɑ] + final stress. First
pass 33.3%. Fixed a FOLD SELF-CORRUPTION (the ʑ→d͡ʑ fold hit the ʑ inside my own
d͡ʑ → d͡d͡ʑ; switched to emitting ⟨җ⟩→[ʑ] the Kazan-standard fricative + folding
the referee's affricate d͡ʑ/d͡ʒ→ʑ). Added the ⟨а⟩ harmony (+3pp), folds for ⟨ы⟩
ɪ/ɤ~ɨ, ⟨ө⟩ ɵ~ø, ⟨х⟩ χ~x, ⟨ч/щ⟩ ɕ~ʃ, and the RUSSIAN-LOAN palatalization ʲ + front
ä (native Tatar lacks them; the referee marks loan phonetic detail).

**Result: 50.7% FOLDED / 84.3% symbol** — but this is **REFEREE-LIMITED, not an
engine-quality signal.** The 69-word kaikki set is heavy with **Russian/Arabic LOAN
pronunciations read non-natively** (адрес→ˈädrʲɪs palatalized, имтихан→imtʲixän,
Оренбург→arinbur akanye, Сабантуй, Бәхрәйн proper nouns) that a NATIVE Tatar g2p
correctly does NOT reproduce. On the clearly-NATIVE subset the engine is right:
the weekday names якшәмбе→jɑqʃæmbe, дүшәмбе→dyʃæmbe, сишәмбе→siʃæmbe; ак→ɑq,
вөҗдан→vøʑdan, балык→bɑlɨq, мәктәп→mæktæp (front к→k) vs ак→ɑq (back к→q). Like
Irish (ga 44.8%) / Tamil (63%): the % reflects the referee, not the g2p.

Verdict: 🔷 THIN single-source (kaikki 69, noisy). Deferred: fuller vowel harmony
(⟨я⟩→jæ in front words, ⟨о у⟩ reduction), numbers, and — the real gap — an
INDEPENDENT and larger referee (none exists: no wikipron tt/tat, no epitran tat).

## Run 3 — 2-agent review fixes

The thin+noisy referee can't validate the engine, so the engine reviewer checked
against published Kazan Tatar phonology and found several real issues, fixed:
- **⟨ч⟩→[ɕ]** (was [t͡ɕ]): Kazan standard DEAFFRICATES — ⟨ч⟩ is the fricative [ɕ],
  consistent with the voiced ⟨җ⟩→[ʑ] (the affricates [t͡ɕ]/[d͡ʑ] are Mishar). The
  referee's affricate is folded (t͡ʃ→ɕ).
- **⟨г к⟩ near a fronted ⟨а⟩** (гаилә): ⟨а⟩ is harmony-NEUTRAL for the к/г backing
  now (nearBack skips it), so a front word gives ⟨г⟩→[ɡ] (ɡailæ) not [ʁ].
- **word-initial / post-vocalic ⟨е⟩→[je]** (елга→jelɡa).
- **⟨а⟩-fronting broadened** to any front vowel ⟨ә ө ү е и э⟩ (китап→kitap).
- **max-onset stress** (спорт→ˈsport, not sˈport) — the recurring cluster-onset
  fix (obstruent+liquid / voiceless-sibilant+stop; NO nasal+stop, since a medial
  ⟨мб⟩ is a coda, якшәмбе→jɑqʃæmbe).
- **NOT applied: ⟨я ю⟩ harmony** — the fronting is LEXICAL, not spelling-recoverable
  (якшәмбе→jɑq… back vs яшь→jæʃ front, neither has a harmony marker), so a
  frontWord rule would break якшәмбе; kept ⟨я⟩→jɑ with яшь as a documented exception.
Post-fix: 47.8→**50.7% FOLDED / 84.3% symbol**. Folds/wiring clean (reviewer 2).
