import { Point, FloorplanShape, ViewTransform, DEFAULT_EDITING_DPI } from "@shared/schema";
import { worldToCanvas, getBounds } from "./coordinate-math";

interface RoofSection {
  bounds: { min: Point; max: Point };
  center: Point;
  width: number;
  height: number;
}

interface Rectangle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function isRectilinear(vertices: Point[]): boolean {
  if (vertices.length < 4) return false;
  
  for (let i = 0; i < vertices.length; i++) {
    const prev = vertices[(i - 1 + vertices.length) % vertices.length];
    const curr = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    
    const isHorizontal1 = Math.abs(v1.y) < 0.01;
    const isVertical1 = Math.abs(v1.x) < 0.01;
    const isHorizontal2 = Math.abs(v2.y) < 0.01;
    const isVertical2 = Math.abs(v2.x) < 0.01;
    
    if (!((isHorizontal1 || isVertical1) && (isHorizontal2 || isVertical2))) {
      return false;
    }
  }
  
  return true;
}

function decomposeRectilinearPolygon(vertices: Point[]): Rectangle[] {
  if (vertices.length < 4) return [];
  
  if (!isRectilinear(vertices)) {
    const bounds = getBounds(vertices);
    return [{
      minX: bounds.min.x,
      minY: bounds.min.y,
      maxX: bounds.max.x,
      maxY: bounds.max.y,
    }];
  }
  
  const rectangles: Rectangle[] = [];
  const bounds = getBounds(vertices);
  
  const xCoords = Array.from(new Set(vertices.map(v => v.x))).sort((a, b) => a - b);
  const yCoords = Array.from(new Set(vertices.map(v => v.y))).sort((a, b) => a - b);
  
  if (xCoords.length < 2 || yCoords.length < 2) {
    return [{
      minX: bounds.min.x,
      minY: bounds.min.y,
      maxX: bounds.max.x,
      maxY: bounds.max.y,
    }];
  }
  
  for (let i = 0; i < xCoords.length - 1; i++) {
    for (let j = 0; j < yCoords.length - 1; j++) {
      const rect: Rectangle = {
        minX: xCoords[i],
        minY: yCoords[j],
        maxX: xCoords[i + 1],
        maxY: yCoords[j + 1],
      };
      
      const rectCenter = {
        x: (rect.minX + rect.maxX) / 2,
        y: (rect.minY + rect.maxY) / 2,
      };
      
      if (isPointInPolygon(rectCenter, vertices)) {
        rectangles.push(rect);
      }
    }
  }
  
  return mergeAdjacentRectangles(rectangles);
}

