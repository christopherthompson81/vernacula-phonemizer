# The trainers never followed the data move

`tools/english/en_g2p_bilstm.py` reads a dictionary that has not existed since August. This is what else
was wrong, and why nothing caught it.

## Run 1 — 2026-09-18

### It was a move, not a deletion

`908fface` (#876, 23 Aug) relocated 317 data assets — 141 MB — from `src/languages/<lang>/` into a shared
`data/` tree so the C# port could consume the same files by the same keys. Git records the English dict as
a pure rename: `{src => data}/languages/english/g2p-dict.tsv`.

The engine was routed through one choke point (`src/core/dataPath.ts`) and **49 tools were repointed by
hand. None of them were under `tools/english/`.**

### ⚠ THE SWEEP MISSED THE TRAINERS, AND THAT IS NOT A COINCIDENCE

32 real code paths across ~13 languages were still on the old location, and the list is almost entirely
model trainers, ONNX exporters and lexicon builders:

    train_nb_bilstm.py  train_af_bilstm.py  da_bilstm.py       fr_g2p_bilstm.py
    train_ps_harakat.py train_ckb_bizroke.py en_g2p_bilstm.py  export_onnx.py
    build_sh_stress_lexicon.py  build_ckb_lexicon.py  build_sl_stress_lexicon.py
    en_baseline.mts  en_per_compare.mts  en_hybrid.mts  en_g2p_ngram.ts

⚠ #876's sweep repointed the tools the SUITE OR THE GATES EXERCISE. A trainer runs only when somebody
retrains, so nothing failed, nothing went red, and the paths rotted in place. **Every BiLSTM trainer in the
repo is broken the same way**; English is just where it was noticed.

### ⚠ THE DANGEROUS HALF IS THE WRITE PATHS, NOT THE READ PATHS

The old directories still exist — they hold the `.ts` modules — but contain zero data files. So:

  * **reads hard-fail** (`en_g2p_bilstm.py:22 DICT`) — loud, harmless, and the reason this was found;
  * **writes silently succeed into a dead directory** (`en_g2p_bilstm.py:117 SRC`, the ONNX export
    destination, and `en_g2p_ngram.ts:537`, the `--emit` default). The run reports success, the shipped
    model is untouched, and the package fence includes `src/` — so a stray 3 MB model there would SHIP.

That is not hypothetical. `tools/perso-arabic/export_onnx.py` carries a header note dated 2026-08-19
describing exactly it: "a successful-looking export wrote two ORPHAN files into src/core while the model
the runtime loads stayed untouched".

### ⚠ AND THAT FILE WAS STILL WRONG AFTER BEING FIXED ONCE

Its 2026-08-19 fix moved the destination from `src/core` to `src/languages/perso-arabic` — a directory
that **has never existed**, under either tree. So repointing `src/`→`data/` mechanically would have left it
just as broken, pointing at `data/languages/perso-arabic` instead. `riderDiacritizer` is a SHARED
multilingual model loaded by `src/core/riderDiacritizer.ts` for every Perso-Arabic rider; it has no
language directory, and ships as `data/core/riderDiacritizer.onnx`. Fixed there.

⚠ The same note also claimed `riderDiacritizer.ts` had left `src/core`. It has not — the file is there
today. What moved was the MODEL, not the module, and the note had conflated them.

### What the guard checks, and what it deliberately allows

`test/tool-data-paths.test.ts`, two assertions:

  1. no tool assembles a data path out of `src/languages` — either as `os.path.join(…, "src", "languages")`
     (in `tools/`, a segment-joined path is always data; a code import is written as a module specifier) or
     as a literal `src/languages/<lang>/<file>.(tsv|jsonc|onnx|pt|txt)`;
  2. **every `data/` directory a tool names actually exists** — which is the half that catches a WRONG
     `data/` path rather than a stale `src/` one, and it earned its place immediately: it failed on
     `tools/README.md`, which my own sweep had just converted to `data/languages/perso-arabic`.

⚠ EIGHT FILES ARE ALLOW-LISTED BECAUSE THEY READ MODULE SOURCE, which is what `src/` is still for —
`gen_parity_goldens.mts` says so itself ("the .ts to identify which directory owns the code, the .tsv
under data/ for the headwords"). Two needed care rather than exclusion: `tools/normalization/review.ts`
carries a comment RECORDING this bug class ("THE MANIFESTS ARE IN `data/`, NOT `src/`, AND THIS PATH WAS
STALE… this arm kept reading `src/languages/<dir>`") — a blind replace inverts its meaning — and
`tools/arabic/eval_ar_runtime.mts` names `src/languages/arabic/diacritizer.ts` split across two lines, so
the `.ts` is not on the line that matches. Both were caught by reading the diff, not by the sweep.

### The convention that produced it

`tools/README.md` still said, under Conventions: *"Read from an external data root or the network, write
into `src/`"* — twenty-six days after `src/` stopped being where data lives. A tool author following the
documented convention would reintroduce this on the next trainer written. Corrected, with a pointer to the
test.

### Verified

    BiLSTM DICT resolves → data/languages/english/g2p-dict.tsv, 117,482 rows
    en_baseline.mts runs; en_hybrid/en_per_compare reach their /tmp training artifact (expected)
    en_g2p_ngram.ts reaches its CMUDICT check (expected)
    46 files, 64 lines. tests 6,007/314, goldens 0 stale, C# 6,687 passed, parity 189 byte-identical
