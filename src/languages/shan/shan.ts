/**
 * Shan (shn) phonemizer — a per-syllable abugida scan (the Burmese template), canonical IPA. This file
 * owns the syllable machinery: onset → medials (ွ/ႂ/ျ) → the RIME resolver (vowel-sign combos × medial-w
 * × coda — positional logic) → the explicit lexical tone, plus the ႉ-tone glottalisation and the ໆ-style
 * repetition mark. The letter values, tone marks, number words and the encyclopedic record live in
 * shan.jsonc.
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface ShanNumbers {
    units: string[];
    ten: string;
    twenty: string;
    finalOne: string;
    magnitudes: [number, string][];
}
interface ShanDef {
    onsets: Record<string, string>;
    codas: Record<string, string>;
    tones: Record<string, string>;
    unmarkedTone: string;
    palatal: Record<string, string>;
    vowelSigns: Record<string, string>;
    numbers: ShanNumbers;
}
const DEF = loadManifest<ShanDef>(import.meta.url, "shan.jsonc");
// Letter tables (shan.jsonc): onsets, the 8-way coda set, tone marks, palatalisation, vowel-sign keys.
const ONSET = DEF.onsets;
const CODA = DEF.codas;
const TONE = DEF.tones;
const UNMARKED_TONE = DEF.unmarkedTone;
const PALATAL = DEF.palatal;
const VSIGN = DEF.vowelSigns;

const ASAT = "်"; // U+103A — kills a consonant → coda
const MED_Y = "ျ", MED_R = "ြ", MED_W1 = "ွ", MED_W2 = "ႂ";
const MEDIALS = new Set([MED_Y, MED_R, MED_W1, MED_W2]);
const isVSign = (c: string | undefined): boolean => c !== undefined && VSIGN[c] !== undefined;
const isOnset = (c: string | undefined): boolean => c !== undefined && ONSET[c] !== undefined;

/**
 * Resolve the rime → { nucleus, offglide } from the vowel-sign keys, the medial -w-, whether there is a coda, and
 * the offglide letter (ဝ→"w", ႆ/ၺ→"j", ႂ→"ɰ"). The Shan quirks: ⟨ူ⟩ is uː open but [o] closed (and ⟨ူ⟩+ဝ→oː);
 * a medial ⟨ွ⟩ over the inherent vowel ROUNDS the rime to [ɔ] (no -w- glide); ⟨ၢ⟩ is short [a], ⟨ႃ⟩ long [aː].
 */
function rime(keys: string[], medialW: boolean, closed: boolean, offglide: string): { nucleus: string; glide: string } {
    const has = (k: string): boolean => keys.includes(k);
    const noSign = !keys.length;
    // A medial ⟨ွ/ႂ⟩ with NO vowel sign rounds the inherent rime to [ɔ] (ၵွင်→kɔŋ), not a -w- glide.
    if (medialW && noSign) return { nucleus: closed || offglide ? "ɔ" : "ɔː", glide: offglide };
    // ⟨ူ⟩ (uu): open→uː, but +ဝ→oː (the ဝ merges to length), else closed→o.
    if (has("uu") && !has("i")) {
        if (offglide === "w") return { nucleus: "oː", glide: "" };
        return { nucleus: closed || offglide ? "o" : "uː", glide: offglide };
    }
    // Combos.
    if (has("i") && has("uu")) return { nucleus: closed && offglide !== "w" ? "ɤ" : "ɤː", glide: offglide === "w" ? "" : offglide }; // ိူ (+ဝ→ɤː, else short before a coda)
    if (has("i") && has("u")) return { nucleus: offglide === "w" ? "ɯː" : closed ? "ɯ" : "ɯː", glide: offglide === "w" ? "" : offglide }; // ို (+ဝ→ɯː; short before a plain coda)
    if (has("ee") && has("aa")) return { nucleus: "ɔː", glide: offglide }; // ေႃ
    // Single-sign nuclei.
    let nucleus: string;
    if (has("aa")) nucleus = "aː";
    else if (has("ii")) nucleus = "iː";
    else if (has("u")) nucleus = closed || offglide ? "u" : "uː";
    else if (has("ee")) nucleus = "eː";
    else if (has("ee_open")) nucleus = "ɛː";
    else if (has("i")) nucleus = closed || offglide ? "i" : "iː";
    else if (has("e_short")) nucleus = "e";
    else if (has("ee_short")) nucleus = "ɛ";
    else nucleus = closed || offglide ? "a" : "aː"; // inherent (sign-less): short [a] closed, long [aː] open
    return { nucleus, glide: offglide };
}

