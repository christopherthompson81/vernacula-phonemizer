/**
 * Khmer / ភាសាខ្មែរ (km) text phonemizer — Austroasiatic (Mon-Khmer), the Khmer abugida, canonical IPA,
 * Cambodia's national language (~18M). NON-tonal but SESQUISYLLABIC.
 *
 * Khmer's defining feature is the TWO CONSONANT SERIES: every base consonant belongs to the a-series (1st,
 * inherent ɑː) or the o-series (2nd, inherent ɔː), and the SAME vowel sign is pronounced differently depending
 * on the governing series (ក+ា = kaː but គ+ា = kiə). The algorithm below follows Huffman (1970), Cambodian
 * System of Writing:
 *   1. UNIT PASS — scan base consonant + coeng (្) subscripts + dependent vowel sign + diacritics into "units".
 *   2. CODA PASS — the last bare unit (no written vowel) attaches as the coda of the previous syllable; a
 *      NASAL superscript in a medial cluster (CVN-) closes the previous syllable and its subscript opens the
 *      next (តម្រង → tɑm.rɑŋ, not tɑ.mrɑŋ). A medial bare unit between two vowelled syllables is its own
 *      minor syllable (ចេតនា → ceːtaʔnaː).
 *   3. RENDER PASS — GOVERNANCE (Huffman VI.B): a vowel's series is set by the LAST PRECEDING stop/spirant
 *      (dominant) consonant, tracked ACROSS THE WHOLE WORD so a passive-initial syllable harmonises to the
 *      last dominant (ចេតនា: ន harmonises to a-series from ត). Bare-vowel syllables: SHORT inherent (ɑ/ɔ) as
 *      an unstressed presyllable or a closed syllable, LONG inherent (ɑː/ɔː) only when stressed-and-open.
 * Series values + the two-reading vowel table were DERIVED from wikipron khm (7107 words). Khmer Unicode is
 * logical-order, so no leading-vowel reorder is needed.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { normalizeKhmer } from "./normalize.ts";
import { restoreBoundaries } from "./khmerPerceptron.ts";
import { numberToKhmerWords } from "./numbers.ts";

interface KhmerDef {
    consonants: Record<string, [string, string]>;
    diacritics: readonly string[];
    passiveConsonants: readonly string[];
    nasalConsonants: readonly string[];
    vowels: Record<string, [string, string]>;
    vowelCombos: Record<string, [string, string]>;
    codas: Record<string, string>;
    /** U+17A3–U+17B3 → its IN-WORD reading. See the manifest for provenance and why it is not the letter name. */
    independentVowels: Record<string, string>;
    inherent: [string, string];
    clausePunctuation: Record<string, string>;
}

const DEF = loadManifest<KhmerDef>(import.meta.url, "khmer.jsonc");
const COENG = "្"; // U+17D2 — subscript former
const TOANDAKHIAT = "៍"; // U+17CD — silences the consonant it sits on
const MUUSIKATOAN = "៉"; // U+17C9 — converts a 2nd-series (o) consonant to 1st-series (a)
const TRIISAP = "៊"; // U+17CA — converts a 1st-series (a) consonant to 2nd-series (o)
const BANTOC = "់"; // U+17CB — shortens the vowel; sits on a coda consonant
const SAMYOK = "័"; // U+17D0 — samyok sannya: a short-vowel sign; ⟨័រ⟩ reads oə (កុងទ័រ koŋtoə)
const REAHMUK = "ះ"; // U+17C7 — adds an -h coda (combines with a preceding base vowel)
const NIKAHIT = "ំ"; // U+17C6 — adds an -m coda (combines with a preceding base vowel)
// Combining diacritics consumed after a unit's vowel (register shifters + bantoc handled separately, rest ignored).
const DIACRITICS = new Set(DEF.diacritics);
// A long vowel shortened by the /bantaq/ (់): កាត់ kaːt → kat, ចាប់ caːp → cap.
const SHORTEN: Record<string, string> = {
    "aː": "a", "ɛː": "ɛ", "eː": "e", "oː": "o", "uː": "u", "iː": "i", "ɨː": "ɨ", "əː": "ə", "ɔː": "ɔ", "ɑː": "ɑ",
    // ⟨ា⟩ o-series is iə, and the bantaq RE-COLOURS it: ជាប់ coəʔ, not *ciəʔ. Referee-derived 71:1 on the
    // o-series ⟨ា⟩+់ words. ⚠ BANTAQ ONLY — the silent-subscript codaShort shape KEEPS iə (11:0), and that
    // split falls out structurally: SHORTEN is consulted only on `unit.shorten`.
    "iə": "oə",
};
// Passive consonants = continuants (nasals, semivowels, liquids); everything else is a dominant stop/spirant.
const PASSIVE = new Set(DEF.passiveConsonants);
const NASAL = new Set(DEF.nasalConsonants);

