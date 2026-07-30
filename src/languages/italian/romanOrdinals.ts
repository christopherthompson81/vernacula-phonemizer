/**
 * ITALIAN (it) Roman-numeral reading — ORDINAL.
 *
 * Italian is the clear ordinal member of the Romance set: a Roman numeral IS the ordinal notation.
 * Treccani, *Enciclopedia dell'Italiano*, s.v. «numerali»: the ordinals are what Roman numerals write
 * ("rimasti disponibili dopo che, nel Medioevo, l'Occidente accolse l'attuale sistema degli Arabi"), and
 * the entry's own examples put the ordinal AFTER the noun exactly in our two target contexts — regnal
 * names ("Vittorio Emanuele II, Paolo VI"), enumeration ("atto secondo, scena quarta", "la lezione è in
 * Aula VI") — and gives the century as "le vicende narrate nei *Promessi sposi* sono ambientate nel XVII
 * secolo".
 *   → https://www.treccani.it/enciclopedia/numerali_(Enciclopedia-dell'Italiano)/
 * So `XIX secolo` is *diciannovesimo secolo* and `papa Giovanni XXIII` is *papa Giovanni ventitreesimo* —
 * unlike Spanish/Portuguese/Catalan, Italian does NOT switch to a cardinal above ten.
 *
 * FORM: derived from the language's own cardinal compositor (`numberWords` in italian.ts), because Italian
 * ordinals above ten are perfectly regular — take the cardinal, drop its final vowel, add `-esimo`
 * (venti → ventesimo, quaranta → quarantesimo, cinquanta → cinquantesimo). Only 1–10 are irregular, so
 * only 1–10 is a table. Two orthographic exceptions are handled: a final stressed `-tré` keeps its vowel
 * (ventitré → ventitreesimo) as does final `-sei` (ventisei → ventiseiesimo), and the fused thousand
 * `-mila` restores the geminate (duemila → duemillesimo).
 *
 * AGREEMENT: masculine singular (`-esimo`). Every context word below is a masculine noun, so the century
 * and enumeration readings agree. LIMITATION: feminine heads would need `-esima` — "la II Guerra
 * mondiale" is *seconda*, "la XXV Olimpiade" *venticinquesima* — so feminine nouns are deliberately kept
 * OUT of the trigger lists; they keep the cardinal reading rather than acquiring a wrong-gender ordinal.
 * Likewise a queen ("Elisabetta II" = *seconda*) is not triggered.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { numberWords } from "./italian.ts";

/** 1–10: not derivable from the cardinal (primo ≠ uno-esimo). */
const IRREGULAR: Readonly<Record<number, string>> = {
    1: "primo", 2: "secondo", 3: "terzo", 4: "quarto", 5: "quinto",
    6: "sesto", 7: "settimo", 8: "ottavo", 9: "nono", 10: "decimo",
};

/** Italian masculine ordinal for any n a Roman numeral can encode, or `undefined` where we decline to guess. */
function italianOrdinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1) return undefined;
    const irr = IRREGULAR[n];
    if (irr !== undefined) return irr;
    const card = numberWords(n);
    if (card.includes(" ")) return undefined; // millions split into words (un milione …) — not worth guessing
    if (card.endsWith("tré")) return `${card.slice(0, -1)}eesimo`; // ventitré → ventitreesimo
    if (card.endsWith("sei")) return `${card}esimo`; // ventisei → ventiseiesimo
    if (card.endsWith("mila")) return `${card.slice(0, -4)}millesimo`; // duemila → duemillesimo
    if (/[aeiou]$/u.test(card)) return `${card.slice(0, -1)}esimo`; // venti → ventesimo
    return `${card}esimo`;
}

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal: italianOrdinal,
    /**
     * Noun BEFORE the numeral. Two families, both masculine:
     *  - the century noun in the postposed order (`nel secolo XIX`);
     *  - the masculine enumeration heads Treccani lists as ordinal-reading (`capitolo XIV`, `atto II`);
     *  - regnal/papal GIVEN NAMES, because the word immediately before the numeral in "papa Giovanni
     *    XXIII" is the NAME, not the title — a title regex would never fire. This is the one heuristic
     *    part of the file (no style guide enumerates the names); it is a closed list of the male regnal
     *    names that actually recur in Italian running text, and a miss simply leaves the cardinal.
     *    Titles are listed too, for the (rarer) "papa XXIII" ellipsis.
     *  Feminine enumeration heads Treccani also cites (*scena* IV, *Aula* VI, *tavola* III) are excluded —
     *    they would need `-esima`; they keep the cardinal instead of a wrong-gender ordinal.
     */
    ordinalBefore:
        /^(secolo|secoli|capitolo|capitoli|libro|volume|tomo|canto|atto|articolo|paragrafo|allegato|papa|re|imperatore|zar|sultano|antipapa|beato|san|santo|giovanni|paolo|pio|benedetto|francesco|leone|gregorio|clemente|innocenzo|urbano|alessandro|sisto|celestino|adriano|callisto|bonifacio|onorio|eugenio|martino|niccolò|nicola|stefano|giulio|silvestro|pasquale|lucio|luigi|carlo|alberto|enrico|filippo|ferdinando|emanuele|umberto|napoleone|federico|guglielmo|giorgio|edoardo|giacomo|riccardo|alfonso|pietro|giuseppe|leopoldo|massimiliano|ottone|corrado|ludovico|amedeo|gustavo|cristiano|solimano|ramses|tolomeo)$/iu,
    /**
     * Noun AFTER the numeral — the dominant Italian order for centuries (`XIX secolo`) and for event
     * names (`XL anniversario`, `XXV congresso`), which is precisely where the range is NOT bounded by
     * the century: `L anniversario` is *cinquantesimo anniversario*. Masculine nouns only (see AGREEMENT).
     */
    ordinalAfter:
        /^(secolo|secoli|anniversario|congresso|convegno|simposio|campionato|festival|premio|concorso|raduno|torneo|centenario|capitolo|volume|libro|tomo|canto|atto|articolo|emendamento|reggimento|governo)$/iu,
};
