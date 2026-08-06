import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeMalay } from "../src/languages/malay/normalize.ts";

// #562 Standard Malay (zsm) TEXT NORMALIZATION. The phonology is still Indonesian's (zsm is served by the
// Indonesian engine as a labelled approximation), so these goldens pin the TEXT→TEXT layer that runs in
// front of it — the shapes where the two standards' orthographic conventions genuinely differ.
//
// Pinned by RULE BRANCH, not by corpus instance (playbook trap 13 (pin the rule's BRANCHES)): every branch below has at least one
// case, and the branches the ms_my corpus does NOT exercise — 12 a.m./12 p.m., the afternoon `petang` arm,
// a three-place decimal, `°C`, `m²`, `m/s` — are pinned deliberately (trap 8 (zero corpus instances is not evidence of…)).
describe("malay (zsm) normalization — the conventions Indonesian does not share", () => {
    test("separators are the ENGLISH ones: comma groups thousands, the dot is the decimal point", () => {
        // Read with Indonesian's separators, `1,400` was *satu koma empat nol nol* ("one point four zero
        // zero") and `5,000,000` lost digits to a clause pause.
        expect(normalizeMalay("Dari 1,400 orang")).toBe("Dari 1400 orang");
        expect(normalizeMalay("5,000,000 pelawat")).toBe("5000000 pelawat");
        expect(phonemize("Dari 1,400 orang", "zsm")).toBe("dˈari sərˈibu əmpˈat rˈatus ˈoraŋ");
        expect(phonemize("5,000,000 pelawat", "zsm")).toBe("lˈima d͡ʒˈuta pəlˈawat");
        // The decimal point is `perpuluhan`, and the fraction is read DIGIT BY DIGIT.
        expect(normalizeMalay("hampir 3.7 juta")).toBe("hampir 3 perpuluhan 7 juta");
        expect(normalizeMalay("selebar 3.50 m")).toBe("selebar 3 perpuluhan 5 0 m");
        expect(phonemize("hampir 3.7 juta", "zsm")).toBe("hˈampir tˈiɡa pərpulˈuhan tˈud͡ʒuh d͡ʒˈuta");
    });

    test("the two separator branches the corpus does NOT exercise", () => {
        // `9.000 orang` is the corpus's one Indonesian-convention leak and must stay THOUSANDS…
        expect(normalizeMalay("9.000 orang")).toBe("9.000 orang");
        expect(phonemize("9.000 orang", "zsm")).toBe("səmbˈilan rˈibu ˈoraŋ");
        // …while its adversarial neighbour, a real three-place decimal, must not be caught by that
        // exclusion: only an all-zero group is a grouped thousand.
        expect(normalizeMalay("nilai 3.141")).toBe("nilai 3 perpuluhan 1 4 1");
    });

    test("percent is peratus, and a sentence that writes the word drops the sign", () => {
        expect(normalizeMalay("membentuk 3% dari")).toBe("membentuk 3 peratus dari");
        expect(phonemize("membentuk 3% dari", "zsm")).toBe("məmbəntˈuʔ tˈiɡa pərˈatus dˈari");
        // Trap 12: say it once. Leaving the sign for the inherited tier said it twice AND in Indonesian.
        expect(normalizeMalay("80% peratus")).toBe("80 peratus");
    });

    test("clocks need a marker, take no joiner, and read the meridiem as a part of the day", () => {
        // Malay `lewat` means "late / via" (its two corpus instances are `Lewat pada hari Ahad` and `pada
        // lewat tahun 2015`), never Indonesian's "past the hour", so the hour and minutes are juxtaposed.
        expect(normalizeMalay("pukul 8:46 pagi")).toBe("pukul 8 46 pagi");
        expect(normalizeMalay("Sekitar pukul 11:00,")).toBe("Sekitar pukul 11,");
        expect(phonemize("Tepat pada pukul 8:46 pagi", "zsm")).toBe("təpˈat pˈada pˈukul dəlˈapan əmpˈat pˈuluh ənˈam pˈaɡi");
        // A COORDINATED pair: the second clock's `pukul` window is only reachable once the first has been
        // rewritten, which is why the pass repeats to a fixed point.
        expect(normalizeMalay("antara pukul 06.30 dan 07.30")).toBe("antara pukul 6 30 dan 7 30");
        // The meridiem is consumed and re-emitted as the Malay part of the day.
        expect(normalizeMalay("pukul 1.15 a.m. hari")).toBe("pukul 1 15 pagi hari");
        expect(normalizeMalay("pada 11:35 pm.")).toBe("pada 11 35 malam.");
        // Branches with ZERO corpus instances (trap 8 (zero corpus instances is not evidence of…)): noon, midnight, and the afternoon arm.
        expect(normalizeMalay("pukul 12.00 p.m.")).toBe("pukul 12 tengah hari");
        expect(normalizeMalay("pukul 12.00 a.m.")).toBe("pukul 12 tengah malam");
        expect(normalizeMalay("pukul 3.30 p.m.")).toBe("pukul 3 30 petang");
    });

    test("without a marker a colon pair is a score, a ratio or a degree class — not a clock", () => {
        // The inherited rule read the rugby score 21:20 as *dua puluh satu lewat dua puluh*. No single
        // Malay word fits all three senses, so the mark is dropped and both operands kept.
        expect(normalizeMalay("satu mata, 21:20, yang")).toBe("satu mata, 21 20, yang");
        expect(normalizeMalay("dikatakan 3:2.")).toBe("dikatakan 3 2.");
        expect(phonemize("dikatakan 3:2.", "zsm")).toBe("dikatˈakan tˈiɡa dˈua .");
        // …and a sports time keeps its hundredths as a decimal instead of becoming a clock.
        expect(normalizeMalay("masa 4:41.30 minit")).toBe("masa 4 41 perpuluhan 3 0 minit");
    });

    test("ranges join with hingga only where a measure noun or a year pair says they are ranges", () => {
        expect(normalizeMalay("selama 2-5 hari")).toBe("selama 2 hingga 5 hari");
        expect(normalizeMalay("(10-60 minit)")).toBe("(10 hingga 60 minit)");
        expect(normalizeMalay("sejak 1995-1996, apabila")).toBe("sejak 1995 hingga 1996, apabila");
        expect(normalizeMalay("dari 4.2-3.9 juta tahun")).toBe("dari 4 perpuluhan 2 hingga 3 perpuluhan 9 juta tahun");
        // The four corpus SPORTS SCORES have neither a measure noun nor a year pair, and must not join.
        expect(normalizeMalay("Washington 5-3 semasa")).toBe("Washington 5-3 semasa");
        expect(normalizeMalay("mencapai 6-6.")).toBe("mencapai 6-6.");
    });

    test("units: the rate takes the se- prefix, and the exponent, frequency and degree words are Malay", () => {
        // Indonesian says `per jam`; Malay says `sejam` (`105 batu sejam` is the corpus's own wording).
        expect(normalizeMalay("melebihi 160km/j tujuh")).toBe("melebihi 160 kilometer sejam tujuh");
        expect(normalizeMalay("(sering 100-200 batu/jam)")).toBe("(sering 100 hingga 200 batu sejam)");
        expect(normalizeMalay("40 bsj (64 kmj)")).toBe("40 batu sejam (64 kilometer sejam)");
        expect(normalizeMalay("meliputi 19,500km² dan")).toBe("meliputi 19500 kilometer persegi dan");
        expect(normalizeMalay("2.2 juta km2.")).toBe("2 perpuluhan 2 juta kilometer persegi.");
        expect(normalizeMalay("frekuensi 2.4Ghz")).toBe("frekuensi 2 perpuluhan 4 gigahertz");
        // Malay `darjah`, not Indonesian `derajat`; `35°W` was the glued non-word `dərˈad͡ʒatw`.
        expect(normalizeMalay("suhu panas 90°F.")).toBe("suhu panas 90 darjah Fahrenheit.");
        expect(normalizeMalay("timur 35°W.")).toBe("timur 35 darjah barat.");
        expect(normalizeMalay("suhu 25°C dan 40°")).toBe("suhu 25 darjah Celsius dan 40 darjah");
        expect(phonemize("suhu panas 90°F.", "zsm")).toBe("sˈuhu pˈanas səmbˈilan pˈuluh dˈard͡ʒah fahrənhəˈit .");
    });

    test("abbreviations, the era marker and the ampersand", () => {
        // Malay wording where it differs from Indonesian's table: doktor/nombor/Encik, not dokter/nomor/—.
        expect(normalizeMalay("Dr. Ehud Ur,")).toBe("doktor Ehud Ur,");
        expect(normalizeMalay("angkasawan No. 11")).toBe("angkasawan nombor 11");
        expect(normalizeMalay("Keputusan En. Rudd untuk")).toBe("Keputusan Encik Rudd untuk");
        // `A.S.` read as `ˈa . s .` — two phrase breaks mid-sentence. The clause-final dot is kept.
        expect(normalizeMalay("Presiden A.S. mengatakan")).toBe("Presiden AS mengatakan");
        expect(normalizeMalay("berpusat di A.S.")).toBe("berpusat di AS.");
        expect(phonemize("Presiden A.S. mengatakan", "zsm")).toBe("presˈidɛn aɛs məŋatˈakan");
        // The corpus spells `sebelum Masihi` out elsewhere; `SM` was read as the letters `ɛsɛm`.
        expect(normalizeMalay("pada 323 SM.")).toBe("pada 323 sebelum Masihi.");
        // The ampersand VANISHED — a symbol that is dropped is invisible to the leak classes (#584).
        expect(normalizeMalay("Seni &amp; Sains")).toBe("Seni dan Sains");
        expect(phonemize("Pada skala mewah, B&B dengan", "zsm")).toBe("pˈada skˈala mewˈah , b dˈan b dəŋˈan");
    });

    test("the currency VOCABULARY stays with the shared tier; only the sign's position is Malay's problem", () => {
        // A sign glued behind letters was swallowed whole, so the amount lost its currency word.
        expect(normalizeMalay("yuran sebanyak US$30,")).toBe("yuran sebanyak US $30,");
        // …and a sign in front of a bare DECIMAL amount is moved behind it, or the tier sees only the
        // integer part and says the currency word INSIDE the number (*satu dolar perpuluhan lima nol*).
        expect(normalizeMalay("harga €1.50 sekilo")).toBe("harga 1 perpuluhan 5 0 € sekilo");
        expect(phonemize("harga €1.50 sekilo", "zsm")).toBe("hˈarɡa sˈatu pərpulˈuhan lˈima nˈol əˈuro səkˈilo");
        // A MAGNITUDE WORD after the amount is the case the tier cannot get right at all: keyed on the
        // sign's adjacency to the digits, it says the currency between the number and its own magnitude.
        // The corpus settles the order itself — `bilion dolar` ×4, `juta dolar` ×4, `dolar bilion` ×0.
        expect(normalizeMalay("kekayaan $2.3 bilion.")).toBe("kekayaan 2 perpuluhan 3 bilion dolar.");
        expect(phonemize("kekayaan $2.3 bilion.", "zsm")).toBe("kəkajˈaan dˈua pərpulˈuhan tˈiɡa bilˈion dˈolar .");
        // No currency NAME is invented for that move: the words are verbatim the INHERITED tier's own table
        // (indonesian.ts `currency`), so only the position changes. `pound` is also what the ms corpus writes
        // for the currency — its `paun` ×3 is the WEIGHT pound.
        expect(phonemize("berjumlah £ 27 juta.", "zsm")).toBe("bərd͡ʒˈumlah dˈua pˈuluh tˈud͡ʒuh d͡ʒˈuta pˈound .");
        // MOVING the sign instead of naming it is not an option, and this pins why: past a word it is no
        // longer digit-adjacent, so the tier drops it and the currency vanishes outright.
        expect(normalizeMalay("kadar $1.5 trilion")).toBe("kadar 1 perpuluhan 5 trilion dolar");
        // Trap 12 outranks both: a CURRENCY CODE after the amount already names the currency, so the sign is
        // dropped rather than said twice. `billion` is in the magnitude class because the corpus writes the
        // English spelling once, in `US $14.7 billion`.
        expect(normalizeMalay("tambahan berjumlah $45 juta AUD.")).toBe("tambahan berjumlah 45 juta AUD.");
        expect(normalizeMalay("(US $14.7 billion)")).toBe("(US 14 perpuluhan 7 billion dolar)");
        // An INTEGER amount with no magnitude word is left entirely alone — the tier already reads it.
        expect(normalizeMalay("kos $1000 setahun")).toBe("kos $1000 setahun");
        expect(phonemize("kos $1000 setahun", "zsm")).toBe("kˈos sərˈibu dˈolar sətˈahun");
    });

    test("what Malay INHERITS unchanged from the Indonesian layer", () => {
        // Nothing here is a Malay rule; each is a shape measured to be identical in both standards, and
        // each would be a defect if this layer touched it.
        expect(normalizeMalay("juadah dsb. yang")).toBe("juadah dsb. yang");        // Indonesian's table is right
        expect(phonemize("juadah dsb. yang", "zsm")).toBe("d͡ʒuˈadah dˈan səbaɡaˈiɲa jˈaŋ");
        expect(phonemize("tempat ke-190 dalam", "zsm")).toBe("təmpˈat kˈə sərˈatus səmbˈilan pˈuluh dˈalam");
        expect(phonemize("pada 21 Mac 2010", "zsm")).toBe("pˈada dˈua pˈuluh sˈatu mˈat͡ʃ dˈua rˈibu səpˈuluh");
        expect(phonemize("denda $1000 setiap", "zsm")).toBe("dəndˈa sərˈibu dˈolar sətˈiap");
    });

    test("INDONESIAN still reads its own conventions — the Malay layer is not on its path", () => {
        // The whole point of the pre-pass shape: `id` never imports it. Its dot-thousands, its comma
        // decimal, its `persen`, its `lewat` clock and its `dokter` are all untouched.
        expect(phonemize("sebanyak 9.000 orang", "id")).toBe("səbˈaɲaʔ səmbˈilan rˈibu ˈoraŋ");
        expect(phonemize("sekitar 1,5 juta", "id")).toBe("səkˈitar sˈatu kˈoma lˈima d͡ʒˈuta");
        expect(phonemize("membentuk 3% dari", "id")).toBe("məmbəntˈuʔ tˈiɡa pərsˈɛn dˈari");
        expect(phonemize("pukul 11.30 pagi", "id")).toBe("pˈukul səbəlˈas lewˈat tˈiɡa pˈuluh pˈaɡi");
        expect(phonemize("Dr. Damadian", "id")).toBe("dˈoʔtər damadˈian");
    });

    // #586 — `m³` lost the `³` outright. `padu` is a REAL Malay/Indonesian divergence rather than a shared
    // word, which is the whole reason this file's layer exists: ms_my writes `meter padu` ×2 ("Luno membawa
    // 120–160 meter padu bahan bakar") and `kubik` ×0, where Indonesian uses `kubik`.
    // ⚠ `isi padu` ×2 in the same corpus is the ordinary sense, "volume" (`isi padu air`) — the collocation
    // with the unit noun is the evidence, and the rule must not touch the bare word.
    test("the cubed measure word is Malay's own, not Indonesian's (#586)", () => {
        expect(phonemize("120 m³", "zsm")).toContain("mɛtˈər pˈadu");
        expect(phonemize("120 m³", "id")).toContain("mɛtˈər");      // id has no cube word; not "padu"
        expect(phonemize("120 m³", "id")).not.toContain("pˈadu");
        expect(phonemize("isi padu air", "zsm")).toBe("ˈisi pˈadu ˈair"); // the bare word is untouched
        // EVERY unit, not just `m`: nothing behind this file has a cube word at all (the tier Malay inherits
        // is Indonesian's, `squared` only), so unlike the squared arms these cannot fall through.
        expect(phonemize("5 km³", "zsm")).toContain("kilomətˈər pˈadu");
        expect(phonemize("5 km3", "zsm")).toContain("kilomətˈər pˈadu");
        expect(phonemize("3136 mm3", "zsm")).toContain("milimətˈər pˈadu");
        // …but bare `m` stays SUPERSCRIPT-ONLY, because `M3` is a motorway and a car. `5 m3` reads as a
        // number deliberately, the same trade the `m²` arm above already makes.
        expect(phonemize("M3 lebuhraya", "zsm")).toContain("m tˈiɡa");
        expect(phonemize("BMW M3", "zsm")).toContain("m tˈiɡa");
        expect(phonemize("1 M3", "zsm")).not.toContain("pˈadu");
    });
});
