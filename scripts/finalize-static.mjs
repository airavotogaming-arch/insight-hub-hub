// Turns the SPA shell from `STATIC=1 vite build` into a portal-ready
// dist/client folder: index.html at the root, relative asset paths.
import { readFileSync, writeFileSync, renameSync, rmSync, existsSync } from "node:fs";

const dir = "dist/client";
if (existsSync(`${dir}/_headers`)) rmSync(`${dir}/_headers`);
renameSync(`${dir}/_shell.html`, `${dir}/index.html`);
const html = readFileSync(`${dir}/index.html`, "utf8")
  // TanStack injects "/./assets/..." into the manifest/script tags
  .replace(/"\/\.\//g, '"./')
  .replace(/"\/(assets|toys|favicon)/g, '"./$1');
writeFileSync(`${dir}/index.html`, html);

// CSS lives in ./assets/, so root-absolute public URLs inside it must become "../"
import { readdirSync } from "node:fs";
for (const f of readdirSync(`${dir}/assets`).filter((n) => n.endsWith(".css"))) {
  const p = `${dir}/assets/${f}`;
  const css = readFileSync(p, "utf8").replace(/url\((["']?)\/(cursor-|toys\/|favicon)/g, "url($1../$2");
  writeFileSync(p, css);
}
console.log("static build ready:", `${dir}/index.html`);
