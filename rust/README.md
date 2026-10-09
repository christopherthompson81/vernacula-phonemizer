# vernacula-phonemizer (Rust)

A port of the TypeScript engine (`src/`) to Rust, tracked in #1463. It reads the same repo-root `data/`
tree and is checked against the same goldens as `csharp/`. The porting rules are in `PORTING.md`.

```sh
cargo test                                  # unit tests
cargo run --release -p regex-diff           # JsRegex against Node over csharp/regex-corpus.jsonl
```

Status: foundations only (the JS string and regex layers). Nothing phonemizes yet.
