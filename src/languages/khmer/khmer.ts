/**
 * Khmer / ភាសាខ្មែរ (km) text phonemizer — Austroasiatic (Mon-Khmer), the Khmer abugida, canonical IPA,
 * espeak-independent. Cambodia's national language (~18M). NON-tonal but SESQUISYLLABIC.
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
 * logical-order, so no leading-vowel reorder is needed. See docs/investigations/km_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { numberToKhmerWords } from "./numbers.ts";

interface KhmerDef {
    consonants: Record<string, [string, string]>;
    vowels: Record<string, [string, string]>;
    vowelCombos: Record<string, [string, string]>;
    codas: Record<string, string>;
    inherent: [string, string];
    clausePunctuation: Record<string, string>;
}

const DEF = loadManifest<KhmerDef>(import.meta.url, "khmer.jsonc");
const COENG = "្"; // U+17D2 — subscript former
const TOANDAKHIAT = "៍"; // U+17CD — silences the consonant it sits on
const MUUSIKATOAN = "៉"; // U+17C9 — converts a 2nd-series (o) consonant to 1st-series (a)
const TRIISAP = "៊"; // U+17CA — converts a 1st-series (a) consonant to 2nd-series (o)
const BANTOC = "់"; // U+17CB — shortens the vowel; sits on a coda consonant
const REAHMUK = "ះ"; // U+17C7 — adds an -h coda (combines with a preceding base vowel)
const NIKAHIT = "ំ"; // U+17C6 — adds an -m coda (combines with a preceding base vowel)
// Combining diacritics consumed after a unit's vowel (register shifters + bantoc handled separately, rest ignored).
const DIACRITICS = new Set(["់", "៉", "៊", "៌", "៍", "៎", "៏", "័", "៑", "៓", "ៈ"]);
// A long vowel shortened by the /bantaq/ (់): កាត់ kaːt → kat, ចាប់ caːp → cap.
const SHORTEN: Record<string, string> = {
    "aː": "a", "ɛː": "ɛ", "eː": "e", "oː": "o", "uː": "u", "iː": "i", "ɨː": "ɨ", "əː": "ə", "ɔː": "ɔ", "ɑː": "ɑ",
};
// Passive consonants = continuants (nasals, semivowels, liquids); everything else is a dominant stop/spirant.
const PASSIVE = new Set(["ង", "ញ", "ណ", "ន", "ម", "យ", "រ", "ល", "វ", "ឡ"]);
const NASAL = new Set(["ង", "ញ", "ណ", "ន", "ម"]);

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
}

// Exceptions lexicon (word → canonical IPA) for the RULE-UNPREDICTABLE residual — inherent-vowel length,
// internal-doubling, Pali/Sanskrit loanword vowels. These are LEXICAL (not derivable from the spelling, per
// Huffman 1970), so — the Romanian-stress / akan-tone pattern — a mined lexicon carries them and the shipped
// phonemizeWord consults it dict-first. phonemizeWordRules NEVER reads it, keeping the referee eval non-circular
// (the lexicon is derived FROM the wikipron referee). Mined by tools/gen/build-km-lexicon.mts. See
// docs/investigations/km_native_bringup_investigation.md Run 5.
const LEX: ReadonlyMap<string, string> = loadTsvMap(import.meta.url, "km-lexicon.tsv", undefined, { optional: true });

/** One Khmer word → canonical IPA. SHIPPED path: the exceptions lexicon first (Huffman-lexical words the rules
 *  cannot predict), else the rule engine. */
export function phonemizeWord(word: string): string {
    return LEX.get(word) ?? phonemizeWordRules(word);
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
        if (!(c in DEF.consonants)) { i += 1; continue; } // independent vowels / stray marks — skip (Phase 1)
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
        while (DIACRITICS.has(s[i] ?? "")) {
            if (s[i] === TOANDAKHIAT) silent = true;
            if (s[i] === BANTOC) bantaq = true;
            i += 1;
        }
        if (!silent) units.push({ ons, vs, post, bantaq, ser, bp, coda: null, shorten: false, codaShort: false });
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
    for (let u = 1; u < units.length - 1; u++) {
        const cur = units[u]!;
        const prev = units[u - 1]!;
        if (cur.vs === null && cur.post === null && !cur.bantaq && cur.ons.length === 1
            && !(cur as { drop?: boolean }).drop && prev.coda === null && prev.vs !== null) {
            prev.coda = cur.ons[0]!;
            (cur as { drop?: boolean }).drop = true;
        }
    }
    let live = units.filter((u) => !(u as { drop?: boolean }).drop);
    // A trailing bare unit (no written vowel) supplies the coda of the previous syllable; any subscript in a
    // final cluster (ចន្ទ → can) is silent, so only ons[0] is taken.
    const last = live[live.length - 1]!;
    if (live.length >= 2 && last.vs === null && last.post === null && !last.bantaq && live[live.length - 2]!.coda === null) {
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
        // onset IPA — ⟨ប⟩ is [p] as the first member of a cluster, [ɓ] as a simple onset
        let onset = "";
        for (let k = 0; k < unit.ons.length; k++) {
            const letter = unit.ons[k]!;
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
        } else if (u === units.length - 1) {
            // stressed (last) syllable. Open → LONG inherent (ក kɑː). Closed: LONG by default (a PLAIN coda —
            // កង kɑːŋ, គង kɔːŋ), but SHORT when the coda is a silent-subscript/doubled cluster (ចន្ទ can,
            // រដ្ឋ rŏət) or carries the bantaq (ចង់ cɑŋ) — Huffman IX.A.1 (long) vs IX.A.2/3 (short).
            const short = unit.codaShort || unit.shorten;
            nucleus = codaIpa === "" || !short ? DEF.inherent[oIdx]! : (gov === "a" ? "ɑ" : "uə");
        } else {
            nucleus = gov === "a" ? "ɑ" : "ɔ"; // unstressed presyllable → reduced short inherent
        }
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
export function createKhmer(): Phonemizer {
    return {
        text(input: string): string {
            return assembleClauses(input, TOKEN, (m, sink) => {
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
