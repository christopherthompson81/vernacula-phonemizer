# Egyptian Arabic (arz) bring-up investigation

First Arabic VARIETY (after MSA `ar`). Design: shared Arabic engine (scanner + diacritizer + numbers) + per-variety
DATA (consonant/vowel maps, phonological rules), registered under its own ISO code `arz` (NOT a runtime variety
flag — the registry/referee/eval/maturity all key on flat codes; precedent: hi/gu/ur share one abugida engine under
distinct codes). Referee: wikipron arz_arab_broad (HUMAN, 800 entries, fully-voweled DIALECTAL IPA — INDEPENDENT).

## Run 1 — 2026-07-17 — baseline: current MSA engine vs the Egyptian referee

The MSA engine (neural diacritizer → MSA g2p) scores **28.6%** folded (590 words) against the Egyptian referee.
The residual is exactly the Egyptian character, in three tiers:

- **DETERMINISTIC consonant shifts** (the signature, easy win): ق→[ʔ] (بقى baq→baʔ, ×18), ج→[ɡ] (×16). Also ث→t,
  ذ→z/d, ظ→zˤ/dˤ (classic Egyptian mergers).
- **DIPHTHONG monophthongization** (rule-ish): MSA [aj]→[eː] (ألفين alfajn→alfen, ×11), [aw]→[oː] (أوضة awdˤ→odˤ, ×5).
- **SHORT-VOWEL restructuring** (the hard tail, like Urdu): ∅→a / a→∅ / i↔a / u↔i (Egyptian syllable structure +
  imāla a→æ + mid-vowel raising differ from MSA). The MSA diacritizer restores MSA vowels — wrong for Egyptian — so
  this tail needs a wikipron-arz-mined VOWEL LEXICON (the Urdu/id pattern), with MSA-restore+transform as OOV fallback.

Plan: Phase 1 = Egyptian consonant g2p + diphthong monophthongization (deterministic → big jump). Phase 2 = the
dialect vowel lexicon. Consonants first — they are what make it *sound* Egyptian and are unambiguous.

## Run 2 — 2026-07-17 — Phase 1: Egyptian consonant + diphthong g2p

Built the variety architecture: shared Arabic engine + `egyptian.jsonc` (ordered IPA shifts) + `createArabic(variety)`
+ registered `arz` (distinct ISO code, NOT a runtime flag). Shifts: ج→ɡ, ق→ʔ, ث→t, ذ→d (also ظ ðˤ→dˤ), ay→eː, aw→oː.

**Result: 28.6% (MSA baseline) → 37.3% folded** vs the Egyptian referee (+8.7pp). The consonant/diphthong shifts
land exactly. The residual is now the predicted VOWEL tail:
- short-vowel QUALITY (i↔a, u↔o, u↔i) — MSA diacritizer restores MSA vowels, not Egyptian;
- word-initial ʔ over-generation (ʔabril vs abril);
- imāla (aː→æ in some contexts);
- loan ج=ʒ (French loans keep [ʒ]; our blanket ج→ɡ is wrong for those — a lexical tail).

Phase 1 = the architecture + the deterministic consonants (what makes it SOUND Egyptian). Phase 2 = a
wikipron-arz-mined VOWEL LEXICON (the Urdu/id pattern) to close the short-vowel restructuring. 🟡 (Phase-1).

## Run 3 — 2026-07-17 — Phase 2 (vowels) is DATA-BLOCKED, not algorithm-blocked

Phase 2 was meant to close the short-vowel restructuring with a dialect vowel lexicon. It has no tractable lever:

- **Vowel RULES are all net-negative** (tested vs the arz referee, fixed−broken): imāla aː→æ **−55**, short a→æ
  **−157**, i→e **−32**, u→o **−12**, word-initial ʔ-drop **−7**. The Egyptian vowel changes (imāla, short-vowel
  quality, epenthesis) are LEXICALLY/context conditioned, not derivable by a blanket rule — the tl/ur pattern.
- **A lexicon has no independent source.** The ONLY machine-readable Egyptian IPA is wikipron arz — and the full
  scrape is the SAME 590 words that ARE the eval referee. Mining a lexicon from it is circular (and 590 words is
  negligible coverage of 118M-speaker text). kaikki arz is sparse; there is no free Egyptian pronunciation corpus.
- The gap is also partly **restoration**: the shared MSA diacritizer under-vowels dialectal words (∅→V) and restores
  MSA (not Egyptian) qualities (i↔a, u↔o). An Egyptian diacritizer would need Egyptian diacritized training data,
  which likewise does not exist.

