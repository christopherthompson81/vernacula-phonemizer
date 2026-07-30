# Scottish Gaelic (gd) native bring-up investigation

Target: **Scottish Gaelic** (Gàidhlig) — Goidelic Celtic (sibling of Irish), ~57k speakers (Scotland),
Latin script. Canonical IPA, espeak-independent. A DEEP orthography sharing Irish's broad/slender
("caol le caol") consonant axis but with its own hallmarks (pre-aspiration, ao→[ɯː], b/d/g→[p t̪ k]).
The fleet has Irish (ga, 🔷/referee-limited) — the closest structural template — and Welsh (cy, Brythonic).

## Run 1 — referee landscape (2026-07-27): WELL-RESOURCED but MULTI-DIALECT

- **wikipron gla_latn_broad**: 6000 pairs — LARGE, but MULTI-DIALECT (4+ transcriptions per word: Ailean →
  a-l-a-n / a-l-a-ɲ / ɛ-l-a-ɲ / ɛ-l-ɛ-ɲ). Like Irish, this deflates the folded % (our single output can match
  only ONE variant) → the SYMBOL accuracy is the honest signal (the Irish 44.8%/~34%-ceiling situation).
- **wikipron gla_latn_narrow**: 865 pairs.
- **kaikki Scottish Gaelic**: exists (200) → possible secondary.

## Run 2 — the phonology (read off the broad referee)

Shares Irish's **broad/slender axis** (a consonant is velarized [Cˠ]/dental next to a/o/u, palatalized [Cʲ]
next to e/i). SG-specific hallmarks:
- ★★ **PRE-ASPIRATION**: medial/final fortis ⟨p t c⟩ → [hp ht̪ xk] (mac→maxk, cat→kʰaht̪, bochd→bɔxk); WORD-
  INITIAL fortis → aspirated [pʰ t̪ʰ kʰ] (cat→kʰ…, cù→kʰuː). The Scottish Gaelic signature.
- ★ **b/d/g → [p t̪ k]** (unaspirated lenis, referee writes b̥/d̪̊/ɡ̊: beag→b̥ek, gu→ɡ̊ɔ, dubh→d̪̊uh) — vs Irish's
  voiced [bˠ d̪ˠ ɡ]. So ⟨b d g⟩=[p t̪ k] lenis vs ⟨p t c⟩=[pʰ t̪ʰ kʰ]/pre-aspirated fortis.
- **Broad ⟨d t⟩ = DENTAL** [t̪]; slender ⟨d t⟩ → [tʲ]; slender ⟨c g⟩ → [kʲ] (geal→kʲal̪ˠ, Aigneas→akʲn̪əs̪).
- **⟨s⟩** broad→[s̪], slender→[ʃ]; **⟨l n r⟩** broad→[l̪ˠ n̪ˠ rˠ], slender→[lʲ nʲ ɾʲ].
- **Lenition** (séimhichte digraphs): bh mh→[v], ch→[x]/[ç], dh gh→[ɣ]/[j], th sh→[h], fh→∅, ph→[f].
- **Vowels**: a→[a], à→[aː], e→[e], è→[ɛː], é→[eː], i→[i], ì→[iː], o→[ɔ], ò→[ɔː], ó→[oː], u→[u], ù→[uː];
  ★ ⟨ao⟩→[ɯː] (the SG signature vowel), ⟨eu⟩→[iaː], ⟨ia⟩→[iə], ⟨ua⟩→[uə]. Digraphs are dialect-variable.
- First-syllable stress; unstressed short vowels → [ə] (obair→opəɾʲ).

## Run 3 — build + tune (2026-07-27)

Self-contained scanner (scottishgaelic.ts) adapting the Irish broad/slender approach (Irish's engine is
lexicon-bound + diverges on the values, so isolating it avoids regressions — the Faroese-vs-Icelandic
pattern) + a pre-aspiration pass. A shared Goidelic scanner refactor is a future altitude improvement.
- **v1** (broad/slender + lenition + pre-asp + vowel clusters): 10.9% folded / 61.4% symbol.
- **v2** (slender ⟨t⟩ is FORTIS [tʲʰ]; slender ⟨n⟩→[ɲ]; pre-asp GATED to only fire after a vowel/sonorant —
  asta→as̪t̪ not as̪ht̪; slender c/t pre-asp → [ç] not [x] — aice→açkʲ; ⟨eò⟩→[jɔː]): 12.3% / 64.1%.
