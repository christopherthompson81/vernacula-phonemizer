/**
 * Persian (fa) cardinal number compositor — the DECIMAL IRANIAN system, the same shape already implemented for
 * its relatives Central Kurdish (central-kurdish/numbers.ts) and Balochi (balochi/numbers.ts):
 *
 *     21        بیست و یک              bist-o-yek
 *     105       صد و پنج               sad-o-panj
 *     1979      هزار و نهصد و هفتاد و نه   hezâr-o-nohsad-o-haftâd-o-noh
 *     1,000,000 یک میلیون              yek milyun
 *
 * WHY THIS FILE EXISTS. Persian was previously composed by `indicNumberWords`, the 2-2-3 lakh/crore composer,
 * with persian.jsonc faking `lakh: "صد هزار"` and `crore: "ده میلیون"` to approximate the Iranian scale. Over the
 * fa_ir corpus's 591 digit runs that produced, measurably:
 *   21        → "یک بیست"  [ˈiːk bˈiːst]        (Indic unit-before-tens, and no connective)
 *   100       → "یک صد"                          (Persian says the bare صد)
 *   200/300   → "دو صد" / "سه صد"                (Persian has the IRREGULAR fused دویست / سیصد)
 *   1000      → "یک هزار"                        (Persian says the bare هزار)
 *   1,000,000 → "ده صد هزار" [dˈah sadahzˈaːɾ]   (ten-hundred-thousand, and the faked two-word magnitude was
 *                                                 g2p'd as ONE word because renderNumber maps each entry whole)
 * and no ⟨و⟩ anywhere, so 1979 read as a bare five-word list.
 *
 * THREE THINGS THE IRANIAN SYSTEM NEEDS THAT THE SHARED COMPOSERS DO NOT PROVIDE:
 *
 * 1. IRREGULAR HUNDREDS. 200-900 are single fused words (دویست، سیصد، چهارصد، پانصد، ششصد، هفتصد، هشتصد، نهصد),
 *    not multiplier + صد. That is exactly what the shared `NumbersDef.hundreds` slot is for (the Western/Slavic
 *    composer already reads it), so the data lives in persian.jsonc; only the linking differs.
 *
 * 2. THE CONNECTIVE ⟨و⟩ /o/ between every group. Given as IPA (`connectiveIpa`), NOT orthography, for the reason
 *    balochi/numbers.ts records: this g2p reads a bare ⟨و⟩ as the long [uː] (isV → longVowel), so a spelled-out
 *    ⟨بیستو⟩ would yield [biːstuː] and a standalone ⟨و⟩ token [ˈuː] — neither is the Persian enclitic /o/. So the
 *    composer MARKS the word that carries it and `encliticWord` appends the single segment [o] after that word has
 *    been phonemized. Central Kurdish takes the orthographic route because its -u genuinely IS long.
 *
 * 3. THE BARE-vs-یک RULE, which differs per magnitude: صد and هزار are bare (صد = 100, هزار = 1000 — *یک صد is
 *    not idiomatic), while میلیون and میلیارد keep it (یک میلیون). Same split as ckb's سەد/هەزار vs ملیۆن/ملیار.
 *
 * SOURCE: standard Iranian Persian cardinals, the same basis as the rest of persian.jsonc. Corroborated in-repo by
 * the mined harakat lexicon, which independently carries سیصد and پانصد as headwords (persian/lexicon.tsv) — i.e.
 * the fused hundreds are attested as single words by data this repo already shipped, not asserted here.
 */
import type { NumbersDef } from "../../core/numbers.ts";

import { PUA_SENTINEL } from "../../core/markers.ts";
/** The fa numbers table: the shared schema (units/teens/tens/hundreds/magnitudes) + the connective's IPA. */
export interface FaNumbersDef extends NumbersDef {
    hundreds: string[];
    magnitudes: NumbersDef["magnitudes"] & { million: string; billion: string };
    /** IPA of the linking enclitic ⟨و⟩ /o/; appended after the preceding word is phonemized. See §2 above. */
    connectiveIpa: string;
}

// Internal marker: "this word carries the connective". Stripped by the word renderer, which then appends the
// connective's IPA. A private-use codepoint, so it can never collide with a Persian spelling.
const CONNECTIVE = PUA_SENTINEL;

/** Wrap a word→IPA renderer so a connective-marked word gets [o] appended to its IPA (بیست → [bˈiːsto]). */
export function encliticWord(word: (w: string) => string, d: FaNumbersDef): (w: string) => string {
    return (w) => (w.endsWith(CONNECTIVE) ? word(w.slice(0, -1)) + d.connectiveIpa : word(w));
}

/** Link two groups with the connective: it attaches to the LAST word of the head (بیست → بیست-و). */
function link(head: string[], tail: string[]): string[] {
    if (tail.length === 0) return head;
    const out = head.slice();
    out[out.length - 1] = out[out.length - 1]! + CONNECTIVE;
    return [...out, ...tail];
}

/** Compose a non-negative integer into ordered Persian number-word spellings. */
export function persianNumberWords(n: number, def: NumbersDef): (string | null)[] {
    const d = def as FaNumbersDef;
    const go = (x: number): string[] => {
        if (x < 10) return [d.units[x]!];
        if (x < 20) return [d.teens![x - 10]!];
        if (x < 100) {
            const t = Math.floor(x / 10) * 10;
            return link([d.tens[String(t)]!], x % 10 ? go(x % 10) : []);
        }
        // The hundreds are ONE fused word each (§1) — no multiplier, so nothing to link inside the group.
        if (x < 1000) return link([d.hundreds[Math.floor(x / 100)]!], x % 100 ? go(x % 100) : []);
        // Multiplier + magnitude form one group; `bare` drops a multiplier of 1 (هزار, not *یک هزار) (§3).
        const grouped = (mult: number, mag: string, bare: boolean): string[] =>
            bare && mult === 1 ? [mag] : [...go(mult), mag];
        if (x < 1_000_000)
            return link(grouped(Math.floor(x / 1000), d.magnitudes.thousand, true), x % 1000 ? go(x % 1000) : []);
        if (x < 1_000_000_000)
            return link(
                grouped(Math.floor(x / 1_000_000), d.magnitudes.million, false),
                x % 1_000_000 ? go(x % 1_000_000) : [],
            );
        return link(
            grouped(Math.floor(x / 1_000_000_000), d.magnitudes.billion, false),
            x % 1_000_000_000 ? go(x % 1_000_000_000) : [],
        );
    };
    return go(n);
}
