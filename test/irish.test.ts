import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/irish/irish.ts";

// Canonical-IPA goldens for Irish Gaelic (ga) — Standard/Connacht-leaning, espeak-independent. The defining
// axis is BROAD (velarized ˠ, next to a/o/u) vs SLENDER (palatalized ʲ, next to e/i) consonants, determined by
// the flanking vowel letters ("caol le caol"). Slender velars are the palatal stops c/ɟ; slender s → ʃ. First-
// syllable stress (marked even on monosyllables); unstressed short vowels reduce to ə. Authored to
// Standard/Connacht; the espeak-ng-portable ga engine is a LOOSE cross-check — a few goldens deliberately
// diverge from it (Connacht final -e → ə, silent -dh/-gh, broad bh/mh → w). See docs/ga_bringup_investigation.md.
describe("irish canonical IPA", () => {
    test("broad consonants (velarized ˠ, dental l̪ˠ/n̪ˠ/d̪ˠ/t̪ˠ)", () => {
        expect(phonemizeWord("mór")).toBe("mˠˈoːɾˠ");
        expect(phonemizeWord("cat")).toBe("kˈat̪ˠ"); // broad k (velar), dental broad t
        expect(phonemizeWord("madra")).toBe("mˠˈad̪ˠɾˠə"); // final a → ə (unstressed reduction)
        expect(phonemizeWord("lá")).toBe("l̪ˠˈɑː"); // dark dental broad l
        expect(phonemizeWord("carr")).toBe("kˈaɾˠ"); // rr → single broad ɾˠ
        expect(phonemizeWord("focal")).toBe("fˠˈɔkəl̪ˠ");
    });

    test("slender consonants (palatalized ʲ; velars → palatal c/ɟ; s → ʃ)", () => {
        expect(phonemizeWord("bí")).toBe("bʲˈiː");
        expect(phonemizeWord("fir")).toBe("fʲˈɪɾʲ");
        expect(phonemizeWord("tír")).toBe("tʲˈiːɾʲ");
        expect(phonemizeWord("teach")).toBe("tʲˈax"); // slender t → tʲ, ch → x (broad)
        expect(phonemizeWord("súil")).toBe("sˠˈuːlʲ");
        expect(phonemizeWord("duine")).toBe("d̪ˠˈɪnʲə");
    });

    test("broad/slender in one word (caol le caol) + word-initial r broad", () => {
        expect(phonemizeWord("fear")).toBe("fʲˈaɾˠ"); // slender f (e), broad r (a)
        expect(phonemizeWord("bean")).toBe("bʲˈan̪ˠ");
        expect(phonemizeWord("rí")).toBe("ɾˠˈiː"); // word-initial r broad even before i
        expect(phonemizeWord("baile")).toBe("bˠˈalʲə");
    });

    test("lenition (séimhiú) + silent -dh/-gh endings", () => {
        expect(phonemizeWord("bhí")).toBe("vʲˈiː"); // bh → vʲ (slender)
        expect(phonemizeWord("oíche")).toBe("ˈiːçə"); // ch → ç (slender)
        expect(phonemizeWord("deoch")).toBe("dʲˈɔx"); // eo → ɔ here (lexicon pins the semi-lexical eo split)
        expect(phonemizeWord("chéadaigh")).toBe("çˈeːd̪ˠə"); // ch→ç, final -aigh: gh silent, ai→ə
        expect(phonemizeWord("airigh")).toBe("ˈaɾʲə");
    });

    test("review fixes: eclipsis (urú), s-cluster + coda quality, native ng → ŋ, oi → ɔ", () => {
        expect(phonemizeWord("gcat")).toBe("ɡˈat̪ˠ"); // eclipsis gc → ɡ (c silent)
        expect(phonemizeWord("mbád")).toBe("mˠˈɑːd̪ˠ"); // mb → mˠ
        expect(phonemizeWord("ngaeilge")).toBe("ŋˈeːəlʲɟə"); // ng → ŋ; unstressed i reduces to ə (referee-backed)
        expect(phonemizeWord("bhfuil")).toBe("wˈɪlʲ"); // bhf → w (f silent)
        expect(phonemizeWord("spéir")).toBe("sˠpʲˈeːɾʲ"); // s stays BROAD in the s-cluster; only p palatalizes
        expect(phonemizeWord("ainm")).toBe("ˈanʲmˠ"); // final m broad (no adjacent slender vowel)
        expect(phonemizeWord("long")).toBe("l̪ˠˈɔŋ"); // native ng → ŋ, final ɡ absorbed
        expect(phonemizeWord("scoil")).toBe("sˠkˈɔlʲ"); // oi → ɔ (not ɛ)
    });

    test("Run 2 — i-offglide (long back V + slender coda) + svarabhakti epenthesis", () => {
        expect(phonemizeWord("áit")).toBe("ˈɑːⁱtʲ"); // ɑː + slender coda t → i-offglide
        expect(phonemizeWord("cóir")).toBe("kˈoːⁱɾʲ");
        expect(phonemizeWord("súil")).toBe("sˠˈuːlʲ"); // uː gets NO offglide
        expect(phonemizeWord("baile")).toBe("bˠˈalʲə"); // pre-vocalic slender l → no offglide
        expect(phonemizeWord("gorm")).toBe("ɡˈɔɾˠəmˠ"); // r + coda m → epenthetic ə
        expect(phonemizeWord("bolg")).toBe("bˠˈɔl̪ˠəɡ"); // l + coda ɡ → ə
        expect(phonemizeWord("gairm")).toBe("ɡˈaɾʲəmˠ"); // r-epenthesis; short a → no offglide
        expect(phonemizeWord("ainm")).toBe("ˈanʲmˠ"); // n does NOT trigger epenthesis
    });

    test("Run 3 — ia/ua diphthongs, onset offglide, eo no-glide, lexicon overrides", () => {
        expect(phonemizeWord("iad")).toBe("ˈiəd̪ˠ"); // ia → iə (short first element; referee-confirmed)
        expect(phonemizeWord("ciall")).toBe("cˈiəl̪ˠ");
        expect(phonemizeWord("nuair")).toBe("n̪ˠˈuəɾʲ"); // ua → uə
        expect(phonemizeWord("áirithe")).toBe("ˈɑːⁱɾʲəhə"); // offglide before a slender ONSET, not just coda
        expect(phonemizeWord("ceoil")).toBe("cˈoːlʲ"); // eo carries its glide → no i-offglide
        expect(phonemizeWord("deoch")).toBe("dʲˈɔx"); // lexicon: the semi-lexical eo → ɔ split
        expect(phonemizeWord("féidir")).toBe("fʲˈeːdʲəɾʲ"); // unstressed i reduces to ə (referee), NOT the oracle's ɪ
    });

    test("fada (long vowels) + first-syllable stress", () => {
        expect(phonemizeWord("bó")).toBe("bˠˈoː");
        expect(phonemizeWord("fada")).toBe("fˠˈad̪ˠə");
        expect(phonemizeWord("cara")).toBe("kˈaɾˠə");
        expect(phonemizeWord("obair")).toBe("ˈɔbˠəɾʲ"); // stress first syllable; 2nd (ai) → ə
    });
});
