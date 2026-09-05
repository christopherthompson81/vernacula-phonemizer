# Bishnupriya Manipuri (bpy) native bring-up investigation

Target: **Bishnupriya Manipuri** (বিষ্ণুপ্রিয়া মণিপুরী / ইমার ঠার) — an EASTERN
INDO-ARYAN language (~120k, Assam/Tripura in India + Sylhet division of Bangladesh),
written in the **Bengali / Eastern-Nagari abugida**. Heavily contact-shaped by Meitei
(Manipuri, Tibeto-Burman) but structurally Eastern Indo-Aryan — close to Bengali/Sylheti/
Assamese. Canonical IPA, espeak-independent. The fleet already covers Bengali (bn ✅),
Assamese (as), and Sylheti (syl) in this script family → bpy is a 4th Eastern-Nagari member.

## Run 1 — referee landscape (2026-07-27)

- **wikipron**: no `bpy` set.
- **kaikki**: no standalone Bishnupriya extract (a handful of entries only).
- **epitran**: none.
- **English Wiktionary** "Category:Bishnupriya Manipuri terms with IPA pronunciation":
  **39 members** via the MediaWiki API (the chv/quc avenue). All 39 carry a literal
  `{{IPA|bpy|…}}` → HUMAN attestation, not module-generated. → the ONLY referee.
  - ~9 are single-letter VOWEL DEFINITIONS (অ→ɔ, আ→a, ই→i, উ→u, এ→e, ঐ→ɔiː …) —
    reference-parity (the orthography→IPA spec itself), near-circular.
  - ~29 are real words, heavy on the NUMERALS (three তিন, four চার, five পাঁচ, six ছয়,
    seven সাত, eight আট, nine নয়, ten দশ, twelve বারো, twenty বিশ, thousand হাজার) plus
    jackfruit/rabbit/boat/spider/sea/soil/love/mountain/dust/star.
  → 🔷 single-source, THIN (38 pairs, ~29 real). The % is a real signal on a small sample,
    NOT a breadth claim.

Dropped the one two-word phrase (অন্ধ্র প্রদেশ "Andhra Pradesh") — the eval is single-word.

## Run 2 — the phonology (read off the referee)

bpy in this referee is strikingly **Bengali-like** (NOT Assamese-like):
- **Sibilants শ/ষ/স → [ʃ]** (সাত→ʃat, সমুদ্র→ʃɔmudɾo, বিশ→biʃ) — Bengali's [ʃ], NOT the
  Assamese velar [x].
- **Retroflex ট→[ʈ]** preserved (আট→aʈ, মাটি→maʈi, কাটা→kaʈa) — Bengali, not the Assamese
  alveolar merger. Dental ত/দ → t̪/d̪.
- **Affricates চ→[t͡ʃ], ছ→[t͡ʃʰ], জ→[d͡ʒ]** (চার four, ছয় six, হাজার thousand) — Bengali keeps
  them; the referee writes them with a RETROFLEX tinge ⟨ʈʃ ʈʃʰ⟩ (ʈʃar, paʈʃ, bɔʈʃʰor) → a
  transcription-convention FOLD (ʈʃ~t͡ʃ), not a real place contrast.
