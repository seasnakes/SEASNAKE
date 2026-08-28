import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const docsRoot = path.join(repositoryRoot, "docs");

const requiredFiles = [
  "docs/index.html",
  "docs/seasnake-logo-preview.html",
  "docs/seasnake-ouroboros-concepts.html",
  "docs/logo-export-studio.html",
  "docs/assets/logo-export-studio.css",
  "docs/assets/logo-export-studio.js",
  "docs/assets/logo-motion-export.js",
  "docs/assets/logo-system/svg/seasnake-logo-snake.svg",
  "docs/assets/logo-system/svg/seasnake-logo-triangle.svg",
  "docs/assets/logo-system/svg/seasnake-logo-wordmark-horizontal.svg",
  "docs/assets/logo-system/svg/seasnake-logo-snake-two-row.svg",
];

const failures = [];

for (const relativeFile of requiredFiles) {
  try {
    await access(path.join(repositoryRoot, relativeFile));
  } catch {
    failures.push(`missing required file: ${relativeFile}`);
  }
}

const htmlFiles = [
  "index.html",
  "seasnake-logo-preview.html",
  "seasnake-ouroboros-concepts.html",
  "logo-export-studio.html",
];

for (const relativeFile of htmlFiles) {
  const absoluteFile = path.join(docsRoot, relativeFile);
  const html = await readFile(absoluteFile, "utf8");
  const referencePattern = /\b(?:href|src)="([^"]+)"/g;
  for (const match of html.matchAll(referencePattern)) {
    const reference = match[1];
    if (/^(?:https?:|data:|mailto:|tel:|#)/i.test(reference)) continue;
    const target = reference.split(/[?#]/, 1)[0];
    if (!target) continue;
    try {
      await access(path.resolve(path.dirname(absoluteFile), target));
    } catch {
      failures.push(`${relativeFile} references missing file: ${reference}`);
    }
  }
}

const exportPage = await readFile(path.join(docsRoot, "logo-export-studio.html"), "utf8");
const requiredControlIds = [
  "logo-picker",
  "palette-list",
  "preview-grid",
  "export-active",
  "export-all",
  "export-overlay",
];
for (const id of requiredControlIds) {
  if (!exportPage.includes(`id="${id}"`)) failures.push(`export page is missing control #${id}`);
}
if (/\b(?:src|href)="https?:/i.test(exportPage)) {
  failures.push("export page must not depend on third-party runtime assets");
}

const masterSvgFiles = requiredFiles.filter((file) => file.includes("/logo-system/svg/") && file.endsWith(".svg"));
for (const relativeFile of masterSvgFiles) {
  const svg = await readFile(path.join(repositoryRoot, relativeFile), "utf8");
  if (!/^<svg\b/.test(svg.trim())) failures.push(`${relativeFile} is not an SVG document`);
  if (!svg.includes("currentColor")) failures.push(`${relativeFile} no longer exposes currentColor for recoloring`);
}

if (failures.length) {
  console.error("Static site validation failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Static site validation passed: ${requiredFiles.length} required files and ${htmlFiles.length} pages checked.`);
