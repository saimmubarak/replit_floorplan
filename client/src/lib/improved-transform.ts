import { Point, FloorplanShape, HandleType } from "@shared/schema";
import { getShapeCenter, rotateVertices, calculateRotationAngle, snapAngleToIncrements } from "./transform-utils";

interface TransformResult {
  vertices: Point[];
  rotationDelta?: number;
}

export function improvedTransformVertices(
  originalVertices: Point[],
  handle: HandleType,
  startPoint: Point,
  currentPoint: Point,
  shiftKey: boolean,
  altKey: boolean,
  shape: FloorplanShape
): TransformResult {
  if (originalVertices.length === 0) return { vertices: originalVertices };

  const xs = originalVertices.map(v => v.x);
  const ys = originalVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const delta = { x: currentPoint.x - startPoint.x, y: currentPoint.y - startPoint.y };

  if (handle === 'center') {
    return {
      vertices: originalVertices.map(v => ({
        x: v.x + delta.x,
        y: v.y + delta.y,
      }))
    };
  }

  if (handle === 'rotate') {
    const center = { x: centerX, y: centerY };
    let angleDelta = calculateRotationAngle(center, currentPoint, startPoint);
    
    if (shiftKey) {
      angleDelta = snapAngleToIncrements(angleDelta, 15);
    }
    
    return {
      vertices: originalVertices,
      rotationDelta: angleDelta
    };
  }

  if (handle === 'n' || handle === 's') {
    const isNorth = handle === 'n';
    const targetY = isNorth ? minY : maxY;
    
    return {
      vertices: originalVertices.map(v => {
        const isOnTargetEdge = Math.abs(v.y - targetY) < 0.1;
        if (isOnTargetEdge) {
          return {
            x: v.x,
            y: v.y + delta.y,
          };
        }
        return v;
      })
    };
  }

  if (handle === 'e' || handle === 'w') {
    const isEast = handle === 'e';
    const targetX = isEast ? maxX : minX;
    
    return {
      vertices: originalVertices.map(v => {
        const isOnTargetEdge = Math.abs(v.x - targetX) < 0.1;
        if (isOnTargetEdge) {
          return {
            x: v.x + delta.x,
            y: v.y,
          };
        }
        return v;
      })
    };
  }

  if (['nw', 'ne', 'se', 'sw'].includes(handle)) {
    const isNorth = handle.includes('n');
    const isEast = handle.includes('e');
    
    const targetX = isEast ? maxX : minX;
    const targetY = isNorth ? minY : maxY;
    
    return {
      vertices: originalVertices.map(v => {
        const isOnHorizontalEdge = Math.abs(v.y - targetY) < 0.1;
        const isOnVerticalEdge = Math.abs(v.x - targetX) < 0.1;
        
        const newX = isOnVerticalEdge ? v.x + delta.x : v.x;
        const newY = isOnHorizontalEdge ? v.y + delta.y : v.y;
        
        return { x: newX, y: newY };
      })
    };
  }

  return { vertices: originalVertices };
}
