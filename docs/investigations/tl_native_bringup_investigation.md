# Tagalog / Filipino (tl) native bring-up — investigation log

Tagalog — a shallow, near-phonemic Latin orthography → rule-based transliterator (tagalog.jsonc + tagalog.ts).
No wikipron tgl exists; referees are epitran tgl-Latn (INDEPENDENT, programmatic) + a 20-word adjudicated gold.

## Run 1 — 2026-07-15 — rule-based g2p + glottal stops → 🟡 (epitran 89%, gold 100%)

Built the module: digraphs (ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ, sy→ʃ, ll→lj, ts→t͡s) then single letters (c/q→k, j→d͡ʒ, r→ɾ,
y→j, …), the 5-vowel a e i o u, whole-word irregulars (mga→maŋa, ng→naŋ — given as orthographic respellings
manga/nang the g2p scans), penultimate stress, and compositional numbers.

GLOTTAL STOPS (the distinctive part): Tagalog ʔ is phonemic but mostly UNWRITTEN. Implemented the predictable
positions:
- word-INITIAL before a vowel (araw→ʔaɾaw, umaga→ʔumaɡa),
- INTERVOCALIC in vowel hiatus (tao→taʔo, maaari→maʔaʔaɾi, oo→ʔoʔo) — between two vowel LETTERS (the y/w glides
  are consonants, so ay/aw stay glides),
- HYPHEN → [ʔ] (pag-ibig→paɡʔibiɡ).

VALIDATION: epitran does word-initial ʔ but NOT the intervocalic ʔ, so once we added the (correct) intervocalic
rule the epitran agreement dropped 100→89% — and ALL 12 residual misses are epitran omitting the ʔ we add
(doon→doʔon, tao→taʔo, paa→paʔa …), i.e. WE beat the referee (gold-confirmed). The adjudicated common-word gold
is 100%. Status 🟡.

