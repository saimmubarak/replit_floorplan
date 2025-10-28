import { Point, FloorplanShape, ViewTransform, DEFAULT_EDITING_DPI } from "@shared/schema";
import { worldToCanvas, getBounds } from "./coordinate-math";

// ============================================
// ROOF GEOMETRY DETECTION
// ============================================

interface RoofSection {
  bounds: { min: Point; max: Point };
  center: Point;
  width: number;
  height: number;
}

/**
 * Detect if a shape is rectangular (4 vertices forming a rectangle)
 */
function isRectangular(vertices: Point[]): boolean {
  if (vertices.length !== 4) return false;
  
  // Check if we have 4 right angles
  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const prev = vertices[(i - 1 + 4) % 4];
    const curr = vertices[i];
    const next = vertices[(i + 1) % 4];
    
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    const angle = Math.acos(dot / (mag1 * mag2));
    angles.push(angle);
  }
  
  // All angles should be close to 90 degrees (π/2)
  return angles.every(angle => Math.abs(angle - Math.PI / 2) < 0.1);
}

/**
 * Detect if a polygon is L-shaped (can be decomposed into 2 rectangles)
 */
function isLShaped(vertices: Point[]): boolean {
  // L-shapes typically have 6 vertices
  if (vertices.length !== 6) return false;
  
  // Check if vertices form an L-shape by counting corners
  let rightAngles = 0;
  let reflex = 0;
  
  for (let i = 0; i < vertices.length; i++) {
    const prev = vertices[(i - 1 + vertices.length) % vertices.length];
    const curr = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    
    const cross = v1.x * v2.y - v1.y * v2.x;
    const dot = v1.x * v2.x + v1.y * v2.y;
    const angle = Math.atan2(cross, dot);
    
    const absAngle = Math.abs(angle);
    if (Math.abs(absAngle - Math.PI / 2) < 0.2) {
      rightAngles++;
    } else if (absAngle > Math.PI / 2) {
      reflex++;
    }
  }
  
  // L-shapes have 6 right angles (4 external, 2 internal)
  return rightAngles >= 4 && reflex <= 2;
}

/**
 * Decompose L-shaped polygon into 2 rectangular sections
 */
function decomposeL(vertices: Point[]): RoofSection[] {
  if (vertices.length !== 6) return [];
  
  // Find the bounding box
  const bounds = getBounds(vertices);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  
  // Sort vertices by x and y to find the pattern
  const sortedByX = [...vertices].sort((a, b) => a.x - b.x);
  const sortedByY = [...vertices].sort((a, b) => a.y - b.y);
  
  // Determine if it's a horizontal or vertical L
  const xGroups = groupByCoordinate(sortedByX, 'x');
  const yGroups = groupByCoordinate(sortedByY, 'y');
  
  // Find the notch (where the L shape cuts in)
  // For a proper L-shape, we should have 3 unique X values and 3 unique Y values
  if (xGroups.length === 3 && yGroups.length === 3) {
    const midX = xGroups[1][0].x;
    const midY = yGroups[1][0].y;
    
    // Determine L orientation by checking which quadrant is missing
    const hasTopLeft = vertices.some(v => v.x < midX && v.y < midY);
    const hasTopRight = vertices.some(v => v.x > midX && v.y < midY);
    const hasBottomLeft = vertices.some(v => v.x < midX && v.y > midY);
    const hasBottomRight = vertices.some(v => v.x > midX && v.y > midY);
    
    // Create two rectangular sections based on orientation
    if (!hasTopRight) {
      // L shape: horizontal bar on bottom, vertical bar on left
      return [
        createSection(bounds.min.x, midY, midX, bounds.max.y), // Vertical part
        createSection(bounds.min.x, midY, bounds.max.x, bounds.max.y), // Horizontal part
      ];
    } else if (!hasTopLeft) {
      // Mirror L: horizontal bar on bottom, vertical bar on right
      return [
        createSection(midX, midY, bounds.max.x, bounds.max.y), // Vertical part
        createSection(bounds.min.x, midY, bounds.max.x, bounds.max.y), // Horizontal part
      ];
    } else if (!hasBottomRight) {
      // Inverted L: horizontal bar on top, vertical bar on left
      return [
        createSection(bounds.min.x, bounds.min.y, midX, midY), // Vertical part
        createSection(bounds.min.x, bounds.min.y, bounds.max.x, midY), // Horizontal part
      ];
    } else if (!hasBottomLeft) {
      // Inverted Mirror L: horizontal bar on top, vertical bar on right
      return [
        createSection(midX, bounds.min.y, bounds.max.x, midY), // Vertical part
        createSection(bounds.min.x, bounds.min.y, bounds.max.x, midY), // Horizontal part
      ];
    }
  }
  
  // Fallback: split by longer dimension
  if (width > height) {
    const midX = bounds.min.x + width / 2;
    return [
      createSection(bounds.min.x, bounds.min.y, midX, bounds.max.y),
      createSection(midX, bounds.min.y, bounds.max.x, bounds.max.y),
    ];
  } else {
    const midY = bounds.min.y + height / 2;
    return [
      createSection(bounds.min.x, bounds.min.y, bounds.max.x, midY),
      createSection(bounds.min.x, midY, bounds.max.x, bounds.max.y),
    ];
  }
}

