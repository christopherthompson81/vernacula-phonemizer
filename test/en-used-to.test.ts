/**
 * `used to` — THE ONLY HETERONYM WITH A FOLLOWING-WORD CONDITION, AND THE ONLY ONE MEASURED BEFORE IT
 * WAS BUILT (#1395).
 *
 * ⚠ `used` IS RANK 125 AND WAS SIMPLY WRONG. The habitual "I used to walk" is /juːst/ and we said
 * /juːzd/. No POS tag separates it from the passive "will be used to determine" — both are VB* before
 * an infinitival `to` — which is why #1396 left it out of the `-ed` adjective class.
 *
 * ⚠ THE CONDITION TESTS A WORD *AND* TWO TAGS, BECAUSE THE CORPUS SAID THE TAGS WERE WORTH 26 POINTS.
 * Scored over the 101 `used to` tokens in the UD English treebanks with this repo's own tagger:
 *
 *     41%  today (always juːzd)          81%  tag is VBD
 *     59%  next word is `to` (flat)      85%  tag is VBD, OR the next tag is IN
 *
 * The issue proposed the flat bigram, which WOULD have been net positive. It is not what shipped.
 *
 * ⚠ AND THE RESIDUE IS NAMED, NOT HIDDEN: the instrumental "a trick that I used to tame them" is VBD
 * before an infinitive exactly like the habitual, and is 3 of the 101. It is pinned below as WRONG so
 * the number in this header stays honest and a future fix has a failing case to aim at.
 */
import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";

const say = (s: string): string => phonemize(s, "en");

describe("the used-to following-word condition", () => {
    it("reads the habitual as /juːst/", () => {
        expect(say("I used to walk there")).toBe("aᶦ jˈuːst tʰuː wˈɔːk ðˈɛɹ");
        expect(say("a website I used to run")).toBe("ə wˈɛbsˌaᶦt aᶦ jˈuːst tʰuː ɹˈʌn");
    });

    it("reads be/get used to <gerund> as /juːst/ too, via the NEXT tag", () => {
        // ⚠ THIS IS THE HALF `VBD` ALONE WOULD NOT GET. Here `used` is VBN and `to` is a PREPOSITION
        // (IN), not the infinitive marker — the "accustomed" reading. 10 of the 101.
        expect(say("He was used to walking briskly")).toBe("hiː wʌz jˈuːst tʰuː wˈɔːkɪŋ bɹˈɪskli");
        expect(say("Get used to using it yourself")).toBe("ɡˈɛt jˈuːst tʰuː jˈuːzɪŋ ɪt jɚsˈɛɫf");
    });

    it("leaves the passive and the participle as /juːzd/", () => {
        // ⚠ THE HALF A FLAT BIGRAM WOULD BREAK, and it is 38 of the 101 — the reason the issue refused
        // to copy misaki gold's {VBD: jˈust}, which would also have broken "she used a hammer".
        expect(say("This date will be used to determine it")).toBe("ðɪs dˈeᶦt wɪɫ biː jˈuːzd tʰuː dᵻtʰˈɝmən ɪt");
        expect(say("The aircraft used to fly there")).toBe("ðə ˈɛɹkɹˌæft jˈuːzd tʰuː flˈaᶦ ðˈɛɹ");
    });

    it("leaves a plain past with no following `to` alone", () => {
        // The `past` slot exists ONLY for this condition, so it must be CLEARED when the condition does
        // not fire — `used` is VBD here too and would otherwise reach it.
        expect(say("She used a hammer")).toBe("ʃiː jˈuːzd ə hˈæmɚ");
        expect(say("They used it yesterday")).toBe("ðeᶦ jˈuːzd ɪt jˈɛstɚdˌeᶦ");
    });

    it("⚠ STILL GETS THE INSTRUMENTAL WRONG, and that is pinned rather than papered over", () => {
        // "the tool I used [in order] to open it" is VBD before an infinitive, identical in every
        // feature this condition can see. 3 of the 101 corpus tokens. If a later change fixes it, THIS
        // TEST FAILING IS THE SIGNAL — flip the expectation and raise the 85% in the header.
        expect(say("The tool I used to open it")).toBe("ðə tʰˈuːɫ aᶦ jˈuːst tʰuː ˈoᶷpn̩ ɪt");
        expect(say("The tool I used to open it")).toContain("jˈuːst");   // ← wrong; /juːzd/ is correct
    });
});
