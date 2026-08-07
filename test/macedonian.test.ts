import { describe, expect, test } from "vitest";

import { createMacedonian, phonemizeWord } from "../src/languages/macedonian/macedonian.ts";
import { normalizeMacedonian } from "../src/languages/macedonian/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Macedonian (mk, македонски) — South Slavic (~2M), Cyrillic, fully phonemic with NO vowel reduction. A left-to-right
// grapheme scan + the shared South-Slavic phonotactics (dark-l, final devoicing, regressive voicing, n→ŋ). Two
// Macedonian specifics: the palatals are DISTINCT LETTERS (ѓ ќ љ њ ѕ џ ј → ɟ c ʎ ɲ d͡z d͡ʒ j — no ь/я/ю), and STRESS is
// FIXED on the ANTEPENULT syllable (predictable → emitted). 99.0% folded / 99.8% symbol accuracy vs the wikipron
// mkd_cyrl_narrow referee (63,024 headwords — the residual is letter-name rows).
describe("Macedonian canonical IPA — phonemic Cyrillic g2p + antepenultimate stress", () => {
    const mk = createMacedonian();

    test("the distinct palatal LETTERS: ѓ→ɟ, ќ→c, љ→ʎ, њ→ɲ, ѕ→d͡z, џ→d͡ʒ", () => {
        expect(phonemizeWord("ѓавол")).toBe("ɟˈavɔɫ"); // ⟨ѓ⟩ → ɟ
        expect(phonemizeWord("куќа")).toBe("kˈuca"); // ⟨ќ⟩ → c
        expect(phonemizeWord("љубов")).toBe("ʎˈubɔf"); // ⟨љ⟩ → ʎ, final ⟨в⟩→f
        expect(phonemizeWord("коњ")).toBe("kˈɔɲ"); // ⟨њ⟩ → ɲ
        expect(phonemizeWord("ѕид")).toBe("d͡zˈit"); // ⟨ѕ⟩ → d͡z, final ⟨д⟩→t
        expect(phonemizeWord("џамија")).toBe("d͡ʒˈamija"); // ⟨џ⟩ → d͡ʒ
    });

    test("dark-l ([l] before е/и, [ɫ] elsewhere), syllabic ⟨р⟩→[r̩], final devoicing", () => {
        expect(phonemizeWord("волк")).toBe("vˈɔɫk"); // dark ⟨л⟩ before a consonant
        expect(phonemizeWord("леб")).toBe("lˈɛp"); // light ⟨л⟩ before ɛ, final ⟨б⟩→p
        expect(phonemizeWord("прст")).toBe("pˈr̩st"); // syllabic ⟨р⟩
        expect(phonemizeWord("срце")).toBe("sˈr̩t͡sɛ"); // syllabic ⟨р⟩ bears the stress
        expect(phonemizeWord("град")).toBe("ɡrˈat"); // final ⟨д⟩→t
    });

    test("fixed ANTEPENULT stress: 3rd-from-last syllable (planina→ˈplanina), penult in disyllables", () => {
        expect(phonemizeWord("Македонија")).toBe("makɛdˈɔnija"); // 5 syllables → antepenult (до)
        expect(phonemizeWord("планина")).toBe("pɫˈanina"); // 3 syllables → antepenult (пла)
        expect(phonemizeWord("ноќ")).toBe("nˈɔc"); // monosyllable
    });

    test("cardinal numbers: 'и' connector, feminine две илјади, millions", () => {
        expect(mk.text("15").trim()).toBe("pɛtnˈaɛsɛt"); // петнаесет
        expect(mk.text("21").trim()).toBe("dvˈaɛsɛt ˈi ˈɛdɛn"); // дваесет и еден
        expect(mk.text("234").trim()).toBe("dvˈɛstɛ trˈiɛsɛt ˈi t͡ʃˈɛtiri"); // двесте триесет и четири
        expect(mk.text("2000").trim()).toBe("dvˈɛ ˈiljadi"); // ДВЕ илјади (feminine илјада, not два)
        expect(mk.text("1000000").trim()).toBe("mˈiliɔn"); // милион (was empty before the fix)
        expect(mk.text("2000000").trim()).toBe("dvˈa milˈiɔni"); // два милиони (милион is masculine)
    });

    test("clause assembly", () => {
        expect(mk.text("Добар ден, Македонија!").trim()).toBe("dˈɔbar dˈɛn , makɛdˈɔnija !");
    });
});

