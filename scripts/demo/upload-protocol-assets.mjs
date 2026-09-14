// Uploads the shared photos and signatures that generated demo protocols point at.
//
// demo.load() (supabase/migrations/20260914120000_demo_dataset.sql) writes protocol
// rows whose photo and signature paths live under `issue/demo/` in the private
// `protocols` bucket. This script puts real objects at those paths:
//
//   issue/demo/vehicles/<vehicle id>/{front,rear,left,right}.jpg
//       the vehicle's own catalog photos (Wikimedia Commons), cycled over four slots
//   issue/demo/generic/{interior,dashboard}-{1,2,3}.jpg
//       shared cab / cargo-area and dashboard shots (scripts/demo/protocol-assets.json)
//   issue/demo/signatures/sig-01.png … sig-12.png
//       illegible handwritten scribbles, drawn with the signature pad's own stroke style
//
// Usage (service-role key, because the bucket is private and staff-only):
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
//     node scripts/demo/upload-protocol-assets.mjs
//
// Safe to re-run: every upload uses upsert.

// core
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "protocols";
const EXTERIOR_SLOTS = ["front", "rear", "left", "right"];
const SIGNATURE_COUNT = 12;
const GENERIC_COUNT = 3;
// Wikimedia asks automated clients to identify themselves.
const USER_AGENT = "FleetRentDemoData/1.0 (portfolio demo; https://fleetrent.marcin-kulbicki.workers.dev)";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const assets = JSON.parse(await readFile(new URL("./protocol-assets.json", import.meta.url), "utf8"));

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Wikimedia answers a burst of requests with 429, so space downloads out and
// back off before giving up.
async function download(source) {
  for (let attempt = 1; ; attempt++) {
    await pause(1500);
    const response = await fetch(source, { headers: { "User-Agent": USER_AGENT } });
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.startsWith("image/jpeg")) {
      return Buffer.from(await response.arrayBuffer());
    }
    if (response.status !== 429 || attempt === 6) {
      throw new Error(`${source} -> ${response.status} ${type}`);
    }
    await pause(5000 * attempt);
  }
}

async function upload(path, body, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`${path}: ${error.message}`);
  console.log(`uploaded ${path}`);
}

// Downloads are cached per URL: one vehicle with two photos reuses them over four slots.
const cache = new Map();
async function downloadOnce(source) {
  if (!cache.has(source)) cache.set(source, await download(source));
  return cache.get(source);
}

// 1. Vehicle exterior shots — every vehicle whose catalog photos come from Wikimedia.
const { data: vehicles, error } = await supabase.from("vehicles").select("id, name, photos");
if (error) throw new Error(`reading vehicles: ${error.message}`);

const demoVehicles = vehicles.filter((v) => v.photos.some((p) => p.includes("upload.wikimedia.org")));
if (demoVehicles.length === 0) {
  console.error("No vehicles with Wikimedia photos found. Run select demo.load(); first.");
  process.exit(1);
}

for (const vehicle of demoVehicles) {
  const photos = vehicle.photos.filter((p) => p.includes("upload.wikimedia.org"));
  for (const [index, slot] of EXTERIOR_SLOTS.entries()) {
    const body = await downloadOnce(photos[index % photos.length]);
    await upload(`issue/demo/vehicles/${vehicle.id}/${slot}.jpg`, body, "image/jpeg");
  }
}

// 2. Generic interior and dashboard shots.
for (const kind of ["interior", "dashboard"]) {
  const sources = assets[kind];
  for (let n = 1; n <= GENERIC_COUNT; n++) {
    const body = await downloadOnce(sources[(n - 1) % sources.length].url);
    await upload(`issue/demo/generic/${kind}-${n}.jpg`, body, "image/jpeg");
  }
}

// 3. Signatures, drawn on a canvas in headless Chromium.
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (let n = 1; n <= SIGNATURE_COUNT; n++) {
    const dataUrl = await page.evaluate(drawSignature, n);
    const body = Buffer.from(dataUrl.split(",")[1], "base64");
    await upload(`issue/demo/signatures/sig-${String(n).padStart(2, "0")}.png`, body, "image/png");
  }
} finally {
  await browser.close();
}

console.log(`done: ${demoVehicles.length} vehicles, ${GENERIC_COUNT * 2} generic shots, ${SIGNATURE_COUNT} signatures`);

// Runs in the browser. A cursive-looking, unreadable scribble: a tall opening
// stroke, one or two "words" of small loops along a baseline, and an underline
// flourish, joined with a Catmull-Rom spline. Same ink as SignaturePad.tsx.
function drawSignature(seed) {
  let state = seed * 9301 + 49297;
  const rand = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };

  const width = 900;
  const height = 300;
  const baseline = 190 + rand() * 20;
  const points = [];
  let x = 60 + rand() * 40;

  // opening capital
  points.push([x, baseline + 10], [x + 25, baseline - 120 - rand() * 40], [x + 5, baseline - 60], [x + 45, baseline]);
  x += 60;

  const words = 1 + Math.floor(rand() * 2);
  for (let w = 0; w < words; w++) {
    const letters = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < letters; i++) {
      const tall = rand() < 0.2;
      const low = !tall && rand() < 0.12;
      points.push([x + 8, baseline - (tall ? 80 + rand() * 30 : 25 + rand() * 25)]);
      if (rand() < 0.35) points.push([x - 4, baseline - 15 - rand() * 10]);
      points.push([x + 18 + rand() * 10, low ? baseline + 45 : baseline - rand() * 8]);
      x += 24 + rand() * 16;
    }
    x += 45 + rand() * 30;
  }

  // underline flourish, sweeping back under the name
  points.push(
    [x + 20, baseline + 15],
    [x - 80 - rand() * 120, baseline + 38 + rand() * 12],
    [80 + rand() * 60, baseline + 30],
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 3.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const scale = Math.min(1, (width - 60) / Math.max(...points.map((p) => p[0])));
  const pts = points.map(([px, py]) => [px * scale, py]);

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
  ctx.stroke();
  return canvas.toDataURL("image/png");
}