**Conclusion:** Egyptian **consonants** (the audible dialect character — ج→ɡ, ق→ʔ, ث→t) are done and verified
(37.3% vs an independent referee, up from 28.6% MSA-baseline). The **vowels** are a documented ceiling with current
data — recoverable in principle (a dialect diacritizer/lexicon *would* work), but no independent Egyptian corpus
exists to build or measure one. arz = consonant-correct / vowel-MSA-biased. 🟡 (a real path — more Egyptian data —
that is simply unavailable, like Urdu's restoration wall). Phase 1 was the tractable deliverable.

## Phase 2 — 2026-07-18 — the Egyptian short-vowel LEXICON (kaikki)

Found the Egyptian vowel data after all, in kaikki's **Egyptian Arabic** Wiktionary extract: 1183 entries, **876
with IPA** carrying the correct Egyptian vowels + reflexes (أنا /a.na/, مصر /masˤr/, قط /ʔʊtˤtˤ/). Built
`egyptian-lexicon.tsv` (**554 words**, word→canonical Egyptian IPA): cleaned the IPA (strip slashes/dots),
collapsed geminates to ⟨Cː⟩, normalized narrow→broad (æ/ɪ/ʊ→a/i/u — the notation half of the residual), and
placed a Cairene stress mark before the stressed vowel. Validated **~88–92% against the wikipron-arz referee**
(the residual is notation: initial-ʔ + remaining narrow marks). Wired into `phonemizeArabic` (egyptian variety):
the tokenizer strips harakat to recover the bare key and substitutes the lexicon IPA before the g2p — works
per-word in sentences too (أنا من مصر → ana min masˤr).

**Non-circular split:** kaikki and the wikipron-arz referee share the Wiktionary tradition (95% agree on the 563
shared words), so the eval scores the RULE path (`lexicon:false`, 37.3% unchanged); the lexicon is a SHIPPED
refinement. It fixes the common-word core (مصر, أنا, ازاى, تلفزيون…) where the MSA diacritizer gave MSA vowels;
the OOV Egyptian tail remains → still 🟡. This is Phase 2a (a curated common-word lexicon), not a full solution.

**Farasa (evaluated, rejected on licensing).** QCRI's Farasa has a multi-variety neural diacritizer (the 2019
"Four Varieties" system) that could diacritize large Egyptian text at scale → a Phase-2b silver corpus. But: (a)
the dialect diacritizer is **not** in the downloadable JAR (MSA-only there; farasapy exposes only `diacritize()`),
it's an API/demo; and (b) the Farasa license is **"research purpose only; non-research use → contact QCRI"** —
more restrictive than CC BY-NC, so it fails this repo's permissive-data policy and would taint the training
provenance. Rejected for the pipeline unless QCRI grants explicit permission. The same group's ACL-2024 paper
("Beyond Orthography") also warns text-based dialect diacritizers are unreliable vs speech — they went acoustic.
kaikki (CC BY-SA) is the clean source; a larger permissive Egyptian corpus remains the real Phase-2b lever.

## Phase 3 — 2026-07-18 — the Egyptian NEURAL diacritizer (calima-egy teacher → silver → student)

Found the scale lever after all — CAMeL Tools `calima-egy` (GPL) diacritizes Egyptian at scale, and per ADR-0014
a model trained on its *outputs* is clean (facts-not-expression; GPL doesn't propagate to a silver-trained
student — the same teacher→student pattern the MSA diacritizer used with the Apache CATT teacher). Pipeline (RTX
3090, camel-tools venv, /mnt/data/arz-diac): extract **Masri Wikipedia** (CC-BY-SA, 350k sentences) + the **MIT
dialect-corpus** Egyptian subset (90k) → `calima_egy_silver.py` (calima-egy analyzer + MIT BERT disambiguator →
diacritized silver, **6 parallel GPU workers**, 99% util) → OOV-filter + 90/5/5 split (222,888 train) →
`train_bilstm_sent.py --pausal 1` (silver-only, same arch/alphabet as MSA) → int8 ONNX (15 MB). **TEST DER
1.63% / WER 4.70%** — better than the MSA student (2.17%). Wired variety-aware (`createArabicDiacritizer(variety)`
loads diacritizer-egy for egyptian, MSA fallback).

