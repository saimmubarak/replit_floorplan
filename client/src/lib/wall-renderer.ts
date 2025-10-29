import { type FloorplanShape, type Point, type ViewTransform, DEFAULT_EDITING_DPI } from "@shared/schema";

function worldToCanvas(
  point: Point,
  viewTransform: ViewTransform,
  dpi: number,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const { panX, panY, zoom } = viewTransform;
  
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  const scaledX = point.x * zoom;
  const scaledY = point.y * zoom;
  
  return {
    x: scaledX + centerX + panX,
    y: scaledY + centerY + panY,
  };
}

export function drawWallSkin(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  if (shape.layer !== 'wall' || shape.vertices.length < 2) return;
  
  // Convert vertices to canvas coordinates
  const canvasVertices = shape.vertices.map(v =>
    worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height)
  );
  
  ctx.save();
  
  // Create a clipping region to draw brick pattern only inside the shape
  ctx.beginPath();
  canvasVertices.forEach((v, i) => {
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  });
  
  // Close the path for polygon shapes
  if (shape.type === 'polygon' || shape.type === 'rectangle') {
    ctx.closePath();
  }
  
  // Fill with semi-transparent purple for wall background
  ctx.fillStyle = 'rgba(147, 51, 234, 0.15)';
  ctx.fill();
  
  // Clip to this region for brick pattern
  ctx.clip();
  
  // Draw brick pattern
  const brickWidth = 20 * viewTransform.zoom;
  const brickHeight = 10 * viewTransform.zoom;
  const mortarWidth = 2;
  
  // Calculate bounds of the shape
  const xs = canvasVertices.map(v => v.x);
  const ys = canvasVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  // Draw brick pattern within bounds
  ctx.strokeStyle = 'rgba(147, 51, 234, 0.4)';
  ctx.lineWidth = mortarWidth;
  
  // Draw horizontal mortar lines
  for (let y = minY; y < maxY; y += brickHeight) {
    ctx.beginPath();
    ctx.moveTo(minX, y);
    ctx.lineTo(maxX, y);
    ctx.stroke();
  }
  
  // Draw vertical mortar lines (staggered for brick pattern)
  let rowIndex = 0;
  for (let y = minY; y < maxY; y += brickHeight) {
    const offset = rowIndex % 2 === 0 ? 0 : brickWidth / 2;
    for (let x = minX + offset; x < maxX; x += brickWidth) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + brickHeight);
      ctx.stroke();
    }
    rowIndex++;
  }
  
  ctx.restore();
}
