/**
 * `used to` — THE ONLY HETERONYM WITH A FOLLOWING-WORD CONDITION, AND THE ONLY ONE MEASURED BEFORE IT
 * WAS BUILT (#1395).
 *
 * ⚠ `used` IS RANK 125 AND WAS SIMPLY WRONG. The habitual "I used to walk" is /juːst/ and we said
 * /juːzd/. #1396 left it out of the `-ed` adjective class on the grounds that no POS tag separates it
 * from the passive "will be used to determine". Two tags do, partly.
 *
 * ⚠ SCORED OVER THE 101 `used to` TOKENS IN THE UD ENGLISH TREEBANKS, with this repo's own tagger:
 *
 *     41/101  41%  today (always juːzd)            82/101  81%  tag is VBD
 *     60/101  59%  next word is `to` (flat)        87/101  86%  ← what shipped
 *
 * The issue proposed the flat bigram, which WOULD have been net positive. It is not what shipped.
 *
 * ⚠ AND THE RESIDUE IS 14, NOT THE 3 I FIRST CLAIMED. An earlier draft of this header said the only
 * miss was the instrumental; the error list says otherwise, and the classes are pinned below AS WRONG
 * so the 86% stays honest:
 *
 *   ~6  HABITUAL TAGGED VBN — "Car repair used to be a knowledge commons", "Poverty used to depend…".
 *       A tagger error, not an ambiguity: these are unmistakably habitual to a reader.
 *    3  INSTRUMENTAL — "a trick that I used to tame them". VBD before an infinitive, identical in every
 *       feature the condition can see.
 *   ~4  ACCUSTOMED the left gate or the UD-derived gold gets wrong at the edges.
 *
 * ⚠ AND ONE MORE THE CORPUS DOES NOT CONTAIN AT ALL: a participle before a PREPOSITIONAL `to` with a
 * be/get head — "the funds were used to that end". All 15 prepositional `used to` tokens in the corpus
 * are the accustomed sense, so the measurement is silent on that class and cannot defend it.
 */
import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";

const say = (s: string): string => phonemize(s, "en");

describe("the used-to following-word condition", () => {
    it("reads the habitual as /juːst/", () => {
        expect(say("I used to walk there")).toBe("aᶦ jˈuːst tʰuː wˈɔːk ðˈɛɹ");
        expect(say("a website I used to run")).toBe("ə wˈɛbsˌaᶦt aᶦ jˈuːst tʰuː ɹˈʌn");
    });

    it("reads be/get used to <gerund> as /juːst/ too, via the NEXT tag and a left gate", () => {
        // Here `used` is VBN and `to` is a PREPOSITION (IN), not the infinitive marker.
        expect(say("He was used to walking briskly")).toBe("hiː wʌz jˈuːst tʰuː wˈɔːkɪŋ bɹˈɪskli");
        expect(say("Get used to using it yourself")).toBe("ɡˈɛt jˈuːst tʰuː jˈuːzɪŋ ɪt jɚsˈɛɫf");
    });

    it("leaves the passive as /juːzd/", () => {
        // ⚠ THE HALF A FLAT BIGRAM WOULD BREAK — the reason the issue refused to copy misaki gold's
        // {VBD: jˈust}, which would also have broken "she used a hammer".
        expect(say("This date will be used to determine it")).toBe("ðɪs dˈeᶦt wɪɫ biː jˈuːzd tʰuː dᵻtʰˈɝmən ɪt");
    });

    it("leaves a plain past with no following `to` alone", () => {
        // The `past` slot exists ONLY for this condition, so it must be CLEARED when the condition does
        // not fire — `used` is VBD here too and would otherwise reach it.
        expect(say("She used a hammer")).toBe("ʃiː jˈuːzd ə hˈæmɚ");
        expect(say("They used it yesterday")).toBe("ðeᶦ jˈuːzd ɪt jˈɛstɚdˌeᶦ");
    });

    it("⚠ DOES NOT READ ACROSS A CLAUSE BOUNDARY, which it did for one review round", () => {
        // The word stream carries NO punctuation — clause units contribute no words — so `words[i+1]`
        // is the next WORD however many commas lie between. Unguarded, both of these read jˈuːst: the
        // tagger cannot see the punctuation either, so it obligingly tags the bare stream VBD IN and
        // BOTH halves of the condition pass. That is the plain-past failure this exists to avoid,
        // reintroduced one clause to the left.
        expect(say("He used, to my surprise, a hammer.")).toBe("hiː jˈuːzd , tʰuː maᶦ sɚpɹˈaᶦz , ə hˈæmɚ .");
        expect(say("I do not know which tool he used. To be fair, it worked.")).toBe("aᶦ duː nɑːt nˈoᶷ wˌɪt͡ʃ tʰˈuːɫ hiː jˈuːzd . tʰuː biː fˈɛɹ , ɪt wˈɝkt .");
    });

    it("⚠ PINS THE THREE RESIDUE CLASSES AS WRONG, rather than papering over them", () => {
        // ⚠ IF A LATER CHANGE FIXES ANY OF THESE, THIS TEST FAILING IS THE SIGNAL — flip the
        // expectation and raise the 86% in the header. The device english-gb-ary.test.ts used for
        // `amatory`, which fired as designed at #1391.
        expect(say("The tool I used to open it")).toContain("jˈuːst");          // ← instrumental; /juːzd/
        expect(say("Car repair used to be a knowledge commons")).toContain("jˈuːzd");  // ← habitual VBN
        expect(say("the materials used to make paper")).toContain("jˈuːst");    // ← participle; /juːzd/
        expect(say("The tool I used to open it")).toBe("ðə tʰˈuːɫ aᶦ jˈuːst tʰuː ˈoᶷpn̩ ɪt");
        expect(say("Car repair used to be a knowledge commons")).toBe("kʰˈɑːɹ ɹᵻpʰˈɛɹ jˈuːzd tʰuː biː ə nˈɑːləd͡ʒ kʰˈɑːmənz");
        expect(say("the materials used to make paper")).toBe("ðə mətʰˈɪɹiʲəɫz jˈuːst tʰuː mˈeᶦk pʰˈeᶦpɚ");
    });
});
