/**
 * Balochi (bal) cardinal number compositor — DECIMAL IRANIAN in its 1-999 core (Persian-shaped: units + irregular
 * teens + a distinct round-ten word, groups linked by the enclitic connective -u) but INDIC in its magnitudes.
 *
 * SOURCE: Jahani & Korn (2009), "Balochi", in *The Iranian Languages*, §3.1.6 + Table 11.19 (Cardinal Numbers) —
 * the same reference the rest of this language's data comes from. Two things it settles:
 *   • the compounds: "Numbers like '21' are compounds made in the same way as in Persian (thus bīst-u-yak)", and
 *     "200 etc. is do-sad etc." — so the connective links tens↔units and every magnitude group, but NOT the
 *     multiplier inside a group.
 *   • the MAGNITUDES are sad '100', hazār '1,000', lak(k) '100,000', kurōr '10,000,000', arab '1,000,000,000' —
 *     i.e. the South-Asian LAKH/CRORE series (Indic contact, Balochistan), with NO word for 10^6. So this composer
 *     groups 2-2-3 above the thousand like Hindi/Bengali/Sylheti, and 1,000,000 is dah lakk 'ten lakh', not
 *     *"one million". arab is taken as 10^9 (FBB / Sayad Hashmi 2000, the reading J&K list first; BMC has 10^8).
 * EBal.'s vigesimal counting (gīst '20', sai-gīst '60' …) is a different dialect from the Southern reference
 * variety this engine targets and is NOT implemented (J&K: "there is a system of counting by 20s in EBal.").
 *
 * The connective is an ENCLITIC, so it is glued to the END of the preceding word. Because the Balochi Arabic script
 * is a defective abjad, a spelled-out ⟨بیستو⟩ would not phonemize (the ⟨و⟩ is read as uː, and ⟨سیو⟩ misparses the
 * ⟨ی⟩ as a glide), so `encliticWord()` marks the word and the IPA [u] is appended after the word is phonemized. The
 * numeral SPELLINGS themselves stay orthographic (balochi.jsonc) and resolve through the cross-script lexicon,
 * which is where balochi-lexicon.tsv now carries the Table-11.19 forms with their full vowels.
 */
import type { NumbersDef } from "../../core/numbers.ts";

/** Balochi numbers table: the shared schema (lakh/crore magnitudes) + the enclitic connective and 10^9 word. */
export interface BalNumbersDef extends NumbersDef {
    magnitudes: NumbersDef["magnitudes"] & { arab: string };
    /** IPA of the enclitic connective -u (J&K bīst-u-yak); appended after the preceding word is phonemized. */
    connectiveIpa: string;
}

// Internal marker: "this word carries the enclitic connective". Stripped by the word renderer, which then appends
// the connective's IPA. A private-use codepoint, so it can never collide with a Balochi spelling.
const ENCLITIC = "\u{E000}";

/** Wrap a language word→IPA renderer so a connective-marked word gets the enclitic -u appended to its IPA. */
export function encliticWord(word: (w: string) => string, d: BalNumbersDef): (w: string) => string {
    return (w) => (w.endsWith(ENCLITIC) ? word(w.slice(0, -1)) + d.connectiveIpa : word(w));
}

/** Link two groups with the enclitic connective: it attaches to the LAST word of the head (بیست → bīst-u). */
function link(head: string[], tail: string[]): string[] {
    if (tail.length === 0) return head;
    const out = head.slice();
    out[out.length - 1] = out[out.length - 1]! + ENCLITIC;
    return [...out, ...tail];
}

/** Compose a non-negative integer into ordered Balochi number-word spellings (Iranian core, lakh/crore scale). */
export function balochiNumberWords(n: number, def: NumbersDef): (string | null)[] {
    const d = def as BalNumbersDef;
    const go = (x: number): string[] => {
        if (x < 10) return [d.units[x]!];
        if (x < 20) return [d.teens![x - 10]!];
        if (x < 100) {
            const t = Math.floor(x / 10) * 10,
                r = x % 10;
            return link([d.tens[String(t)]!], r ? go(r) : []);
        }
        // Multiplier + magnitude form ONE group (do-sad, dah lakk) — no connective inside it; the bare magnitude
        // drops the multiplier for 100 and 1,000 (sad, hazār), as in Persian.
        const grouped = (mult: number, mag: string, bare: boolean): string[] =>
            bare && mult === 1 ? [mag] : [...go(mult), mag];
        if (x < 1000) return link(grouped(Math.floor(x / 100), d.magnitudes.hundred, true), x % 100 ? go(x % 100) : []);
        if (x < 100_000)
            return link(grouped(Math.floor(x / 1000), d.magnitudes.thousand, true), x % 1000 ? go(x % 1000) : []);
        if (x < 10_000_000)
            return link(grouped(Math.floor(x / 100_000), d.magnitudes.lakh!, false), x % 100_000 ? go(x % 100_000) : []);
        if (x < 1_000_000_000)
            return link(
                grouped(Math.floor(x / 10_000_000), d.magnitudes.crore!, false),
                x % 10_000_000 ? go(x % 10_000_000) : [],
            );
        return link(
            grouped(Math.floor(x / 1_000_000_000), d.magnitudes.arab, false),
            x % 1_000_000_000 ? go(x % 1_000_000_000) : [],
        );
    };
    return go(n);
}
