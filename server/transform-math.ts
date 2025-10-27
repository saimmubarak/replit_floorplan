import { type Point, type HandleType } from "@shared/schema";

export interface TransformResult {
  vertices: Point[];
}

// ============================================
// TRANSFORM HANDLE MATH
// ============================================

export function applyMidpointScaling(
  handleType: HandleType,
  draggedWorldPoint: Point,
  initialVertices: Point[],
  isSymmetric: boolean
): Point[] {
  if (initialVertices.length < 2) return initialVertices;

  const xs = initialVertices.map(v => v.x);
  const ys = initialVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let newVertices = [...initialVertices];

  switch (handleType) {
    case 'n': {
      const deltaY = draggedWorldPoint.y - minY;
      newVertices = initialVertices.map(v => {
        if (Math.abs(v.y - minY) < 0.001) {
          return { ...v, y: draggedWorldPoint.y };
        }
        if (isSymmetric && Math.abs(v.y - maxY) < 0.001) {
          return { ...v, y: maxY - deltaY };
        }
        return v;
      });
      break;
    }
    case 's': {
      const deltaY = draggedWorldPoint.y - maxY;
      newVertices = initialVertices.map(v => {
        if (Math.abs(v.y - maxY) < 0.001) {
          return { ...v, y: draggedWorldPoint.y };
        }
        if (isSymmetric && Math.abs(v.y - minY) < 0.001) {
          return { ...v, y: minY - deltaY };
        }
        return v;
      });
      break;
    }
    case 'e': {
      const deltaX = draggedWorldPoint.x - maxX;
      newVertices = initialVertices.map(v => {
        if (Math.abs(v.x - maxX) < 0.001) {
          return { ...v, x: draggedWorldPoint.x };
        }
        if (isSymmetric && Math.abs(v.x - minX) < 0.001) {
          return { ...v, x: minX - deltaX };
        }
        return v;
      });
      break;
    }
    case 'w': {
      const deltaX = draggedWorldPoint.x - minX;
      newVertices = initialVertices.map(v => {
        if (Math.abs(v.x - minX) < 0.001) {
          return { ...v, x: draggedWorldPoint.x };
        }
        if (isSymmetric && Math.abs(v.x - maxX) < 0.001) {
          return { ...v, x: maxX - deltaX };
        }
        return v;
      });
      break;
    }
  }

  return newVertices;
}

export function applyCornerDrag(
  handleType: HandleType,
  draggedWorldPoint: Point,
  initialVertices: Point[],
  constrainAspect: boolean,
  isSymmetric: boolean
): Point[] {
  if (initialVertices.length < 2) return initialVertices;

  const xs = initialVertices.map(v => v.x);
  const ys = initialVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const initialWidth = maxX - minX;
  const initialHeight = maxY - minY;
  const aspectRatio = initialWidth / initialHeight;

  let anchorPoint: Point;
  let newWidth: number;
  let newHeight: number;

  switch (handleType) {
    case 'nw':
      anchorPoint = { x: maxX, y: maxY };
      newWidth = anchorPoint.x - draggedWorldPoint.x;
      newHeight = anchorPoint.y - draggedWorldPoint.y;
      break;
    case 'ne':
      anchorPoint = { x: minX, y: maxY };
      newWidth = draggedWorldPoint.x - anchorPoint.x;
      newHeight = anchorPoint.y - draggedWorldPoint.y;
      break;
    case 'se':
      anchorPoint = { x: minX, y: minY };
      newWidth = draggedWorldPoint.x - anchorPoint.x;
      newHeight = draggedWorldPoint.y - anchorPoint.y;
      break;
    case 'sw':
      anchorPoint = { x: maxX, y: minY };
      newWidth = anchorPoint.x - draggedWorldPoint.x;
      newHeight = draggedWorldPoint.y - anchorPoint.y;
      break;
    default:
      return initialVertices;
  }

  if (constrainAspect) {
    const avgScale = (Math.abs(newWidth / initialWidth) + Math.abs(newHeight / initialHeight)) / 2;
    newWidth = initialWidth * avgScale * Math.sign(newWidth);
    newHeight = initialHeight * avgScale * Math.sign(newHeight);
  }

  return initialVertices.map(v => {
    const relX = (v.x - minX) / initialWidth;
    const relY = (v.y - minY) / initialHeight;

    let newX: number;
    let newY: number;

    if (isSymmetric) {
      newX = centerX + (relX - 0.5) * newWidth;
      newY = centerY + (relY - 0.5) * newHeight;
    } else {
      newX = anchorPoint.x + (relX - (anchorPoint.x === maxX ? 1 : 0)) * newWidth;
      newY = anchorPoint.y + (relY - (anchorPoint.y === maxY ? 1 : 0)) * newHeight;
    }

    return { x: newX, y: newY };
  });
}

export function applyTranslation(
  deltaX: number,
  deltaY: number,
  initialVertices: Point[]
): Point[] {
  return initialVertices.map(v => ({
    x: v.x + deltaX,
    y: v.y + deltaY,
  }));
}

export function applyRotation(
  angle: number,
  center: Point,
  initialVertices: Point[]
): Point[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return initialVertices.map(v => {
    const dx = v.x - center.x;
    const dy = v.y - center.y;

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
}

// ============================================
// GEOMETRY UTILITIES
// ============================================

export function calculatePolygonArea(vertices: Point[]): number {
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