interface Unit {
    ons: string[]; // onset consonant letters (base + coeng subscripts)
    vs: string | null; // dependent vowel sign, or null (inherent)
    post: string | null; // trailing ⟨ះ⟩/⟨ំ⟩ that combines with the base vowel
    bantaq: boolean; // carries the /bantaq/ (់) — a coda consonant that shortens the previous vowel
    ser: "a" | "o" | null; // register-shifter override, if any
    bp: boolean; // ⟨ប៉⟩ — the base ⟨ប⟩ is realised as plain [p] rather than [ɓ]
    coda: string | null; // coda consonant letter, or null
    shorten: boolean; // a following /bantaq/ coda shortens this syllable's vowel
    codaShort: boolean; // the coda came from a silent-subscript/doubled cluster → short inherent (ចន្ទ can)
    samyok?: boolean; // carries ⟨័⟩ (samyok sannya) — with a silent-រ coda the nucleus is oə (referee 25:1)
    /** An INDEPENDENT VOWEL's literal IPA — the unit is a whole syllable nucleus with no onset letter. */
    iv?: string;
}

/**
 * The `vs` a unit carries when it IS an independent vowel.
 *
 * ⚠ WHY A SENTINEL RATHER THAN `null`. Coda assignment in PASS 2 asks `prev.vs !== null` — "does the previous
 * syllable already have a WRITTEN vowel, so a bare consonant after it must be its coda rather than a syllable of
 * its own". An independent vowel's vowel IS written; it is written as the letter. With `vs: null` the rule declined
 * to attach a coda and ឥណ្ឌា came out *ʔə.ɗiə* instead of *ʔən.ɗiə*, dropping the ណ. This sentinel is never looked
 * up in `DEF.vowels`, because PASS 3 emits an `iv` unit and moves on before the vowel lookup.
 */
const IV_VS = "\u0000";

// Exceptions lexicon (word → canonical IPA) for the RULE-UNPREDICTABLE residual — inherent-vowel length,
// internal-doubling, Pali/Sanskrit loanword vowels. These are LEXICAL (not derivable from the spelling, per
// Huffman 1970), so — the Romanian-stress / akan-tone pattern — a mined lexicon carries them and the shipped
// phonemizeWord consults it dict-first. phonemizeWordRules NEVER reads it, keeping the referee eval non-circular
// (the lexicon is derived FROM the wikipron referee). Mined by tools/gen/build-km-lexicon.mts.
const LEX: ReadonlyMap<string, string> = loadTsvMap(import.meta.url, "km-lexicon.tsv", undefined, { optional: true });

