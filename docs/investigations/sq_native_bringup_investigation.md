# Albanian (sq) native bring-up investigation

Target: **Standard Albanian** (Shqip, Tosk-based standard), Latin script (36
letters), canonical IPA, espeak-independent. Indo-European — its OWN branch (the
fleet's first Albanian-branch language). ~6M. Fairly phonemic with a rich DIGRAPH
system.

## Run 1 — referee landscape

- **wikipron**: NONE (sq/als all 404).
- **kaikki Albanian**: 23,438 entries, **8035 with IPA** (HUMAN). Phonemic /../ +
  phonetic [..]; stress marked; ⟨e⟩→[ɛ], ⟨ll⟩→[ɫ], ⟨c⟩→[t͡s], ⟨x⟩→[d͡z]. Some
  English-spelled loan/junk entries (cube→t͡subɛ) → filter. → PRIMARY (human).
- **epitran `sqi-Latn`**: WORKS — an INDEPENDENT programmatic G2P. Confirms the
  digraph map: dh→ð, th→θ, sh→ʃ, zh→ʒ, xh→d͡ʒ, gj→ɟ, nj→ɲ, ll→l(~ɫ), rr→r, q→c,
  c→t͡s, x→d͡z, ç→t͡ʃ, ë→ə, y→y, r→ɾ. → SECONDARY (independent implementation).

Verdict: **two INDEPENDENT sources** (kaikki human Wiktionary + epitran rule-based)
→ not single-source (the Quechua situation). Digraph inventory:
- ⟨dh⟩→ð, ⟨th⟩→θ, ⟨sh⟩→ʃ, ⟨zh⟩→ʒ, ⟨xh⟩→d͡ʒ, ⟨gj⟩→ɟ, ⟨nj⟩→ɲ, ⟨ll⟩→ɫ, ⟨rr⟩→r (trill)
- ⟨c⟩→t͡s, ⟨ç⟩→t͡ʃ, ⟨x⟩→d͡z, ⟨q⟩→c (palatal), ⟨j⟩→j
- vowels a e→ɛ i o u y→[y] ë→[ə]; single ⟨r⟩→ɾ (tap), ⟨l⟩→l

## Run 2 — engine + tuning

Engine: longest-match digraph scan (Quechua template) + penultimate stress. First
pass **82.0% folded / 95.6% symbol** (kaikki). Tuning (folds only — the g2p is a
clean direct map):
- **Syllable dots** (kaikki a.de.rim) + the **optional word-final ⟨ë⟩
  parentheses** (Buzëmadhe→buz(ə)maðe) + **r~ɾ** (the referees NEUTRALIZE the
  ⟨r⟩[ɾ]/⟨rr⟩[r] tap/trill contrast inconsistently — kaikki writes both r~ɾ) →
  **87.7% / 97.3%**.
- **q/gj affricate notation** (kaikki [c͡ç ɟ͡ʝ] ~ our [c ɟ]) + ⟨e⟩ ɛ~e, ⟨o⟩ ɔ~o →
  **87.8% folded / 97.3% symbol** (kaikki).

**Result:** kaikki (HUMAN, 6002) **87.8% folded / 97.3% symbol**; epitran sqi-Latn
(INDEPENDENT rule-based, same wordlist) **90.2% / 98.5%**. TWO INDEPENDENT sources
corroborate → 🔷. The residual is the VARIABLE word-final ⟨ë⟩ (Tosk keeps [ə], some
kaikki entries drop it + lengthen the preceding vowel: Gresë→[ɡɾɛːs] vs ours
[ɡɾɛsə] — dialectal/lexical, not rule-predictable) + proper-noun/loan oddities
(Daniel→daɲeɫ). A clean, high-scoring bring-up. Deferred: numbers, the ⟨ë⟩-drop
dialect variant.
