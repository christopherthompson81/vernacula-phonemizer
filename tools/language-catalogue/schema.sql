-- Language catalogue for vernacula-phonemizer.
--
-- One row per language / lect we have considered. The point is to STOP re-deriving the same scope + data-
-- availability verdicts: every language we implement, reject, or defer is recorded here with WHY, plus the
-- phonological-referee material we found (so we don't re-probe wikipron/kaikki/epitran each time).
--
-- Source of truth is catalogue.tsv (diffable); build.py regenerates languages.db from this schema + that TSV.

DROP TABLE IF EXISTS languages;

CREATE TABLE languages (
    code             TEXT PRIMARY KEY,          -- our code / ISO 639-3 (e.g. 'hi', 'ckb', 'arq', 'es-419')
    name             TEXT NOT NULL,
    family           TEXT,                      -- family / branch (e.g. 'Indo-Aryan', 'Semitic (Arabic)', 'Sinitic')
    script           TEXT,                      -- primary writing system

    -- Estimated speaker populations, in absolute numbers. L1 = native, L2 = second-language. NULL = unknown
    -- (fill incrementally); 0 = genuinely ~none (e.g. MSA has ~no L1 speakers).
    l1_speakers      INTEGER,
    l2_speakers      INTEGER,

    -- Presence / size of relevant phonological material (independent referees). For the count columns: a positive
    -- integer = # entries found, 0 = confirmed ABSENT, NULL = not yet probed. For the flag columns: 1 = exists,
    -- 0 = confirmed none, NULL = unknown.
    wikipron_entries INTEGER,                   -- wikipron <iso>_*_broad entry count
    kaikki_entries   INTEGER,                   -- kaikki (Wiktionary) IPA entry count
    epitran          INTEGER,                   -- 1 = an epitran mapping exists
    espeak           INTEGER,                   -- 1 = espeak-ng ships a voice (legacy reference only)
    fleurs           INTEGER,                   -- 1 = in the FLEURS-102 speech benchmark, 0 = not, NULL = unknown

    -- The disposition.
    decision         TEXT NOT NULL
                       CHECK (decision IN ('implemented','rejected','unimplemented')),

    -- WHY a language is rejected, or the provisional blocker for an unimplemented one. NULL for implemented.
    rejection_reason TEXT
                       CHECK (rejection_reason IS NULL OR rejection_reason IN (
                           'unsuitable orthography',                    -- no community-adopted standard script
                           'macrolanguage umbrella',                    -- a cover term, not a single phonology
                           'spoken-only',                               -- no established written tradition
                           'data scarcity',                             -- no independent referee to verify against
                           'variant without sufficient vowel-encoding'  -- an abjad/variant that under-writes vowels
                       )),

    verdict          TEXT,                      -- for implemented rows: maturity ✅ 🟢 🟡 🔷 ⛔ (else NULL).
    -- ⚠ 🔵 ("in active development", per docs/language-maturity.md) IS PART OF THE VOCABULARY and was missing
    -- here. That omission had a cost: `km` carried 🔵🔷 in the maturity doc, the column could not express it, and
    -- so km sat with a NULL verdict — the only real engine without one — which read as an oversight rather than
    -- as a value the schema refused. NO language carries 🔵 today (km was promoted to 🔷 once its bring-up was
    -- measured), but the state is real and the next bring-up will need it. A verdict may hold TWO glyphs when
    -- both apply. A blank verdict is meaningful ONLY for an aliased row; see served_by below.

    -- TEXT NORMALIZATION state — whether the symbols a reader says aloud (%, currency, ranges, decimals, signs)
    -- are read for this language, which is a SEPARATE axis from `verdict`: a language can phonemize its words
    -- excellently and still drop every percent sign. Empty is the planning signal — see the query in README.md.
    --
    -- ⚠ DERIVED, NOT HAND-KEPT: `python3 derive-normalization.py` recomputes it from the registry and the engine
    -- directories. A hand-maintained column goes stale the moment a language is treated, and this one is only
    -- worth planning from if it is true.
    --
    --   done       the engine directory has a normalize.ts AND the engine calls it
    --   partial    the file exists but nothing calls it — those came apart in practice, so it is a real state
    --   inherited  the row is served by another language's engine (served_by), so that engine's layer runs
    --   NULL       no layer: a candidate
    --
    -- ⚠ `done` MAY MEAN A SHARED LAYER. Four directories serve sixteen codes — `arabic` alone serves ten dialect
    -- codes — so `done` says a normalizer RUNS for this code, not that one was written for it specifically.
    normalization    TEXT
                       -- ⚠ `separators` IS NOT `done`. It marks a layer that is the corpus-independent
                       -- subset and nothing else — `core/separatorHygiene.ts`, which spends marks and emits
                       -- no word — written for the eight languages with no text to source vocabulary from.
                       -- Rounding it up to `done` would delete them from the planning query that found them.
                       CHECK (normalization IS NULL OR normalization IN ('done','separators','partial','inherited')),

    -- If this language is served by ANOTHER language's engine as a labelled approximation (rather than a bespoke
    -- module), the code of that sibling — e.g. Magahi (mag) served_by 'bho'. NULL = its own bespoke module (or
    -- not implemented). An aliased row is still `decision='implemented'` (the code works) but carries no verdict.
    -- ⚠ DEFERRABLE, because the rows arrive in catalogue.tsv's order and an alias may precede its target: `bgc`
    -- references `hi`, which is inserted later, so an immediate check fails on a file that is perfectly valid.
    -- Deferred to COMMIT, with build.py inserting inside one transaction.
    served_by        TEXT REFERENCES languages(code) DEFERRABLE INITIALLY DEFERRED,

    pr               TEXT,                      -- PR / commit reference
    notes            TEXT,

    -- An implemented row carries no rejection reason; a rejected row must state one.
    CHECK (decision != 'implemented' OR rejection_reason IS NULL),
    CHECK (decision != 'rejected'    OR rejection_reason IS NOT NULL),

    -- ⚠ AN ALIASED ROW CARRIES NO VERDICT, which the comment on `served_by` above has always said and nothing
    -- enforced. `af` was recorded as `served_by='native'` — a SENTINEL, not a language code — while also carrying
    -- a verdict and notes describing its own bespoke g2p, i.e. it was a native module wearing an alias marker for
    -- what NULL already means. The pair is the tell: `bgc` and `zsm` are real aliases and have no verdict, `af`
    -- had both. Enforced now, along with foreign keys (build.py turns them on), so `served_by` must name a row
    -- that exists and cannot be used as a free-text flag again.
    CHECK (served_by IS NULL OR verdict IS NULL)
);

CREATE INDEX idx_decision ON languages(decision);
CREATE INDEX idx_reason   ON languages(rejection_reason);
CREATE INDEX idx_family   ON languages(family);
-- The planning index: "which unnormalized language has the most speakers?" is the query this table gets asked.
CREATE INDEX idx_norm     ON languages(normalization);
