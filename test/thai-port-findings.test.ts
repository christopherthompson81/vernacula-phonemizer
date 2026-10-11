/**
 * Thai defects the Rust port found by reading (#1512), fixed TS-first. Each reading is pinned as an
 * EQUIVALENCE with the spelled-out Thai the fix intends, so no IPA is hand-typed here.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeThai } from "../src/languages/thai/normalize.ts";

const th = (s: string): string => phonemize(s, "th");

describe("Thai: the Rust port's findings (#1512)", () => {
    test("1. a unit abbreviation after a DECIMAL is still expanded", () => {
        expect(normalizeThai("ยาว 3.5 กม.")).toBe("ยาว 3 จุด ห้า กิโลเมตร");
        expect(normalizeThai("2.5 กก.")).toBe("2 จุด ห้า กิโลกรัม");
        expect(th("ยาว 3.5 กม.")).toBe(th("ยาว 3 จุด ห้า กิโลเมตร"));
        expect(th("ยาว 3.5 กม.")).not.toContain(".");
        // The integer case was already right and stays so.
        expect(normalizeThai("ยาว 3 กม.")).toBe("ยาว 3 กิโลเมตร");
    });

    test("2. a clock hour never matches the tail of a longer number", () => {
        expect(normalizeThai("123.45 น.")).not.toContain("นาฬิกา");
        expect(normalizeThai("2024 น.")).not.toContain("นาฬิกา");
        // The real clocks are untouched.
        expect(normalizeThai("09.30 น.")).toBe("9 นาฬิกา 30 นาที");
        expect(normalizeThai("เวลา 9 น.")).toBe("เวลา 9 นาฬิกา");
        expect(normalizeThai("22.00-23.00 น.")).toBe("22 นาฬิกา ถึง 23 นาฬิกา");
    });

    test("3. a final 1 after a magnitude is เอ็ด, as after a ten", () => {
        expect(th("101")).toBe(th("หนึ่ง ร้อย เอ็ด"));
        expect(th("1001")).toBe(th("หนึ่ง พัน เอ็ด"));
        expect(th("201")).toBe(th("สอง ร้อย เอ็ด"));
        expect(th("111")).toBe(th("หนึ่ง ร้อย สิบ เอ็ด"));
        // A multiplier of 1 is not a final 1, and 1 alone is หนึ่ง.
        expect(th("1")).toBe(th("หนึ่ง"));
        expect(th("1000000")).toBe(th("หนึ่ง ล้าน"));
        expect(th("10")).toBe(th("สิบ"));
    });

    test("4. the baht sign is read as บาท", () => {
        expect(th("ราคา ฿100")).toBe(th("ราคา 100 บาท"));
        expect(th("ราคา ฿100")).not.toBe(th("ราคา 100"));
    });

    test("5. °F is องศาฟาเรนไฮต์, with no Latin letter left behind", () => {
        expect(normalizeThai("10°F")).toBe("10 องศาฟาเรนไฮต์");
        expect(normalizeThai("10 °F")).toBe("10 องศาฟาเรนไฮต์");
        expect(th("10°F")).toBe(th("10 องศาฟาเรนไฮต์"));
        expect(normalizeThai("10°C")).toBe("10 องศาเซลเซียส");
    });
});