Result: the diacritizer restores Egyptian vowels + reflexes on running text (قلب→ʔalb, رحت→ruħt, النهاردة→
nahaːrda, مدرسة→madrasa). **NON-CIRCULAR**: the referee is wikipron, the teacher is calima-egy — different
traditions — so the rules-only **37.3→39.5%** lift is independently anchored. The referee undercounts the model's
true quality (1.63% DER) because it is ISOLATED citation words while the model trained on running text and hedges
on isolated forms (مصر→miṣr, hamza-less انا→naː); the shipped path's kaikki lexicon supplements exactly those
isolated common words. This is the MSA pattern (neural running-text model + a citation-form lexicon supplement),
now for Egyptian, from fully permissive corpus + a GPL-offline teacher.

**Farasa vs calima-egy (why calima-egy won):** both are Arabic dialect diacritizers, but Farasa's is
research-license-only (fails the permissive-data policy even for offline silver) and API/JAR-MSA-only; calima-egy
is GPL (not non-commercial), usable offline for silver under ADR-0014, with a clean permissive corpus.

## Run — 2026-07-18 — the "unlockable" hamzat-al-waṣl fix (short-vowel restoration → a masked g2p bug)

The user's memory: *once a method restores short vowels in an abjad, other findings become unlockable.* Confirmed.
Ran `eval.ts arz --examples 45` and read the RESIDUAL DIVERGENCE CLASSES (not the headline %). The dominant
non-lexical class was a **spurious word-initial glottal stop**: `ʔana≠an`, `ʔibtasam≠ibtasam`, `ʔitbasatˤ≠itbasatˤ`
— the ONLY difference in a large class was a leading `ʔ` our g2p emitted and the referee omitted.

Root cause (g2p.ts): word-initial **bare alif** ا is **hamzat al-waṣl** (a connecting/elidable seat), NOT a glottal
stop — it should surface as a plain VOWEL onset. Only the hamza-CARRIERS أ إ آ ء (CONS→ʔ) and ALIF_MADDA آ carry a
real [ʔ]. Discriminator (measured on the referee): of 50 bare-alif-initial words, 42 (84%) start with a VOWEL in
the referee; of 45 hamza-alif words, 40 (89%) KEEP the ʔ. Clean orthographic split → a principled fix, not a heuristic.

Two entangled sub-bugs, both fixed:
1. **bare alif + harakat** (diacritizer voweled it, e.g. اِبْتَسَم) → was `ʔ`+vowel; now vowel only.
2. **bare alif with NO harakat** — the MSA Tashkeela restore-lexicon writes the waṣl vowel UNwritten (احْتَاج، اسْم),
   so line 169 didn't fire and the alif was DROPPED entirely (`ħtaːɡ`, `sm`). Now defaults to the waṣl vowel **[i]**
   (اسم→ism, استخدم→istaxdam, arz istaxdim).
3. **the definite article** الـ — the alif is also waṣl → `ʔal`→`al` (both referees: القمر→alqamar, arz→ilqaːhira; the
   ʔ in الأحد→alʔaħad is the FOLLOWING word's hamza, not the article's).

This is a SHARED g2p fix (bare-alif handling), so it helps **both** dialects — and MSA more than Egyptian:

| referee | before | after | Δ |
|---|---|---|---|
| arz wikipron (primary) | 39.5% | **41.7%** | +2.2 |
| ar wikipron (primary)  | 57.4% | **65.3%** | **+7.0** |
| ar kaikki (secondary)  | 62.6% | **70.5%** | **+7.0** |

**Running-text test (the user asked):** phonemized 5 connected Egyptian sentences end-to-end (the diacritizer's real
strength is in-context, unlike the isolated-word referee). Coherent, and both fixes visibly correct in context:
المدرسة→almadrasa, الكتاب→alkitaːb, الدرس→adːars (sun-assim, no ʔ), استخدم→istaxdam, دلوقتي→dilwaʔti (ق→ʔ),
الجو→algoː (ج→ɡ, aw→oː), اللي→illi, احنا→iħna. Residual is the known short-vowel-QUALITY tail (انا→inaː should be
ana; نتكلم vowel) — lexical, not structural. Floors raised ar 0.55→0.62, arz 0.35→0.40. arabic tests updated (the
article no longer carries ʔ) + all pass.

