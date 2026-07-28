# Papiamentu / Papiamento (pap) native bring-up investigation

Target: **Papiamentu** (Papiamento) — an IBERIAN- (Portuguese/Spanish-) lexified CREOLE of the ABC
islands (Aruba, Bonaire, Curaçao), ~340k speakers. The fleet's **4th creole** (after Haitian, Cape
Verdean, Nigerian Pidgin). Two orthographies exist — the Curaçao/Bonaire **phonemic** spelling
(Papiamentu) and the Aruba etymological one (Papiamento); this targets the phonemic Curaçao standard.

## Run 1 — referee landscape (2026-07-27)

- **kaikki Papiamentu**: 920-word dump, but only **9 with IPA**.
- **English Wiktionary category** "Papiamentu terms with IPA pronunciation": 20 members → merged with
  kaikki = **20 usable pairs** (the MediaWiki-API avenue; literal `{{IPA|pap|…}}`).
- **wikipron / epitran**: none.

🔷 **THIN single-source-family** (kaikki + Wiktionary both Wiktionary-derived). ~20 pairs — the % is on
a small sample, and Papiamentu has real dialect variation, so it is not a strong quality signal; the
g2p rests on the phonemic Curaçao orthography.

## Run 2 — the phonology (from the 20 pairs)

★ **NASALIZATION** (the creole hallmark, Portuguese-inherited): a CODA ⟨n⟩ (a vowel + ⟨n⟩ before a
consonant or word-end) NASALIZES the vowel and DROPS: -shon→[ʃõ] (federashon→fedeɾaˈʃõ,
klasifikashon, pronunsiashon, puntuashon, eksploshon — 5×), mashin→[maˈʃĩ], sustantivo→[sustãˈtivo].
An INTERVOCALIC ⟨n⟩ stays an oral onset [n] (abominabel→abomiˈnabəl; pronunsia→pɾonũsia — the FIRST ⟨n⟩
oral o_u, the SECOND a nasalizing coda u_s). ★ digraphs ⟨ch sh dj zj⟩→[t͡ʃ ʃ d͡ʒ ʒ]; open-vowel letters
⟨è ò ù⟩→[ɛ ɔ ø]; ⟨ñ⟩→[ɲ], ⟨y⟩→[j], ⟨r⟩→[ɾ]. Degemination (no geminates: Willemstad→wiləmstad).
★ acute ⟨á é í ó ú⟩ = irregular STRESS (abolí→aboˈli); default penult, but a consonant-final or
nasal-final (dropped -on) word → ULTIMATE (federashon final). ★ Lexical PITCH-ACCENT (H/L, párà, djàká)
is transcribed by the referee but NOT written in the orthography → not emitted (folds via the backbone).

## Run 3 — build + tune

Self-contained Curaçao-orthography scan (papiamento.ts). First pass **55% folded**; +folds
(r~ɾ, the unstressed-vowel reduction ə~e, ɔ~o, dark-l) → 75%; +degemination (Willemstad) → **80%
folded / 95.7% symbol (16/20)**. The 4 residuals are each a distinct, explained thing:
- **deporte→[depohte]** — CODA ⟨r⟩ debuccalizes to [h] (a Curaçao dialect feature the referee marks
  inconsistently — ortografia keeps [ɾ]); not modeled.
- **kontra→[kɔntra]** — the referee KEEPS the medial coda-⟨n⟩ here, but nasalizes it in sustantivo/
  puntua/pronunsia; the nasalize-coda-n rule sides with the majority (3 vs 1).
- **athetivo→[afetifo]** — an odd/loan entry (th→f, v→f); non-standard.
- **sustantivo→[sustatifo]** — intervocalic ⟨v⟩→[f] devoicing in a -ivo loan (also athetivo); we emit
  the canonical [v]. A ⟨v⟩~[f]/[β] realization is a documented Papiamentu detail (2 words).

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — CORRECT, no blocking bugs.** The tricky coda-n `.slice(-1)` on multi-char segs
and the acute-stress grapheme→seg mapping both verified sound (no vowel-terminal seg is ever multi-char;
digraphs are all consonantal). NFC, degemination, wiring all correct. Removed a dead 2-codepoint `"ò̀"`
LETTER entry it flagged.

**Phonology reviewer — engine mostly sound, but one IMPORTANT reframe (well-sourced).**
- ★★ **CODA-⟨n⟩ is RETAINED, not deleted** (Maurer; Kouwenberg & Murray). Papiamentu keeps a coda /n/ —
  WORD-FINAL → [ŋ] (pan→paŋ, bon→bɔŋ), MEDIAL before a consonant → [n] (kontra→[kɔntra]). The Wiktionary
  referee's "nasalize + DROP the ⟨n⟩" (ʃõ) is a Portuguese-STYLE over-transcription, not the language.
  My initial engine deleted the ⟨n⟩ (provably wrong on kontra vs its own referee). REFRAMED: word-final
  ⟨n⟩→[ŋ] (+ vowel nasalization), medial/intervocalic ⟨n⟩→[n]; the referee's dropped-⟨n⟩ is folded (ŋ→∅).
  This makes the OUTPUT canonically correct (kontra→[kontɾa], Papiamentu→[papiaˈmentu]) but DROPS the
  folded % 80→70% — the thin referee inconsistently drops the coda-n that speech retains (kontra keeps it,
  pronunsia/puntua/sustantivo drop it). The honest call: correct output, disclosed number.
- ★ **Dropped the ɔ→o fold** — it MASKED the real ⟨o⟩/⟨ò⟩ = /o/-/ɔ/ contrast the Curaçao orthography
  exists to encode. kontra→[kɔntra] in the referee is an unmarked-⟨o⟩ mistranscription → taken as a residual.
- ★ **⟨ou⟩ diphthong → [ɔu]** (Kòrsou→[kɔrsɔu]) added; falling diphthongs now count as ONE nucleus for
  stress (the reviewer's concrete Kòrsou wrong-stress catch).
- CONFIRMED: ⟨v⟩→[v] canonical ([f] is a real but variable devoicing — don't hard-code); ⟨j y⟩→[j]
  (no [x]/[ʒ] in the Curaçao orthography); coda-⟨r⟩→[h] correctly left a residual (variable); the
  ⟨-el/-abel⟩ Dutch-loan reduction is narrow (not general) → folded.

**Final: 70% folded / 93.1% symbol (14/20)** — the number is DEPRESSED by the referee's divergent
(dropped-n, unmarked-⟨o⟩→ɔ) transcription; the output is canonically correct. Floor 0.62. Goldens (3
tests, reframed), the 152-test referee floor, and typecheck all green.
