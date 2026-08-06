/**
 * Native Igbo / Asụsụ Igbo (ig) text phonemizer — canonical IPA, espeak-independent. Igboid (Volta-Niger,
 * Niger-Congo), Yoruba's sibling. A phonemic Latin orthography → a rule-based g2p (the tonal-Latin pattern).
 * Signature features: the labial-velars ⟨gb⟩→ɡ͡b / ⟨kp⟩→k͡p, the labialised ⟨nw⟩→ŋʷ ⟨gw⟩→ɡʷ ⟨kw⟩→kʷ, ⟨ny⟩→ɲ,
 * ⟨ch⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ, ⟨gh⟩→ɣ, ⟨r⟩→ɾ; the 8-vowel harmony with dotted ị→ɪ ọ→ɔ ụ→ʊ; syllabic m̩/n̩. TWO tones
 * — High=acute ˥, Low=grave ˩ (Chao letters), downstep=macron ˧ — but Igbo standard orthography usually OMITS
 * tone, so a vowel is toned only when its diacritic is present. NO independent referee exists (no wikipron/epitran/
 * kaikki) → validated against an adjudicated gold. See docs/investigations/ig_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeIgbo } from "./normalize.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { latinPhone } from "../../core/latinPhones.ts";

interface IgboDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    tones: { high: string; low: string; down: string };
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<IgboDef>(import.meta.url, "igbo.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const DOT_BELOW = "̣", ACUTE = "́", GRAVE = "̀", MACRON = "̄";
const TONE_MARK = new Set([ACUTE, GRAVE, MACRON]);
const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const toneOf = (mark: string): string =>
    mark === ACUTE ? DEF.tones.high : mark === GRAVE ? DEF.tones.low : DEF.tones.down;

/** One Igbo word → canonical IPA (segments + tone-when-marked). */
export function phonemizeWord(word: string): string {
    const s = [...word.toLowerCase().normalize("NFD")];
    const n = s.length;
    let out = "";

    for (let i = 0; i < n; ) {
        const c = s[i]!;
        // Base vowel + combining marks: dot-below → the [-ATR] ị/ọ/ụ; tone accent → Chao letter (else no tone).
        if (isVowelLetter(c)) {
            let ipa = DEF.vowels[c]!;
            let tone = "";
            let dot = false;
            i++;
            while (i < n && (s[i] === DOT_BELOW || TONE_MARK.has(s[i]!))) {
                if (s[i] === DOT_BELOW) dot = true;
                else tone = toneOf(s[i]!);
                i++;
            }
            if (dot) ipa = c === "i" ? "ɪ" : c === "o" ? "ɔ" : c === "u" ? "ʊ" : ipa;
            out += ipa + tone;
            continue;
        }
        // Syllabic nasal: m/n directly before a tone mark (ḿ, ǹ) → m̩/n̩ carrying that tone.
        if ((c === "m" || c === "n") && TONE_MARK.has(s[i + 1] ?? "")) {
            out += (c === "m" ? "m̩" : "n̩") + toneOf(s[i + 1]!);
            i += 2;
            continue;
        }
        // ⟨ṅ⟩ (n with dot ABOVE, U+0307) → ŋ.
        if (c === "n" && s[i + 1] === "̇") {
            out += "ŋ";
            i += 2;
            continue;
        }
        // Digraphs (longest-first): ch/gb/gh/gw/kp/kw/nw/ny/sh.
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out += DEF.digraphs[dg];
            i += 2;
            continue;
        }
        if (c in DEF.consonants) {
            out += DEF.consonants[c];
            i++;
            continue;
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed. Only
        // reached when every grapheme (digraphs included) has declined, so the language's own reading wins (#663).
        out += latinPhone(c, { initial: i === 0, includeH: true }) ?? "";
        i++;
    }
    return out.normalize("NFC");
}

// A word = Latin letters (incl. accented/dotted) plus combining marks.
const TOKEN = /([A-Za-zÀ-ɏḀ-ỿ̀-ͯ]+)|(\d+)|([.?!,;:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class IgboPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Normalization BEFORE tokenizing: TOKEN is a three-way split that skips every symbol it does not name,
        // so a symbol has to become an Igbo word before it gets here. See normalize.ts for each reading's source.
        return assembleClauses(normalizeIgbo(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // ⚠ DIGITS GO TO THE IGBO COMPOSITOR, NEVER TO `foreign`. The registry wires `foreign` to the ENGLISH
            // phonemizer for Latin-script fallback, so `1945` used to read *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd
            // fˈɔːɹt̬i fˈaᶦv* — fluent English inside Igbo speech. numbers.ts always answers (digit-by-digit in
            // Igbo units beyond its range), so no digit can reach the foreign path again.
            else if (m[2]) { for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd)); }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Igbo phonemizer. */
export function createIgbo(foreign?: ForeignPhonemizer): Phonemizer {
    return new IgboPhonemizer(foreign);
}
