/**
 * en-GB (SSBE / "BBC") accent-transform DIAGNOSTIC GOLD — the non-circular quality anchor. The referee-eval
 * headline (~39% vs wikipron UK, rule-only) is REFEREE-NOISE-LIMITED exactly like `en`'s own ~36%: the 76k
 * wikipron list is dominated by rare/proper/foreign words where the shared OOV G2P model mangles the spelling,
 * a weakness of the parent `en` engine, not of the accent delta. This hand-adjudicated gold (RP from Wells's
 * lexical sets + Jones/Cambridge EPD conventions, NOT mined from the referee) measures what actually matters:
 * whether the GenAm→SSBE transform is right on the core vocabulary + every Wells lexical set.
 *
 * DEFERRED (documented in), so excluded here:
 *   • yod-COALESCENCE after /t d/ (tube→t͡ʃuːb, duke→d͡ʒuːk) — a further modern-SSBE step beyond yod-retention.
 *   • idiosyncratic US/UK lexical vowel swaps (tomato→təˈmɑːtəʊ, pasta→ˈpæstə) — not a systematic set.
 */
import { describe, expect, it } from "vitest";
import { phonemizeWord } from "../src/languages/english-gb/english-gb.ts";

// word → adjudicated SSBE IPA in OUR output convention (aspirated kʰ/tʰ/pʰ, dark coda [ɫ], ɹ, ᵻ reduced-high).
const GOLD: [string, string][] = [
    // START / non-rhotic coda r + linking-r vowels
    ["car", "kʰˈɑː"], ["start", "stˈɑːt"], ["hard", "hˈɑːd"], ["park", "pʰˈɑːk"],
    ["water", "wˈɔːtə"], ["letter", "lˈɛtə"], ["better", "bˈɛtə"], ["mother", "mˈʌðə"], ["doctor", "dˈɒktə"],
    // NURSE
    ["nurse", "nˈɜːs"], ["bird", "bˈɜːd"], ["word", "wˈɜːd"], ["work", "wˈɜːk"], ["world", "wˈɜːɫd"], ["first", "fˈɜːst"],
    // BATH (æ → ɑː)
    ["bath", "bˈɑːθ"], ["grass", "ɡɹˈɑːs"], ["class", "klˈɑːs"], ["dance", "dˈɑːns"], ["last", "lˈɑːst"],
    ["past", "pʰˈɑːst"], ["after", "ˈɑːftə"], ["france", "fɹˈɑːns"], ["laugh", "lˈɑːf"], ["path", "pʰˈɑːθ"], ["ask", "ˈɑːsk"],
    // CLOTH / LOT (ɒ)
    ["off", "ˈɒf"], ["dog", "dˈɒɡ"], ["cost", "kʰˈɒst"], ["cloth", "klˈɒθ"], ["lost", "lˈɒst"],
    ["gone", "ɡˈɒn"], ["long", "lˈɒŋ"], ["strong", "stɹˈɒŋ"], ["lot", "lˈɒt"],
    // yod-retention (Cuː → Cjuː) after /n s θ/
    ["new", "njˈuː"], ["news", "njˈuːz"], ["student", "stjˈuːdənt"], ["stupid", "stjˈuːpəd"], ["nude", "njˈuːd"],
    ["enthusiasm", "ɪnθjˈuːziˌæzəm"], ["numerous", "njˈuːməɹəs"], ["assume", "əsjˈuːm"],
    // GOAT (əʊ)
    ["goat", "ɡˈəʊt"], ["home", "hˈəʊm"], ["road", "ɹˈəʊd"], ["know", "nˈəʊ"], ["boat", "bˈəʊt"],
    // centring diphthongs NEAR / SQUARE / CURE (non-rhotic)
    ["near", "nˈɪə"], ["here", "hˈɪə"], ["dear", "dˈɪə"], ["square", "skwˈɛə"], ["care", "kʰˈɛə"], ["hair", "hˈɛə"],
    ["cure", "kjˈʊə"], ["pure", "pjˈʊə"],
    // NORTH/FORCE/THOUGHT (ɔː)
    ["north", "nˈɔːθ"], ["force", "fˈɔːs"], ["law", "lˈɔː"], ["thought", "θˈɔːt"], ["talk", "tʰˈɔːk"], ["daughter", "dˈɔːtə"],
    // short vowels (unchanged from GenAm)
    ["trap", "tɹˈæp"], ["cat", "kʰˈæt"], ["dress", "dɹˈɛs"], ["kit", "kʰˈɪt"], ["strut", "stɹˈʌt"], ["foot", "fˈʊt"], ["good", "ɡˈʊd"],
    // PALM exceptions (keep [ɑː] against the LOT rule)
    ["father", "fˈɑːðə"], ["spa", "spˈɑː"], ["drama", "dɹˈɑːmə"], ["banana", "bənˈɑːnə"],
    // dark coda [ɫ]
    ["little", "lˈɪtəɫ"], ["people", "pʰˈiːpəɫ"], ["apple", "ˈæpəɫ"], ["table", "tʰˈeɪbəɫ"],
    // wide diphthongs FACE/PRICE/MOUTH/CHOICE + FLEECE/GOOSE
    ["face", "fˈeɪs"], ["price", "pɹˈaɪs"], ["time", "tʰˈaɪm"], ["mouth", "mˈaʊθ"], ["now", "nˈaʊ"],
    ["choice", "t͡ʃˈɔɪs"], ["boy", "bˈɔɪ"], ["fleece", "flˈiːs"], ["goose", "ɡˈuːs"], ["blue", "blˈuː"],
    // linking-r kept before a vowel
    ["different", "dˈɪfəɹənt"],
    // LOT before intervocalic r (sorry vs starry split — lexical, mined `lotr` set)
    ["sorry", "sˈɒɹi"], ["borrow", "bˈɒɹəʊ"], ["tomorrow", "təmˈɒɹəʊ"],
];

describe("en-GB (SSBE/BBC) accent transform", () => {
    for (const [word, ipa] of GOLD) {
        it(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});
