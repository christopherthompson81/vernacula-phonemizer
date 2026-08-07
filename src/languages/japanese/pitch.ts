/**
 * Japanese (Tokyo) lexical pitch accent. Accent is lexical and
 * contrastive (箸 haꜜɕi "chopsticks" vs 端 haɕi "edge"); the accent NUCLEUS is marked with the IPA downstep
 * ꜜ (U+A71C) placed AFTER the nucleus mora. Heiban (accentless, nucleus 0) words carry no mark.
 *
 * The nucleus is looked up per bunsetsu: the SURFACE (kanji) first, so homographs the reading collapses are
 * disambiguated (はし→箸=1), then the READING (kana). A bunsetsu is a content word + trailing case/topic
 * particles or copula (橋を, 天気です); the accent sits on the content stem, so we strip those to recover it and
 * apply the nucleus to the full reading. Data: pitch-accent.tsv (merged consensus > inflected > base).
 */
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

let LEX: Map<string, number> | undefined;
function lex(): Map<string, number> {
    if (LEX === undefined)
        LEX = loadTsvMap(import.meta.url, "pitch-accent.tsv", (v) => {
            const n = Number.parseInt(v, 10);
            return Number.isInteger(n) && n >= 0 ? n : undefined;
        });
    return LEX;
}

// Raw key, then a katakana→hiragana FOLDED fallback (UniDic/OpenJTalk layers are hiragana-keyed; the NHK
// consensus layer stores katakana surfaces UNFOLDED, so the raw lookup hits those first).
function get(k: string): number | undefined {
    const m = lex();
    return (
        m.get(k) ??
        m.get(
            k.replace(/[ァ-ヶ]/gu, (c) =>
                String.fromCodePoint(c.codePointAt(0)! - 0x60),
            ),
        )
    );
}

/** Whether the pitch lexicon has an entry for a surface/reading key (with the katakana→hiragana fold get() applies).
 *  For the pitch eval's OOV tracking: an out-of-lexicon word renders heiban (0), indistinguishable from a real
 *  heiban hit, so the eval must be able to tell a genuine agreement from an OOV-defaulted-flat coincidence. */
export function pitchLexiconHas(key: string): boolean {
    return get(key) !== undefined;
}

const HAN_END = /\p{Script=Han}$/u;
// Trailing affixes to strip to recover a noun bunsetsu's content word (whose accent governs the phrase):
// case/topic particles (橋を→橋), and the copula + optional sentence-final particle (天気です→天気). The affix
// sets are DATA (japanese.jsonc → pitchStrip); the strip logic is here.
const PS = MANIFEST.pitchStrip;
const STRIPS = [
    new RegExp(`[${PS.particles}]+$`, "u"),
    new RegExp(
        `(?:${PS.copula.join("|")})(?:[${PS.copulaFinalParticles}])?$`,
        "u",
    ),
];

const PARTICLE_TOKENS = new Set([
    "は", "が", "を", "に", "で", "と", "の", "も", "や", "へ", "わ", "え",
    "から", "まで", "など", "には", "では", "でわ", "とは", "とわ", "への", "からの", "までの", "にわ",
]);

/** Resolve the accent nucleus (mora index, 0 = heiban) for a bunsetsu: surface first, then reading. */
export function accentNucleus(surface: string, reading: string): number {
    // A bare PARTICLE token is always unaccented (heiban). Particles reach here as their own tokens when
    // the preceding content is digits or katakana (二時に, ビザを) — the pitch dictionary must not put a
    // downstep on them (85 で → de̞ꜜ was audible nonsense in the corpus).
    if (PARTICLE_TOKENS.has(surface)) return 0;
    let n = get(surface); // 1. exact surface (disambiguates homographs the reading collapses)
    if (n === undefined) {
        for (const re of STRIPS) {
            const m = surface.match(re);
            if (!m) continue;
            const ks = surface.slice(0, -m[0].length); // 2. surface content-kanji stem (橋 / 天気), noun bunsetsu only
            if (ks === "" || !HAN_END.test(ks)) continue;
            n = get(ks);
            if (n === undefined && reading.endsWith(m[0])) {
                const rs = reading.slice(0, -m[0].length); // 3. reading content stem, same suffix (はしを→はし)
                if (rs !== "") n = get(rs);
            }
            if (n !== undefined) break;
        }
    }
    if (n === undefined) n = get(reading); // 4. exact reading (はし)
    return n ?? 0;
}

/** Place ꜜ after the nucleus-th mora of a pre-segmented mora list (1-based; ≤0 = heiban, no mark). */
export function placeDownstep(
    morae: readonly string[],
    nucleus: number,
): string {
    if (nucleus <= 0 || morae.length === 0) return morae.join("");
    const n = Math.min(nucleus, morae.length);
    return morae.slice(0, n).join("") + "ꜜ" + morae.slice(n).join("");
}
