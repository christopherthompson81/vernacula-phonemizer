import { phonemize } from "../src/index.ts";
for (const w of ["finite","senile","canine","feline","archive","textile","percentile","enzyme","oxide","quinine","unite","exploit","rabbis","meantime","meanwhile","sometime","online","website","midnight","deadline","pipeline"])
  console.log(w.padEnd(12), phonemize(w,"en"));
