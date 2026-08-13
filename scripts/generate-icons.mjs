import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

const SIZES = [192, 512];

// Simple icon: dark rounded rect with orange flask
function drawIcon(ctx, size) {
  const s = size / 512;

  // Background
  const r = 96 * s;
  ctx.fillStyle = '#121212';
  roundRect(ctx, 0, 0, size, size, r);
  ctx.fill();

  // Inner border
  ctx.fillStyle = '#1E1E1E';
  roundRect(ctx, 24*s, 24*s, 464*s, 464*s, 80*s);
  ctx.fill();
  ctx.strokeStyle = '#2A2A2A';
  ctx.lineWidth = 4*s;
  roundRect(ctx, 24*s, 24*s, 464*s, 464*s, 80*s);
  ctx.stroke();

  // Flask
  ctx.save();
  ctx.translate(256*s, 220*s);

  // Flask body fill
  ctx.beginPath();
  ctx.moveTo(-55*s, -110*s);
  ctx.lineTo(-55*s, -35*s);
  ctx.lineTo(-110*s, 75*s);
  ctx.quadraticCurveTo(-120*s, 105*s, -90*s, 120*s);
  ctx.lineTo(90*s, 120*s);
  ctx.quadraticCurveTo(120*s, 105*s, 110*s, 75*s);
  ctx.lineTo(55*s, -35*s);
  ctx.lineTo(55*s, -110*s);
  ctx.closePath();
  ctx.fillStyle = 'rgba(249,115,22,0.15)';
  ctx.fill();
  ctx.strokeStyle = '#F97316';
  ctx.lineWidth = 20*s;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Top line
  ctx.beginPath();
  ctx.moveTo(-55*s, -110*s);
  ctx.lineTo(55*s, -110*s);
  ctx.stroke();

  // Bubbles
  ctx.fillStyle = 'rgba(249,115,22,0.5)';
  ctx.beginPath();
  ctx.arc(-15*s, 20*s, 8*s, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(25*s, 45*s, 6*s, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();

  // Text
  ctx.fillStyle = '#F97316';
  ctx.font = `800 ${56*s}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('MB LAB', 256*s, 430*s);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawIcon(ctx, size);
  const buf = canvas.toBuffer('image/png');
  const outPath = join(PUBLIC, `icon-${size}.png`);
  writeFileSync(outPath, buf);
  console.log(`Generated ${outPath} (${buf.length} bytes)`);
}

console.log('Done!');
