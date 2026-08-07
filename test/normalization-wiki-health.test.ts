/**
 * The mined-corpus health check — that it still fails a template-built corpus and passes prose.
 *
 * WHY THIS IS PINNED. The first set of thresholds PASSED `ceb`, the one wiki that is the reason the
 * check exists: they were written from the shape of the argument before anything was measured. The
 * calibration that replaced them lives in, and a
 * future edit that loosens a threshold, changes the shingle width, or swaps the tokenizer can silently
 * restore that state — the tool would keep printing confident output and would stop catching anything.
 *
 * The fixtures are SHAPES, not fetched text. The bot fixture is built the way a geographic generator builds
 * an article — one sentence pattern, slots filled from a small list — because that is the property under
 * test, and it means the test carries no third-party content.
 */
import { describe, expect, test } from "vitest";
import { health, verdict, histogram } from "../tools/normalization/wiki-health.ts";

/** One template, slots varied. This is the `ceb` failure mode in miniature. */
const TEMPLATE = Array.from({ length: 60 }, (_, i) =>
    `Alang sa ubang mga dapit sa mao usab nga ngalan, tan-awa ang Barangay ${i + 1}. `
    + `Ang Barangay ${i + 1} mao ang usa ka barangay sa Pilipinas. Nahimutang ni sa lalawigan sa `
    + `${["Cebu", "Bohol", "Leyte"][i % 3]}, sa rehiyon sa Central Visayas, sa habagatang bahin sa nasod. `
    + `Ang mga gilay-on sa ${20 + (i % 40)} ka metros ibabaw sa dagat ug adunay ${1000 + i * 7} ka molupyo.`);

/** Ordinary prose: every sentence a different sentence. Deliberately mundane content, no shared phrasing. */
const PROSE = [
    "Der Bahnhof wurde 1873 eröffnet und diente zunächst dem Güterverkehr auf der Strecke nach Kassel.",
    "Ihre Dissertation über die Löslichkeit organischer Salze erschien 1927 in einer Fachzeitschrift.",
    "Das Gebäude beherbergt heute ein Museum, dessen Sammlung vor allem regionale Keramik umfasst.",
    "Nach dem Umbau betrug die nutzbare Fläche 4.250 m², verteilt auf drei Etagen und ein Kellergeschoss.",
    "Die Art wurde erstmals an einem Bachlauf im Süden der Insel beobachtet und später auch anderswo belegt.",
    "Im Winter sinkt die Durchschnittstemperatur auf -3 °C, während der Sommer selten über 24 °C hinausgeht.",
    "Er spielte 112 Partien für den Verein und wechselte anschließend in die zweite Liga.",
    "Der Vertrag sah vor, dass beide Seiten ihre Truppen innerhalb von 30 Tagen zurückziehen sollten.",
    "Über die Herkunft des Namens gibt es mehrere Vermutungen, von denen keine als gesichert gilt.",
    "Die Straßenbahnlinie verkehrt alle 7:30 Minuten und wird an Wochenenden ausgedünnt.",
    "Ein Teil der Handschrift ging bei einem Brand verloren; erhalten sind noch etwa 40 % der Blätter.",
    "Sie veröffentlichte insgesamt neun Romane, von denen der dritte den größten Erfolg hatte.",
    "Das Kraftwerk liefert eine Leistung von 340 kW und speist den Strom direkt ins Ortsnetz ein.",
    "Der Fluss mündet nach 86 km in einen See, dessen Ufer größtenteils unter Naturschutz stehen.",
    "Nach seiner Rückkehr arbeitete er als Lehrer, bevor er 1901 in den Staatsdienst eintrat.",
];

/**
 * ⚠ THE FIRST ATTEMPT AT A PASS FIXTURE WAS ITSELF A TEMPLATE, and the check caught it. Fifteen sentences
 * repeated twelve times with a varying `(Abschnitt k.i, laut der damaligen Chronik des Ortes)` suffix
 * measured **18.9% template reuse and 0.043 type/token** — worse than `ceb` on both. That is the fixture
 * being wrong and the tool being right, and it is a better demonstration than any assertion: filling a slot
 * differently does not make text diverse, which is precisely what the metric is for.
 *
 * So the pass side is pinned on the MEASURED readings from the calibration instead of on invented prose. Real
 * corpora are what those numbers came from; a synthetic that is diverse enough to clear the floor would be a
 * word salad, and pinning a word salad proves less than pinning the numbers the thresholds were set from.
 */
const measured = (
    templateReuse: number,
    ttr: number,
    segments = 370,
    over: Partial<Parameters<typeof verdict>[0]> = {},
): Parameters<typeof verdict>[0] => ({
    segments, analyzed: segments, chars: 100_000, lenMedian: 230, lenP10: 105, lenP90: 531, lenCV: 0.71,
    templateReuse, topShingle: undefined, ttr, ttrUnit: "word",
    scripts: [["Latin", 0.997]], latinShare: 0.997,
    scriptLines: { native: segments, mixed: 0, foreign: 0 },
    fields: { count: 6, top: [] }, cellRate: {},
    ...over,
});

