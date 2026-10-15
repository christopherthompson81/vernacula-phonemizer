/**
 * Prose in angle brackets is READ, not stripped as a tag. All inputs are synthetic.
 *
 * `stripMarkup` used to delete any `<` + letter span up to `>`, so an aside like `<a longer note here>` lost its
 * words and a paragraph wrapped in `< >` left an empty input. Mirrored in C# (`MarkupAngleProseTests.cs`) and
 * Rust (`core::markup::tests`).
 */
import { describe, expect, test } from "vitest";
import { stripMarkup } from "../src/core/markup.ts";
import { phonemize } from "../src/index.ts";

describe("angle-bracketed prose", () => {
    test("is kept, and read as parentheses", () => {
        expect(stripMarkup("Before <a longer note here> after.")).toBe("Before (a longer note here) after.");
        expect(stripMarkup("<Question for the team: was the widget tested?>")).toBe(
            "(Question for the team: was the widget tested?)",
        );
        expect(stripMarkup("<I think so>")).toBe("(I think so)");
    });

    test("comparisons are left alone", () => {
        expect(stripMarkup("3 < 5 and 7 > 2")).toBe("3 < 5 and 7 > 2");
        expect(stripMarkup("x<y and z>w")).toBe("x<y and z>w");
        expect(stripMarkup("a lone < here")).toBe("a lone < here");
    });

    test("real tags are still removed", () => {
        expect(stripMarkup("Year <i>2024</i> end")).toBe("Year 2024 end");
        expect(stripMarkup("<B>bold</B>")).toBe("bold");
        expect(stripMarkup('<a href="https://x.example/y">link</a>')).toBe("link");
        expect(stripMarkup("<br/>x<br />y<br>")).toBe("xy");
        expect(stripMarkup('<ref name="n1"/>z')).toBe("z");
        expect(stripMarkup("<span class='q' style=\"c:r\">s</span>")).toBe("s");
        expect(stripMarkup("<p class=lead>t</p>")).toBe("t");
    });

    test("<sup> digits still become superscripts", () => {
        expect(stripMarkup("2.802×10<sup>10</sup>")).toBe("2.802×10¹⁰");
        expect(stripMarkup("km<sup>2</sup>")).toBe("km²");
        expect(stripMarkup("4<sup>th</sup>")).toBe("4th");
    });

    test("an engine reads the aside as it reads parentheses, not as a comparison", () => {
        for (const lang of ["en", "de", "es", "ar"])
            expect(phonemize("Before <a longer note here> after.", lang)).toBe(
                phonemize("Before (a longer note here) after.", lang),
            );
        expect(phonemize("<Question for the team: was the widget tested?>", "en")).not.toBe("");
    });
});