// TEXT NORMALIZATION. Asserted on the normalize.ts text→text output where the point is the WORDS
// (a wrong word is the failure mode this layer has), and through `phonemize` where the point is that the
// pipeline downstream actually speaks them. Counts are from the mk_mk FLEURS corpus (1,857 utterances).
describe("Macedonian text normalization", () => {
    // The REGISTRY path — the shared Roman→digit and foreign routers run there, so regnal ordinals
    // (Лиалофи III → Лиалофи 3) and the Latin version-dot suffix (802.11n) resolve as in production.
    const ph = (s: string): string => getPhonemizer("mk").text(s).trim();

    test("period-space group thousands; the comma is BOTH grouping and decimal, told apart by block length", () => {
        expect(normalizeMacedonian("400.000 познати случаи")).toBe("400000 познати случаи");
        expect(normalizeMacedonian("5.000.000 уникатни")).toBe("5000000 уникатни"); // two passes
        expect(normalizeMacedonian("40 000 луѓе")).toBe("40000 луѓе");
        expect(ph("Од 1,400 луѓе")).toBe("ˈɔt ˈiljada ˈi t͡ʃɛtiristˈɔtini ɫˈuɟɛ"); // 3-digit comma = grouping
        expect(ph("6,5 степени")).toBe("ʃˈɛst zˈapirka pˈɛt stˈɛpɛni"); // 1-digit comma = decimal
        expect(ph("12,8 km")).toBe("dvanˈaɛsɛt zˈapirka ˈɔsum kiɫˈɔmɛtri");
        expect(ph("2,243")).toBe("dvˈɛ ˈiljadi dvˈɛstɛ t͡ʃɛtirˈiɛsɛt ˈi trˈi"); // 3-digit block read whole
    });

    test("the suffix ordinal: the suffix is the last letters of the spoken form, encoding gender+definiteness", () => {
        expect(normalizeMacedonian("17-ти век")).toBe("седумнаесетти век"); // -ти masc indef
        expect(normalizeMacedonian("18-тиот век")).toBe("осумнаесеттиот век"); // -тиот masc definite
        expect(normalizeMacedonian("18-от век")).toBe("осумнаесеттиот век"); // -от, contracted
        expect(normalizeMacedonian("7-миот")).toBe("седмиот"); // -миот (седми)
        expect(normalizeMacedonian("21-ви")).toBe("дваесет и први"); // -ви (први)
        expect(normalizeMacedonian("37-ма земја")).toBe("триесет и седма земја"); // -ма feminine indefinite
        expect(normalizeMacedonian("1-та и 3-та дивизија")).toBe("првата и третата дивизија"); // -та definite
        expect(normalizeMacedonian("1.000-та марка")).toBe("илјадита марка"); // round thousand: feminine, not -тата
        expect(normalizeMacedonian("116-те напреварувачи")).toBe("сто и шеснаесетте напреварувачи"); // "the 116"
        expect(normalizeMacedonian("40-тина")).toBe("четириесетина"); // "some forty"
        expect(normalizeMacedonian("190ти")).toBe("сто и деведесетти");
        expect(normalizeMacedonian("60-ти")).toBe("шеесетти");
        expect(normalizeMacedonian("1970-тите години")).toBe("илјада деветстотини и седумдесеттите години");
        expect(normalizeMacedonian("1850-те години")).toBe("илјада осумстотини и педесеттите години");
        expect(normalizeMacedonian("1920- тите години")).toBe("илјада деветстотини и дваесеттите години"); // space!
        expect(normalizeMacedonian("100-200 милји/час")).toBe("100 до 200 милји на час");
    });

    test("century and date ordinals: bare N век, N месяц, and the Germanic N. remnant", () => {
        expect(normalizeMacedonian("меѓу 10 и 11 век и 14 век")).toBe("меѓу десетти и единаесетти век и четиринаесетти век");
        expect(normalizeMacedonian("на 6 октомври 1789")).toBe("на шести октомври 1789");
        expect(normalizeMacedonian("24 август - 5 септември 2021")).toBe("дваесет и четврти август до петти септември 2021");
        expect(normalizeMacedonian("4. јули 1776")).toBe("четврти јули 1776");
    });

    test("era markers and the year abbreviation", () => {
        expect(normalizeMacedonian("356 г. п.н.е.")).toBe("356 година пред нашата ера");
        expect(normalizeMacedonian("400 г. н.е.")).toBe("400 година од нашата ера");
        expect(normalizeMacedonian("1978 г.")).toBe("1978 година"); // a year → година
        expect(normalizeMacedonian("25 г.")).toBe("25 години"); // an age → години
    });

    test("clock: hour и minute, :00 drops minutes, ч → часот", () => {
        expect(ph("меѓу 06:30 и 07:30 часот")).toBe("mˈɛɟu ʃˈɛst ˈi trˈiɛsɛt ˈi sˈɛdum ˈi trˈiɛsɛt t͡ʃˈasɔt");
        expect(ph("во 10:00 часот")).toBe("vˈɔ dˈɛsɛt t͡ʃˈasɔt");
        expect(ph("до 23:35 ч.")).toBe("dˈɔ dvˈaɛsɛt ˈi trˈi ˈi trˈiɛsɛt ˈi pˈɛt t͡ʃˈasɔt");
        expect(ph("Помеѓу 22:00-23:00 часот")).toBe("pˈɔmɛɟu dvˈaɛsɛt ˈi dvˈa dˈɔ dvˈaɛsɛt ˈi trˈi t͡ʃˈasɔt");
    });

    test("rates, units, squared units and percent through the shared tier", () => {
        expect(ph("83 km/h")).toBe("ɔsˈumdɛsɛt ˈi trˈi kiɫˈɔmɛtri nˈa t͡ʃˈas");
        expect(ph("165 км/ч")).toBe("stˈɔ ʃˈɛɛsɛt ˈi pˈɛt kiɫˈɔmɛtri nˈa t͡ʃˈas");
        expect(ph("3.850 км²")).toBe("trˈi ˈiljadi ɔsumstˈɔtini ˈi pˈɛdɛsɛt kvˈadratni kiɫˈɔmɛtri");
        expect(ph("3136 мм2")).toBe("trˈi ˈiljadi stˈɔ trˈiɛsɛt ˈi ʃˈɛst kvˈadratni milˈimɛtri");
        expect(ph("4892 м")).toBe("t͡ʃˈɛtiri ˈiljadi ɔsumstˈɔtini dɛvˈɛdɛsɛt ˈi dvˈa mˈɛtri");
        expect(ph("88 %")).toBe("ɔsˈumdɛsɛt ˈi ˈɔsum prˈɔt͡sɛnti");
        expect(ph("600 Mbit/s")).toBe("ʃɛstˈɔtini mɛɡˈabiti nˈa sˈɛkunda");
    });

    test("signs: degrees, plus, ampersand — the handoff's sign classes", () => {
        expect(ph("90°F")).toBe("dɛvˈɛdɛsɛt stˈɛpɛni pˈɔ fˈarɛnxa d͡ʒˈeᶦ t");
        expect(ph("35° W")).toBe("trˈiɛsɛt ˈi pˈɛt stˈɛpɛni zˈapat");
        expect(ph("над +30 степени целзиусови")).toBe("nˈat pɫˈus trˈiɛsɛt stˈɛpɛni t͡sɛɫziˈusɔvi");
        expect(ph("Б&Б")).toBe("p ˈi p"); // ampersand → и (was dropped before)
    });

    test("initialisms: vowel-less runs letter-spell, САД is a word, Д-р/Г-дин expand", () => {
        expect(ph("ФБИ")).toBe("ˈɛf bˈɛ ˈi");
        expect(ph("ДНК")).toBe("dˈɛ ˈɛn kˈa");
        expect(ph("СССР")).toBe("ˈɛs ˈɛs ˈɛs ˈɛr");
        expect(ph("САД")).toBe("sˈat"); // pronounced as the word [sat], not letter-spelled
        expect(ph("ОН")).toBe("ˈɔ ˈɛn"); // Обединети Нации = UN, letter-spelled (он = "he" would be wrong)
        expect(ph("GPS")).toBe("ɡˈɛ pˈɛ ˈɛs"); // embedded Latin, Macedonian letter names
        expect(ph("Д-р Малар")).toBe("dˈɔktɔr mˈaɫar");
        expect(ph("Г-дин Рид")).toBe("ɡˈɔspɔdin rˈit");
        expect(ph("НАСА, Н. Вејн")).toBe("nˈasa , ˈɛn vˈɛjn");
        expect(ph("Џорџ В. Буш")).toBe("d͡ʒˈɔrt͡ʃ vˈɛ bˈuʃ");
    });

    test("regnal ordinals after roman→digit: feminine after a name in -а, 2–39 only", () => {
        expect(ph("Лиалофи III")).toBe("liˈaɫɔfi trˈɛti");
        expect(ph("Кралица Елизабета II")).toBe("krˈalit͡sa ɛlizˈabɛta ftˈɔra"); // Втора, feminine
        expect(ph("Луј XVI")).toBe("ɫˈuj ʃɛsnaˈɛsɛtti");
        expect(ph("во Формула 1.")).toBe("vˈɔ fˈɔrmuɫa ˈɛdɛn ."); // Formula ONE — cardinal, not regnal
    });

    test("fractions and version dots", () => {
        expect(ph("29¾ инчи на 24½ инчи")).toBe(
            "dvˈaɛsɛt ˈi dˈɛvɛt ˈi trˈi t͡ʃɛtvˈr̩tini ˈint͡ʃi nˈa dvˈaɛsɛt ˈi t͡ʃˈɛtiri ˈi pɔɫˈɔvina ˈint͡ʃi",
        );
        expect(ph("5 мм (1/5 инчи)")).toBe("pˈɛt milˈimɛtri ˈɛdna pˈɛttina ˈint͡ʃi");
        expect(ph("802.11n")).toBe("ɔsumstˈɔtini ˈi dvˈa tˈɔt͡ʃka ɛdinˈaɛsɛt ˈɛn");
    });
});
