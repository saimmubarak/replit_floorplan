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
  
  // Wall thickness in world units (feet) - walls should be visible
  const wallThickness = 0.5; // 6 inches (0.5 feet) thick walls
  const wallThicknessPx = wallThickness * viewTransform.zoom;
  
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  
  // Draw the wall as a thick line with brick pattern
  // First, draw a solid purple background slightly thicker than the line
  ctx.strokeStyle = '#9333ea';
  ctx.lineWidth = wallThicknessPx + 2;
  
  ctx.beginPath();
  const canvasVertices = shape.vertices.map(v =>
    worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height)
  );
  
  canvasVertices.forEach((v, i) => {
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  });
  
  if (shape.type === 'polygon' || shape.type === 'rectangle') {
    ctx.closePath();
  }
  
  ctx.stroke();
  
  // Now draw brick pattern on top
  // For each segment, draw bricks along it
  for (let i = 0; i < shape.vertices.length - 1; i++) {
    const v1 = worldToCanvas(
      shape.vertices[i],
      viewTransform,
      DEFAULT_EDITING_DPI,
      canvasSize.width,
      canvasSize.height
    );
    const v2 = worldToCanvas(
      shape.vertices[i + 1],
      viewTransform,
      DEFAULT_EDITING_DPI,
      canvasSize.width,
      canvasSize.height
    );
    
    drawBricksAlongSegment(ctx, v1, v2, wallThicknessPx, viewTransform.zoom);
  }
  
  // Close the polygon if needed
  if (shape.type === 'polygon' || shape.type === 'rectangle') {
    const v1 = worldToCanvas(
      shape.vertices[shape.vertices.length - 1],
      viewTransform,
      DEFAULT_EDITING_DPI,
      canvasSize.width,
      canvasSize.height
    );
    const v2 = worldToCanvas(
      shape.vertices[0],
      viewTransform,
      DEFAULT_EDITING_DPI,
      canvasSize.width,
      canvasSize.height
    );
    drawBricksAlongSegment(ctx, v1, v2, wallThicknessPx, viewTransform.zoom);
  }
  
  ctx.restore();
}

function drawBricksAlongSegment(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  thickness: number,
  zoom: number
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return;
  
  const unitX = dx / length;
  const unitY = dy / length;
  const perpX = -unitY;
  const perpY = unitX;
  
  const brickLength = 20 * zoom;
  const brickHeight = thickness * 0.4;
  
  ctx.save();
  
  // Draw mortar lines (lighter purple)
  ctx.strokeStyle = 'rgba(216, 180, 254, 0.8)';
  ctx.lineWidth = 1.5;
  
  // Vertical mortar lines (between bricks)
  for (let dist = brickLength; dist < length; dist += brickLength) {
    const x = start.x + unitX * dist;
    const y = start.y + unitY * dist;
    
    ctx.beginPath();
    ctx.moveTo(x + perpX * thickness / 2, y + perpY * thickness / 2);
    ctx.lineTo(x - perpX * thickness / 2, y - perpY * thickness / 2);
    ctx.stroke();
  }
  
  // Horizontal mortar line (middle of wall)
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  
  ctx.restore();
}