function isPointInPolygon(point: Point, vertices: Point[]): boolean {
  let inside = false;
  
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

function mergeAdjacentRectangles(rects: Rectangle[]): Rectangle[] {
  if (rects.length <= 1) return rects;
  
  const merged: Rectangle[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < rects.length; i++) {
    if (used.has(i)) continue;
    
    let current = { ...rects[i] };
    let didMerge = true;
    
    while (didMerge) {
      didMerge = false;
      
      for (let j = 0; j < rects.length; j++) {
        if (i === j || used.has(j)) continue;
        
        const other = rects[j];
        
        if (Math.abs(current.minY - other.minY) < 0.01 && 
            Math.abs(current.maxY - other.maxY) < 0.01) {
          if (Math.abs(current.maxX - other.minX) < 0.01) {
            current.maxX = other.maxX;
            used.add(j);
            didMerge = true;
          } else if (Math.abs(current.minX - other.maxX) < 0.01) {
            current.minX = other.minX;
            used.add(j);
            didMerge = true;
          }
        }
        
        if (Math.abs(current.minX - other.minX) < 0.01 && 
            Math.abs(current.maxX - other.maxX) < 0.01) {
          if (Math.abs(current.maxY - other.minY) < 0.01) {
            current.maxY = other.maxY;
            used.add(j);
            didMerge = true;
          } else if (Math.abs(current.minY - other.maxY) < 0.01) {
            current.minY = other.minY;
            used.add(j);
            didMerge = true;
          }
        }
      }
    }
    
    merged.push(current);
    used.add(i);
  }
  
  return merged;
}

function createSection(rect: Rectangle): RoofSection {
  const width = rect.maxX - rect.minX;
  const height = rect.maxY - rect.minY;
  return {
    bounds: {
      min: { x: rect.minX, y: rect.minY },
      max: { x: rect.maxX, y: rect.maxY },
    },
    center: {
      x: rect.minX + width / 2,
      y: rect.minY + height / 2,
    },
    width,
    height,
  };
}

export function detectRoofSections(shape: FloorplanShape): RoofSection[] {
  if (shape.type !== 'rectangle' && shape.type !== 'polygon') {
    return [];
  }
  
  if (shape.vertices.length < 3) {
    return [];
  }
  
  const rectangles = decomposeRectilinearPolygon(shape.vertices);
  return rectangles.map(rect => createSection(rect));
}

const ROOF_TILE_BASE = '#c2410c';
const ROOF_TILE_LIGHT = '#ea580c';
const ROOF_TILE_DARK = '#9a3412';
const ROOF_SHADOW = '#7c2d12';
const ROOF_RIDGE = '#451a03';
const ROOF_RIDGE_OFFSET = 0.35;

function drawRoofSection(
  ctx: CanvasRenderingContext2D,
  section: RoofSection,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  const { bounds, center, width, height } = section;
  
  const isWider = width > height;
  const ridgeOffset = (isWider ? height : width) * ROOF_RIDGE_OFFSET;
  
  const topLeft = worldToCanvas(bounds.min, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const topRight = worldToCanvas({ x: bounds.max.x, y: bounds.min.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const bottomLeft = worldToCanvas({ x: bounds.min.x, y: bounds.max.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  const bottomRight = worldToCanvas(bounds.max, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  
  let ridge1: Point, ridge2: Point;
  
  if (isWider) {
    const ridgeYWorld = center.y - ridgeOffset;
    ridge1 = worldToCanvas({ x: bounds.min.x, y: ridgeYWorld }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    ridge2 = worldToCanvas({ x: bounds.max.x, y: ridgeYWorld }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    
    ctx.fillStyle = ROOF_TILE_LIGHT;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.lineTo(ridge1.x, ridge1.y);
    ctx.closePath();
    ctx.fill();
    
    drawRoofTiles(ctx, topLeft, topRight, ridge2, ridge1, true);
    
    ctx.fillStyle = ROOF_TILE_DARK;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();
    
    drawRoofTiles(ctx, ridge1, ridge2, bottomRight, bottomLeft, false);
    
    ctx.strokeStyle = ROOF_RIDGE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.stroke();
    
    const gradient = ctx.createLinearGradient(ridge1.x, ridge1.y, bottomLeft.x, bottomLeft.y);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();
  } else {
    const ridgeXWorld = center.x - ridgeOffset;
    ridge1 = worldToCanvas({ x: ridgeXWorld, y: bounds.min.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    ridge2 = worldToCanvas({ x: ridgeXWorld, y: bounds.max.y }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    
    ctx.fillStyle = ROOF_TILE_LIGHT;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();
    
    drawRoofTiles(ctx, topLeft, ridge1, ridge2, bottomLeft, true);
    
    ctx.fillStyle = ROOF_TILE_DARK;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.closePath();
    ctx.fill();
    
    drawRoofTiles(ctx, ridge1, topRight, bottomRight, ridge2, false);
    
    ctx.strokeStyle = ROOF_RIDGE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.stroke();
    
    const gradient = ctx.createLinearGradient(ridge1.x, ridge1.y, topRight.x, topRight.y);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(ridge1.x, ridge1.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(ridge2.x, ridge2.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRoofTiles(
  ctx: CanvasRenderingContext2D,
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
  isLight: boolean
) {
  const tileSpacing = 8;
  const tileColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.12)';
  
  ctx.strokeStyle = tileColor;
  ctx.lineWidth = 1;
  
  const width = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  const height = Math.sqrt(Math.pow(p4.x - p1.x, 2) + Math.pow(p4.y - p1.y, 2));
  
  const numLines = Math.floor(height / tileSpacing);
  
  for (let i = 1; i < numLines; i++) {
    const t = i / numLines;
    const startX = p1.x + (p4.x - p1.x) * t;
    const startY = p1.y + (p4.y - p1.y) * t;
    const endX = p2.x + (p3.x - p2.x) * t;
    const endY = p2.y + (p3.y - p2.y) * t;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

export function drawRoof(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number },
  opacity: number = 0.9
) {
  if (shape.layer !== 'house') {
    return;
  }
  
  const sections = detectRoofSections(shape);
  if (sections.length === 0) {
    return;
  }
  
  ctx.save();
  ctx.globalAlpha = opacity;
  
  for (const section of sections) {
    drawRoofSection(ctx, section, viewTransform, canvasSize);
  }
  
  ctx.restore();
}