/**
 * SECOND-TIER lexicon — an INDEPENDENT dictionary, for words no human transcription covers.
 *
 * ⚠ IT IS CONSULTED AFTER `LEX` AND MUST STAY THERE. `LEX` is wikipron-verified; this is google/language-resources
 * under CC BY 4.0, and where the two disagree the verified one wins.
 *
 * ⚠ AND IT DELIBERATELY CONTAINS NO WORD THE REFEREE COVERS. `LEX` is an EXCEPTIONS lexicon — it holds the words
 * where the rules FAIL — so for any referee word absent from it, the rules already match wikipron by construction.
 * This dictionary agrees with wikipron only 88.1% of the time on those, so including them would be a measured 12pp
 * regression on exactly the words that can be checked. The generator excludes them; see its header.
 *
 * What is left is the population with no human transcription at all — 8.7% of the units the engine looks up — and
 * there this is the better evidence: on the 5,734 referee words it does cover it agrees with wikipron 78.3% against
 * the rules' 63.3%.
 *
 * ⚠ "THE UNITS THE ENGINE LOOKS UP" MEANS AFTER SEGMENTATION, and measuring it on writer-delimited tokens instead
 * gave a badly wrong picture: those average 19.7 characters against 4.2 for a covered token, because Khmer writers
 * delimit inconsistently and an unsegmented run is several words. On the segmented unit lexicon coverage is
 * 22.5% → 31.3% with only 7.4% of lookups having no evidence anywhere — not the 38.9% a token-level count suggests.
 * Built by tools/gen/build-km-dict-lexicon.mts.
 */
const DICT: ReadonlyMap<string, string> = loadTsvMap(import.meta.url, "km-lexicon-dict.tsv", undefined,
    { optional: true });

/**
 * THIRD-TIER lexicon — en.wiktionary readings via kaikki, for words the wikipron SCRAPE lacks (newer entries,
 * compounds written solid). SAME lineage as the referee, which is why it is a lexicon and can never be a
 * referee; by construction it holds NO referee word, only words where the rules disagree with its reading.
 *
 * ⚠ CONSULTED BETWEEN `LEX` AND `DICT`, and the order is an evidence ranking: wikipron-VERIFIED beats a
 * same-tradition human reading, which beats the converted Google dictionary (its conversion validates 97.7%
 * against wikipron on 6,564 shared words, against the dictionary's 78.3%). Built by
 * tools/gen/build-km-kaikki-lexicon.mts.
 */
const KAIKKI: ReadonlyMap<string, string> = loadTsvMap(import.meta.url, "km-lexicon-kaikki.tsv", undefined,
    { optional: true });

/** One Khmer word → canonical IPA. SHIPPED path: the wikipron-verified exceptions lexicon, then the kaikki
 *  (same-tradition) tier, then the independent dictionary, then the rule engine. `phonemizeWordRules` reads
 *  NONE of them, so the referee eval stays non-circular. */
export function phonemizeWord(word: string): string {
    return LEX.get(word) ?? KAIKKI.get(word) ?? DICT.get(word) ?? phonemizeWordRules(word);
}

/** One Khmer word → canonical IPA by RULE ONLY (segmental two-series sesquisyllabic abugida; no lexicon). This is
 *  the non-circular referee-eval signal. */
