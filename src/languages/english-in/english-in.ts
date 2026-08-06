/**
 * Indian English (en-IN) — "General Indian English" (GIE), an ACCENT VARIANT of the General-American `en` engine
 * (not a separate language). Reuses the full English G2P (dict + heteronyms + OOV model) and applies a phonological
 * DELTA — a context-free surface remap — to the GenAm output, like en-GB/es-419 (no information is lost, so this is
 * a post-process, not an engine fork). Labels the OmniVoice FLEURS `en_in` training audio (~200M L2 speakers).
 *
 * The delta (GenAm → GIE), from the documented phonology (Wells 1982 vol. 3; Sailaja 2009, *Indian English*):
 *   • RETROFLEXION — the signature: alveolar /t d/ → retroflex [ʈ ɖ] (tin→ʈɪn, dog→ɖɔːɡ). Guarded so the tied
 *     affricates t͡ʃ/d͡ʒ (church, judge) are NOT retroflexed.
 *   • TH-STOPPING — the dental fricatives become dental STOPS: /θ/ → [t̪ʰ] (aspirated), /ð/ → [d̪] (thin→t̪ʰɪn,
 *     this→d̪ɪs). Distinct from the retroflex /t d/ by PLACE (dental vs retroflex), so "thin"≠"tin".
 *   • /v/–/w/ MERGER → the labiodental approximant [ʋ] (wet=vet=ʋɛʈ).
 *   • MONOPHTHONGISATION — FACE [eᶦ]→[eː], GOAT [oᶷ]→[oː] (they→d̪eː, goat→ɡoːʈ). PRICE/MOUTH stay diphthongs.
 *   • DE-ASPIRATION of the other voiceless stops /p k/ → [p k] (GIE lacks English aspiration; cat→kæʈ). /t/'s
 *     aspiration is already removed by the retroflexion.
 *   • CLEAR /l/ in all positions (no dark [ɫ]): full→fʊl.
 *   • RHOTIC with a TAP: GIE is rhotic (spelling-pronunciation) — coda /ɹ/ is KEPT and every /ɹ/ → [ɾ]; the
 *     r-coloured vowels de-rhoticise to a plain vowel + [ɾ] (NURSE ɝ→əɾ, lettER ɚ→əɾ; car→kɑːɾ, letter→lɛʈəɾ).
 *   • Reduced [ᵻ]→[ɪ] (GIE is syllable-timed with fuller vowels; the further full-vowel restoration of unstressed
 *     syllables needs the spelling → deferred). The palatal on-glide [ʲ] is dropped.
 *
 * Deliberately DEFERRED (need a lexical distinction / not recoverable from the GenAm output, and no en-IN referee
 * exists to adjudicate): the TRAP/DRESS ([æ]~[ɛ]) and LOT/THOUGHT vowel qualities, yod-retention (student→stjuːɖənʈ),
 * and the syllable-timed full-vowel restoration in unstressed syllables. Quality anchor = a hand-adjudicated
 * diagnostic gold (english-in.test.ts).
 */
import { createEnglish, type EnglishPhonemizer } from "../english/english.ts";

const TIE = "͡"; // U+0361 combining double inverted breve (affricate tie) — guard so t͡ʃ/d͡ʒ aren't retroflexed

/** GenAm citation IPA → General Indian English (context-free; no lexical sets needed). */
export function toIndian(genAm: string): string {
    let s = genAm;
    // RETROFLEXION of /t d/ → [ʈ ɖ], guarded against the tied affricates t͡ʃ/d͡ʒ. Matches t/d + an optional
    // aspiration/flap diacritic, but NOT when the tie U+0361 follows (that is an affricate). Runs BEFORE TH-stopping
    // so the dental stops [t̪ d̪] created below are not swept up.
    s = s.replace(new RegExp(`t[ʰ̬̰]?(?!${TIE})`, "gu"), "ʈ");
    s = s.replace(new RegExp(`d[̬̰]?(?!${TIE})`, "gu"), "ɖ");
    // TH-STOPPING → dental stops (after retroflexion; distinct from ʈ/ɖ by place).
    s = s.replace(/θ/gu, "t̪ʰ").replace(/ð/gu, "d̪");
    // MONOPHTHONGISATION of FACE/GOAT; other offglides → plain [ɪ]/[ʊ] (PRICE/MOUTH/CHOICE stay diphthongs).
    s = s.replace(/eᶦ/gu, "eː").replace(/oᶷ/gu, "oː");
    s = s.replace(/aᶦ/gu, "aɪ").replace(/aᶷ/gu, "aʊ").replace(/ᶦ/gu, "ɪ").replace(/ᶷ/gu, "ʊ");
    // /v/–/w/ MERGER → [ʋ].
    s = s.replace(/[vw]/gu, "ʋ");
    // DE-ASPIRATION of the remaining voiceless stops (/t/ already de-aspirated via retroflexion).
    s = s.replace(/pʰ/gu, "p").replace(/kʰ/gu, "k");
    // CLEAR /l/ (drop the dark-coda diacritic).
    s = s.replace(/ɫ/gu, "l");
    // RHOTIC with a tap: de-rhoticise the r-coloured vowels to V+[ɾ], then every /ɹ/ → [ɾ] (coda kept — GIE is rhotic).
    s = s.replace(/ɝ/gu, "əɾ").replace(/ɚ/gu, "əɾ").replace(/ɹ/gu, "ɾ");
    // Fuller vowels: reduced [ᵻ]/[ᵿ] → [ɪ]/[ʊ]; drop the palatal on-glide [ʲ].
    s = s.replace(/ᵻ/gu, "ɪ").replace(/ᵿ/gu, "ʊ").replace(/ʲ/gu, "");
    return s;
}

let IN: EnglishPhonemizer | undefined;
const eng = (): EnglishPhonemizer => (IN ??= createEnglish());

/** One en-IN word → canonical IPA (GenAm engine + the GIE delta). The delta is context-free, so the shipped and
 *  rule paths are identical (no mined lexical sets) — the eval, if any, is trivially non-circular. */
export function phonemizeWord(word: string): string {
    return toIndian(eng().text(word));
}
/** Alias kept for parity with the other accent variants (en-GB/pt-BR) that split a lexicon-bearing shipped path. */
export const phonemizeWordRules = phonemizeWord;

/** Build the Indian-English phonemizer (GenAm engine + the GIE delta on each word's output). */
export function createEnglishIN(): { text(input: string): string } {
    const e = createEnglish();
    return { text: (input: string): string => e.text(input, (ipa) => toIndian(ipa)) };
}
