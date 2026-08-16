export interface ProfileCardData {
  name: string;
  level: number;
  coins: number;
  best: number;
  avatarSrc: string;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the shareable profile card and returns it as a PNG blob. */
export async function renderProfileCard(data: ProfileCardData): Promise<Blob | null> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createRadialGradient(W / 2, 0, 60, W / 2, H, W);
  bg.addColorStop(0, "#4a1780");
  bg.addColorStop(1, "#17062b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // confetti dots
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.globalAlpha = 0.18 + Math.random() * 0.25;
    ctx.fillStyle = ["#ffd76a", "#ff5da2", "#4dd2ff", "#8bff5a"][i % 4] as string;
    ctx.fillRect(x, y, 6, 10);
  }
  ctx.globalAlpha = 1;

  // card frame
  ctx.fillStyle = "rgba(20, 5, 38, 0.82)";
  ctx.strokeStyle = "#ffc84a";
  ctx.lineWidth = 6;
  roundRect(ctx, 48, 48, W - 96, H - 96, 36);
  ctx.fill();
  ctx.stroke();

  // avatar
  const avatar = await loadImage(data.avatarSrc);
  const ax = 110;
  const ay = 130;
  const as = 190;
  ctx.save();
  roundRect(ctx, ax, ay, as, as, 28);
  ctx.clip();
  ctx.fillStyle = "#6b2fd6";
  ctx.fillRect(ax, ay, as, as);
  if (avatar) ctx.drawImage(avatar, ax, ay, as, as);
  ctx.restore();
  ctx.strokeStyle = "#ffc84a";
  ctx.lineWidth = 5;
  roundRect(ctx, ax, ay, as, as, 28);
  ctx.stroke();

  // texts
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffd76a";
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.fillText("TOY BLITZ CARNIVAL", ax, 108);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 68px system-ui, sans-serif";
  ctx.fillText((data.name || "PLAYER ONE").toUpperCase().slice(0, 14), 340, 205);

  ctx.fillStyle = "#cbb8f2";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText("Carnival sharpshooter", 340, 250);

  const stats: [string, string][] = [
    ["LEVEL", String(data.level)],
    ["COINS", data.coins.toLocaleString()],
    ["BEST SCORE", data.best.toLocaleString()],
  ];
  const boxW = 320;
  const gap = 24;
  const startX = (W - (boxW * 3 + gap * 2)) / 2;
  const boxY = 380;
  stats.forEach(([label, value], i) => {
    const x = startX + i * (boxW + gap);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, boxY, boxW, 130, 22);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd76a";
    ctx.font = "bold 54px system-ui, sans-serif";
    ctx.fillText(value, x + boxW / 2, boxY + 74);
    ctx.fillStyle = "#cbb8f2";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText(label, x + boxW / 2, boxY + 110);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Can you beat my score?", W / 2, 560);
  ctx.textAlign = "left";

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}