/** Phonemize one Shan word → canonical IPA: per-syllable abugida scan + explicit tone. */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;
    while (i < n) {
        if (!isOnset(s[i])) { i++; continue; } // stray sign / space handled by text()
        let onset = ONSET[s[i]!]!;
        i++;
        // Medials. Only ⟨ွ⟩ (U+103D) ROUNDS the inherent rime to [ɔ]; ⟨ႂ⟩ (U+1082) stays a plain -w- glide.
        let glide = "";
        let palatal = false, roundW = false, plainW = false;
        while (i < n && MEDIALS.has(s[i]!)) {
            if ((s[i] === MED_W1 || s[i] === MED_W2) && s[i + 1] === ASAT) break; // ⟨ွ/ႂ⟩+asat is a CODA offglide, not a medial
            if (s[i] === MED_Y) palatal = true;
            else if (s[i] === MED_R) glide = "r"; // ြ medial r
            else if (s[i] === MED_W1) roundW = true; // ⟨ွ⟩
            else plainW = true; // ⟨ႂ⟩
            i++;
        }
        const medialW = roundW;
        if (palatal) onset = PALATAL[onset] ?? onset + "j";
        // Vowel signs.
        const keys: string[] = [];
        while (i < n && isVSign(s[i])) { keys.push(VSIGN[s[i]!]!); i++; }
        // Coda: a killed consonant (C + asat) — a nasal/stop, or an offglide letter (ဝ→w, ႂ→ɰ).
        let coda = "", offglide = "";
        if (keys.includes("FINAL_Y")) offglide = "j"; // ⟨ႆ⟩ vowel sign = -j offglide
        if (s[i + 1] === ASAT && (isOnset(s[i]) || s[i] === MED_W2 || s[i] === MED_W1)) {
            const cd = s[i] === MED_W2 ? "ɰ" : s[i] === MED_W1 ? "w" : (CODA[s[i]!] ?? "");
            if (cd === "w" || cd === "j" || cd === "ɰ") offglide = cd;
            else coda = cd;
            i += 2;
        }
        // Tone mark.
        let tone = UNMARKED_TONE;
        while (i < n && TONE[s[i]!] !== undefined) { tone = TONE[s[i]!]!; i++; }
        // Tone 5 (ႉ, ˦˨) GLOTTALISES to ˦˨ˀ on a NON-word-final syllable (phrase-medial reinforcement).
        if (tone === "˦˨" && s.slice(i).some((c) => isOnset(c))) tone += "ˀ";
        // Build the rime.
        const { nucleus, glide: og } = rime(
            keys.filter((k) => k !== "FINAL_Y"), medialW, coda !== "" || offglide !== "", offglide,
        );
        // ⟨ြ⟩→ -r- glide; ⟨ွ⟩ keeps a real -w- glide only WITH a real vowel sign (a bare ⟨ွ⟩ — or ⟨ွ⟩+ႆ offglide only —
        // rounded the rime to ɔ above, so no glide).
        const realSigns = keys.filter((k) => k !== "FINAL_Y").length;
        const medialGlide = glide === "r" ? "r" : plainW || (roundW && realSigns !== 0) ? "w" : "";
        // Order: onset + (-w-) + nucleus + offglide + coda + tone (the Chao tone sits at the syllable end).
        out += onset + medialGlide + nucleus + og + coda + tone;
    }
    return out.normalize("NFC");
}

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────
// Digit runs were previously emitted RAW (a digit leak into the IPA). SHAN-SCRIPT words only (data +
// provenance in shan.jsonc); the abugida scan reads them.
const NUM = DEF.numbers;
const SHN_UNITS = NUM.units;

function numberToShanWords(n: number): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => SHN_UNITS[Number(d)]!);
    }
    if (n === 0) return [SHN_UNITS[0]!];
    const out: string[] = [];
    let r = n;
    for (const [v, w] of NUM.magnitudes) {
        if (r >= v) {
            const q = Math.floor(r / v);
            out.push(...numberToShanWords(q), w);
            r %= v;
        }
    }
    if (r >= 10) {
        const t = Math.floor(r / 10);
        if (t === 2) out.push(NUM.twenty); // 20 = သၢဝ်း alone (သၢဝ်းသွင် = 22)
        else if (t === 1) out.push(NUM.ten);
        else out.push(SHN_UNITS[t]!, NUM.ten);
        r %= 10;
    }
    if (r === 1 && n >= 11) out.push(NUM.finalOne); // final 1 in a compound → ဢဵတ်း
    else if (r > 0) out.push(SHN_UNITS[r]!);
    return out;
}



// A Shan word (Myanmar-block letters/signs, EXCLUDING the dandas U+104A/104B and the Shan digits U+1090–99) / number
// (ASCII or Shan digits) / punctuation (incl. the Myanmar dandas). Space-separated.
const TOKEN = /([က-၉၌-ႏႚ-႟ꩠ-ꩿ]+)|(\d+|[႐-႙]+)|([၊။.!?…,;:])/gu;

class ShanPhonemizer implements Phonemizer {
    text(input: string): string {
        // Shan digits (U+1090–1099) fold to ASCII up front (core/unicode.ts), so a Shan-digit run composes
        // exactly like a Western one. The token class still admits ႐-႙ so an unfolded digit could never
        // fall between the WORD ranges and vanish.
        return assembleClauses(foldNativeDigits(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToShanWords(Number(m[2]))) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "။" || m[3] === "." || m[3] === "!" || m[3] === "?" ? "." : ",");
        });
    }
}

/** Build the Shan phonemizer (abugida syllable scan + explicit lexical tone). */
export function createShan(): Phonemizer {
    return new ShanPhonemizer();
}
