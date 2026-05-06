// One-shot generator for the e2e test fixture PDF.
// Produces a ~250-byte valid PDF that PDF.js can render. Commit the output;
// re-run only if the fixture goes missing.
//
// Usage: node scripts/gen-fixture-pdf.js
const fs = require('fs');
const path = require('path');

const objects = [
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((obj, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
});
const xrefOffset = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += o.toString().padStart(10, '0') + ' 00000 n \n';
pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

const out = path.join(__dirname, '..', 'tests', 'fixtures', 'sample.pdf');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(pdf, 'latin1'));
console.log(`Wrote ${out} (${Buffer.byteLength(pdf, 'latin1')} bytes)`);
