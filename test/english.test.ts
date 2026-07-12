import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for English. Pronunciation from the CMUdict lexicon + n-gram OOV G2P + POS
// heteronyms; sentence prosody = function-word de-accenting + nuclear tonic on the clause-final word.
describe("english canonical IPA", () => {
  test("heteronyms are POS-gated", () => {
    expect(phonemize("I read a book", "en")).toBe("aᶦ ɹˈɛd ə bˈʊk");             // past read
    expect(phonemize("please read this", "en")).toBe("plˈiːz ɹˈiːd ðˈɪs");        // present read
    expect(phonemize("they record the sales records", "en")).toBe("ðeᶦ ɹᵻkʰˈɔːɹd ðə sˈeᶦɫz ɹˈɛkɚdz"); // verb vs noun-plural
    expect(phonemize("what is the use", "en")).toBe("wˌʌt ɪz ðə jˈuːs");           // noun use
    expect(phonemize("please use it", "en")).toBe("plˈiːz jˈuːz ɪt");             // verb use
    expect(phonemize("the subject", "en")).toBe("ðə sˈʌbd͡ʒɪkt");                  // noun-dominant default
    expect(phonemize("the houses", "en")).toBe("ðə hˈaᶷzəz");                     // irregular voiced plural (pinned)
  });

  test("possessives + OOV G2P", () => {
    expect(phonemize("putin's car", "en")).toBe("pʰˈuːt̬ɪnz kʰˈɑːɹ");
    expect(phonemize("doomscroll", "en")).toBe("dˈuːmskɹoᶷɫ");                    // OOV → native G2P
  });

  test("numbers (cardinal, decimal, ordinal) become words → lexicon", () => {
    expect(phonemize("42", "en")).toBe("fˈɔːɹt̬i tʰˈuː");
    expect(phonemize("one hundred five", "en")).toBe("wˈʌn hˈʌndɹəd fˈaᶦv");
    expect(phonemize("3.14", "en")).toBe("θɹˈiː pʰɔᶦnt wˈʌn fˈɔːɹ");
    expect(phonemize("1st place", "en")).toBe("fˈɝst plˈeᶦs");
  });

  test("de-accenting + nuclear tonic", () => {
    expect(phonemize("give it to me.", "en")).toBe("ɡˈɪv ɪt tʰuː mˈiː .");        // function words reduced, tonic on me
    expect(phonemize("record this.", "en")).toBe("ɹᵻkʰˈɔːɹd ðˈɪs .");            // clause-final tonic promotes 'this'
    expect(phonemize("use it, record this.", "en")).toBe("jˈuːz ɪt , ɹᵻkʰˈɔːɹd ðˈɪs ."); // continuing clause keeps 'it' unstressed
    expect(phonemize("is it done?", "en")).toBe("ɪz ɪt dˈʌn ?");
  });

  test("wh-pronouns demote to secondary; decimal 'point' de-accents", () => {
    expect(phonemize("which one", "en")).toBe("wˌɪt͡ʃ wˈʌn");
    expect(phonemize("who is there", "en")).toBe("hˌuː ɪz ðˈɛɹ");
    expect(phonemize("how are you", "en")).toBe("hˈaᶷ ˈɑːɹ juː"); // wh-ADVERB keeps citation stress
    expect(phonemize("0.5", "en")).toBe("zˈɪɹoᶷ pʰɔᶦnt fˈaᶦv");   // decimal separator is a de-accented connector
  });
});