- **Inherent vowel /ɔ/**; **word-final inherent deletion** after a single C (ফল→pʰɔl, দশ→dɔʃ,
  আট→aʈ) but RETAINED as [o] after a cluster (সমুদ্র→ʃɔmudɾo, বছর→bɔʈʃʰor) — the Bengali rule.
- **NO Bengali height harmony**: the inherent /ɔ/ does NOT raise before a following high/mid
  vowel (সমুদ্র→ʃɔmudɾo, not ʃomudɾo) — so `heightHarmony:false` (Assamese-like on this one axis).
- Medial inherent deletion DOES apply (খরগোশ→kʰɔrɡoʃ, the র's ɔ drops) → `medialSchwaDeletion:true`.
- Diphthong offglides: ছয়→t͡ʃʰɔi, নয়→nɔi, দুই→d̪ui, নৌকা→nou̯ka (ঔ/ৌ→ou) — the referee marks the
  offglide non-syllabic (ɪ̯/u̯); we render the plain vowel → fold the U+032F mark + ɪ~i / ʊ~u.
- Stress: the referee marks initial primary + a secondary (ˈkʰɔrɡoʃ, ˈbʰaloˌbaʃa) → backbone-folded.

**Architecture:** reuse `makeNativeBengali` (the shared Eastern-Indic abugida engine) with a
bpy manifest = Bengali consonant values + `heightHarmony:false`, `skipLexicon:true`, exactly the
Assamese wrapping pattern (src/languages/bishnupriya/). No new engine code.

## Run 3 — build + tune (2026-07-27)

Wrapped `makeNativeBengali` with a bpy manifest (Bengali consonant values + `heightHarmony:false`,
`skipLexicon:true`); no extra engine pass (unlike Assamese, whose deaffricated t/d/s/z/x need their own
geminate collapse — bpy's inventory IS Bengali's, so the Bengali engine's geminate pass already covers it).

- **First pass (no config folds beyond dots):** 57.9% folded / 85.5% symbol. Residuals all notational.
- **+ notational folds** (rhotic r~ɾ; post-vocalic glide→offglide j~i for ছয়/নয়; voiced-breathy dʰ~dʱ;
  glottal h~ɦ; ʈʃ~t͡ʃ affricate place; ɪ~i/ʊ~u/ɑ~a): **81.6% folded / 94.5% symbol**.
- **Fixed a fold-order bug:** the eval's BACKBONE strips `ː` (both sides) BEFORE the config folds run, so a
  geminate fold that mapped doubled→length (`ll`→`lː`, the syl convention) re-added length only on the
  reference side (দিল্লী: ours `dili` vs ref `dilːi`). Changed it to collapse doubled→SINGLE (`ll`→`l`) to
  match our backbone-stripped output → **84.2% folded / 95.1% symbol** (32/38).

**Final: 84.2% folded / 95.1% symbol.** Residual (6, all 1×):
1. কঁঠাল→ours kɔ̃ʈʰal | ref kaʈʰal — the entry omits the আ matra but the referee gives the standard
   কাঁঠাল "jackfruit" [ka…]; a spelling/lexical variant, not rule-derivable.
2. বছর→ours bɔt͡ʃʰɔɾ | ref bɔt͡ʃʰor — the referee raises a RETAINED medial inherent /ɔ/→[o]. This is NOT
   Bengali height harmony (which keys on a following high vowel and would wrongly raise সমুদ্র→ʃomudɾo,
   which the referee keeps as ʃɔmudɾo). A minor "retained non-initial inherent → [o]" rule would fix it +
   help মাকড়সা, but on a 38-word referee that is overfitting → left as a disclosed residual.
3. বাঁহ→ours bãɦ | ref baɦa — the referee drops the ঁ nasalization AND retains the final inherent (baha).
4. বারো→ours baɾo | ref baɽo — the referee transcribes an intervocalic ⟨র⟩ as the flap [ɽ] (can't blanket-
   fold ɽ→ɾ: পাহাড়→pahaɽ where ⟨ড়⟩ IS [ɽ] and both agree).
5. ভালবাসা→ours bʱalbaʃa | ref bʱalobaʃa — a compound (ভাল+বাসা) boundary schwa our medial deletion drops
   but the referee retains as [o] (the lexical compound-boundary case, needs a lexicon).
6. মাকড়সা→ours makɔɽʃa | ref makorʃa — the retained-inherent [o]-raising (#2) + the intervocalic ɽ/r (#4).

**Honesty:** all 9 single-letter vowel DEFINITIONS match trivially (they ARE the orthography→IPA spec →
reference-parity, near-circular); the real-word folded subset is ~23/29 ≈ 79%. 🔷 single-source, THIN.

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — CLEAN, no bugs, no dishonest folds.** Confirmed: the registry foreign-Latin
routing (→en, like bn/as); the eval PHON entry is the honest non-circular path (skipLexicon:true makes
word()==rules, so no lexicon inflation — bpy correctly doesn't need bn's phonemizeWordRules dodge); the
wrapper correctly OMITS an Assamese-style geminate re-pass (the Bengali engine already covers it since the
inventory is Bengali). VERIFIED the geminate-fold direction claim: the eval BACKBONE strips ː BEFORE the
config folds (eval.ts makeFold), so the fold must collapse doubled→SINGLE (not →length) — correct. No fold
masks a phonemic contrast (crucially, there is NO ɔ→o fold, so heightHarmony:false is genuinely tested).
One nit APPLIED: the catalogue `family` column was "Indo-Aryan" → changed to "Indo-Aryan (Eastern)" for
parity with bn/as/syl/rkt.

**Phonology reviewer — all load-bearing decisions CONFIRMED, no wrong values.** (1) Bengali-not-Assamese
inventory: referee attests [ʃ] uniformly (no [x]), affricates kept, retroflex/dental split kept. (2)
heightHarmony:false is the decisive correct call — সমুদ্র→ʃɔmud̪ɾo (Bengali would raise to ʃomud̪ɾo) +
ঐ→ɔiː both point the same way, zero counter-evidence. (3) deletion rules referee-backed (ফল→pʰɔl,
খরগোশ→kʰɔɾɡoʃ, সমুদ্র→…d̪ɾo). (4) all vowel/diphthong/nukta values match the referee's letter-defs.

**The one deferred rule (documented for the future):** the "retained NON-INITIAL inherent /ɔ/ → [o]"
raising (বছর→bɔt͡ʃʰor, মাকড়সা→makorʃa). The phonology reviewer verified the scope is clean and strictly
+2/−0 on the referee (সমুদ্র's ɔ is initial → untouched; খরগোশ's is deleted → never reaches the rule),
and it mirrors real Bengali ([bɔt͡ʃʰor], [makorʃa]). It is MORE principled than pure overfitting — but with
no independent second corpus we cannot see a word where a non-initial retained /ɔ/ legitimately stays [ɔ],
so shipping it would apply it fleet-wide to unattested vocabulary unchecked. DEFERRED as "pending
corroboration" (the conservative choice, matching the Latgalian-coda / Basque-i-palatalization precedent) —
**this is the FIRST rule to add if a second bpy source ever appears.**

**Final: 84.2% folded / 95.1% symbol. 🔷 single-source, THIN. Both reviewers sign off as-is.** Floor 0.80.
Full suite 1337/1337, typecheck clean, DB rebuilt (implemented=180).


