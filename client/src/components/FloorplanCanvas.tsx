import { useRef, useEffect, useState, useCallback } from "react";
import {
  type FloorplanShape,
  type ViewTransform,
  type Point,
  type ToolType,
  type HandleType,
  DEFAULT_EDITING_DPI,
  A2_WIDTH_FT,
  A2_HEIGHT_FT,
  GRID_SPACING_FT,
  SNAP_THRESHOLD_FT,
} from "@shared/schema";
import {
  worldToCanvas,
  canvasToWorld,
  pixelsPerFoot,
  distance,
  snapToGrid,
  findSnapTarget,
} from "@/lib/coordinate-math";

interface FloorplanCanvasProps {
  shapes: FloorplanShape[];
  viewTransform: ViewTransform;
  selectedShapeId: string | null;
  activeTool: ToolType;
  gridEnabled: boolean;
  snapEnabled: boolean;
  onShapesChange: (shapes: FloorplanShape[]) => void;
  onViewTransformChange: (transform: ViewTransform) => void;
  onSelectShape: (id: string | null) => void;
}

export function FloorplanCanvas({
  shapes,
  viewTransform,
  selectedShapeId,
  activeTool,
  gridEnabled,
  snapEnabled,
  onShapesChange,
  onViewTransformChange,
  onSelectShape,
}: FloorplanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [hoveredHandle, setHoveredHandle] = useState<{ shapeId: string; handle: HandleType } | null>(null);
  const [snapPoint, setSnapPoint] = useState<Point | null>(null);

  // Update canvas size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Draw canvas content
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'hsl(var(--canvas-sheet))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate A2 sheet dimensions in pixels
    const ppf = pixelsPerFoot(DEFAULT_EDITING_DPI);
    const sheetWidth = A2_WIDTH_FT * ppf * viewTransform.zoom;
    const sheetHeight = A2_HEIGHT_FT * ppf * viewTransform.zoom;
    
    // Center the sheet
    const sheetX = (canvas.width - sheetWidth) / 2;
    const sheetY = (canvas.height - sheetHeight) / 2;

    // Draw A2 sheet background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas-sheet').trim();
    ctx.fillStyle = `hsl(${ctx.fillStyle})`;
    ctx.fillRect(sheetX, sheetY, sheetWidth, sheetHeight);

    // Draw grid if enabled
    if (gridEnabled) {
      drawGrid(ctx, viewTransform, canvasSize, sheetX, sheetY, sheetWidth, sheetHeight);
    }

    // Draw all shapes
    shapes.forEach(shape => {
      drawShape(ctx, shape, viewTransform, shape.id === selectedShapeId);
      if (shape.labelVisibility) {
        drawMeasurements(ctx, shape, viewTransform);
      }
    });

    // Draw current drawing
    if (isDrawing && currentPoints.length > 0) {
      drawTemporaryShape(ctx, currentPoints, viewTransform, activeTool);
    }

    // Draw snap indicator
    if (snapPoint) {
      drawSnapIndicator(ctx, snapPoint, viewTransform);
    }

    // Draw handles for selected shape
    if (selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) {
        drawHandles(ctx, shape, viewTransform, hoveredHandle);
      }
    }
  }, [shapes, viewTransform, selectedShapeId, gridEnabled, isDrawing, currentPoints, activeTool, snapPoint, hoveredHandle, canvasSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = canvasToWorld(canvasPoint, viewTransform, DEFAULT_EDITING_DPI);

    if (activeTool === 'select') {
      // Check if clicking on a shape
      const clickedShape = findShapeAtPoint(shapes, worldPoint);
      onSelectShape(clickedShape?.id || null);
    } else if (activeTool !== 'pan') {
      // Start drawing
      setIsDrawing(true);
      const point = snapEnabled ? snapToGrid(worldPoint, GRID_SPACING_FT) : worldPoint;
      setCurrentPoints([point]);
    }
  }, [activeTool, viewTransform, shapes, snapEnabled, onSelectShape]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = canvasToWorld(canvasPoint, viewTransform, DEFAULT_EDITING_DPI);

    if (isDrawing) {
      const point = snapEnabled ? snapToGrid(worldPoint, GRID_SPACING_FT) : worldPoint;
      
      if (activeTool === 'freehand') {
        setCurrentPoints(prev => [...prev, point]);
      } else {
        setCurrentPoints(prev => [prev[0], point]);
      }

      // Check for snap targets
      if (snapEnabled) {
        const allVertices = shapes.flatMap(s => s.vertices);
        const snap = findSnapTarget(point, allVertices, SNAP_THRESHOLD_FT);
        setSnapPoint(snap);
      }
    }
  }, [isDrawing, activeTool, viewTransform, snapEnabled, shapes]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentPoints.length >= 2) {
      // Create new shape based on tool
      const newShape: FloorplanShape = {
        id: crypto.randomUUID(),
        type: activeTool === 'rectangle' ? 'rectangle' : activeTool === 'freehand' ? 'freehand' : 'line',
        vertices: activeTool === 'rectangle' ? createRectangleVertices(currentPoints) : currentPoints,
        strokeMm: 0.25,
        strokeColor: '#000000',
        layer: 'default',
        labelVisibility: true,
        lockAspect: false,
      };

      onShapesChange([...shapes, newShape]);
    }
    
    setIsDrawing(false);
    setCurrentPoints([]);
    setSnapPoint(null);
  }, [isDrawing, currentPoints, activeTool, shapes, onShapesChange]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="cursor-crosshair"
        data-testid="floorplan-canvas"
      />
      
      {/* Zoom indicator */}
      <div className="absolute top-4 right-4 px-3 py-1 bg-background/90 backdrop-blur-sm rounded-md border text-sm font-mono">
        {(viewTransform.zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number },
  sheetX: number,
  sheetY: number,
  sheetWidth: number,
  sheetHeight: number
) {
  ctx.strokeStyle = 'hsl(var(--canvas-grid))';
  ctx.lineWidth = 1;
  
  const ppf = pixelsPerFoot(DEFAULT_EDITING_DPI) * viewTransform.zoom;
  const gridSize = GRID_SPACING_FT * ppf;

  ctx.save();
  ctx.beginPath();
  ctx.rect(sheetX, sheetY, sheetWidth, sheetHeight);
  ctx.clip();

  for (let x = sheetX; x < sheetX + sheetWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, sheetY);
    ctx.lineTo(x, sheetY + sheetHeight);
    ctx.stroke();
  }

  for (let y = sheetY; y < sheetY + sheetHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(sheetX, y);
    ctx.lineTo(sheetX + sheetWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  isSelected: boolean
) {
  if (shape.vertices.length < 2) return;

  const canvasVertices = shape.vertices.map(v => worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI));

  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvasVertices[0].x, canvasVertices[0].y);
  
  for (let i = 1; i < canvasVertices.length; i++) {
    ctx.lineTo(canvasVertices[i].x, canvasVertices[i].y);
  }

  if (shape.type === 'rectangle' || shape.type === 'polygon') {
    ctx.closePath();
  }

  ctx.stroke();

  if (isSelected) {
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawTemporaryShape(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  viewTransform: ViewTransform,
  tool: ToolType
) {
  if (points.length < 2) return;

  const canvasPoints = points.map(p => worldToCanvas(p, viewTransform, DEFAULT_EDITING_DPI));

  ctx.strokeStyle = 'hsl(var(--primary))';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);

  for (let i = 1; i < canvasPoints.length; i++) {
    ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
  }

  if (tool === 'rectangle' && canvasPoints.length === 2) {
    const [start, end] = canvasPoints;
    ctx.lineTo(end.x, start.y);
    ctx.lineTo(start.x, start.y);
  }

  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSnapIndicator(ctx: CanvasRenderingContext2D, point: Point, viewTransform: ViewTransform) {
  const canvasPoint = worldToCanvas(point, viewTransform, DEFAULT_EDITING_DPI);
  
  ctx.fillStyle = 'hsl(var(--canvas-snap))';
  ctx.beginPath();
  ctx.arc(canvasPoint.x, canvasPoint.y, 4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = 'hsl(var(--canvas-snap))';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvasPoint.x, canvasPoint.y, 8, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  hoveredHandle: { shapeId: string; handle: HandleType } | null
) {
  const canvasVertices = shape.vertices.map(v => worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI));

  if (canvasVertices.length === 0) return;

  const xs = canvasVertices.map(v => v.x);
  const ys = canvasVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const handles: { pos: Point; type: HandleType }[] = [
    { pos: { x: minX, y: minY }, type: 'nw' },
    { pos: { x: (minX + maxX) / 2, y: minY }, type: 'n' },
    { pos: { x: maxX, y: minY }, type: 'ne' },
    { pos: { x: maxX, y: (minY + maxY) / 2 }, type: 'e' },
    { pos: { x: maxX, y: maxY }, type: 'se' },
    { pos: { x: (minX + maxX) / 2, y: maxY }, type: 's' },
    { pos: { x: minX, y: maxY }, type: 'sw' },
    { pos: { x: minX, y: (minY + maxY) / 2 }, type: 'w' },
    { pos: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, type: 'center' },
  ];

  handles.forEach(handle => {
    const isHovered = hoveredHandle?.handle === handle.type && hoveredHandle?.shapeId === shape.id;
    const size = isHovered ? 4 : 3;
    
    ctx.fillStyle = isHovered ? 'hsl(var(--handle-hover))' : 'hsl(var(--handle))';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    if (handle.type === 'center') {
      ctx.beginPath();
      ctx.arc(handle.pos.x, handle.pos.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (['n', 'e', 's', 'w'].includes(handle.type)) {
      ctx.beginPath();
      ctx.arc(handle.pos.x, handle.pos.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(handle.pos.x - size, handle.pos.y - size, size * 2, size * 2);
      ctx.strokeRect(handle.pos.x - size, handle.pos.y - size, size * 2, size * 2);
    }
  });
}

function findShapeAtPoint(shapes: FloorplanShape[], point: Point): FloorplanShape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (isPointInShape(point, shape)) {
      return shape;
    }
  }
  return null;
}

function isPointInShape(point: Point, shape: FloorplanShape): boolean {
  const bounds = {
    min: {
      x: Math.min(...shape.vertices.map(v => v.x)),
      y: Math.min(...shape.vertices.map(v => v.y)),
    },
    max: {
      x: Math.max(...shape.vertices.map(v => v.x)),
      y: Math.max(...shape.vertices.map(v => v.y)),
    },
  };

  return point.x >= bounds.min.x && point.x <= bounds.max.x &&
         point.y >= bounds.min.y && point.y <= bounds.max.y;
}

function createRectangleVertices(points: Point[]): Point[] {
  if (points.length !== 2) return points;
  
  const [start, end] = points;
  return [
    { x: start.x, y: start.y },
    { x: end.x, y: start.y },
    { x: end.x, y: end.y },
    { x: start.x, y: end.y },
  ];
}

function drawMeasurements(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform
) {
  if (shape.vertices.length < 2) return;

  for (let i = 0; i < shape.vertices.length; i++) {
    const j = (i + 1) % shape.vertices.length;
    
    if (shape.type === 'line' && i > 0) break;
    if (shape.type === 'freehand' && i >= shape.vertices.length - 1) break;

    const start = worldToCanvas(shape.vertices[i], viewTransform, DEFAULT_EDITING_DPI);
    const end = worldToCanvas(shape.vertices[j], viewTransform, DEFAULT_EDITING_DPI);
    
    const dx = shape.vertices[j].x - shape.vertices[i].x;
    const dy = shape.vertices[j].y - shape.vertices[i].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    
    const label = `${length.toFixed(1)} ft`;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const metrics = ctx.measureText(label);
    const padding = 4;
    const bgWidth = metrics.width + padding * 2;
    const bgHeight = 16;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(-bgWidth / 2, -bgHeight / 2 - 8, bgWidth, bgHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 0, -8);
    
    ctx.restore();
  }
}
