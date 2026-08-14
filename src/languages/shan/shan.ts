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
import { readForeignRun } from "../../core/foreign.ts";
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

/**
 * ⟨ꧦ⟩ U+A9E6 MYANMAR MODIFIER LETTER SHAN REDUPLICATION — "say the preceding syllable again".
 *
 * ⚠ THE MODULE HEADER HAS CLAIMED "the ໆ-style repetition mark" SINCE BRING-UP AND NOTHING IMPLEMENTED IT.
 * The character is not an onset, so the scan below stepped over it and it read as nothing: `silentCharsIn`
 * reported it ×10, `ႁတ်းꧦႁၢၼ်ꧦဝႃႈ → hat̚˥ haːn˨˦ waː˧˧˨`. Every one of the corpus's ten instances follows a
 * COMPLETE syllable and intensifies it — ႁတ်းꧦႁၢၼ်ꧦ (ႁတ်းႁၢၼ် "bold" → "boldly"), တႅမ်ႈꧦမၢႆꧦ, လၢႆꧦ
 * ("various"), ငၢႆႈꧦ ("easily"), တႄႉꧦ, ဝႃႈꧦ — which is precisely how Lao ໆ and Thai ๆ behave, and
 * `lao.ts` already reads its own mark by copying the last syllable. Same rule, same shape.
 */
const REDUPLICATION = "ꧦ";

/** Phonemize one Shan word → canonical IPA: per-syllable abugida scan + explicit tone. */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let last = ""; // the syllable just emitted, for ⟨ꧦ⟩ to repeat
    let i = 0;
    while (i < n) {
        // ⚠ BEFORE the onset test, because ⟨ꧦ⟩ is not an onset and the `continue` below would step over it.
        // A mark with nothing before it repeats nothing rather than guessing at the previous WORD.
        if (s[i] === REDUPLICATION) { out += last; i++; continue; }
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
        last = onset + medialGlide + nucleus + og + coda + tone;
        out += last;
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
// ⚠ `ꧠ-꧿` IS MYANMAR EXTENDED-B, AND ITS ABSENCE CUT EVERY REDUPLICATED WORD IN TWO. The class
// listed the main block, Extended-A (`ꩠ-ꩿ`) and the two tails, and skipped Extended-B — where ⟨ꧦ⟩ U+A9E6
// lives, along with the Shan Pali letters ⟨ꧠ ꧡ ꧣ ꧤ⟩. So `ႁတ်းꧦႁၢၼ်ꧦဝႃႈ` tokenized as three separate words
// with the marks stranded in the gap, and no reduplication rule inside `phonemizeWord` could ever have seen
// one. The token class and the grapheme table both had a hole, and only fixing both shows a change.
const TOKEN = /([က-၉၌-ႏႚ-႟ꧠ-꧿ꩠ-ꩿ]+)|(\d+|[႐-႙]+)|([၊။.!?…,;:])/gu;

/**
 * BURMESE-ONLY CONSONANTS — the letters of the Myanmar block that the SHAN alphabet does not use.
 *
 * ⚠ THE SILENT-DELETION SCAN NAMED ⟨က ×76 န ×70 အ ×59 ည ×41 ခ ×30⟩ AND NONE OF THEM IS A SHAN LETTER.
 * They are Burmese, and they are in a Shan corpus because 15 of its 407 lines are BURMESE TEXT — quotations,
 * Burmese-language passages, Burmese proper names. `silentCharsIn` cannot filter them the way it filters an
 * IPA gloss: its native-script test asks whether a word is in the corpus's dominant SCRIPT, and Burmese and
 * Shan are the same script. So the report is right that the characters say nothing and wrong about why.
 *
 * ⚠ AND THE SILENCE WAS THE LESSER HALF. `phonemizeWord` steps over a character that is not an onset, which
 * leaves the surrounding Burmese vowel signs to attach to whatever consonant comes next: `ပတ်ဝန်းကျင်`
 * ("environment") read *pat̚˨˦waː˨˦ŋaː˨˦*, `သည်` read *sʰaː˨˦*. That is a wrong reading, not a gap.
 *
 * So a run carrying one of these goes to the SCRIPT ROUTER, which sends Myanmar to `my` — the Burmese engine
 * this file's own syllable scan was modelled on. `ပတ်ဝန်းကျင် → paʔwʊ˥˩ɴd͡ʑɪ˨ɴ`, `သည် → ðɛ˨`.
 *
 * ⚠ THE SET IS THE COMPLEMENT OF THE SHAN INVENTORY, not a list of "Burmese-looking" letters: ⟨င တ ထ ပ မ ယ
 * ရ လ ဝ သ⟩ are shared and are excluded, so a Shan word can never match. Measured on the corpus: 123 distinct
 * tokens contain one, and all 123 are Burmese — no false positive. The converse is not claimed and cannot
 * be: a Burmese word built only from shared letters is indistinguishable from Shan without language ID, and
 * those still read as Shan. This is a floor, not a fence.
 */
const BURMESE_ONLY = /[က-ဃစ-ဏဒ-နဖ-ဘဟ-အ]/u;

class ShanPhonemizer implements Phonemizer {
    text(input: string): string {
        // Shan digits (U+1090–1099) fold to ASCII up front (core/unicode.ts), so a Shan-digit run composes
        // exactly like a Western one. The token class still admits ႐-႙ so an unfolded digit could never
        // fall between the WORD ranges and vanish.
        return assembleClauses(foldNativeDigits(input), TOKEN, (m, sink) => {
            if (m[1]) {
                // ⚠ THE ROUTER FIRST, THE OLD BEHAVIOUR AS THE FALLBACK. `readForeignRun` declines when no
                // router is registered — which is what a direct `import` of this module in a test looks
                // like — and declining must not delete the text, so the run then reads as Shan exactly as
                // it did before. In the shipped pipeline the registry always has a router.
                const foreign = BURMESE_ONLY.test(m[1]) ? readForeignRun(m[1]) : undefined;
                if (foreign !== undefined) { if (foreign !== "") sink.emit(foreign); return; }
                sink.emit(phonemizeWord(m[1]));
            }
            else if (m[2]) for (const wd of numberToShanWords(Number(m[2]))) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "။" || m[3] === "." || m[3] === "!" || m[3] === "?" ? "." : ",");
        });
    }
}

/** Build the Shan phonemizer (abugida syllable scan + explicit lexical tone). */
export function createShan(): Phonemizer {
    return new ShanPhonemizer();
}
