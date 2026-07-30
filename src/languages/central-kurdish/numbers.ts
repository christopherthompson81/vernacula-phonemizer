/**
 * Central Kurdish / Sorani (ckb) cardinal number compositor — the DECIMAL IRANIAN system (Persian-shaped), not the
 * Turkic juxtaposition of its ug/kk neighbours. Structure: units + irregular teens (10-19) + a distinct word per
 * round ten, with every magnitude group linked by the ENCLITIC CONNECTIVE ⟨و⟩ -u:
 *
 *     21   بیست و یەک            bîst-u-yek
 *     101  سەد و یەک             sed-u-yek
 *     1234 هەزار و دوو سەد و سی و چوار   hezar-u-du-sed-u-sî-u-çwar
 *
 * The connective is an ENCLITIC, so `link()` appends it to the END of the preceding word rather than emitting it as
 * a free token: بیست+و → [biːstu] (kaikki has بیست و یەک = /biːstujak/), پەنجا+و → [pandʒaːw] (it glides after a
 * vowel). Emitting a standalone ⟨و⟩ would instead phonemize to a bare [w] (the ckb g2p reads a word-initial ⟨و⟩ as
 * the glide). Inside a group there is NO connective (دوو سەد = 200). Round سەد/هەزار drop the leading "yek";
 * ملیۆن/ملیار keep it (یەک ملیۆن).
 *
 * SOURCES: numeral spellings + IPA cross-check from kaikki ckb (Wiktionary Central Kurdish numerals); round tens
 * 30-90 and the compound pattern from Omniglot "Kurdish (Soranî) numbers"
 * (https://www.omniglot.com/language/numbers/kurdish_sorani.htm). Table lives in central-kurdish.jsonc.
 */
import type { NumbersDef } from "../../core/numbers.ts";

/** The ckb numbers table: the shared schema plus the enclitic connective ⟨و⟩ that links magnitude groups. */
export interface CkbNumbersDef extends NumbersDef {
    connective: string;
}

/** Link two groups with the enclitic connective: it attaches to the LAST word of the head (بیست → بیستو). */
function link(head: string[], tail: string[], u: string): string[] {
    if (tail.length === 0) return head;
    const out = head.slice();
    out[out.length - 1] = out[out.length - 1]! + u;
    return [...out, ...tail];
}

/** Compose a non-negative integer into ordered Sorani number-word spellings (Iranian decimal + -u connective). */
export function iranianNumberWords(n: number, d: NumbersDef): (string | null)[] {
    const u = (d as CkbNumbersDef).connective;
    const go = (x: number): string[] => {
        if (x < 10) return [d.units[x]!];
        if (x < 20) return [d.teens![x - 10]!];
        if (x < 100) {
            const t = Math.floor(x / 10) * 10,
                r = x % 10;
            return link([d.tens[String(t)]!], r ? go(r) : [], u);
        }
        if (x < 1000) {
            const h = Math.floor(x / 100),
                r = x % 100;
            // 100 = سەد (bare); 200 = دوو سەد (no connective INSIDE the hundreds group).
            return link(h > 1 ? [d.units[h]!, d.magnitudes.hundred] : [d.magnitudes.hundred], r ? go(r) : [], u);
        }
        if (x < 1_000_000) {
            const th = Math.floor(x / 1000),
                r = x % 1000;
            // 1000 = هەزار (bare, like the bare سەد); 2000 = دوو هەزار.
            return link(th > 1 ? [...go(th), d.magnitudes.thousand] : [d.magnitudes.thousand], r ? go(r) : [], u);
        }
        if (x < 1_000_000_000) {
            const m = Math.floor(x / 1_000_000),
                r = x % 1_000_000;
            // million/billion KEEP the leading "yek" (یەک ملیۆن — grammatical, as in Persian یک میلیون).
            return link([...go(m), d.magnitudes.million!], r ? go(r) : [], u);
        }
        const b = Math.floor(x / 1_000_000_000),
            r = x % 1_000_000_000;
        return link([...go(b), d.magnitudes.billion!], r ? go(r) : [], u);
    };
    return go(n);
}