export function phonemizeWordRules(word: string): string {
    const s = [...word];
    const n = s.length;

    // ---- PASS 1: scan into orthographic units ---------------------------------------------------------
    const units: Unit[] = [];
    let i = 0;
    while (i < n) {
        const c = s[i]!;
        /**
         * An INDEPENDENT VOWEL is a complete syllable: emit it as its own unit so PASS 2 can still hand it a coda.
         *
         * ⚠ A COENG AFTER ONE IS SKIPPED, AND THAT IS LOAD-BEARING FOR THE COMMONEST SHAPE. `ឲ្យ`/`ឱ្យ` ("to
         * give/let") is 54,491 corpus occurrences — 98% of all IV+coeng sequences — and reads ʔaoj. An independent
         * vowel cannot actually carry a subscript, so the coeng falls through as an unrecognised mark and the ⟨យ⟩
         * becomes this syllable's CODA by the trailing-bare-unit rule in PASS 2. `ឲ្យ` and `ឲយ` therefore give the
         * same reading, which is the correct one. Pinned by a test, because it happens by omission rather than by
         * an explicit branch and would be easy to "tidy" away.
         *
         * ⚠ AND `ឣ្នក` IS A TYPO, NOT A WORD. U+17A3 ឣ and U+17A2 អ look nearly identical and writers confuse them:
         * 462 corpus lines write ឣ្នក for អ្នក ("person"). Reading it as ʔɑn… is what the letters say, and a g2p
         * should not silently repair a misspelling — the reading is phonetically close in any case.
         */
        const ivIpa = DEF.independentVowels[c];
        if (ivIpa !== undefined) {
            i += 1;
            units.push({ ons: [], vs: IV_VS, post: null, bantaq: false, ser: null, bp: false,
                coda: null, shorten: false, codaShort: false, iv: ivIpa });
            continue;
        }
        if (!(c in DEF.consonants)) { i += 1; continue; } // stray marks — nothing to say
        const ons = [c];
        let ser: "a" | "o" | null = null;
        i += 1;
        // register shifters can sit directly on the base consonant. ⟨ប៉⟩ additionally changes the consonant
        // value ɓ → p (កប៉ាល់ kapal), the muusikatoan devoicing the implosive.
        let muus = false;
        while (s[i] === MUUSIKATOAN || s[i] === TRIISAP) { ser = s[i] === MUUSIKATOAN ? "a" : "o"; muus ||= s[i] === MUUSIKATOAN; i += 1; }
        const bp = muus && ons[0] === "ប"; // ⟨ប៉⟩ → plain [p]
        // coeng subscripts (្ + consonant): a written cluster
        while (s[i] === COENG && (s[i + 1] ?? "") in DEF.consonants) {
            ons.push(s[i + 1]!);
            i += 2;
            while (s[i] === MUUSIKATOAN || s[i] === TRIISAP) { ser = s[i] === MUUSIKATOAN ? "a" : "o"; i += 1; }
        }
        const vs = (s[i] ?? "") in DEF.vowels ? s[i]! : null;
        if (vs) i += 1;
        // a base vowel sign may be followed by ⟨ះ⟩/⟨ំ⟩, which combine with it (multi-char vowel)
        let post: string | null = null;
        if (vs && vs !== REAHMUK && vs !== NIKAHIT && (s[i] === REAHMUK || s[i] === NIKAHIT)) { post = s[i]!; i += 1; }
        // diacritics after the vowel — ៍ silences the whole unit; ់ (bantaq) is recorded; the rest are ignored
        let silent = false;
        let bantaq = false;
        let samyok = false;
        while (DIACRITICS.has(s[i] ?? "")) {
            if (s[i] === TOANDAKHIAT) silent = true;
            if (s[i] === BANTOC) bantaq = true;
            if (s[i] === SAMYOK) samyok = true;
            i += 1;
        }
        if (!silent) units.push({ ons, vs, post, bantaq, ser, bp, coda: null, shorten: false, codaShort: false, samyok });
    }
    if (units.length === 0) return word;

    // ---- PASS 2: coda assignment ----------------------------------------------------------------------
    // A bare unit carrying the /bantaq/ (់) is always a coda and shortens the previous syllable's vowel
    // (កាត់ → kat, កង់ → kaŋ): it closes the previous syllable rather than opening its own.
    for (let u = 1; u < units.length; u++) {
        const cur = units[u]!;
        if (cur.bantaq && cur.vs === null && cur.post === null && units[u - 1]!.coda === null) {
            units[u - 1]!.coda = cur.ons[0]!;
            units[u - 1]!.shorten = true;
            (cur as { drop?: boolean }).drop = true;
        }
    }
    // A medial bare consonant (no vowel of its own) after a syllable that already has a WRITTEN vowel but no
    // coda is that syllable's coda, not a minor syllable of its own (គីមឈី → kiːm.ciː, not kiːm.ɔ.ciː).
    //
    // ⚠ TWO GUARDS, BOTH FOR THE SAME REASON: this rule CONSUMES `cur`, so it must not fire when `cur` is
    // carrying something that would be destroyed with it. Without them a whole syllable vanishes.
    // · `cur.coda === null` — the bantaq rule above may ALREADY have given `cur` a coda. កំណត់ scans to
    //   [កំ][ណ][ត់]; ណ takes ត as its coda, and stealing ណ here dropped ត with it (kɑmn, not kɑmnɑt).
    // · the next unit must not be a BARE FINAL one — if it is, `cur` is the ONSET of the last syllable and the
    //   next unit is its coda, not a coda for `prev`. ចំណង is [ចំ][ណ][ង] = cɑm.nɑːŋ; stealing ណ stranded ង as
    //   its own syllable with a long inherent vowel, giving the garbled *cɑmnŋɑː*. Contrast គីមឈី, where the
    //   next unit ឈី has a written vowel and so is a real syllable — there the rule must still fire.
    for (let u = 1; u < units.length - 1; u++) {
        const cur = units[u]!;
        const prev = units[u - 1]!;
        const next = units[u + 1]!;
        const nextIsBareFinal = u + 1 === units.length - 1
            && next.vs === null && next.post === null && !(next as { drop?: boolean }).drop;
        if (cur.vs === null && cur.post === null && !cur.bantaq && cur.ons.length === 1
            && !(cur as { drop?: boolean }).drop && cur.coda === null && !nextIsBareFinal
            && prev.coda === null && prev.vs !== null) {
            prev.coda = cur.ons[0]!;
            (cur as { drop?: boolean }).drop = true;
        }
    }
    let live = units.filter((u) => !(u as { drop?: boolean }).drop);
    // A trailing bare unit (no written vowel) supplies the coda of the previous syllable; any subscript in a
    // final cluster (ចន្ទ → can) is silent, so only ons[0] is taken.
    //
    // ⚠ `last.coda === null` IS LOAD-BEARING — this rule SLICES `last` away, so a coda already assigned to it
    // by the bantaq rule above would be discarded along with it. កញ្ចក់ is [ក][ញ្ច][ក់]: ក់ correctly becomes
    // ញ្ច's coda, then this rule took ញ្ច's ons[0] as ក's coda and deleted the unit, losing the whole second
    // syllable — kɑɲ against the referee's kɑɲcɑʔ.
    const last = live[live.length - 1]!;
    if (live.length >= 2 && last.vs === null && last.post === null && !last.bantaq && last.coda === null
        && live[live.length - 2]!.coda === null) {
        const prev = live[live.length - 2]!;
        prev.coda = last.ons[0]!;
        prev.codaShort = last.ons.length > 1; // a silent trailing subscript (doubled/type-3) → short inherent
        live = live.slice(0, -1);
    }
    units.length = 0;
    units.push(...live);
    // Nasal-superscript medial cluster (CVN-): a nasal at the head of a medial cluster closes the PREVIOUS
    // syllable and its subscript opens this one (តម្រង → tɑm.rɑŋ). Only when the previous syllable can still
    // take a coda; word-initial nasal clusters (ម្រាម → mriəm) are left as genuine onset clusters.
    for (let u = 1; u < units.length; u++) {
        const cur = units[u]!;
        const prev = units[u - 1]!;
        if (cur.ons.length >= 2 && NASAL.has(cur.ons[0]!) && prev.coda === null) {
            prev.coda = cur.ons[0]!;
            cur.ons = cur.ons.slice(1);
        }
    }

    // ---- PASS 3: render with GOVERNANCE running-state -------------------------------------------------
    let lastDom: "a" | "o" | null = null; // series of the last dominant (stop/spirant) consonant seen
    let out = "";
    for (let u = 0; u < units.length; u++) {
        const unit = units[u]!;
        // An independent vowel carries its whole reading; it has no onset letter to look up, and no series to
        // govern with, so `lastDom` is left as it was. Emitted before the onset/series logic, which would read
        // `unit.ons[unit.ons.length - 1]` and find nothing.
        if (unit.iv !== undefined) {
            out += unit.iv + (unit.coda ? DEF.codas[unit.coda] ?? "" : "");
            continue;
        }
        // onset IPA — ⟨ប⟩ is [p] as the first member of a cluster, [ɓ] as a simple onset
        //
        // ⚠ ⟨ហ្វ⟩ IS THE LOAN-/f/ DIGRAPH, NOT AN h+ʋ CLUSTER. Khmer has no native /f/ and spells it ហ+coeng+វ
        // (កាហ្វេ "coffee" kaːfeː, តេឡេហ្វូន "telephone"). Both referees corroborate: wikipron writes f in
        // កាហ្វេ/ទីហ្វុង/តេឡេហ្វូន, and the google secondary surfaced the gap (ហ្វក faːk read *hʋɑːk*, 12× in
        // its residual). Letter-by-letter rendering gave hʋ, so the pair is read as one segment here.
        let onset = "";
        for (let k = 0; k < unit.ons.length; k++) {
            const letter = unit.ons[k]!;
            if (letter === "ហ" && unit.ons[k + 1] === "វ") { onset += "f"; k += 1; continue; }
            // ⟨ដ្ឋ⟩ — the Indic retroflex cluster reads [tt], not *ɗtʰ: the implosive devoices against the
            // following stop and the aspiration drops (កម្មដ្ឋាន kammattʰan → kammattan folded; referee-derived
            // tt 59 / t 38 / other 1 on the 98 ⟨ដ្ឋ⟩ words).
            if (letter === "ដ" && unit.ons[k + 1] === "ឋ") { onset += "tt"; k += 1; continue; }
            onset += letter === "ប" && (unit.bp || unit.ons.length > 1) && k === 0 ? "p" : DEF.consonants[letter]![0];
        }
        // governing series: register-shifter override, else the LAST dominant among the onset consonants,
        // else the running last-dominant (vowel harmony), else this onset's own last series.
        let gov: "a" | "o";
        if (unit.ser) {
            gov = unit.ser;
            lastDom = gov;
        } else {
            let onsetDom: "a" | "o" | null = null;
            for (const letter of unit.ons) if (!PASSIVE.has(letter)) onsetDom = DEF.consonants[letter]![1] as "a" | "o";
            if (onsetDom) { gov = onsetDom; lastDom = gov; }
            else gov = lastDom ?? (DEF.consonants[unit.ons[unit.ons.length - 1]!]![1] as "a" | "o");
        }
        const oIdx = gov === "a" ? 0 : 1;
        const codaIpa = unit.coda ? DEF.codas[unit.coda] ?? "" : "";
        // nucleus
        let nucleus: string;
        if (unit.post) {
            // multi-char vowel (base sign + ⟨ះ⟩/⟨ំ⟩): the combined reading carries its own -h/-m coda
            nucleus = DEF.vowelCombos[unit.vs! + unit.post]?.[oIdx]
                ?? (unit.vs ? DEF.vowels[unit.vs]![oIdx]! : DEF.inherent[oIdx]!) + (unit.post === NIKAHIT ? "m" : "h");
        } else if (unit.vs) {
            nucleus = DEF.vowels[unit.vs]![oIdx]!;
            if (unit.shorten) nucleus = SHORTEN[nucleus] ?? nucleus;
            // ⟨ិ⟩/⟨ី⟩ IN A NON-FINAL SYLLABLE REDUCE TO [i], both series — the table values (ə/ɨ, əj/iː) are
            // the STRESSED (final-syllable) readings, and the Indic polysyllables this fires in carry the
            // short i medially: កម្មវិធី kammaʋitʰiː not *kammaʋətʰiː, ការីយ- karij- not *karəj-.
            // Referee-derived: non-final ⟨ិ⟩ i 87 / ə 29 / e 23 / ɨ 7; non-final ⟨ី⟩ i 61 / əj 14.
            // ⟨ិ⟩/⟨ី⟩ REDUCE outside the stressed final-open position — the table values (ə/ɨ, əj) are the
            // stressed readings, and the Indic polysyllables this fires in carry [e]/[i] instead:
            // កម្មវិធី kammaʋitʰiː not *kammaʋətʰiː, កណិការ kaneka. Referee-derived: non-final ⟨ិ⟩ i/e 110 vs
            // ə 29 ɨ 7; non-final ⟨ី⟩ i(ː) 61 vs əj 14; ⟨ី⟩+coda i(ː) 135 vs əj 6.
            // ⚠ ⟨ី⟩ EMITS LONG iː — the folded metric strips length either way, but the raw referee writes
            // ទីហ្វុង t iː f o ŋ and ពីរ p iː (the first derivation read "i" as a substring of "iː" and
            // shortened the raw output of every ី word; four goldens caught it).
            if (u < units.length - 1 && (unit.vs === "ិ" || unit.vs === "ី") && !unit.coda)
                nucleus = unit.vs === "ី" ? "iː" : gov === "a" ? "e" : "i";
            if (unit.vs === "ី" && unit.coda) nucleus = "iː";
        } else if (u === units.length - 1) {
            // stressed (last) syllable. Open → LONG inherent (ក kɑː). Closed: LONG by default (a PLAIN coda —
            // កង kɑːŋ, គង kɔːŋ), but SHORT when the coda is a silent-subscript/doubled cluster (ចន្ទ can,
            // រដ្ឋ rŏət) or carries the bantaq (ចង់ cɑŋ) — Huffman IX.A.1 (long) vs IX.A.2/3 (short).
            const short = unit.codaShort || unit.shorten;
            nucleus = codaIpa === "" || !short ? DEF.inherent[oIdx]! : (gov === "a" ? "ɑ" : "uə");
            // ⟨័រ⟩ — samyok sannya with the silent-រ coda reads [oə], both series (កុងទ័រ koŋtoə,
            // កុំព្យូទ័រ kompjutoə; referee-derived 25:1 on ័រ-final words).
            if (unit.samyok && unit.coda === "រ") nucleus = "oə";
        } else {
            // unstressed presyllable → reduced short inherent. ⚠ The o-series value depends on the syllable
            // SHAPE (referee-derived over the 640 o-series-inherent presyllables: eə 223 / u 171 / ɔ 160 / ə 66):
            // CLOSED (the unit owns a coda — គម kum-, ពន pun-) → [u]; OPEN stays [ɔ] (34:20 over eə on the
            // true open-presyllable shape).
            nucleus = gov === "a" ? "ɑ" : unit.coda ? (unit.coda === "ល" || unit.coda === "ង" ? "uə" : "u") : u > 0 ? "eə" : "ɔ";
        }
        // ⚠ A NIKAHIT NUCLEUS MERGES WITH A ⟨ង⟩ CODA. ⟨ំ⟩ carries its own [-m], so កម្លាំង rendered the m AND
        // the coda: *kɑmlamŋ* against the referee's kɑmlaŋ. A velar nasal coda absorbs it — the sign marks
        // nasality and ⟨ង⟩ supplies the place.
        //
        // ⚠ THE CONDITION IS THE ASSIGNED CODA, NOT THE SPELLING, and the difference is load-bearing. Bucketing
        // the 7,108 referee rows by the consonant after ⟨ំ⟩ shows ⟨ង⟩ is the ONLY one that drops the m (68 of
        // 88; ណ 102/102, ព 64/64 and every other keep it — កាំបិត is k a m ɓ ə t). But reading the exceptions
        // individually finds two that keep it — ជំងឺ cum.ŋɨː, where ⟨ង⟩ has its own vowel, and ទំងន់ tum.ŋuən,
        // where ⟨ង⟩ is bare but OPENS the syllable that ន់ closes. In both, ⟨ង⟩ is an onset. A spelling rule
        // (⟨ំ⟩ before ⟨ង⟩) breaks both; PASS 2 has already decided the question, so ask it instead.
        if (nucleus.endsWith("m") && unit.coda === "ង") nucleus = nucleus.slice(0, -1);
        out += onset + nucleus + codaIpa;
    }
    return out.normalize("NFC");
}

