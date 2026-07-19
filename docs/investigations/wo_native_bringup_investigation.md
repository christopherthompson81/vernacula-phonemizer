# Wolof (wo) native bring-up

Wolof (wo) — Atlantic-Congo, Senegambian (Atlantic) branch; the principal language and lingua franca of Senegal
(~12M incl. L2), also spoken in the Gambia and Mauritania. Written in the **Latin** orthography (official CLAD
standard), and also in Arabic (Wolofal) and the Garay script. This is a fresh bring-up targeting the Latin
orthography. Wolof is **NON-tonal** — so, unlike the Bantu/Mande bring-ups, there is no tone to defer.

**Scope gate — PASSES (single-source).** Standardized Latin orthography + a human referee: **kaikki Wolof**
(Wiktionary, CC-BY-SA). No epitran `wol`, no wikipron `wol` — kaikki is the only machine referee (🔷 single-source).

## Run 1 — the g2p + gemination, 97.1% folded

**Referee.** kaikki Wolof (748 entries; **86 with IPA**, 69 single-token). The transcription marks stress (ˈ),
syllable dots, a variable word-initial glottal onset [ʔ], vowel length (ː) and gemination — none of stress/dots/ʔ
is determined by the orthography, so the eval folds them.

**g2p** (Chichewa greedy pattern + two code rules). The key facts, all read off the referee:
- **ATR vowels**: ⟨e⟩=ɛ / ⟨é⟩=e, ⟨o⟩=ɔ / ⟨ó⟩=o, ⟨ë⟩=ə, ⟨à⟩=aː, ⟨a i u⟩=a i u.
- **DOUBLING = LENGTH**: a doubled vowel is long — aa→aː, ee→ɛː, oo→ɔː, ii→iː, uu→uː, and the accent+plain pairs
  ée→eː, óo→oː (vowel digraphs in the table).
- **⟨c⟩=c, ⟨j⟩=ɟ** — the voiceless/voiced palatal STOPS, not affricates (the Wiktionary convention). ⟨x⟩=x
  (velar fricative), ⟨q⟩=q (uvular stop), ⟨ñ⟩=ɲ, ⟨ŋ⟩=ŋ, ⟨y⟩=j.
- **CONSONANT GEMINATION** (code): a doubled consonant is a geminate [Cː] — benn→bɛnː, làkk→laːkː, dëjj→dəɟː,
  noppa→nɔpːa.
- **NASAL place assimilation** (code): ⟨n⟩→ŋ before g/k — Angale→aŋɡalɛ (⟨ng⟩ → ŋɡ).

**Result.** `npx tsx tools/referee-eval/eval.ts wo` → **97.1% folded (67/69)**; raw 44.9% (much higher than the
tonal bring-ups because Wolof is non-tonal — nothing to differ on but stress/ʔ/notation). Folds: stress ˈ,
syllable dots, word-initial ʔ (variable), CC~Cː.

**The 2-word residual is a loanword spelling + one oddity, not a g2p defect:** inchaalaaxu (Arabic *inshallah*
loan — ⟨ch⟩→ʃ, a non-native digraph) and jàmm→ɟaːmmə (the referee adds an epenthetic final schwa).

## Verdict: 🔷 single-source

The g2p is correct for what the orthography determines (97.1% folded — near-ceiling on an independent human
referee). Deferred:
- **NUMBERS** — Wolof has a base-5 numeral system (benn, ñaar, ñett, ñeent, juróom, juróom-benn…); deferred until
  verifiable against a source (digits pass through) — a Run-2 candidate.
- **Wolofal (Arabic) + Garay** — the two non-Latin Wolof scripts; separate front-ends, deferred.

There is **no tone or vowel-height deferral** (Wolof is non-tonal, and the ATR vowel qualities ARE written).
Single-source (🔷): kaikki is the only machine referee (69 IPA words — small, like Bambara/Lingala). Gold:
`test/wolof.test.ts`. Floor `wo: 0.95`.
