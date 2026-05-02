export function downloadTextCardAsPng({
  title,
  subtitle,
  lines,
  filename,
}: {
  title: string;
  subtitle?: string;
  lines: string[];
  filename: string;
}) {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#17385e");
  gradient.addColorStop(0.55, "#0f233d");
  gradient.addColorStop(1, "#081627");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(245,166,35,0.92)";
  roundRect(ctx, 80, 78, 190, 10, 5);
  ctx.fill();

  ctx.fillStyle = "#F5A623";
  ctx.font = "700 34px Arial";
  ctx.fillText("VENTU SULI", 80, 110);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 72px Arial";
  let y = wrapText(ctx, title, 80, 260, 920, 84) + 58;

  if (subtitle) {
    ctx.fillStyle = "#b9d6f6";
    ctx.font = "400 34px Arial";
    y = wrapText(ctx, subtitle, 80, y, 920, 46) + 90;
  } else {
    y += 52;
  }

  for (const line of lines.slice(0, 7)) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 80, y - 48, 920, 92, 22);
    ctx.fill();
    ctx.fillStyle = "#eaf4ff";
    ctx.font = "700 34px Arial";
    wrapText(ctx, line, 110, y + 8, 860, 38);
    y += 116;
  }

  ctx.fillStyle = "#8eb0dc";
  ctx.font = "400 28px Arial";
  ctx.fillText("feito para correr melhor, junto.", 80, 1260);

  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