- **+ velarization fold** (ˠ — the multi-dialect referee marks it very variably; the broad/slender CONTRAST
  survives via dental/ʲ/segment identity): **15.1% folded / 67.0% symbol**.

**Final: 15.1% folded / 67.0% symbol** on wikipron gla_latn_broad (6000). ★ **The folded % is a MULTI-DIALECT
ARTIFACT, NOT a quality signal** — the referee has 4+ transcriptions per word (Ailean → a-l-a-n / a-l-a-ɲ /
ɛ-l-a-ɲ / ɛ-l-ɛ-ɲ), so RAW EXACT is 0.3% (19/6000) and our single output can match only one variant. **Symbol
accuracy 67.0% is the honest (modest) signal** — and the native-only (lowercase) subset is 67.0%, so it is NOT
name-dragged; it is the genuine multi-dialect ceiling. Validation of the core: the unstressed reduction (14.2
vs 9.8 folded / 66.1 vs 60.9 symbol with it OFF), pre-aspiration, and broad/slender are all net-POSITIVE and
spot-checked correct (mac→maxk EXACT, cat→kʰaht̪, balach→pal̪ˠəx). The residual is the **semi-lexical vowel
detail** (⟨ea⟩ [ɛ]~[a], ⟨ui⟩ [u]~[ɯ], ⟨ao⟩, the a~ə reduction split — exactly what Irish defers to a
pronunciation lexicon) + the extreme dialect variation. 🔷 single-source family, referee-limited (the Irish
situation, MORE extreme). A pronunciation lexicon (the Irish Connacht-lexicon path) is the route to higher.

## Run 4 — 2-agent review (2026-07-27)

**Phonology reviewer — core CONFIRMED** (probed ~60 words vs documented SG phonology): pre-aspiration core
(initial aspirated, medial/final [hp ht̪ xk], velar [x] vs palatal [ç] split for broad/slender c, de-asp after
/s/), ⟨b d g⟩→lenis [p t̪ k] (the correct point of divergence from Irish), the broad/slender values, lenition
defaults, and the vowels (ao→ɯː, eu→iaː, ia→iə, ua→uə + accented longs) all CORRECT; ⟨ea⟩/⟨ui⟩ genuinely
lexical (no clean better default). Drove **3 fixes** (+0.9pp folded / +0.9pp symbol → 15.1% / 67.0%):
- ★ **⟨chd⟩→[xk]** (B1, also flagged by the code reviewer — the highest-value fix): a dental stop after [x]/[ç]
  → [k] (bochd→pɔxk, seachd→ʃɛxk; the productive -achd nominal suffix). Was rendering the WRONG final consonant.
- ★ **pre-aspiration removed after NASALS** (B2): it fires only after a vowel or a LIQUID l/r, not a nasal
  (annta→an̪ˠt̪ə, cainnt→kaɲt̪, cunntas→kun̪ˠt̪əs̪ — the post-nasal fortis stays plain, the documented behaviour).
- ★ **slender ⟨t⟩ pre-asp → [htʲ] not [çtʲ]** (B3): the [ç] frication is dorsal-specific; the coronal fortis
  takes a plain [h] (bhite→vihtʲ). Slender ⟨c⟩→[çkʲ] kept (correct).
