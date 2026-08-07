/**
 * Malayalam cardinal number → words, plus the ordinal and oblique morphology normalize.ts needs.
 *
 * THE COMPOSITION IS THE SHARED `dravidianNumberWords` (core/numbers.ts). Malayalam exercises every
 * capability that composer has — a fused 21–99, suppletive round hundreds, suppletive round thousands,
 * and a combining magnitude form before a remainder — which is why it is worth reading as the reference
 * case for the shared path. All of it is DATA in malayalam.jsonc, with its provenance; this file is only
 * the Malayalam-facing wrapper plus the two morphologies.
 *
 * What `indicNumberWords` produced before, measured on this corpus's own numerals:
 *     21   ഇരുപത് ഒന്ന്                          → ഇരുപത്തിയൊന്ന്
 *     150  നൂറ് അമ്പത്                            → നൂറ്റി അമ്പത്
 *     200  രണ്ട് നൂറ്                             → ഇരുന്നൂറ്
 *     1976 ആയിരം ഒമ്പത് നൂറ് എഴുപത് ആറ്            → ആയിരത്തി തൊള്ളായിരത്തി എഴുപത്തിയാറ്
 *     2011 രണ്ട് ആയിരം പതിനൊന്ന്                  → രണ്ടായിരത്തി പതിനൊന്ന്
 * — five words where Malayalam says three, with the wrong hundred and no linkage at all.
 *
 * YEARS TAKE THE ORDINARY CARDINAL, as in Kannada and unlike Telugu (which reads 1976 as "nineteen
 * hundred seventy-six" and had to arbitrate that on audio).
 */
import { dravidianNumberWords } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const VIRAMA = "്";
const ANUSVARA = "ം";

/** The decimal separator word; read by normalize.ts. */
export const DECIMAL_WORD = N.decimalWord;

/** Non-negative integer → Malayalam words, space-separated. */
export function numberToWords(n: number): string {
    return dravidianNumberWords(n, N).join(" ");
}

/**
 * The ORDINAL stem of a cardinal word — what -ാം attaches to. This corpus writes the fused result for
 * fourteen different cardinals (ഒന്നാം, രണ്ടാം, മൂന്നാമത്തെ, നാലാമത്തെ, അഞ്ചാമത്തെ, ആറാമത്തെ, ഏഴാമത്തെ,
 * ഒൻപതാം, പത്താം, പതിനൊന്നാം, പതിനഞ്ചാം, പതിനാറാം, ഇരുപതാം, അറുപതാമത്തേത്) and every one of them is
 * its cardinal with the final samvritokaram ് dropped. A ം-final magnitude (ആയിരം, ലക്ഷം) drops the ം
 * the same way; കോടി, which ends in a vowel sign, takes the glide യ.
 *
 * Emitted APART — which is what this corpus's "18-ആം നൂറ്റാണ്ട്" produced before normalize.ts step 5 —
 * ആം reaches the G2P as a stray syllable carrying its own primary stress, [ˈaːm].
 */
export function ordinalStem(word: string): string {
    if (word.endsWith(VIRAMA) || word.endsWith(ANUSVARA)) return word.slice(0, -1);
    return /[ാിീുൂെേൈൊോൗ]$/u.test(word) ? `${word}യ` : word;
}

/** N + the ordinal ending (18-ആം → പതിനെട്ടാം, 7-മത്തെ → ഏഴാമത്തെ), fused onto the last cardinal word. */
export function ordinalToWords(n: number, ending = "ാം"): string {
    const words = numberToWords(n).split(" ");
    const last = words[words.length - 1];
    if (last === undefined || last === "") return "";
    words[words.length - 1] = `${ordinalStem(last)}${ending}`;
    return words.join(" ");
}

/**
 * The OBLIQUE stem — what a case clitic attaches to. The samvritokaram ് becomes ി, which this corpus
 * attests on five different cardinals (മൂന്നിൽ, മൂന്നിലൊന്ന്, നാലിലൊന്ന്, അഞ്ചിലൊന്ന്, ഒന്നിലധികം) and on
 * a round ten (ഇരുപതിലേറെ). A ം-final magnitude takes -ത്തി- instead, which is the same combining stem
 * the composer already uses (ആയിരം → ആയിരത്തി, hence ആയിരത്തിൽ). A vowel-final word takes the glide.
 */
export function obliqueStem(word: string): string {
    if (word.endsWith(VIRAMA)) return `${word.slice(0, -1)}ി`;
    if (word.endsWith(ANUSVARA)) return `${word.slice(0, -1)}ത്തി`;
    return /[ാിീുൂെേൈൊോൗ]$/u.test(word) ? `${word}യി` : word;
}

/**
 * The PLURAL stem — what -കൾ and its case forms attach to. The samvritokaram becomes ു, not ി:
 * this corpus writes ഇരുപതുകളിൽ, which is exactly the shape "1970-കളിൽ" needs. Only ്-final words are
 * handled; a ം-final magnitude pluralises differently (ആയിരങ്ങൾ) and none occurs with -കൾ here, so it
 * is left alone rather than guessed at.
 */
export function pluralStem(word: string): string | undefined {
    return word.endsWith(VIRAMA) ? `${word.slice(0, -1)}ു` : undefined;
}

/** N + a clitic, fused onto the last cardinal word through `stem` (1789-ൽ → …ഒമ്പതിൽ). */
export function cliticToWords(
    n: number,
    clitic: string,
    stem: (w: string) => string | undefined,
): string {
    const words = numberToWords(n).split(" ");
    const last = words[words.length - 1];
    if (last === undefined || last === "") return "";
    const s = stem(last);
    if (s === undefined) return "";
    words[words.length - 1] = `${s}${clitic}`;
    return words.join(" ");
}
