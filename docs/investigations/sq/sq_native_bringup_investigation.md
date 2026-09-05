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

## Run 3 — cardinal numbers (2026-07-29)

**Question.** `phonemize("<int>", "sq")` leaked the digit string. Albanian is decimal and regular — can it use
Pattern A (a `numbers` data block + the shared `westernNumberWords`)?

**Command.** `npx tsx <scratch>/numwords.mts sq` (43 candidate numerals standalone), then
`npx tsx <scratch>/probe.mts sq`.

**Raw findings.**
- All 43 numerals phonemize non-empty; nothing surprising in the g2p (`njëzet`→[ˈɲəzɛt], `dhjetë`→[ˈðjɛtə],
  `njëqind`→[ˈɲəcind], `mijë`→[ˈmijə], `e`→[ˈɛ]).
- **Pattern A does NOT suffice — one blocker.** Standard Albanian requires the connector ⟨e⟩ "and" between the
  groups of a composed numeral: njëzet **e** një "21", njëqind **e** një "101", një mijë **e** dyqind **e**
  tridhjetë **e** katër "1234". `westernNumberWords` has no connector slot, and faking it via a `compound` map
  would fuse the connector into one lookup string, which the per-word renderer would then phonemize as a single
  word (losing the [ˈɛ] as its own token and mis-stressing the whole phrase). → Pattern B, bespoke composer;
  everything else about the system is plain decimal, so the composer is short.
- Other calls: 3 has masculine ⟨tre⟩ / feminine ⟨tri⟩ — MASCULINE chosen as the citation form (the headword,
  and the counting form when no noun is present, which is exactly the digit-string case). Compounds on 3 are
  gender-fixed anyway (trembëdhjetë, tridhjetë, treqind). ⟨njëzet⟩ 20 / ⟨dyzet⟩ 40 are vigesimal fossils
  ("one twenty" / "two twenties") but modelled as plain round-ten words — 30/50/60/70/80/90 are all
  unit+dhjetë, so there is no base change to represent. The "one" is KEPT before a magnitude (`një mijë`,
  `një milion` — Albanian has no bare *mijë the way Latin has bare mīlle); ⟨mijë⟩ is invariant while
  ⟨milion⟩/⟨miliard⟩ take the plural ⟨-ë⟩ above one.

**Result.** Probe CLEAN for the whole target set. Implementation: `src/languages/albanian/numbers.ts`
(Pattern B), data in `albanian.jsonc` `numbers`, cited to Newmark, Hubbard & Prifti, *Standard Albanian: A
Reference Grammar for Students* (1982).
