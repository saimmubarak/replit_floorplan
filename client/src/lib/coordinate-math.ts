import { 
  MM_TO_INCHES, 
  A2_SHEET_HEIGHT_MM, 
  A2_WIDTH_FT,
  A2_HEIGHT_FT,
  type Point, 
  type ViewTransform 
} from "@shared/schema";

// ============================================
// COORDINATE CONVERSION FUNCTIONS
// ============================================

export function pixelsPerFoot(dpi: number): number {
  // Calculate pixels per foot based on the A2 sheet scale
  // Scale: 191.5ft = 420mm on paper
  const paperHeightInches = A2_SHEET_HEIGHT_MM * MM_TO_INCHES;
  const paperHeightPixels = paperHeightInches * dpi;
  return paperHeightPixels / A2_HEIGHT_FT;
}

export function mmToPixels(mm: number, dpi: number): number {
  return (mm * MM_TO_INCHES) * dpi;
}

export function worldToCanvas(
  point: Point,
  viewTransform: ViewTransform,
  editingDPI: number,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const ppf = pixelsPerFoot(editingDPI);
  
  // Calculate the center of the canvas
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  
  // Offset world coordinates so the A2 sheet center (not origin) maps to canvas center
  const offsetX = point.x - (A2_WIDTH_FT / 2);
  const offsetY = point.y - (A2_HEIGHT_FT / 2);
  
  // Transform world coordinates relative to canvas center
  // This ensures the A2 sheet stays centered on the canvas during zoom/pan
  return {
    x: canvasCenterX + (offsetX * ppf * viewTransform.zoom) + viewTransform.panX,
    y: canvasCenterY + (offsetY * ppf * viewTransform.zoom) + viewTransform.panY,
  };
}

export function canvasToWorld(
  point: Point,
  viewTransform: ViewTransform,
  editingDPI: number,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const ppf = pixelsPerFoot(editingDPI);
  
  // Calculate the center of the canvas
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  
  // Convert canvas coordinates back to world coordinates
  const worldX = (point.x - canvasCenterX - viewTransform.panX) / (ppf * viewTransform.zoom);
  const worldY = (point.y - canvasCenterY - viewTransform.panY) / (ppf * viewTransform.zoom);
  
  // Add back the sheet center offset
  return {
    x: worldX + (A2_WIDTH_FT / 2),
    y: worldY + (A2_HEIGHT_FT / 2),
  };
}

export function worldToExport(
  point: Point,
  dpi: number,
  exportOrigin: Point = { x: 0, y: 0 }
): Point {
  const ppf = pixelsPerFoot(dpi);
  return {
    x: (point.x - exportOrigin.x) * ppf,
    y: (point.y - exportOrigin.y) * ppf,
  };
}

export function exportToWorld(
  point: Point,
  dpi: number,
  exportOrigin: Point = { x: 0, y: 0 }
): Point {
  const ppf = pixelsPerFoot(dpi);
  return {
    x: (point.x / ppf) + exportOrigin.x,
    y: (point.y / ppf) + exportOrigin.y,
  };
}

// ============================================
// GEOMETRY HELPERS
// ============================================

export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function polygonArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

export function getBounds(vertices: Point[]): { min: Point; max: Point } {
  if (vertices.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }
  
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

export function getCenter(vertices: Point[]): Point {
  const bounds = getBounds(vertices);
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
  };
}

// ============================================
// SNAPPING HELPERS
// ============================================

export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function findSnapTarget(
  point: Point,
  allVertices: Point[],
  threshold: number
): Point | null {
  for (const vertex of allVertices) {
    if (distance(point, vertex) <= threshold) {
      return vertex;
    }
  }
  return null;
}

// ============================================
// POLYLINE SIMPLIFICATION (Ramer-Douglas-Peucker)
// ============================================

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return distance(point, lineStart);
  }
  
  const num = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  const den = Math.sqrt(dx * dx + dy * dy);
  
  return num / den;
}

export function simplifyPolyline(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  
  let maxDistance = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }
  
  if (maxDistance > epsilon) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPolyline(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  
  return [points[0], points[points.length - 1]];
}