- DEFERRED (dialect-variable / lexical): the word-final ⟨-aidh/-aigh⟩ [j]-offglide (taigh→[t̪ʰɤj] — currently
  the silent-final-gh rule drops it; the reviewer's 2nd-ranked missing rule, but [ɤj]/[əj]/[i] dialect-split);
  final ⟨-ubh⟩ vocalization (dubh→[t̪u], lexical); slender ⟨ll⟩→[ʎ] (register-variable); the coda-cluster
  slenderness of a final ⟨t⟩ after ⟨inn⟩ (cainnt final t broad vs the referee's slender [tʲ]).

**Code/wiring reviewer — CLEAN, no blocking bugs.** Verified: the pre-aspiration pass has no "raw ʰ survives"
leak (fortis-after-fortis correctly de-aspirates via left-to-right rewrite: actair→axkt̪əɾʲ); the ˠ fold does
NOT collapse broad/slender (each ˠ-consonant keeps a 2nd distinguishing mark — l̪ˠ→l̪ vs lʲ, rˠ→r vs ɾʲ); the
b→p/d→t/ɡ→k folds are NOT two-way merges (the engine never emits a bare voiced stop). ★ HONESTY CAVEAT
acknowledged (not a bug): the `[ɛe]→e` / `[ɔo]→o` folds (the Irish ga.jsonc precedent) DO merge the arguably-
phonemic SHORT /e/~/ɛ/ and /o/~/ɔ/ the engine produces → they modestly inflate both the folded and symbol %
(the long eː/ɛː, oː/ɔː keep ː and survive) — now DISCLOSED in the fold notes. Referee join clean (6000 rows).
Wiring/counts/columns all correct.

**Final: 15.1% folded / 67.0% symbol. 🔷 single-source family, REFEREE-LIMITED (multi-dialect). Floor 0.12.**
Full suite green, typecheck clean. The path to higher is a pronunciation lexicon (the Irish Connacht-lexicon
path) for the semi-lexical vowel detail.

## Run 5 — cardinal numbers (2026-07-29)

**Question.** `phonemize("<int>", "gd")` leaked the digit string (numbers deferred at bring-up). What numeral
system should a gd compositor emit, and do the numeral words survive the rule engine?

**Command.** `npx tsx <scratch>/numwords.mts gd` (every candidate numeral standalone), then
`npx tsx <scratch>/probe.mts gd` (0–100 + 101/111/555/999/1000/1001/12345/1e6/1e9).

**Raw findings.**
- All 34 candidate numeral words phonemize non-empty through the existing engine. Spot values: `ceud`→[kʲʰˈiaːt̪],
  `cheud`→[çˈiaːt̪], `mìle`→[mˈiːlʲə], `mhìle`→[vˈiːlʲə], `dhà`→[ɣˈaː], `dà`→[t̪ˈaː], `deug`→[tʲˈiaːk],
  `dheug`→[jˈiaːk], `h-aon`→[hˈɯːn̪ˠ] (the hyphen is stripped by phonemizeWord, so `a h-aon` reaches the g2p as
  h+vowel — no special casing needed). `neoni`→[ɲˈjɔɲə] (engine's ⟨eo⟩→jɔ; acceptable).
- The elided written connector ⟨'s⟩ does NOT survive tokenization: the gd TOKEN regex requires a word to START
  with a letter, so a leading apostrophe is dropped and a bare `s` would be emitted as [s̪]. → emit the full
  ⟨agus⟩ instead. Same lexical content, no stray segment.
- **DECIMAL vs VIGESIMAL (the judgment call).** Gaelic keeps a live vigesimal series (dà fhichead 40, trì fichead
  60). Rejected for a TTS: it changes base mid-number, and `fhichead` is lenited-silent-f, so 40 would read as
  [ɣaː içət̪]-shaped and be hard to reconstruct as a figure. The modern decimal series (ceathrad, seasgad,
  naochad) maps one round ten to one word. Decimal only; the vigesimal option is never emitted.
- **The ga/gd mutation divergence, confirmed as the substantive difference from the Irish compositor.** Irish
  eclipses a magnitude after 7–10 (naoi gcéad); Gaelic has no eclipsis, so 900 = `naoi ceud` bare, and only ⟨dà⟩
  lenites (dà cheud, dà mhìle). This is now the pinned test case.
- First composition pass emitted `ceud a h-aon` for 101 (Irish-style, no connector) while 21 used ⟨agus⟩ —
  inconsistent. Fixed with an `attach` rule: the connector appears iff the remainder is a bare counting numeral
  (starts with the ⟨a⟩ particle) — `ceud agus a h-aon`, `mìle agus a naoi`, but `mìle naoi ceud naochad agus a
  h-ochd` (the remainder opens with its own hundreds word).

**Result.** Probe CLEAN for the whole target set. Implementation: `src/languages/scottishgaelic/numbers.ts`
(Pattern B — bespoke, Goidelic two-series + mutation), data in `scottishgaelic.jsonc` `numbers`, cited to Colin
Mark, *The Gaelic-English Dictionary* (2003) + LearnGaelic.

**Implication / left open.** Same known limitation as the Irish compositor: a magnitude count in the TEENS is
composed (`a h-aon deug mìle` for 11,000) rather than idiomatic (`aon mhìle deug`). The multi-dialect wikipron
gla referee has no multi-word numerals, so the lenition rule for a magnitude sitting between the numeral and
⟨deug⟩ cannot be corroborated. Wants a native check before changing.