// The letter class EXCLUDES U+17D4-U+17DB. ។ ៕ ៖ are Khmer's own sentence, section and colon marks and
// they sit inside the Khmer block, so the old `[ក-៝]` (U+1780-U+17DD) swallowed them and the clause group
// was unreachable — every sentence boundary in Khmer text was dropped. Same shape as the Burmese and Greek
// cases; see the audit note in burmese.ts.
const TOKEN = /([ក-៓ៜ-៝]+)|([\d០-៩]+)|([។៕?!,.៖])/gu;

/** Build the Khmer phonemizer. */
/**
 * Build the Khmer phonemizer.
 *
 * ⚠ `segment` RESTORES THE WORD BOUNDARIES KHMER DOES NOT WRITE, and it defaults ON. Khmer has no inter-word
 * space, so `TOKEN` takes a maximal Khmer run as one unit and the syllabifier re-parses across boundaries it
 * cannot see: measured on 4,000 junctions where a writer actually typed U+200B, joining two words corrupts the
 * reading 54.6% of the time (`នៅ|សតវត្ស` → *nɨwhtɑʋɑt* against *nɨw + sɑtɑʋoət*, a coda stolen and a syllable
 * lost). `khmerPerceptron.ts` predicts those boundaries and inserts U+200B, which TOKEN already breaks runs on;
 * end-to-end agreement with the boundary-aware reading goes 44.7% → 79.2%, and against independent human
 * gold (wikipron) 36.4% → 80.4%.
 *
 * ⚠ IT COSTS ~2.6x THE SYNC PATH'S TIME, measured rather than assumed: 3,480 characters of Khmer prose take
 * 2.4 ms unsegmented against 6.2 ms with restoration, i.e. ~1.8 µs per character. That is the price of a Map
 * lookup for each of 11 features at every character position, and it is paid on every `phonemize` call for this
 * language. Recorded because it is a real regression in a hot path, accepted because the readings it fixes are
 * more than half of all word junctions.
 *
 * ⚠ AND THE ASYNC PATH MUST PASS `segment: false`. `khmerNeural.ts` restores boundaries with the BiLSTM (83.5%)
 * before calling this, and running the perceptron over an already-segmented run would let it split the pieces
 * AGAIN — two models compounding each other's over-splits. The flag exists for that one caller.
 */
