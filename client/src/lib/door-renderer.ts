import { type Door, type FloorplanShape, type Point, DEFAULT_EDITING_DPI } from "@shared/schema";
import { type ViewTransform } from "@shared/schema";

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

export function findWallSegmentAtPoint(
  shapes: FloorplanShape[],
  point: Point,
  threshold: number = 1.0
): { shape: FloorplanShape; segmentIndex: number; closestPoint: Point; rotation: number } | null {
  let closestResult: { shape: FloorplanShape; segmentIndex: number; closestPoint: Point; distance: number; rotation: number } | null = null;
  
  for (const shape of shapes) {
    // Allow doors to be placed on both house walls and standalone wall shapes
    if (shape.layer !== 'house' && shape.layer !== 'wall') continue;
    
    for (let i = 0; i < shape.vertices.length; i++) {
      const j = (i + 1) % shape.vertices.length;
      if (shape.type === 'line' && i > 0) break;
      if (shape.type === 'freehand' && i >= shape.vertices.length - 1) break;
      
      const v1 = shape.vertices[i];
      const v2 = shape.vertices[j];
      
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) continue;
      
      const t = Math.max(0, Math.min(1, 
        ((point.x - v1.x) * dx + (point.y - v1.y) * dy) / (length * length)
      ));
      
      const closestX = v1.x + t * dx;
      const closestY = v1.y + t * dy;
      
      const dist = Math.sqrt(
        Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2)
      );
      
      if (dist < threshold && (!closestResult || dist < closestResult.distance)) {
        const rotation = Math.atan2(dy, dx) * (180 / Math.PI);
        closestResult = {
          shape,
          segmentIndex: i,
          closestPoint: { x: closestX, y: closestY },
          distance: dist,
          rotation,
        };
      }
    }
  }
  
  if (closestResult) {
    return {
      shape: closestResult.shape,
      segmentIndex: closestResult.segmentIndex,
      closestPoint: closestResult.closestPoint,
      rotation: closestResult.rotation,
    };
  }
  
  return null;
}

export function drawDoorSkin(
  ctx: CanvasRenderingContext2D,
  door: Door,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  const pos = worldToCanvas(door.position, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const widthPx = door.width * viewTransform.zoom;
  
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate((door.rotation * Math.PI) / 180);
  
  // Draw quarter circle(s) representing outward-opening door(s)
  const brownColor = 'rgba(139, 69, 19, 0.4)';
  const brownStroke = 'rgba(101, 67, 33, 0.8)';
  
  if (door.type === 'single') {
    // Single door: one quarter circle on the left side
    const radius = widthPx;
    
    ctx.fillStyle = brownColor;
    ctx.strokeStyle = brownStroke;
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    // Quarter circle from left handle, opening outward (downward in local coords)
    ctx.arc(-widthPx / 2, 0, radius, 0, Math.PI / 2);
    ctx.lineTo(-widthPx / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw door line at the hinge
    ctx.strokeStyle = brownStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-widthPx / 2, -3);
    ctx.lineTo(-widthPx / 2, 3);
    ctx.stroke();
  } else {
    // Double door: two quarter circles, one from each side
    const radius = widthPx / 2;
    
    ctx.fillStyle = brownColor;
    ctx.strokeStyle = brownStroke;
    ctx.lineWidth = 1.5;
    
    // Left door quarter circle
    ctx.beginPath();
    ctx.arc(-widthPx / 2, 0, radius, 0, Math.PI / 2);
    ctx.lineTo(-widthPx / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Right door quarter circle
    ctx.beginPath();
    ctx.arc(widthPx / 2, 0, radius, Math.PI / 2, Math.PI);
    ctx.lineTo(widthPx / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw door lines at hinges
    ctx.strokeStyle = brownStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-widthPx / 2, -3);
    ctx.lineTo(-widthPx / 2, 3);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(widthPx / 2, -3);
    ctx.lineTo(widthPx / 2, 3);
    ctx.stroke();
  }
  
  ctx.restore();
}

export function drawDoorLine(
  ctx: CanvasRenderingContext2D,
  door: Door,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  const v1 = shape.vertices[door.wallSegmentIndex];
  const v2 = shape.vertices[(door.wallSegmentIndex + 1) % shape.vertices.length];
  
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return;
  
  const unitX = dx / length;
  const unitY = dy / length;
  
  const halfWidth = door.width / 2;
  const start: Point = {
    x: door.position.x - unitX * halfWidth,
    y: door.position.y - unitY * halfWidth,
  };
  const end: Point = {
    x: door.position.x + unitX * halfWidth,
    y: door.position.y + unitY * halfWidth,
  };
  
  const startCanvas = worldToCanvas(start, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const endCanvas = worldToCanvas(end, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(startCanvas.x, startCanvas.y);
  ctx.lineTo(endCanvas.x, endCanvas.y);
  ctx.stroke();
  ctx.restore();
}

export function drawDoorHandles(
  ctx: CanvasRenderingContext2D,
  door: Door,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  const pos = worldToCanvas(door.position, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const widthPx = door.width * viewTransform.zoom;
  
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate((door.rotation * Math.PI) / 180);
  
  const handleSize = 8;
  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  
  ctx.fillStyle = `hsl(${primaryColor})`;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  
  [-widthPx / 2, widthPx / 2].forEach((x) => {
    ctx.fillRect(x - handleSize / 2, -handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(x - handleSize / 2, -handleSize / 2, handleSize, handleSize);
  });
  
  ctx.restore();
}

export function findDoorAtPoint(
  doors: Door[],
  point: Point,
  threshold: number = 1.0
): Door | null {
  for (const door of doors) {
    const dist = Math.sqrt(
      Math.pow(point.x - door.position.x, 2) + Math.pow(point.y - door.position.y, 2)
    );
    if (dist < threshold + door.width / 2) {
      return door;
    }
  }
  return null;
}

export function findDoorHandle(
  door: Door,
  point: Point,
  viewTransform: ViewTransform,
  threshold: number = 0.5
): 'start' | 'end' | null {
  const angle = (door.rotation * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  
  const halfWidth = door.width / 2;
  const startPos = {
    x: door.position.x - dx * halfWidth,
    y: door.position.y - dy * halfWidth,
  };
  const endPos = {
    x: door.position.x + dx * halfWidth,
    y: door.position.y + dy * halfWidth,
  };
  
  const startDist = Math.sqrt(
    Math.pow(point.x - startPos.x, 2) + Math.pow(point.y - startPos.y, 2)
  );
  const endDist = Math.sqrt(
    Math.pow(point.x - endPos.x, 2) + Math.pow(point.y - endPos.y, 2)
  );
  
  if (startDist < threshold) return 'start';
  if (endDist < threshold) return 'end';
  return null;
}
