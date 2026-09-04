/**
 * en-GB (SSBE / "BBC") accent-transform DIAGNOSTIC GOLD — the non-circular quality anchor. ⚠ The referee-eval
 * headline is REFEREE-NOISE-LIMITED exactly like `en`'s own: the 76k wikipron UK list is dominated by
 * rare/proper/foreign words where the shared OOV G2P model mangles the spelling — a weakness of the parent
 * `en` engine, not of the accent delta, so the score says little about the transform. This gold (RP from Wells's
 * lexical sets + Jones/Cambridge EPD conventions, NOT mined from the referee) measures what actually matters:
 * whether the GenAm→SSBE transform is right on the core vocabulary + every Wells lexical set.
 *
 * DEFERRED, and so excluded from this gold:
 *   • yod-COALESCENCE after /t d/ (tube→t͡ʃuːb, duke→d͡ʒuːk) — a further modern-SSBE step beyond yod-retention.
 *   • idiosyncratic US/UK lexical vowel swaps (tomato→təˈmɑːtəʊ, pasta→ˈpæstə) — not a systematic set.
 */
import { describe, expect, it } from "vitest";
import { phonemizeWord } from "../src/languages/english-gb/english-gb.ts";

// word → adjudicated SSBE IPA in OUR output convention (aspirated kʰ/tʰ/pʰ, dark coda [ɫ], ɹ, ᵻ reduced-high,
// and since #1252 the parent's SUPERSCRIPT offglide on the closing diphthongs — `əᶷ eᶦ aᶦ aᶷ ɔᶦ`, one unit
// each, where a reference transcription writes `əʊ eɪ aɪ aʊ ɔɪ`). The DEFERRED note above quotes reference
// notation on purpose: it describes a phenomenon this engine does not produce.
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
    // GOAT (əᶷ — the parent's offglide since #1252, RP's central onset)
    ["goat", "ɡˈəᶷt"], ["home", "hˈəᶷm"], ["road", "ɹˈəᶷd"], ["know", "nˈəᶷ"], ["boat", "bˈəᶷt"],
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
    ["little", "lˈɪtəɫ"], ["people", "pʰˈiːpəɫ"], ["apple", "ˈæpəɫ"], ["table", "tʰˈeᶦbəɫ"],
    // wide diphthongs FACE/PRICE/MOUTH/CHOICE + FLEECE/GOOSE
    ["face", "fˈeᶦs"], ["price", "pɹˈaᶦs"], ["time", "tʰˈaᶦm"], ["mouth", "mˈaᶷθ"], ["now", "nˈaᶷ"],
    ["choice", "t͡ʃˈɔᶦs"], ["boy", "bˈɔᶦ"], ["fleece", "flˈiːs"], ["goose", "ɡˈuːs"], ["blue", "blˈuː"],
    // linking-r kept before a vowel
    ["different", "dˈɪfəɹənt"],
    // LOT before intervocalic r (sorry vs starry split — lexical, mined `lotr` set)
    ["sorry", "sˈɒɹi"], ["borrow", "bˈɒɹəᶷ"], ["tomorrow", "təmˈɒɹəᶷ"],
];

describe("en-GB (SSBE/BBC) accent transform", () => {
    for (const [word, ipa] of GOLD) {
        it(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});
