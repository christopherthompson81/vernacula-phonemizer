import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

import { phonemizeWord } from "../src/languages/magahi/magahi.ts";
import { phonemizeWord as bho } from "../src/languages/bhojpuri/bhojpuri.ts";

// Canonical-IPA goldens for Magahi / मगही (mag) — Indo-Aryan (Bihari, Magadhan), Devanagari. BESPOKE (was a
// mag→bho alias until a reference revealed a delta): the Bhojpuri engine + phonology, sharing the Bihari core
// (no vowel length, श/ष→s, ण/ञ→n), PLUS the documented Magahi GLIDE HARDENING (Vinod Kumar 2026, A Comparative
// Phonological Study of Bihari Languages, §6.2): word-initial व→[b] (वंश→bans), य→[d͡ʒ] (यन्त्र→jantar), where
// Bhojpuri preserves the glides.
describe("Magahi canonical IPA — Bhojpuri base + glide hardening", () => {
    test("the Magahi DELTA from Bhojpuri: word-initial glide hardening व→b, य→d͡ʒ", () => {
        expect(phonemizeWord("वंश")).toBe("bˈə̃s"); // व → b (Magahi; Bhojpuri keeps w)
        expect(phonemizeWord("यंत्र")).toBe("d͡ʒˈə̃n̪t̪ɾ"); // य → d͡ʒ (Magahi; Bhojpuri keeps the glide j)
        expect(phonemizeWord("विशाल")).toBe("bˈisɑl"); // व → b, श → s
        // ...and these differ from Bhojpuri (which preserves the glides):
        expect(phonemizeWord("वंश")).not.toBe(bho("वंश"));
    });
    test("the shared Bihari core (== Bhojpuri): no length, श/ष→s, ण→n, ऐ→ɛ", () => {
        expect(phonemizeWord("देश")).toBe("d̪ˈes"); // श → s (== bho)
        expect(phonemizeWord("बैल")).toBe("bˈɛl"); // ऐ → ɛ monophthong (== bho)
        expect(phonemizeWord("गणेश")).toBe("ɡˈənes"); // ण → n (== bho)
        expect(phonemizeWord("देश")).toBe(bho("देश")); // shared features → identical to Bhojpuri here
    });
});

describe("Magahi — `nm`, and the tier it inherits from Hindi", () => {
    const say = (s: string): string => phonemize(s, "mag").trim();

    test("the nanometre reads, from a key declared in the HINDI symbol tier", () => {
        // ⚠ THE LEAK WAS MAGAHI'S AND THE FIX IS HINDI'S. mag has no symbol tier of its own — it is
        // `makeNativeHindi`'s, shared with awa, bgc, bho, hne, mai and rkt — and hi's own artifact contains
        // no `nm` at all, so this key could only ever have been found from a rider.
        expect(say("५८० nm")).toContain("nˈɛnomiʈəɾ");
        expect(say("५८० nm")).not.toContain("nm");
    });
});

describe("Magahi: one rhotic, one symbol", () => {
    test("writes the tap for ऋ/ृ, as it does for र", () => {
        // Inherited from bhojpuri.jsonc, which this manifest was derived from. Fixed with it.
        expect(phonemize("कृष्ण", "mag")).toBe("kɾˈisn");
        expect(phonemize("ऋषि", "mag")).toBe("ɾˈisi");
        expect(phonemize("कर", "mag")).toBe("kˈəɾ");
        expect(phonemize("कृष्ण ऋषि कर", "mag")).not.toMatch(/r/u);
    });
});

describe("Magahi ordinals — its own suffix मा, not Hindi's वाँ/वीं/वें", () => {
    const say = (t: string): string => phonemize(t, "mag").trim();

    // ⚠ THE INHERITED HINDI TABLE WAS 100% UNREACHABLE HERE. `own?.ordinalSuffixes ?? MANIFEST.…` gave mag
    // Hindi's वाँ/वीं/वें, of which the mag corpus has ZERO; all 15 of its ordinals are `digit + मा`. The
    // suffix was therefore tokenized apart and spoken as its own word — मा is an ordinary Magahi word
    // ("mother"), so the failure was a plausible extra syllable, not a gap. See magahi.jsonc.
    test("the suffix FUSES onto the cardinal instead of standing as a word", () => {
        expect(say("१७मा शताब्दी")).toBe("sət̪ɾˈəɦmɑ sət̪ˈɑbd̪i");
        expect(say("१०मा बेर")).toBe("d̪ˈəsmɑ bˈeɾ");
        expect(say("२३मा मुख्यमन्त्री")).toBe("t̪eˈismɑ mukʰd͡ʒəmˈənt̪ɾi");
        // the before-picture: a stray मा as its own token
        expect(say("१७मा शताब्दी")).not.toMatch(/ mˈ?ɑ /u);
    });

    test("मा as an ordinary word is untouched — it is only claimed after a digit", () => {
        // Attested in the corpus and NOT digit-adjacent: "… स्थल मा भद्रकाली मन्दिर …".
        expect(say("स्थल मा भद्रकाली")).toBe("st̪ʰˈəl mˈɑ bʱˈəd̪ɾəkɑli");
    });

    // ⚠ THE DECLARATION IS ADDITIVE, AND THIS IS THE TEST THAT MAKES THAT LOAD-BEARING. `own?.
    // ordinalSuffixes ?? MANIFEST.ordinalSuffixes` overrides WHOLESALE, so a block containing only मा
    // removes Hindi's rows — the first draft did, and `१६वीं सदी` regressed to a stray *bˈĩ* and `१ला`
    // to a stray *lˈɑ*, which is the same defect one spelling over.
    test("Hindi's inherited suffixes and its suppletive arm still fire", () => {
        expect(say("१६वीं सदी")).toBe("solˈəɦbĩ sˈəd̪i");
        expect(say("१ला")).toBe("pˈəɦlɑ");
        expect(say("२रा")).toBe("d̪ˈusɾɑ");
        // …and the guards those arms carry are intact: था is the past copula, not 2's suffix.
        expect(say("२था")).toBe("d̪ˈo t̪ʰˈɑ");
        expect(say("२राज्य")).toBe("d̪ˈo ɾˈɑd͡ʒː");
        expect(say("१० वापस")).toBe("d̪ˈəs bˈɑpəs");
    });
});

describe("Magahi glide hardening — PINNED IN EVERY POSITION, which is not what the source cites", () => {
    // ⚠ DO NOT "FIX" THIS TO WORD-INITIAL WITHOUT A REFEREE. Vinod Kumar 2026 §6.2 states the hardening
    // word-initially; magahi.jsonc applies it as a flat consonant mapping, so it fires medially and
    // finally too — 1178 non-initial व and 1586 non-initial य across the mag corpus, against 481 + 182
    // initial. Filed in src/languages/magahi/magahi.ts: mag has no referee and no FLEURS audio, so there
    // is nothing here that can decide it. These expectations pin the SHIPPED behaviour so the divergence
    // is visible rather than silent.
    test("medial and final व / य harden too", () => {
        expect(phonemizeWord("पाण्डव")).toBe("pˈɑnɖəb");   // word-FINAL व
        expect(phonemizeWord("महाकाव्य")).toBe("məɦɑkˈɑbd͡ʒ"); // medial व AND final य
        expect(phonemizeWord("भारतीय")).toBe("bʱˈɑɾt̪id͡ʒ");  // word-final य
    });
});