describe("mined-corpus health", () => {
    test("a template-built corpus is SUSPECT, on the two metrics that separated", () => {
        const h = health(TEMPLATE);
        const v = verdict(h);
        expect(v.ok).toBe(false);
        // The fixture must trip MORE THAN ONE signal — a single one no longer condemns, by design.
        expect(v.notes.some((n) => n.includes("template reuse"))).toBe(true);
        expect(v.notes.some((n) => n.includes("type/token"))).toBe(true);
        expect(v.notes.some((n) => n.includes("ONE bot signal only"))).toBe(false);
        expect(h.templateReuse).toBeGreaterThan(0.03);
        expect(h.ttr).toBeLessThan(0.45);
    });

    /**
     * ⚠ CORROBORATION, because no single signal is decisive and treating one as decisive misjudged four
     * languages. Each of the three bot signals fires on a healthy corpus for a reason unrelated to a
     * generator — haw (13 phonemes, particle-dense), hak and cdo (romanized monosyllabic, so "words" are
     * syllables), wo (shingle reuse with no template). `ceb` trips all three, because a generated corpus is
     * degenerate in every direction at once.
     */
    test("one bot signal is reported and does NOT fail; two agreeing signals do", () => {
        // haw: low MSTTR alone. hak/cdo: the same. wo: reuse alone.
        const oneSignal = verdict(measured(0.002, 0.364, 370, { fields: { count: 0, top: [] } }));
        expect(oneSignal.ok).toBe(true);
        expect(oneSignal.notes.some((n) => n.includes("ONE bot signal only"))).toBe(true);
        expect(verdict(measured(0.057, 0.644, 370, { fields: { count: 0, top: [] } })).ok).toBe(true);

        // ceb: reuse AND vocabulary AND fields.
        const three = verdict(measured(0.101, 0.340, 370, { fields: { count: 61, top: [] } }));
        expect(three.ok).toBe(false);
        expect(three.notes.some((n) => n.includes("ONE bot signal only"))).toBe(false);

        // any two of the three is enough.
        expect(verdict(measured(0.101, 0.340, 370, { fields: { count: 0, top: [] } })).ok).toBe(false);
        expect(verdict(measured(0.002, 0.340, 370, { fields: { count: 61, top: [] } })).ok).toBe(false);
        expect(verdict(measured(0.101, 0.644, 370, { fields: { count: 61, top: [] } })).ok).toBe(false);
    });

    test("composition and sample-size findings are independent of corroboration", () => {
        // A foreign-line share and a thin sample are true whatever else the corpus looks like — they are
        // statements about what was fetched, not about whether a generator wrote it.
        expect(verdict(measured(0.002, 0.644, 200, {
            scripts: [["Cherokee", 0.74]], scriptLines: { native: 108, mixed: 30, foreign: 62 },
        })).ok).toBe(false);
        expect(verdict(measured(0.002, 0.644, 12)).ok).toBe(false);
    });

    test("the calibration points still land on the right side of every threshold", () => {
        // de and ka, the two human-written wikis, must pass; ceb must fail. These are the readings the
        // thresholds were derived from, so a loosened threshold breaks here rather than in the field.
        expect(verdict(measured(0.002, 0.644)).ok).toBe(true);  // de  wiki
        expect(verdict(measured(0.010, 0.799)).ok).toBe(true);  // ka  wiki
        expect(verdict(measured(0.101, 0.340)).ok).toBe(false); // ceb wiki
        // And the margins: the worst human reading on each metric is still clear of its threshold.
        expect(verdict(measured(0.010, 0.644)).ok).toBe(true);
        expect(verdict(measured(0.002, 0.644)).notes).toHaveLength(0);
    });

    test("a thin sample is reported as unjudgeable rather than as a bad wiki", () => {
        // The Run 4 trap: a partially-written fetch measures as a small wiki and every proportion below is
        // noise. This must be a note about the SAMPLE, not a verdict about the text.
        const v = verdict(health(PROSE.slice(0, 5)));
        expect(v.ok).toBe(false);
        expect(v.notes[0]).toContain("too few to judge");
    });

    test("length CV is never a trigger — pinned as a negative result", () => {
        // Measured: de 0.71, ceb 0.65, and the de_de FLEURS baseline 0.35 — the known-good corpus has the
        // TIGHTEST distribution of the three. Any reintroduced length-uniformity trigger would fire on it.
        expect(verdict(measured(0.002, 0.644)).ok).toBe(true);
        expect(verdict(health(TEMPLATE)).notes.some((n) => n.includes("length"))).toBe(false);
    });

    /**
     * ⚠ MIXED-SCRIPT LINES ARE NOT A DEFECT, and the first version of this check called them one.
     *
     * The candidate set is full of conventionally Latinized languages carrying heavy lexical influence from a
     * colonial language, concentrated in the academic register a Wikipedia is written in — and several are
     * genuinely dual-script, so a correct text mixes Latin with the language's own script. A Latin-CHARACTER
     * share cannot distinguish that from the real problem. Measured on the Cherokee dump: 54% Cherokee, 15%
     * mixed (correct), 32% English prose. Only the last is a finding.
     *
     * These assert on the CLASSIFICATION and on the threshold, not on synthetic prose. Three attempts at a
     * "diverse prose" fixture were themselves templates — rotating clause pools measured 25.1% reuse and
     * 0.159 MSTTR — because a fixture built by filling slots is exactly what the other metrics detect. The
     * classification is what this pair is about, so it is tested directly.
     */
    test("a borrowed foreign term makes a line MIXED, never foreign", () => {
        const lines = Array.from({ length: 200 }, (_, i) =>
            `ქართული ენა არის ქართველური ენების ჯგუფის ენა და მასზე საუბრობენ, ტერმინი Universitas ${i} აკადემიურია.`);
        const h = health(lines);
        expect(h.scripts[0]?.[0]).toBe("Georgian");
        expect(h.scriptLines.foreign).toBe(0);
        expect(h.scriptLines.mixed).toBeGreaterThan(0);
        // ...and mixed lines alone never produce a script finding, whatever their share.
        expect(verdict(measured(0.002, 0.644, 200, {
            scripts: [["Georgian", 0.8]], scriptLines: { native: 25, mixed: 175, foreign: 0 },
        })).notes.some((n) => n.includes("not in"))).toBe(false);
    });

    test("a line that is not the language at all is FOREIGN, and enough of them is the finding", () => {
        const native = Array.from({ length: 130 }, (_, i) =>
            `ქართული ენა არის ქართველური ენების ჯგუფის ენა და მასზე საუბრობენ საქართველოში ნომერი ${i}.`);
        const english = Array.from({ length: 70 }, (_, i) =>
            `Georgian New Testament Online. Online translation of the New Testament, edition number ${i}.`);
        const h = health([...native, ...english]);
        expect(h.scripts[0]?.[0]).toBe("Georgian");
        expect(h.scriptLines.foreign).toBe(70);

        // The chr proportions: 32% foreign trips it, 15% mixed + 54% native does not.
        const chrLike = measured(0.002, 0.644, 200, {
            scripts: [["Cherokee", 0.74]], scriptLines: { native: 108, mixed: 30, foreign: 62 },
        });
        expect(verdict(chrLike).notes.some((n) => n.includes("not in Cherokee script at all"))).toBe(true);
        // A Latin-script language never trips this, whatever its Latin share.
        expect(verdict(measured(0.002, 0.644, 370, { scriptLines: { native: 100, mixed: 0, foreign: 270 } }))
            .notes.some((n) => n.includes("not in"))).toBe(false);
    });

    /**
     * ⚠ THE METRIC THAT RESCUES A REPETITIVE LANGUAGE FROM THE VOCABULARY METRIC. `haw` measured MSTTR 0.364
     * against the bot wiki's 0.340 and was flagged — but Hawaiian has 13 phonemes, short words and dense
     * particle use, so any Hawaiian text repeats heavily. MSTTR was measuring the language.
     *
     * Template fields ask WHAT KIND of word is frequent rather than how much repetition there is: a template
     * slot appears in a huge share of segments EXACTLY ONCE in each, because the generator writes it once per
     * article, whereas a function word recurs within a sentence. Measured: ceb 61 · de 6 · ka 3 · haw 0 · wo 0.
     */
    test("a template's slots are detected as fields; a function word is not", () => {
        const h = health(TEMPLATE);
        expect(h.fields.count).toBeGreaterThan(20);
        // The slots themselves, not the grammar: ceb's real fields were nahimutang/ulohan/giiniton.
        expect(h.fields.top.some((f) => f.rate <= 1.05 && f.df > 0.4)).toBe(true);
        expect(verdict(h).notes.some((n) => n.includes("TEMPLATE FIELDS"))).toBe(true);
    });

    test("a repetitive language is not condemned by field count alone", () => {
        // haw and wo both measured ZERO field-like words while tripping a vocabulary or reuse threshold.
        // Pinned so a future widening of FIELD_MIN_DF / FIELD_MAX_RATE cannot quietly re-flag them.
        expect(verdict(measured(0.002, 0.644, 370, { fields: { count: 0, top: [] } }))
            .notes.some((n) => n.includes("TEMPLATE FIELDS"))).toBe(false);
        expect(verdict(measured(0.002, 0.644, 370, { fields: { count: 6, top: [] } }))
            .notes.some((n) => n.includes("TEMPLATE FIELDS"))).toBe(false);
    });

    test("the histogram is scale-free — it compares shapes, not per-segment rates", () => {
        // The defect the first version had: a cell is a boolean per segment, so a per-segment rate scales
        // with segment length and every cell read as 3-15x "inflated" against a shorter-segment baseline.
        // Doubling every segment must not move the distribution.
        const single = health(PROSE);
        const doubled = health(PROSE.map((s, i) => `${s} ${PROSE[(i + 1) % PROSE.length]}`));
        const h = histogram(doubled, single);
        expect(h.divergence).toBeLessThan(0.25);
    });

    test("health() is deterministic — the artifact it gates is committed and diffed", () => {
        expect(JSON.stringify(health(TEMPLATE))).toBe(JSON.stringify(health(TEMPLATE)));
    });
});
