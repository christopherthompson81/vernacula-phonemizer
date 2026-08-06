/**
 * Shan / Tai Long (shn) phonemizer — လိၵ်ႈတႆး, Southwestern Tai (Tai-Kadai), the SHAN ABUGIDA (a Myanmar-script variant,
 * Unicode U+1000–U+109F incl. the Shan letters U+1075–U+108F), TONAL, canonical IPA. The fleet's
 * first Shan. A per-syllable scan (the Burmese template) — onset consonant → medials (ွ/ႂ→w, ျ palatalises) → the RIME
 * (vowel signs × coda) → the TONE. Unlike Burmese, Shan tone is LEXICAL and marked with EXPLICIT diacritics
 * (unmarked→˨˦, ႇ→˩, ႈ→˧˧˨, visarga း→˥, ႉ→˦˨), so the tone is a direct lookup. Words are space-separated (no DAG
 * segmentation needed). THIN human single-source (wikipron, 2607).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";

// Onset consonants (Shan letters + shared Myanmar letters) → IPA.
const ONSET: Record<string, string> = {
    "ၵ": "k", "ၶ": "kʰ", "ၸ": "t͡ɕ", "သ": "sʰ", "ထ": "tʰ", "ပ": "p", "ၽ": "pʰ", "ၾ": "f", "တ": "t", "ၼ": "n",
    "မ": "m", "လ": "l", "ဝ": "w", "ယ": "j", "ရ": "r", "ႁ": "h", "ႀ": "θ", "ဢ": "ʔ", "င": "ŋ", "ၺ": "ɲ",
};
// Coda consonants (a killed consonant, C + asat ်) → IPA. Nasals + checked stops (unreleased).
const CODA: Record<string, string> = {
    "င": "ŋ", "ၼ": "n", "မ": "m", "ၵ": "k̚", "တ": "t̚", "ပ": "p̚", "ၺ": "j", "ဝ": "w",
};
// Tone marks → Chao tone. Unmarked = ˨˦ (rising).
const TONE: Record<string, string> = { "း": "˥", "ႇ": "˩", "ႈ": "˧˧˨", "ႉ": "˦˨", "ႊ": "˧" };
const UNMARKED_TONE = "˨˦";

const ASAT = "်"; // U+103A — kills a consonant → coda
const MED_Y = "ျ", MED_R = "ြ", MED_W1 = "ွ", MED_W2 = "ႂ";
const MEDIALS = new Set([MED_Y, MED_R, MED_W1, MED_W2]);
// Palatalisation of an onset by ျ: ⟨ၵျ⟩→d͡ʑ (voiced), ⟨ၶျ⟩→t͡ɕʰ, ⟨သျ⟩→ʃ.
const PALATAL: Record<string, string> = { "k": "d͡ʑ", "kʰ": "t͡ɕʰ", "sʰ": "ʃ" };

// Vowel signs (above/below/after the onset) → an abstract vowel key. Combos resolved in rime().
const VSIGN: Record<string, string> = {
    // ⟨ၢ⟩ (U+1062) and ⟨ႃ⟩ (U+1083) are BOTH long [aː] — ⟨ၢ⟩ writes closed-syllable /aː/, ⟨ႃ⟩ the open one; short /a/
    // is the inherent (sign-less) vowel.
    "ႃ": "aa", "ိ": "i", "ီ": "ii", "ု": "u", "ူ": "uu", "ေ": "ee", "ႄ": "ee_open",
    "ဵ": "e_short", "ႅ": "ee_short", "ၢ": "aa", "ႆ": "FINAL_Y",
};
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
// Digit runs were previously emitted RAW (a digit leak into the IPA). Shan is Southwestern Tai, so the system is
// structurally Thai's (see thai.ts) with the cognate irregulars: 20 is သၢဝ်း (sao) and REPLACES the whole "twenty"
// (no သိပ်း), and a FINAL 1 in any compound ≥11 is ဢဵတ်း (et) rather than ၼိုင်ႈ (nueng) — သိပ်းဢဵတ်း 11,
// သၢဝ်းဢဵတ်း 21. Tens 30–90 are unit-first (သၢမ်သိပ်း = 3×10). SHAN-SCRIPT words only; the abugida scan reads them.
// Sources: Wiktionary "Category:Shan numerals" (ၼိုင်ႈ … ၵဝ်ႈ, သိပ်း, သၢဝ်း, ဢဵတ်း, the 30–90 unit+သိပ်း forms,
// ပၢၵ်ႇ 100, ႁဵင် 1000, မိုၼ်ႇ 10⁴, သႅၼ် 10⁵) — https://en.wiktionary.org/wiki/Category:Shan_numerals — cross-checked
// against Omniglot "Numbers in Shan" (https://www.omniglot.com/language/numbers/shan.htm), which agrees on all of
// 0–100 + ပၢၵ်ႇ/ႁဵင်/မိုၼ်ႇ/သႅၼ်.
// JUDGMENT CALL: neither source attests a word for 10⁶. Rather than invent one (the expected Tai cognate လၢၼ်ႉ is
// unattested in both), the magnitude ladder STOPS at သႅၼ် (10⁵) and larger values are composed as multiples of it
// (10⁶ = သိပ်းသႅၼ် "ten hundred-thousand", 10⁹ = ၼိုင်ႈမိုၼ်ႇသႅၼ်) — compositional from cited words only.
const SHN_UNITS = ["သုၼ်", "ၼိုင်ႈ", "သွင်", "သၢမ်", "သီႇ", "ႁႃႈ", "ႁူၵ်း", "ၸဵတ်း", "ပႅတ်ႇ", "ၵဝ်ႈ"];
const SHN_MAG: [number, string][] = [[1e5, "သႅၼ်"], [1e4, "မိုၼ်ႇ"], [1e3, "ႁဵင်"], [100, "ပၢၵ်ႇ"]];

function numberToShanWords(n: number): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => SHN_UNITS[Number(d)]!);
    }
    if (n === 0) return [SHN_UNITS[0]!];
    const out: string[] = [];
    let r = n;
    for (const [v, w] of SHN_MAG) {
        if (r >= v) {
            const q = Math.floor(r / v);
            out.push(...numberToShanWords(q), w);
            r %= v;
        }
    }
    if (r >= 10) {
        const t = Math.floor(r / 10);
        if (t === 2) out.push("သၢဝ်း"); // 20 = သၢဝ်း alone (သၢဝ်းသွင် = 22)
        else if (t === 1) out.push("သိပ်း");
        else out.push(SHN_UNITS[t]!, "သိပ်း");
        r %= 10;
    }
    if (r === 1 && n >= 11) out.push("ဢဵတ်း"); // final 1 in a compound → ဢဵတ်း
    else if (r > 0) out.push(SHN_UNITS[r]!);
    return out;
}

// Shan digits U+1090–1099 → ASCII, so a Shan-digit run composes like an ASCII one.
const SHN_DIGIT: Record<string, string> = {
    "႐": "0", "႑": "1", "႒": "2", "႓": "3", "႔": "4", "႕": "5", "႖": "6", "႗": "7", "႘": "8", "႙": "9",
};


// A Shan word (Myanmar-block letters/signs, EXCLUDING the dandas U+104A/104B and the Shan digits U+1090–99) / number
// (ASCII or Shan digits) / punctuation (incl. the Myanmar dandas). Space-separated.
const TOKEN = /([က-၉၌-ႏႚ-႟ꩠ-ꩿ]+)|(\d+|[႐-႙]+)|([၊။.!?…,;:])/gu;

class ShanPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const ascii = [...m[2]].map((d) => SHN_DIGIT[d] ?? d).join("");
                for (const wd of numberToShanWords(Number(ascii))) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) sink.pause(m[3] === "။" || m[3] === "." || m[3] === "!" || m[3] === "?" ? "." : ",");
        });
    }
}

/** Build the Shan phonemizer (abugida syllable scan + explicit lexical tone). */
export function createShan(): Phonemizer {
    return new ShanPhonemizer();
}