export function createKhmer(opts: { segment?: boolean } = {}): Phonemizer {
    const segment = opts.segment ?? true;
    return {
        text(input: string): string {
            // Normalization BEFORE tokenizing: TOKEN is a deliberately minimal three-way split and skips every
            // symbol it does not name, so a symbol has to become a Khmer word before it gets here. See
            // normalize.ts for what each rule reads and where its vocabulary was sourced.
            //
            // Boundary restoration comes AFTER normalization, and that order is load-bearing: the normalizer's own
            // separator class already includes U+200B (it de-groups thousands across one), so inserting boundaries
            // first would feed its rules a text they were not measured against.
            const normalized = normalizeKhmer(input);
            return assembleClauses(segment ? restoreBoundaries(normalized) : normalized, TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(m[1]));
                else if (m[2]) {
                    // Khmer digits ០–៩ (U+17E0–17E9) → ASCII, then compose (see numbers.ts).
                    const ascii = [...m[2]].map((d) => (d >= "០" && d <= "៩" ? String(d.codePointAt(0)! - 0x17e0) : d)).join("");
                    for (const wd of numberToKhmerWords(Number(ascii))) sink.emit(phonemizeWord(wd));
                }
                else if (m[3]) {
                    const mk = DEF.clausePunctuation[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        },
    };
}