LEXICAL TAIL (the unwritten, lexicon-closable residual): word-FINAL glottal stops (bata 'child' [ˈbataʔ] vs bata
'robe' [ˈbata]) — not derivable from spelling; phonemic STRESS (magandá final vs default penult — the backbone
folds stress so it doesn't hit the eval, but the output is wrong on oxytones); a few Spanish-loan VV are glides,
not hiatus (Europa→ʔewropa), where the intervocalic-ʔ rule slightly over-applies. A pronunciation lexicon would
close the final-glottal + stress classes, exactly as for Indonesian's ⟨e⟩. Suite 36/36; typecheck clean.

## Review — 2026-07-16 — a real human referee + the word-final glottal-stop closure

The bring-up doc claimed "no wikipron tgl exists" — WRONG. wikipron ships **tgl_latn_broad (25,188 HUMAN entries)**,
which CORRECTLY marks the glottal stops the crude 109-word epitran omits (tao→taʔo, araw→ʔaɾaw, and the word-final
ʔ homographs bata→bata AND bataʔ). Replaced the crude epitran primary with wikipron (epitran demoted to a
secondary). The eval uses `phonemizeWordRules` (rule-only) so it's non-circular vs a wikipron-sourced lexicon.

**Rule-only vs wikipron = 77.3%** (was "89% vs crude epitran"). The drop is HONESTY, not regression — the 25k
human set is far harder + surfaces three tails, measured:
- **Word-final glottal stop (~1421 clean, the #1 gap)** — phonemic but UNWRITTEN (bata child [bataʔ] vs robe
  [bata]), so genuinely lexical. CLOSED on the SHIPPED path by a wikipron-sourced set (`final-glottal.txt`: all
  readings end in ʔ AND the rest of our rule output already matches, so the ONLY gap is the final ʔ; 540
  homographs abstained). Shipped `phonemizeWord` appends [ʔ] for these → **shipped 82.9%** (+5.6pp); rule-only
  stays 77.3% (the eval can't see it — correctly non-circular, the Indonesian ⟨e⟩ / Gujarati schwa pattern).
- **Ambiguous loanword VV** (Spanish -ia/-ua): the referee is genuinely 3-way — glide (baniaga→banjaɡa), plain
  (alegria→aleɡɾia), or ʔ-hiatus — for the SAME spelling. A rule suppressing the hiatus-ʔ after a high vowel was
  NET-NEGATIVE (77.3→76.9%), so it's not rule-derivable; left as documented lexical/loanword residual.
- **Proper-noun/surname idiosyncrasy** — the wikipron set is Filipino-surname-heavy; those pronunciations are
  idiosyncratic (referee-limited).

The NATIVE core is excellent (gold 100%); the 77.3% reflects the lexical/loanword/proper-noun tail on a large
human referee, not the common-word quality. STATUS 🟡: the final-ʔ lexical tail is now closed on the shipped path;
phonemic STRESS (unwritten) + the ambiguous loanword VV remain.

## Run — 2026-07-16 — the stress lexical tail (kaikki stress lexicon)

The remaining lexical tail flagged above was phonemic STRESS (unwritten in the orthography). Measured the
penult-default's error rate against **kaikki tgl (27,398 IPA entries, which mark stress explicitly with ˈ**;
abay→ˈʔabaj, abdomen→ʔabˈdomen — broad wikipron does NOT mark stress, so kaikki is the referee here):

- Penult-default is CORRECT on **77.3%** of single-stress kaikki words; **~23% stress elsewhere**, mostly FINAL
  (magandá, ngayón, salmón, doktór, and the plural marker mga = mangá).

CLOSED on the SHIPPED path with `stress-lexicon.tsv` (2,540 pins): kaikki words with a SINGLE confident stress
position (all readings agree — stress homographs like balík/bálik are ABSTAINED → penult default), vowel-count-
aligned with our segmentation so the 0-based stressed-nucleus index transfers safely. `phonemizeWord` applies it;
`phonemizeWordRules` (the referee eval) keeps the penult default — and the eval backbone FOLDS stress ˈˌ, so this
is a **shipped/TTS-quality closure invisible to the referee %** (the Indonesian ⟨e⟩ / final-ʔ pattern).

**Stress-inclusive accuracy vs kaikki (single-confident, 10,479 words):** rule-only penult **67.1%** → shipped
+lexicon **91.3%**. The residual 8.7% is honest abstention — words where our segmentation's vowel count differs
from kaikki's, so the index can't transfer without segment alignment (not pinned). Three naive-penult goldens
(maganda, ngayon, mga) were CORRECTED to their true final stress by the lexicon. STATUS 🟡→ the stress tail is now
closed on the shipped path; the ambiguous loanword VV (glide/plain/hiatus) is the last documented lexical residual.

**Review (PR #242) caught** a number-path stress leak: the digit path routed number words through
`phonemizeWordRules` (penult), so "2"→dalˈawa disagreed with the typed word dalawa→dalawˈa (dalawá IS final-stressed).
Fixed: numbers now take the stress lexicon via `phonemizeCore(wd, stressLex().get(wd))` while still bypassing the
final-glottal set (the #241 uniformity fix). Also hardened the lexicon parser to reject empty values (Number("")===0
would else pin the first vowel). **Pre-existing follow-up (NOT this PR):** the tens compositor is `units[t]+"pu"`
→ *dalawapu/tatlopu*, missing the irregular -ng- ligature (correct: dalawampú, tatlumpú, apatnapú, …); a separate
number-morphology task.

## Run — 2026-07-16 — native number morphology overhaul

The prior compositor was a naive `unit+"pu"` / space-join that produced wrong morphology at every tier. Probed
1–2,000,000 and pinned the correct native (Tagalog-origin, not Spanish) forms against **Wiktionary
Appendix:Tagalog_numbers**:

- **Teens 11–19** — one word with `labing-` + unit, irregular sandhi (ng→n/m, hyphen before vowels):
  labing-isa, labindalawa, labintatlo, labing-apat, labinlima, labing-anim, labimpito, labingwalo, labinsiyam.
  (was two words "labing isa".)
- **Tens 20–90** — irregular, with o→u raising (tatlo→tatlu, pito→pitu, walo→walu) and na/ng split:
  dalawampu, tatlumpu, apatnapu, limampu, animnapu, pitumpu, walumpu, siyamnapu. (was dalawapu/tatlopu/…)
- **Ligature -ng / na** (the productive multiplier linker before daan/libo/milyon): vowel-final → +ng
  (dalawa→dalawang, tatlo→tatlong, pito→pitong), consonant-final → + " na" (apat→apat na, anim→anim na,
  siyam→siyam na). Attaches to the LAST word of a multi-word multiplier (25000 → dalawampu't limang libo).
- **Hundreds** — sandaan (100); else ligate(unit) + daan, with **daan→raan after "na"**: dalawang daan (200),
  apat na raan (400), siyam na raan (900). (was "dalawa daan", missing -ng.)
- **Thousands** — sanlibo (1000); else ligate(mult) + libo: dalawang libo (2000), apat na libo (4000). (libo does
  NOT alternate to ribo.) Millions: ligate(mult) + milyon (isang milyon; no san- form).
- **Connector at→'t** — a single `joinRemainder(high, r)`: a sub-100 remainder attaches with "at", contracting to
  "'t" after a vowel (dalawampu't isa 21; sandaan at isa 101; sandaan at dalawampu't lima 125); a ≥100 remainder is
  space-juxtaposed (isang libo dalawang daan… 1234). VARIATION NOTE: Tagalog "at" placement in multi-group numbers
  varies in usage; this rule (at before every sub-100 tail) is the consistent/standard reading — Wiktionary's
  informal examples sometimes omit the medial "at" (1234), which is also heard.

**Review (PR #243) caught** the ligature's missing third branch: an /n/-final multiplier takes `-g` not `" na"`
(daan→daang), so 100,000 = sandaang libo (not "sandaan na libo"), 200,000 = dalawang daang libo. Only surfaced for
exact-hundred multipliers of thousands/millions (units are never n-final). Fixed + regression test.

## Run — 2026-07-16 — loanword phonology (lever 1: close the loanword class)

Bucketed the shipped residual (82.9%): a *systematic loanword class*, not diffuse noise. Tested every tempting fix
empirically (fixed−broken vs the unanimous-referee set) BEFORE shipping:

| candidate | Δ rule-only | verdict |
|---|---|---|
| **sy/ny palatal folds** ([ʃ]~[sj], [ɲ]~[nj]) | **+3.9%** | notation (same syllable count) → FOLD in eval, no output change |
| **z→s** (no native [z]) | +0.17% | safe RULE |
| **geminate ⟨rr⟩→ɾ** | +0.13% | safe RULE |
| ⟨iy⟩→[j] / ⟨uw⟩→[w] (drop spurious vowel) | **−0.02% / 0.0%** | NET-NEGATIVE — breaks native [ij] (kaniya) → lexicon only |
| Spanish ⟨j⟩→[h] | 0.0% | breaks native [d͡ʒ] as often → lexicon only |
| ⟨ll⟩→[l] | −1.49% | ⟨ll⟩→[lj] is the better default (English-name [l] is minority) |

Rules+folds took **rule-only 77.3→81.5%, shipped 82.9→87.1%**. The net-negative glide/j rules confirmed the
origin-ambiguity the doc warned about (SAME spelling = native [ij]/hiatus-ʔ vs loanword glide/plain).

**KEY FINDING (adversarial review caught this): the broad VV/glide/hiatus class is NOT safely mineable.** A first
cut pinned 2,129 words via a neutralizing fold that collapsed `ij→i` and stripped `ʔ` — which reported a shiny
**95.6% shipped, but was ILLUSORY**: those folds are entangled with NATIVE phonology (the glide in *siya*→[sija],
the phonemic hiatus ʔ in *tao*→[taʔo]), so the referee's *reduced* readings of native words satisfied "in-class"
and got pinned — corrupting core vocabulary (*siya*→[sia], *kaniya*→[kania]). Unanimity gives no protection (a
single-reading row is trivially unanimous). **You cannot mine this class from a referee without a native/loan
discriminator, which spelling does not provide.**

The genuinely SAFE, closable subset is the **foreign-segment** class only — Spanish ⟨j⟩→[h] (abenojar→abenohaɾ),
soft ⟨c⟩→[s] (abece→abese) — origin-specific (native Tagalog has neither), so pinning never touches native words.
`loanword-lexicon.tsv` = **115 words**, built by applying the orthography-gated foreign op to OUR OWN shipped-no-loan
output (so pins inherit our stress + final-ʔ — fixing the forced-penult regression the review also caught, e.g.
kampeón/león), kept only where all wikipron readings agree AND the op matches the referee; a NATIVE-CANARY guard
(siya/tao/…) aborts generation if the mining ever pins a native word; baselined against `phonemizeShippedNoLoan`
(not phonemizeWord) so regenerating is idempotent. SHIPPED-only → eval non-circular. gen:
`tools/referee-eval/gen-tl-loanword-lexicon.ts`.

**HONEST result: rule-only 77.3→81.5%, shipped 82.9→87.6%** (not 95.6%). Native words verified uncorrupted
(siya/kaniya/tao/mabuti/maganda unchanged). The VV/glide/hiatus loanword class remains a documented residual —
genuinely ambiguous with native phonology, not mineable.

STATUS still 🟡 (not ✅): the shipped closures have an OOV tail on the unwritten contrasts (final-ʔ, stress) —
structurally identical to Indonesian ⟨e⟩ / Indic schwa. A stronger, better-measured 🟡, not a promotion.

## Run — 2026-07-16 — foreign-word detector: tested, rejected; offglide fold instead

Q: would a foreign-word detector (tag non-native words, then gate the rejected loanword rules on it) help?
Prototyped a phonotactic detector (loan letters c/f/j/q/v/x/z/ñ, ll/rr, Spanish affixes, non-native clusters) and
tested gating. **It does not help:**
- intervocalic-ʔ suppression gated on foreign STILL breaks 277 native hiatus words (imprecise; false positives —
  *maganda* tagged foreign from its medial `nd`).
- for the glide over-generation, UNGATED beats gated (the tag costs more fixes than it saves: 713 vs 423 fixed).
- the residual ambiguity is native-vs-native, not native-vs-foreign: the referee renders native *siya*→[sia] but
  native *hiyip*→[hijip]. Foreignness is orthogonal, and the 🟡 anchors (final-ʔ minimal pair bata/bata, stress)
  are native contrasts. The foreign-SEGMENT part (⟨j⟩/⟨c⟩) is already closed by the 115-word lexicon.

The probe DID surface that the [ij]/[i] glide difference (713 words) is NOTATION/explicitness, not error: our
explicit [ij] (siya→[sija], diyos→[dijos]) is arguably *more* correct than the referee's under-specified [sia] (per
the explicitness principle), and the referee proves it non-contrastive by using both for native words. A *rule*
(ij→i) would degrade native *siya*→[sia]; the honest close is a **FOLD** (ij~i, uw~u before a vowel — the sy/ny
pattern, and the Bulgarian offglide steer: keep the explicit glide in OUTPUT, fold for comparison). **rule-only
81.5→87.0%, shipped 87.6→93.1%**, ZERO output change (siya stays [sˈija]). Floor 0.80→0.86.

Still 🟡: the fold closes notation; the unwritten NATIVE contrasts (final-ʔ, stress) remain OOV-bounded.