function groupByCoordinate(points: Point[], coord: 'x' | 'y', tolerance = 0.5): Point[][] {
  const groups: Point[][] = [];
  
  for (const point of points) {
    const value = point[coord];
    let foundGroup = false;
    
    for (const group of groups) {
      if (Math.abs(group[0][coord] - value) < tolerance) {
        group.push(point);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      groups.push([point]);
    }
  }
  
  return groups;
}

function createSection(minX: number, minY: number, maxX: number, maxY: number): RoofSection {
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    bounds: {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY },
    },
    center: {
      x: minX + width / 2,
      y: minY + height / 2,
    },
    width,
    height,
  };
}

/**
 * Detect roof sections for any shape
 */
export function detectRoofSections(shape: FloorplanShape): RoofSection[] {
  if (shape.type !== 'rectangle' && shape.type !== 'polygon') {
    return []; // Only render roofs on closed shapes
  }
  
  if (shape.vertices.length < 3) {
    return [];
  }
  
  // Rectangle case
  if (isRectangular(shape.vertices)) {
    const bounds = getBounds(shape.vertices);
    return [createSection(bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y)];
  }
  
  // L-shape case
  if (isLShaped(shape.vertices)) {
    return decomposeL(shape.vertices);
  }
  
  // Fallback for irregular polygons: use bounding box
  const bounds = getBounds(shape.vertices);
  return [createSection(bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y)];
}

// ============================================
// ROOF RENDERING
// ============================================

const ROOF_COLOR_LIGHT = '#b91c1c'; // Red 700
const ROOF_COLOR_DARK = '#7f1d1d';  // Red 900
const ROOF_COLOR_SIDE = '#991b1b';  // Red 800
const ROOF_RIDGE_OFFSET = 0.3; // Proportion of width for ridge offset (creates depth)

/**
 * Draw a slanted roof on a rectangular section using 4 triangular faces
 */
function drawRoofSection(
  ctx: CanvasRenderingContext2D,
  section: RoofSection,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  const { bounds, center, width, height } = section;
  
  // Calculate ridge line (center line running along the longer dimension)
  const isWider = width > height;
  const ridgeOffset = (isWider ? height : width) * ROOF_RIDGE_OFFSET;
  
  // Convert to canvas coordinates
  const topLeft = worldToCanvas(bounds.min, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const topRight = worldToCanvas({ x: bounds.max.x, y: bounds.min.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const bottomLeft = worldToCanvas({ x: bounds.min.x, y: bounds.max.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const bottomRight = worldToCanvas(bounds.max, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  
  let ridge1: Point, ridge2: Point;
  
  if (isWider) {
    // Ridge runs horizontally (left to right)
    const ridgeYWorld = center.y - ridgeOffset;
    ridge1 = worldToCanvas({ x: bounds.min.x, y: ridgeYWorld }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    ridge2 = worldToCanvas({ x: bounds.max.x, y: ridgeYWorld }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    
    // Draw 4 triangular faces
    // Top face (front, lighter)
    ctx.fillStyle = ROOF_COLOR_LIGHT;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.lineTo(ridge1.x, ridge1.y);
    ctx.closePath();
    ctx.fill();
    
    // Bottom face (back, darker)
    ctx.fillStyle = ROOF_COLOR_DARK;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();
    
    // Ridge line (highlight)
    ctx.strokeStyle = ROOF_COLOR_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.stroke();
  } else {
    // Ridge runs vertically (top to bottom)
    const ridgeXWorld = center.x - ridgeOffset;
    ridge1 = worldToCanvas({ x: ridgeXWorld, y: bounds.min.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    ridge2 = worldToCanvas({ x: ridgeXWorld, y: bounds.max.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    
    // Draw 4 triangular faces
    // Left face (front, lighter)
    ctx.fillStyle = ROOF_COLOR_LIGHT;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();
    
    // Right face (side, medium)
    ctx.fillStyle = ROOF_COLOR_DARK;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.closePath();
    ctx.fill();
    
    // Ridge line (highlight)
    ctx.strokeStyle = ROOF_COLOR_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.stroke();
  }
}

/**
 * Draw roof skin for a house shape
 * Automatically detects geometry and renders appropriate roof sections
 */
export function drawRoof(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number },
  opacity: number = 0.85
) {
  // Only draw roofs on house layer shapes
  if (shape.layer !== 'house') {
    return;
  }
  
  const sections = detectRoofSections(shape);
  if (sections.length === 0) {
    return;
  }
  
  // Save context state
  ctx.save();
  ctx.globalAlpha = opacity;
  
  // Draw each roof section
  for (const section of sections) {
    drawRoofSection(ctx, section, viewTransform, canvasSize);
  }
  
  // Restore context state
  ctx.restore();
}
