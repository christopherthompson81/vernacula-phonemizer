import { describe, expect, it } from "vitest";
import { evaluate } from "./eval.ts";
import { CONFIG } from "./config.ts";

/**
 * Independent-referee corroboration floors. Each phonemizer's SEGMENTAL BACKBONE must still agree with its
 * PRIMARY espeak-independent source (epitran / wikipron / kaikki) above a floor — a linguistic-correctness
 * regression guard, distinct from the espeak-canonical gold (which only guards accidental drift from our
 * bootstrap). Secondary sources are reported by eval.ts as corroboration but not floored here. Floors sit below
 * the current measured agreement so ordinary churn doesn't trip them; a real regression (or a fold that stops
 * applying) drops below. Raise a floor deliberately when the engine improves. Languages with no viable
 * independent referee are recorded as gaps (asserted below), not silently skipped.
 */
describe("referee corroboration (segmental backbone vs the PRIMARY independent source)", () => {
    // Floor = the primary referee's folded-agreement fraction, set below the measured value. Alphabetical.
    const floors: Record<string, number> = {
    fa: 0.40, // wikipron fas_arab broad (HUMAN, fully-voweled) — 42.9% FOLDED (short-vowel QUALITY a~e~o~i~u + long و=uː~oː / ی=iː~eː folded, all UNRECOVERABLE from the undiacritized abjad); adjudicated common-word gold (2nd) 88.9%. 🟡 — two-layer short-vowel restoration now SHIPS (coverage lexicon + neural, PR #208); the folded % can't see it (short vowels folded)
    tl: 0.85, // epitran tgl-Latn (INDEPENDENT) — 89.0%; adjudicated common-word gold (2nd) 100%. Shallow Latin g2p (ng→ŋ, r→ɾ, word-initial+intervocalic ʔ, hyphen→ʔ, mga→maŋa). The 11% epitran gap is entirely epitran OMITTING the intervocalic glottal stop that we correctly add (gold-confirmed) — we are MORE correct than the referee
    yue: 0.68, // epitran yue-Latn (INDEPENDENT, jyutping→IPA, crude) — 70.9% folded; adjudicated common-word Han→IPA gold (2nd) 100%. Han→Jyutping is rime-cantonese (121k, standard); jyutping→IPA authored in canonical IPA (aː/ɐ length, checked codas, 6 Chao tones). epitran MERGES aa/a length + drops checked vowels → it caps the number, not our quality
        am: 0.75, // wikipron amh_ethi broad (HUMAN, 478) — 80.1% FOLDED; kaikki amh (2nd, HUMAN, 437) 78.3%. Ethiopian Semitic, the Ge'ez/Fidäl SYLLABARY-abugida (each codepoint = a CV syllable) → a flat fidel→CV lookup (fidel.tsv, from the epitran amh-Ethi map, Apache-2.0, + guttural 1st-order fix ሀ→ha). Ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ, /r/ tap ɾ. Two UNWRITTEN features handled: GEMINATION (phonemic but unmarked → rendered single, degemination fold) + the 6th-order [ɨ] (epenthetic — kept only as the word's first vowel, else deleted: ሁለት→hulət). Folds: gemination, ə~ɐ, the referee-inconsistent word-initial glottal (ʔ)/parens, r~ɾ. Residual is the ɨ-epenthesis tail (amst~amɨst — partly lexical, like schwa deletion).
        ar: 0.55, // wikipron ara via the ONNX diacritizer + LEXICON-PRIMARY Tashkeela restoration + PAUSAL fold — measured 57.4% (kaikki 2nd: 62.6%). Referee is isolated citation-form lemmas (OOD + convention + ambiguity); see docs/ar_referee_investigation.md
        bn: 0.4, // wikipron ben_beng broad (HUMAN) — measured 42.5%; the wikipron primary is REFEREE-NOISE-LIMITED (retroflex ট/ড written dental — a real contrast we keep; literary final-[o] retention word-variable). The adjudicated common-word GOLD (2nd) is 92.0% — the real quality signal. Full core: harmony ɔ→o/e→æ, final+medial (Ohala) inherent-vowel deletion, phôla/ক্ষ/জ্ঞ gemination. Tail: lexical final-o (বড়/ছোট), hiatus (বই), closed-syllable æ (এক)
        ca: 0.76, // wikipron cat_latn narrow (Central-preferring, multi-dialect) — measured 81.3%; referee mixes dialects (reduction/final-r/clusters folded) + no stress
        cmn: 0.8, // epitran pinyin-syllable inventory (syllable-level) — measured 84.7%; residual = fine vowel detail
        cs: 0.95, // wikipron ces_latn (HUMAN) — 97.0% with the kaikki loanword lexicon (de-palatalization: stadion/studie/technik). Rule-engine OOV alone 97.7% (independent). Partly circular for the 404 dict-covered (kaikki~wikipron both Wiktionary)
        cy: 0.8, // wikipron cym_latn NW — 83.7% WITH the kaikki NW lexicon (ae quality/oe length/dim/y-obscure, referee-confirmed → PARTLY CIRCULAR). Rule-engine OOV alone 81.1% (independent).
        de: 0.75, // kaikki deu — measured 76.1% (wikipron deu 2nd: 74.9%); Run 27 glided unstressed i in medial hiatus (Latinate -iVC-: genial, union, aluminium). Residual now DOMINATED by proper-noun/loanword noise (haiti/alert/berlin/moslem) — the referee-limited tail
        en: 0.3, // wikipron eng_us — measured 36.1%; DEFLATED by a noisy referee (proper nouns, GB variants, letter-names)
        es: 0.88, // wikipron spa_latn_ca — measured 92.5%; residual is loanwords + diphthong-offglide notation
        ff: 0.62, // epitran ful-Latn — measured 71.2%; residual = epitran nj→ɲ vs our prenasal + salt
        fr: 0.76, // wikipron fra — 79.1% (adjudicated gold 91.3%); ✅ referee name/acronym-limited (92.5% common-word). Full loi de position: o/ɔ default + au/eau+r→ɔ + o-before-z→o + x-closes; e/ɛ-before-cluster kept lexical (Lexique). Headline deflated by proper-name/acronym/rare tail
        ga: 0.4, // wikipron gle_latn broad — measured 44.8% (Run-3 referee-gated lexicon); 3-DIALECT referee (~34% ceiling even for a mature engine), vowel-noise dominated
        ha: 0.85, // wikipron hau (human) — measured 90.3% (epitran hau 2nd: 88.4%)
        gu: 0.77, // wikipron guj_gujr broad (HUMAN, 4244) — 80.4% FOLDED; kaikki guj (2nd, HUMAN, 4152) 82.2%. Gujarati abugida — REUSES the generic abugida engine + the Hindi orchestration (makeNativeHindi, parameterised by script) with a Gujarati-Unicode data file. Dental t̪/d̪ vs retroflex ʈ/ɖ, ળ→ɭ, ષ→ʂ, NO phonemic length (ઇ/ઈ→i), anusvara→homorganic nasal. Folds: ⟨આ⟩ a~ɑ, the mid-vowel openness (⟨ે⟩=[e]~[ɛ], ⟨ો⟩=[o]~[ɔ] — one sign each), ʂ~ʃ, affricate-gemination notation. Residual (like Hindi's) is schwa-deletion edge cases (Gujarati deletes/retains medial schwa somewhat differently from Hindi's Ohala rule) + loanword nukta ambiguity (ફ→pʰ vs f, ઝ→d͡ʒʱ vs z) + referee matra-only artifacts. 🟡 — schwa-deletion + the 21-99 number gap.
        hi: 0.72, // wikipron hin — measured 77.7%; residual = schwa-deletion edge cases + ref epenthesis + genuine ख़/ख (x/kʰ) noise
        id: 0.92, // wikipron ind_latn broad (HUMAN, 18590) — measured 94.9% FOLDED; adjudicated common-word gold (2nd) 100%. Shallow Latin G2P (digraphs, c/j, final-k→ʔ, acronym spell-out). Folds: closed-syllable lax allophony (i~ɪ/u~ʊ/o~ɔ — referee-erratic) + the ⟨e⟩=/ə/~/e/~/ɛ/ ORTHOGRAPHIC ambiguity (both written ⟨e⟩, lexically unrecoverable). 🟡 — loanword ⟨e⟩ quality is the lexicon-closable tail
        it: 0.95, // wikipron ita_latn broad (HUMAN, 89608) — 97.8% FOLDED. Shallow Latin G2P: c/g softening, ⟨sc⟩→ʃ, ⟨gl⟩i→ʎ, ⟨gn⟩→ɲ, ⟨qu⟩→kw, gemination (doubled consonants — the referee's convention), i/u glides, penult/accent stress. Folds the three genuinely-LEXICAL axes spelling can't encode (stressed mid-vowel openness ⟨e⟩=e/ɛ, ⟨o⟩=o/ɔ; intervocalic ⟨s⟩ voicing; ⟨z⟩ voicing t͡s/d͡z) + the referee-inconsistent glide/hiatus + geminate-affricate notation. Residual is diffuse proper-noun/loan noise (referee reads David/Wikipedia/Vorarlberg with source-language phonology) + letter-name rows + a small stressed-⟨-ia⟩ hiatus tail (epidemiologia, bugia). ✅
        jv: 0.82, // kaikki jav Latin (Wiktionary, HUMAN, 1362 pairs) — 86.2% FOLDED; kaikki jav Aksara Jawa SCRIPT (2nd, 1268 pairs) 84.5% — two front-ends (Latin g2p + the abugida scanner aksara.ts), one shared phonology. Rule-based g2p ported from the espeak-ng-portable authored bring-up: the ⟨a⟩→[ɔ] rule (open final + penult harmony), dental t̪/d̪ vs retroflex ʈ/ɖ, closed-syllable laxing, final ⟨k⟩→ʔ, ngoko numbers. Folds: dental notation (referee-inconsistent t̪~t), i/u laxing (erratic), the bare ⟨e⟩ = /ə/(pepet)~/e/~/ɛ/(taling) ambiguity (unrecoverable in Latin without diacritics), k̚. Residual is diffuse: Sanskrit-loan a→ɔ exceptions (denta, sastra), register variants (dinten krama vs dina ngoko), inconsistent multi-syllable harmony (the referee itself: hanacaraka fully harmonises but wahana stops at penult), h-dropping. 🟡 — the ⟨e⟩ ambiguity is the lexical tail (the Aksara Jawa script writes pepet/taling distinctly → a script front-end would close it).
        ja: 0.52, // wikipron jpn_hira narrow — measured 57.9%; residual = allophonic palatalization + devoicing detail
        kk: 0.83, // epitran kaz-Cyrl — measured 86.2%; residual is largely epitran's own ө/ү merger + palatalization
        kn: 0.94, // wikipron kan_knda broad (HUMAN, 1713) — 97.4% FOLDED; kaikki kan (2nd, HUMAN, 1764) 96.8%. Dravidian abugida — MIRRORS Telugu (generic engine, NO inherent-vowel deletion, inherent /a/; own module + Kannada Unicode). Dravidian short/long e·o, dental t̪/d̪ vs retroflex ʈ/ɖ, ಳ→ɭ, ಷ→ʂ, geminate→length, final anusvara ಂ→[m]. Folds: inherent short /a/ = [ɐ]~[a]~[ɑ] (the referee writes ɐ), and geminate NOTATION (our length Cː vs the referee's DOUBLED consonant — the dominant class, 78→95%). Two independent human referees corroborate; residual is diffuse (visarga h, o~ɔ, diphthong notation).
        ko: 0.52, // wikipron kor_hang narrow — measured 58.5%; residual = ㄹ (ɭ~ɾ) + intervocalic voicing detail
        mr: 0.64, // wikipron mar_deva broad (HUMAN, 4872) — 68.3% FOLDED; adjudicated common-word gold (2nd) 100%. Reuses the Hindi abugida engine + a Marathi data file (ळ→ɭ, ष→ʂ, च/ज→dental t͡s/d͡z before back vowels, ऐ→əi/औ→əu, ृ→ɾu). Folds: ɪ~i/ʊ~u (referee doesn't mark the lax split), alveolo-palatal notation, affricate place variation, degemination. Tail: final-schwa-after-cluster retention, ज्ञ conjunct
        pa: 0.58, // wikipron pan_guru broad (HUMAN, small 1586) — 61.7% FOLDED; adjudicated common-word gold (2nd) 100%. Gurmukhi abugida + TONOGENESIS (voiced-aspirate de-aspiration + tone; eval strips Chao letters → grades the SEGMENTAL de-aspiration). Referee noisy (epenthetic ᵊ/ə̆, medial-schwa variation). 🟡 — tail: intervocalic-h tonogenesis, medial schwa
        ps: 0.30, // wikipron pus_arab broad (HUMAN, 1414) — 35.4% FOLDED; kaikki pus (2nd, HUMAN, 1055) 37.7%. 🟡 restoration-shipped ABJAD (like Urdu/Persian): the consonant + WRITTEN-vowel skeleton is correct (retroflex ʈ ɖ ɳ ɻ / retroflex sibilants ʂ ʐ / affricates t͡s d͡z / dental t̪ d̪ / long-mid vowels ا→ɑ ې→e و→o ی→i, glide-before-final-ه), but SHORT vowels a/ə/i/u are UNWRITTEN → default [ə] (deferred restoration). Pashto is HARDER than Urdu's 42.9%: (a) the referee is MULTI-DIALECT (ښ = ʂ Kandahari ~ x NE ~ ç Central; ږ = ʐ~ɡ~ʝ — I fold ʂ/ç→ʃ, ʐ→ʒ but the referee's NE x/ɡ can't be folded without merging خ/ګ), (b) epenthesis POSITION is ambiguous (initial clusters سپک→spək vs CvC کتاب→kətɑb — unrecoverable), (c) letter-name referee entries (ش→ʃin). Skeleton verified on the gold.
        pt: 0.8, // wikipron por — 81.2% (adjudicated gold 2nd: 99.4%); ✅ referee register/name-limited after dark-l blocks a/e reduction (salvar→saɫvaɾ 53:0, -vel→vɛɫ 89:0). Residual one-directional: we reduce EP pretonic o→u/e→ɨ uniformly, referee keeps mid in learned words (195:0 / 386:8)
        ru: 0.9, // kaikki rus — measured 94.8% (adjudicated gold 2nd: 97.7%)
        si: 0.9, // wikipron sin (human) — measured 93.5%; residual is 1× referee quirks
        sv: 0.52, // wikipron swe broad — measured 55.7% (Phase 3: + NST compound secondary-stress → boundary-safe vowel length/quality + 2nd-onset softening); residual = referee noise (casual/truncated forms)
        sw: 0.90, // wikipron swa_latn broad (HUMAN, 370) — 93.5% FOLDED; kaikki swa (2nd, HUMAN, 405) 97.8%. Bantu, highly phonemic Latin orthography, no tone, penultimate stress. Implosives (ɓ ɗ ʄ ɠ), prenasalized stops (ᵐb ⁿd ⁿd͡ʒ ᵑɡ), ⟨ng'⟩→ŋ vs ⟨ng⟩→ᵑɡ, syllabic nasals, ⟨aa⟩→long vowels, Cʷ labialization. Folds: r~ɾ tap, aspiration (unwritten/variable), length, and the referee-inconsistent cardinal-vowel (a~ɑ e~ɛ o~ɔ) + implosive (ɓ~b) notation. Residual is Arabic-loan nativization where WE are more correct (akili q→k, habari x→h, arusi ʕ→∅). Two independent human referees corroborate.
        ta: 0.58, // wikipron tam — measured 63.0% (r→ɾ folded only word-finally, to keep the ற/ர contrast); residual = ற geminate + diphthong notation
        te: 0.76, // wikipron tel_telu broad (HUMAN, 5117) — 79.6% all-rows / 98.2% DEDUPLICATED (multi-pron rows deflate the headline); adjudicated common-word gold (2nd) 100%. Dravidian abugida, NO inherent-vowel deletion, ళ→ɭ, ష→ʂ, short/long e·o, ౘ/ౙ dental affricates, final ం→m. Residual is the ఋ→ɻ̍-vs-ɾu convention + multi-pron variants
        th: 0.76, // wikipron tha — measured 81.9%; residual is LEXICAL (Sanskrit/Pali readings), not segmental
        tr: 0.92, // wikipron tur — 93.7% (epitran tur 2nd: 94.5% — both referees now corroborate) after (a) engine: coda velar palatalization k/ɡ→c/ɟ (renk→ɾeɲc) + nasal place assimilation n→ŋ/ɲ (angut→aŋɡut), (b) completing the lax-vowel allophony folds (ɛ/ʊ/œ/ɪ/ʏ) + palatal/nasal + degemination folds. Residual = names + ğ glide-vs-length + h→x/ç
        ur: 0.4, // wikipron urd_arab broad (HUMAN, fully-voweled) — measured 42.9% FOLDED (short-vowel quality ə~ɪ~ʊ folded, as it is UNRECOVERABLE from the undiacritized abjad). 🟡 — two-layer short-vowel restoration now SHIPS (coverage lexicon 66% of tokens + neural, PR #208); the folded % can't see it (short vowels folded)
        vi: 0.65, // wikipron vie_hanoi narrow — measured 71.0% (epitran vie 2nd: 51.3%); residual = ə/ɛ nucleus + coda
        my: 0.70, // wikipron mya_mymr broad (HUMAN, 8288) — 71.4% FOLDED; kaikki mya (2nd, HUMAN, 8107) 73.7% (partly self-referential — the voicing lexicon is mined from kaikki; wikipron 69.0% is the honest independent signal). Sino-Tibetan, Mon-Burmese abugida — the HARDEST script/bring-up. Rime chart (vowel × coda), ⟨ွ⟩ labialisation (glide open/before -ng), STACKED-conjunct coda (C1 ္ C2 → C1 is a checked/nasal coda: ဗုဒ္ဓ→boʊʔda), medial palatalisation (ကျ→t͡ɕ, ငြ→ɲ, လျှ→ʃ), voiceless ⟨ှ⟩ sonorants. TONES done (rule-based Chao, 99.6% mono — tools/my-tone-eval.ts). VOICING sandhi done (per-word voicing-lexicon.tsv mined from kaikki, corroborated on wikipron +1210/−4). 🟡 — all three subsystems built (tones, voicing, WORD SEGMENTATION via the shared DAG over syllable boundaries — voicing fires on running text now). Remaining is a lexical/coverage tail: seg-words dictionary size + rime ည i~ɛ.
        yo: 0.86, // wikipron yor_latn broad (HUMAN, 4937) — 89.6% FOLDED; kaikki yor (2nd, HUMAN, 4055) 88.8%. Volta-Niger, highly phonemic three-tone Latin orthography. Labial-velars ⟨gb⟩→ɡ͡b / ⟨p⟩→k͡p, ⟨j⟩→d͡ʒ, ⟨ṣ⟩→ʃ, ⟨r⟩→ɾ, gh→ɣ, Cʷ labialisation; dotted vowels ẹ→ɛ ọ→ɔ; coda-⟨n⟩ nasalisation (ọdún→ɔdũ) vs onset n; syllabic m̩/n̩; THREE level tones as Chao letters (backbone strips them + the referee's tone-accent diacritics, so this grades the SEGMENTAL backbone). Folds r~ɾ. Residual is referee noise (single-letter/letter-name entries B→bí, IPA-glyph headwords Ɔ̀, syllabic-nasal place). Two independent human referees corroborate.
        zu: 0.99, // epitran zul-Latn — clicks/implosives/ejectives/laterals corroborated (measured 100%)
    };
    for (const [lang, floor] of Object.entries(floors)) {
        it(`${lang} backbone ≥ ${(floor * 100).toFixed(0)}% of its primary referee`, async () => {
            const primary = (await evaluate(lang, true)).find(
                (r) => r.role === "primary",
            );
            expect(
                primary,
                `${lang} has no primary referee result`,
            ).toBeDefined();
            const frac = primary!.folded / primary!.total;
            expect(
                frac,
                `${lang} vs ${primary!.source}: ${primary!.folded}/${primary!.total}`,
            ).toBeGreaterThanOrEqual(floor);
        }, 30000); // ONNX diacritizer (ar) is slow; generous per-test timeout
    }

    // Languages with no viable independent referee must RECORD the gap (not silently omit it).
    it("gap languages document why they have no independent referee", () => {
        for (const [lang, cfg] of Object.entries(CONFIG)) {
            if (cfg.referees.length === 0) {
                expect(
                    cfg.secondaryGap,
                    `${lang} has no referees but no documented gap`,
                ).toBeTruthy();
            }
        }
    });
});
