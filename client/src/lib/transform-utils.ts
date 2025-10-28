import { Point, FloorplanShape } from "@shared/schema";

export interface Wall {
  startIndex: number;
  endIndex: number;
  midpoint: Point;
  isHorizontal: boolean;
  isVertical: boolean;
}

export function detectWalls(vertices: Point[]): Wall[] {
  if (vertices.length < 2) return [];
  
  const walls: Wall[] = [];
  
  for (let i = 0; i < vertices.length; i++) {
    const start = vertices[i];
    const end = vertices[(i + 1) % vertices.length];
    
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    
    const isHorizontal = dy < 0.1;
    const isVertical = dx < 0.1;
    
    walls.push({
      startIndex: i,
      endIndex: (i + 1) % vertices.length,
      midpoint: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      },
      isHorizontal,
      isVertical,
    });
  }
  
  return walls;
}

export function findWallAtPoint(
  vertices: Point[],
  point: Point,
  tolerance: number = 0.5
): number | null {
  const walls = detectWalls(vertices);
  
  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const start = vertices[wall.startIndex];
    const end = vertices[wall.endIndex];
    
    const distToWall = pointToLineSegmentDistance(point, start, end);
    
    if (distToWall <= tolerance) {
      return i;
    }
  }
  
  return null;
}

function pointToLineSegmentDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
  ));
  
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  const distX = point.x - projX;
  const distY = point.y - projY;
  
  return Math.sqrt(distX * distX + distY * distY);
}

export function stretchWall(
  vertices: Point[],
  wallIndex: number,
  delta: Point
): Point[] {
  const walls = detectWalls(vertices);
  if (wallIndex < 0 || wallIndex >= walls.length) return vertices;
  
  const wall = walls[wallIndex];
  const newVertices = [...vertices];
  
  if (wall.isHorizontal) {
    newVertices[wall.startIndex] = {
      ...newVertices[wall.startIndex],
      y: newVertices[wall.startIndex].y + delta.y,
    };
    newVertices[wall.endIndex] = {
      ...newVertices[wall.endIndex],
      y: newVertices[wall.endIndex].y + delta.y,
    };
  } else if (wall.isVertical) {
    newVertices[wall.startIndex] = {
      ...newVertices[wall.startIndex],
      x: newVertices[wall.startIndex].x + delta.x,
    };
    newVertices[wall.endIndex] = {
      ...newVertices[wall.endIndex],
      x: newVertices[wall.endIndex].x + delta.x,
    };
  } else {
    newVertices[wall.startIndex] = {
      x: newVertices[wall.startIndex].x + delta.x,
      y: newVertices[wall.startIndex].y + delta.y,
    };
    newVertices[wall.endIndex] = {
      x: newVertices[wall.endIndex].x + delta.x,
      y: newVertices[wall.endIndex].y + delta.y,
    };
  }
  
  return newVertices;
}

export function getShapeCenter(vertices: Point[]): Point {
  if (vertices.length === 0) return { x: 0, y: 0 };
  
  const sumX = vertices.reduce((sum, v) => sum + v.x, 0);
  const sumY = vertices.reduce((sum, v) => sum + v.y, 0);
  
  return {
    x: sumX / vertices.length,
    y: sumY / vertices.length,
  };
}

export function rotatePoint(point: Point, center: Point, angleDegrees: number): Point {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos),
  };
}

export function rotateVertices(vertices: Point[], center: Point, angleDegrees: number): Point[] {
  return vertices.map(v => rotatePoint(v, center, angleDegrees));
}

export function calculateRotationAngle(center: Point, currentPoint: Point, startPoint: Point): number {
  const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
  const currentAngle = Math.atan2(currentPoint.y - center.y, currentPoint.x - center.x);
  
  let angleDelta = (currentAngle - startAngle) * (180 / Math.PI);
  
  return angleDelta;
}

export function snapAngleToIncrements(angle: number, increment: number = 15): number {
  return Math.round(angle / increment) * increment;
}