**Remaining arz tail (documented, not fixed):** Egyptian **il-** article-raising (a→i) is a real Egyptian feature but
only 3 al-initial words in the 590-word referee → low eval-ROI and needs variety-aware g2p (the string-rewrite
variety layer can't tell an article `a` from any other word-initial `a`); folded into the short-vowel-restructuring
tail for now. The bigger tail is unchanged: Egyptian short-vowel QUALITY (the MSA diacritizer restores MSA vowels).

## Run — 2026-07-18 — residual rounds: what's diacritizer-fixable, + the il- article + a silver scale-up

**Round 2 (ar/arz residual triage).** MSA (`ar`) has hit the WALL for systematic g2p fixes: the residual is diffuse
diacritizer vowel-QUALITY noise + pausal convention (the final `-an`~`-aː` class is the adverbial accusative — ours
gives the correct PAUSAL [aː], the referee the context [an]; a blanket fold over-matches root -an like حسن→hasan, so
it's not a bug). arz residual classified by whether harakat can even EXPRESS the fix (of 359 mismatches): **87 (24%)
vowel-only a/i/u — HARAKAT-FIXABLE via the diacritizer**; **100 (28%) involve o/e — NOT expressible** (و=[o]~[uː]
script ambiguity → lexicon territory, and a chunk is really the referee's æ notation for /a/ = a fold); 172 skeleton-
differs (missing/extra vowels + gemination). So the vowel-quality wall is a DIACRITIZER problem, not a rule problem.

**Teacher probe (decisive).** Ran calima-egy (the independent teacher) on the failing words, isolated + in context:
استخدم→اِسْتَخْدِم=**istaxdim** ✓, امبارح→إِمْبارِح=**imbariħ** ✓ — the teacher KNOWS the right Egyptian vowel where our
STUDENT model gave istaxda**m** / imbar**ħ**. Those words are rare/absent in the 350k-line silver we trained on → the
student UNDER-FIT from sparsity, not teacher error. But افتكر→teacher aftikir ≠ referee iftakar (genuine teacher-vs-
Wiktionary convention, unfixable via this teacher without going circular), and the article النهارده→النَّهارْدَه is
written with a BARE alif (no kasra) → the teacher does NOT encode il-, so that is NOT diacritizer-learnable.

**Action A — silver SCALE-UP (non-circular).** We silvered only 350k of the 2.67M-line corpus_arz.txt (7.6× headroom).
Launched `run_pipeline_v2.sh`: 6 parallel resumable shards over the FULL 2.67M lines (~63 s/s each, GPU 99%, ~2 h) →
`filter_split_v2.py` (dedupes vs the old silver) → retrain BiLSTM → export to `diacritizer-egy-v2.onnx` (A/B, does NOT
clobber v1). Expected to recover the teacher-right/student-wrong chunk (istaxdim, imbariħ) NON-CIRCULARLY (teacher =
calima-egy, referee = wikipron). REJECTED the targeted-kaikki-pairs alternative — it injects Wiktionary and makes the
wikipron eval circular; only valid as a shipped refinement, not an eval anchor.

**Action B — the il- article g2p rule (shipped this round).** Egyptian article is [il-] (assimilating: in-, iʃ-), not
MSA [al-]. Since the teacher writes the article bare, this is a G2P VARIETY rule, not learnable from silver. Tagged the
definite-article nucleus at emit time (`Seg.article`) and raise it per-variety (`egyptian.jsonc articleVowel:"i"`) in
the pre-join build — a string replace can't tell an article [a] from any word-initial [a]. القمر→ilʔamar, الشمس→iʃːams;
MSA unchanged. Eval +0.2pp (only 3 al-words in the 590-word referee, and القاهرة/النهارده still miss on ق→ʔ / no-assim
vs the referee's conservative transcription) — the value is TTS correctness (explicitness principle), not the number.

## Run — 2026-07-18 — rebuild the Egyptian vocalization lexicon (554 → 714, correctness fixes)

The shipped egyptian-lexicon.tsv (the short-vowel/vocalization layer, `lexicon:true`) was found to carry MSA
ARTIFACTS: أجر → ʔad͡ʒr (MSA d͡ʒ; Egyptian is ʔaɡr), أسانسير → ʔasˤansˤeːr (spurious emphatic sˤ; should be ʔasanseːr).
The prior 554 were built through a flawed path (partly re-phonemized rather than taken from the source IPA), and the
lexicon value is returned DIRECTLY (no variety shift after), so those errors shipped verbatim.

REBUILT cleanly from the kaikki Egyptian-Arabic IPA (the authoritative Wiktionary source, CC BY-SA) — 876 IPA-bearing
entries → **714 shipped** (superset of the old 554, +160). Processing to the engine's convention: strip /./ and the
optional-glottal parens, prefer a stress-marked pron, **keep the majhūl o/e** (the lexicon's value-add — the abjad
g2p defaults و→uː/ي→iː and can't recover the loanword [o]/[e]: دكتور→duktoːr, أوتوبيس→ʔotubiːs), normalize kaikki's
NARROW transcription (æ/ɑ/ɜ/ə→a, ɪ→i, ʊ→u, ɾ→r, ɛ→e, strip narrow combining marks) to the engine's BROAD a/i/u/r,
gemination→length Cː, affricate ties, stress moved to the nucleus. Correct Egyptian segments throughout (ج→ɡ, ق→ʔ,
plain s, emphatics from ص/ط/ض only).

Impact: SHIPPED path (lexicon:true) covers **75.9%** of the wikipron-arz referee (circular — kaikki~wikipron; the
value is the correct vocalization for the FLEURS `ar_eg` audio, not the number); rule-only eval UNCHANGED at 47.5%
(non-circular). 30 arabic tests pass (2 regression-gold values updated to the new consistent convention: ازاى
ezzaːj→ezːaːj gemination, برتقان burtuʔaːn→bortoʔaːn majhūl o per kaikki). Rebuild is deterministic from the kaikki
dump; no build script committed (one-off from /mnt/data/kaikki-arz.jsonl).

## Run — 2026-08-20 — the cosine retrain: DER halves, pronunciation does not

**What was done.** The shipped v2 finished its 25 epochs with `lr` still at 5.0e-04 — `ReduceLROnPlateau`
never reduced it once — while val DER was still falling. Resumed from its epoch-25 checkpoint with packed
sequences and a deterministic cosine anneal (5e-4 → 0 over 12 epochs).

| | TEST DER | TEST WER |
|---|---|---|
| shipped v2 | 1.69% | 5.00% |
| retrain | **0.89%** | **2.54%** |

**⚠ AND IT IS VERY NEARLY A NO-OP FOR USERS.** Three instruments, one conclusion:

| | shipped → retrain |
|---|---|
| DER (CALIMA-silver test split) | 1.69% → 0.89% (−47% relative) |
| runtime word-exact vs silver gold | 64.68% → 65.01% (+0.33pp) |
| **FLEURS `ar_eg` mean phone-distance** | 0.4341 → **0.4341** (zero) |
| **words actually pronounced differently** | **0.85%** (64 of 7,494) |

**DER IS A POOR PROXY FOR THIS PIPELINE.** It scores the diacritic LABEL sequence, and most labels do not
survive into the IPA — a sukun predicted or not, a mark on a letter whose realisation is unchanged. A 47%
DER reduction bought a 0.85% change in pronunciation, a ~50× discrepancy. What the retrain actually did is
converge harder onto its CALIMA teacher, which only helps to the extent the teacher is right.

⚠ The audio null is NOT evidence of a bad referee here. The metric has real dynamic range across the fleet
(es_419 0.089, median 0.362, ar_eg 0.442, worst 0.67) — it is not saturated. No instrument detects a 0.85%
output change. The models are simply near-identical.

**SHIPPED.** ⚠ The first draft of this entry recommended NOT shipping, on the grounds that the improvement
could not be independently corroborated. That conflates *"unverified"* with *"absent"*. This is the same model
trained further, in less disagreement with its corpus; it is better on its objective (DER), better on the
silver runtime harness, and unchanged on the audio — **nothing measures it worse**. Absence of an independent
referee is a fact about Egyptian's instruments, not about the model. Checkpoint archived at
`/mnt/data/arz-diac/bilstm_egy_cosine.pt`.

**⚠ THE BINDING CONSTRAINT IS THE REFEREE, AND IT WAS ALREADY DOCUMENTED (Run 3, "DATA-BLOCKED").** Egyptian
has exactly two machine-readable IPA sources and they are the same upstream: wikipron arz (590–800 words) IS
the referee, and kaikki arz feeds `egyptian-lexicon.tsv` — so the eval must run `lexicon: false` to stay
non-circular, reporting a configuration nobody ships. The audio is independent but Arabic is among the
recognizer's weaker languages. **Nothing currently in the repo can tell you whether an Egyptian model is
good** — only whether it is anomalous relative to itself. That gap, not the OOV vowel tail, is what blocks
progress: the tail cannot be closed by a method nobody can score.
