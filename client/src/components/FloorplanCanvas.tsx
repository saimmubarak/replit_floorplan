import { useRef, useEffect, useState, useCallback } from "react";
import {
  type FloorplanShape,
  type ViewTransform,
  type Point,
  type ToolType,
  type HandleType,
  type WizardStep,
  type Door,
  type DoorType,
  DEFAULT_EDITING_DPI,
  A2_WIDTH_FT,
  A2_HEIGHT_FT,
  GRID_SPACING_FT,
  SNAP_THRESHOLD_FT,
  STEP_COLORS,
} from "@shared/schema";
import {
  worldToCanvas,
  canvasToWorld,
  pixelsPerFoot,
  distance,
  snapToGrid,
  findSnapTarget,
} from "@/lib/coordinate-math";
import { drawRoof } from "@/lib/roof-renderer";
import { improvedTransformVertices } from "@/lib/improved-transform";
import {
  findWallSegmentAtPoint,
  drawDoorSkin,
  drawDoorLine,
  drawDoorHandles,
  findDoorAtPoint,
  findDoorHandle,
} from "@/lib/door-renderer";
import { useToast } from "@/hooks/use-toast";

interface FloorplanCanvasProps {
  shapes: FloorplanShape[];
  doors: Door[];
  viewTransform: ViewTransform;
  selectedShapeId: string | null;
  selectedDoorId: string | null;
  activeTool: ToolType;
  gridEnabled: boolean;
  snapEnabled: boolean;
  currentStep: WizardStep;
  doorPlacementMode: { active: boolean; doorType: DoorType; width: number };
  onShapesChange: (shapes: FloorplanShape[]) => void;
  onDoorsChange: (doors: Door[]) => void;
  onViewTransformChange: (transform: ViewTransform) => void;
  onSelectShape: (id: string | null) => void;
  onSelectDoor: (id: string | null) => void;
  onPlaceDoor: (door: Door) => void;
}

export function FloorplanCanvas({
  shapes,
  doors,
  viewTransform,
  selectedShapeId,
  selectedDoorId,
  activeTool,
  gridEnabled,
  snapEnabled,
  currentStep,
  doorPlacementMode,
  onShapesChange,
  onDoorsChange,
  onViewTransformChange,
  onSelectShape,
  onSelectDoor,
  onPlaceDoor,
}: FloorplanCanvasProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [hoveredHandle, setHoveredHandle] = useState<{ shapeId: string; handle: HandleType } | null>(null);
  const [snapPoint, setSnapPoint] = useState<Point | null>(null);
  const [dragState, setDragState] = useState<{
    shapeId: string;
    handle: HandleType;
    startPoint: Point;
    originalVertices: Point[];
    shiftKey: boolean;
    altKey: boolean;
  } | null>(null);
  const [liveMeasurement, setLiveMeasurement] = useState<{ label: string; position: Point } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [mousePosition, setMousePosition] = useState<Point | null>(null);
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [hoveredDoorId, setHoveredDoorId] = useState<string | null>(null);
  const [doorDragState, setDoorDragState] = useState<{
    doorId: string;
    handle: 'start' | 'end' | 'center' | null;
    startPoint: Point;
  } | null>(null);

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

    // Clear canvas with background color
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    ctx.fillStyle = `hsl(${bgColor})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw A2 sheet background in world coordinates (0,0) to (A2_WIDTH_FT, A2_HEIGHT_FT)
    const sheetTopLeft = worldToCanvas({ x: 0, y: 0 }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    const sheetBottomRight = worldToCanvas({ x: A2_WIDTH_FT, y: A2_HEIGHT_FT }, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    
    const sheetX = sheetTopLeft.x;
    const sheetY = sheetTopLeft.y;
    const sheetWidth = sheetBottomRight.x - sheetTopLeft.x;
    const sheetHeight = sheetBottomRight.y - sheetTopLeft.y;

    // Draw A2 sheet background (white canvas)
    const sheetColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-sheet').trim();
    ctx.fillStyle = `hsl(${sheetColor})`;
    ctx.fillRect(sheetX, sheetY, sheetWidth, sheetHeight);

    // Draw grid if enabled
    if (gridEnabled) {
      drawGrid(ctx, viewTransform, canvasSize, sheetX, sheetY, sheetWidth, sheetHeight);
    }

    // Draw grass skin for plot shapes (underneath everything)
    shapes.forEach(shape => {
      if (shape.layer === 'plot') {
        drawGrassSkin(ctx, shape, viewTransform, canvasSize);
      }
    });

    // Draw all shapes with roofs
    shapes.forEach(shape => {
      // Draw roof skin first (underneath the shape outline)
      drawRoof(ctx, shape, viewTransform, canvasSize);
      
      // Then draw the shape outline (but we'll draw door lines over walls later)
      const isHovered = shape.id === hoveredShapeId && activeTool === 'select' && !selectedShapeId;
      drawShape(ctx, shape, viewTransform, shape.id === selectedShapeId, canvasSize, isHovered);
      
      // Finally draw measurements on top
      if (shape.labelVisibility) {
        drawMeasurements(ctx, shape, viewTransform, canvasSize);
      }
    });

    // Draw door lines (white lines that interrupt walls)
    doors.forEach(door => {
      const wallShape = shapes.find(s => s.id === door.wallShapeId);
      if (wallShape) {
        drawDoorLine(ctx, door, wallShape, viewTransform, canvasSize);
      }
    });

    // Draw door skins (on top of lines)
    doors.forEach(door => {
      drawDoorSkin(ctx, door, viewTransform, canvasSize);
      if (door.id === selectedDoorId) {
        drawDoorHandles(ctx, door, viewTransform, canvasSize);
      }
      const isHovered = door.id === hoveredDoorId && activeTool === 'select' && !selectedDoorId;
      if (isHovered) {
        const pos = worldToCanvas(door.position, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
        ctx.save();
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        ctx.strokeStyle = `hsl(${primaryColor} / 0.6)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(pos.x - (door.width * viewTransform.zoom) / 2 - 5, pos.y - 10, door.width * viewTransform.zoom + 10, 20);
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    // Draw current drawing
    if (isDrawing && currentPoints.length > 0) {
      const pointsToDraw = activeTool === 'polygon' && previewPoint 
        ? [...currentPoints, previewPoint] 
        : currentPoints;
      drawTemporaryShape(ctx, pointsToDraw, viewTransform, activeTool, canvasSize);
    }

    // Draw snap indicator
    if (snapPoint) {
      drawSnapIndicator(ctx, snapPoint, viewTransform, canvasSize);
    }

    // Draw handles for selected shape
    if (selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) {
        drawHandles(ctx, shape, viewTransform, hoveredHandle, canvasSize);
      }
    }

    // Draw live measurement during dragging
    if (liveMeasurement) {
      const canvasPos = worldToCanvas(liveMeasurement.position, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const metrics = ctx.measureText(liveMeasurement.label);
      const padding = 6;
      const bgWidth = metrics.width + padding * 2;
      const bgHeight = 20;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(canvasPos.x - bgWidth / 2, canvasPos.y - bgHeight / 2, bgWidth, bgHeight);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(liveMeasurement.label, canvasPos.x, canvasPos.y);
    }
  }, [shapes, doors, viewTransform, selectedShapeId, selectedDoorId, gridEnabled, isDrawing, currentPoints, activeTool, snapPoint, hoveredHandle, canvasSize, liveMeasurement, previewPoint, hoveredShapeId, hoveredDoorId]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = canvasToWorld(canvasPoint, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);

    // Spacebar pan mode or pan tool
    if (spacePressed || activeTool === 'pan') {
      setIsPanning(true);
      setPanStart(canvasPoint);
      return;
    }

    // Door placement mode
    if (doorPlacementMode.active) {
      const wallResult = findWallSegmentAtPoint(shapes, worldPoint, 1.0);
      if (wallResult) {
        const newDoor: Door = {
          id: crypto.randomUUID(),
          type: doorPlacementMode.doorType,
          position: wallResult.closestPoint,
          width: doorPlacementMode.width,
          wallShapeId: wallResult.shape.id,
          wallSegmentIndex: wallResult.segmentIndex,
          rotation: wallResult.rotation,
        };
        onPlaceDoor(newDoor);
      } else {
        toast({
          title: "Invalid Placement",
          description: "Place doors only on walls — click a wall segment",
          variant: "destructive",
        });
      }
      return;
    }

    // Delete tool
    if (activeTool === 'delete') {
      const clickedDoor = findDoorAtPoint(doors, worldPoint);
      if (clickedDoor) {
        onDoorsChange(doors.filter(d => d.id !== clickedDoor.id));
        toast({
          title: "Door Deleted",
          description: "Door removed successfully",
        });
      } else {
        const clickedShape = findShapeAtPoint(shapes, worldPoint);
        if (clickedShape) {
          onShapesChange(shapes.filter(s => s.id !== clickedShape.id));
          onSelectShape(null);
          toast({
            title: "Shape Deleted",
            description: "Shape removed successfully",
          });
        }
      }
      return;
    }

    if (activeTool === 'select') {
      // Check if clicking on a door handle
      if (selectedDoorId) {
        const door = doors.find(d => d.id === selectedDoorId);
        if (door) {
          const handle = findDoorHandle(door, worldPoint, viewTransform);
          if (handle) {
            setDoorDragState({
              doorId: door.id,
              handle,
              startPoint: worldPoint,
            });
            return;
          }
        }
      }

      // Check if clicking on a door
      const clickedDoor = findDoorAtPoint(doors, worldPoint);
      if (clickedDoor) {
        onSelectDoor(clickedDoor.id);
        onSelectShape(null);
        setDoorDragState({
          doorId: clickedDoor.id,
          handle: 'center',
          startPoint: worldPoint,
        });
        return;
      }

      // Check if clicking on a handle of the selected shape
      if (selectedShapeId) {
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape) {
          const handle = findHandleAtPoint(shape, canvasPoint, viewTransform, canvasSize);
          if (handle) {
            // Start handle drag
            setDragState({
              shapeId: shape.id,
              handle,
              startPoint: worldPoint,
              originalVertices: [...shape.vertices],
              shiftKey: e.shiftKey,
              altKey: e.altKey,
            });
            return;
          }
        }
      }
      
      // Check if clicking on a shape
      const clickedShape = findShapeAtPoint(shapes, worldPoint);
      if (clickedShape) {
        onSelectShape(clickedShape.id);
        onSelectDoor(null);
      } else {
        onSelectShape(null);
        onSelectDoor(null);
      }
    } else {
      // Drawing mode (rectangle, polygon, line, freehand)
      const point = snapEnabled ? snapToGrid(worldPoint, GRID_SPACING_FT) : worldPoint;
      
      if (activeTool === 'polygon' && isDrawing) {
        // Add point to existing polygon
        setCurrentPoints(prev => [...prev, point]);
      } else {
        // Start drawing
        setIsDrawing(true);
        setCurrentPoints([point]);
      }
    }
  }, [activeTool, viewTransform, shapes, doors, snapEnabled, onSelectShape, onSelectDoor, selectedShapeId, selectedDoorId, canvasSize, spacePressed, isDrawing, doorPlacementMode, onPlaceDoor, onDoorsChange, onShapesChange, toast]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = canvasToWorld(canvasPoint, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);

    // Update mouse position for cursor hints
    setMousePosition(worldPoint);

    // Handle panning
    if (isPanning && panStart) {
      const dx = canvasPoint.x - panStart.x;
      const dy = canvasPoint.y - panStart.y;
      
      onViewTransformChange({
        ...viewTransform,
        panX: viewTransform.panX + dx,
        panY: viewTransform.panY + dy,
      });
      
      setPanStart(canvasPoint);
      return;
    }

    // Handle door dragging
    if (doorDragState) {
      const door = doors.find(d => d.id === doorDragState.doorId);
      const wallShape = door ? shapes.find(s => s.id === door.wallShapeId) : null;
      if (door && wallShape) {
        if (doorDragState.handle === 'center') {
          const wallResult = findWallSegmentAtPoint(shapes, worldPoint, 2.0);
          if (wallResult && wallResult.shape.id === door.wallShapeId) {
            const updatedDoors = doors.map(d =>
              d.id === door.id ? { ...d, position: wallResult.closestPoint } : d
            );
            onDoorsChange(updatedDoors);
          }
        } else if (doorDragState.handle === 'start' || doorDragState.handle === 'end') {
          const v1 = wallShape.vertices[door.wallSegmentIndex];
          const v2 = wallShape.vertices[(door.wallSegmentIndex + 1) % wallShape.vertices.length];
          const wallLength = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
          
          const dx = worldPoint.x - doorDragState.startPoint.x;
          const dy = worldPoint.y - doorDragState.startPoint.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const newWidth = doorDragState.handle === 'end' 
            ? Math.max(2, Math.min(wallLength, door.width + dist)) 
            : Math.max(2, Math.min(wallLength, door.width - dist));
          
          const updatedDoors = doors.map(d =>
            d.id === door.id ? { ...d, width: newWidth } : d
          );
          onDoorsChange(updatedDoors);
        }
      }
      return;
    }

    // Handle dragging transform handles
    if (dragState) {
      const shape = shapes.find(s => s.id === dragState.shapeId);
      if (shape) {
        const result = transformVertices(
          dragState.originalVertices,
          dragState.handle,
          dragState.startPoint,
          worldPoint,
          e.shiftKey,
          e.altKey,
          shape
        );
        
        // Update shape with new vertices and rotation
        let updatedShape = { ...shape, vertices: result.vertices };
        if (result.rotationDelta !== undefined) {
          updatedShape.rotation = (shape.rotation || 0) + result.rotationDelta;
        }
        
        const updatedShapes = shapes.map(s =>
          s.id === dragState.shapeId ? updatedShape : s
        );
        onShapesChange(updatedShapes);
        
        // Calculate and show live measurement
        const measurement = calculateShapeMeasurement(result.vertices);
        if (measurement) {
          setLiveMeasurement({
            label: measurement.label,
            position: measurement.position,
          });
        }
      }
      return;
    }

    // Update hovered handle
    if (selectedShapeId && activeTool === 'select') {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) {
        const handle = findHandleAtPoint(shape, canvasPoint, viewTransform, canvasSize);
        if (handle) {
          setHoveredHandle({ shapeId: shape.id, handle });
        } else {
          setHoveredHandle(null);
        }
      }
    }

    // Update hovered shape and door (for visual feedback when hovering over unselected elements)
    if (activeTool === 'select' && !dragState && !doorDragState && !isPanning) {
      const hoveredDoor = findDoorAtPoint(doors, worldPoint);
      setHoveredDoorId(hoveredDoor?.id || null);
      
      if (!hoveredDoor) {
        const hoveredShape = findShapeAtPoint(shapes, worldPoint);
        setHoveredShapeId(hoveredShape?.id || null);
      } else {
        setHoveredShapeId(null);
      }
    }

    if (isDrawing) {
      const point = snapEnabled ? snapToGrid(worldPoint, GRID_SPACING_FT) : worldPoint;
      
      if (activeTool === 'freehand') {
        setCurrentPoints(prev => [...prev, point]);
      } else if (activeTool === 'polygon') {
        // For polygon mode, update preview point only
        setPreviewPoint(point);
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
  }, [isDrawing, activeTool, viewTransform, snapEnabled, shapes, doors, dragState, doorDragState, selectedShapeId, onShapesChange, onDoorsChange, canvasSize, isPanning, panStart, onViewTransformChange]);

  const handleMouseUp = useCallback(() => {
    // Clear pan state
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // Clear door drag state
    if (doorDragState) {
      setDoorDragState(null);
      return;
    }

    // Clear drag state
    if (dragState) {
      setDragState(null);
      setLiveMeasurement(null);
      return;
    }

    // For polyline mode (polygon), don't finish on mouseup - wait for double-click or Enter
    if (isDrawing && activeTool === 'polygon') {
      return; // Continue drawing
    }

    if (isDrawing && currentPoints.length >= 2) {
      // Determine stroke color based on current wizard step
      const strokeColor = STEP_COLORS[currentStep];
      
      // Determine layer based on step
      const layer = currentStep === 'plot-size' ? 'plot' : currentStep === 'house-shape' ? 'house' : 'default';
      const name = currentStep === 'plot-size' ? 'Plot Boundary' : currentStep === 'house-shape' ? 'House' : undefined;
      
      // Create new shape based on tool
      const newShape: FloorplanShape = {
        id: crypto.randomUUID(),
        type: activeTool === 'rectangle' ? 'rectangle' : activeTool === 'freehand' ? 'freehand' : activeTool === 'polygon' ? 'polygon' : 'line',
        vertices: activeTool === 'rectangle' ? createRectangleVertices(currentPoints) : currentPoints,
        strokeMm: 0.25,
        strokeColor,
        layer,
        labelVisibility: true,
        lockAspect: false,
        name,
        rotation: 0,
      };

      onShapesChange([...shapes, newShape]);
      onSelectShape(newShape.id);
    }
    
    setIsDrawing(false);
    setCurrentPoints([]);
    setSnapPoint(null);
    setPreviewPoint(null);
  }, [isDrawing, currentPoints, activeTool, shapes, onShapesChange, onSelectShape, dragState, doorDragState, isPanning, currentStep]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Finish polyline drawing on double-click
    if (isDrawing && activeTool === 'polygon' && currentPoints.length >= 2) {
      // Determine stroke color based on current wizard step
      const strokeColor = STEP_COLORS[currentStep];
      const layer = currentStep === 'plot-size' ? 'plot' : currentStep === 'house-shape' ? 'house' : 'default';
      const name = currentStep === 'plot-size' ? 'Plot Boundary' : currentStep === 'house-shape' ? 'House' : undefined;
      
      const newShape: FloorplanShape = {
        id: crypto.randomUUID(),
        type: 'polygon',
        vertices: currentPoints,
        strokeMm: 0.25,
        strokeColor,
        layer,
        labelVisibility: true,
        lockAspect: false,
        name,
        rotation: 0,
      };

      onShapesChange([...shapes, newShape]);
      onSelectShape(newShape.id);
      
      setIsDrawing(false);
      setCurrentPoints([]);
      setSnapPoint(null);
      setPreviewPoint(null);
    }
  }, [isDrawing, activeTool, currentPoints, shapes, onShapesChange, onSelectShape, currentStep]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Spacebar: enable pan mode
    if (e.code === 'Space' && !isDrawing && !spacePressed) {
      e.preventDefault();
      setSpacePressed(true);
    }

    // Delete: delete selected shape
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId && !isDrawing) {
      e.preventDefault();
      const updatedShapes = shapes.filter(s => s.id !== selectedShapeId);
      onShapesChange(updatedShapes);
      onSelectShape(null);
      return;
    }

    // Escape: cancel current drawing or deselect
    if (e.key === 'Escape') {
      if (isDrawing) {
        setIsDrawing(false);
        setCurrentPoints([]);
        setSnapPoint(null);
        setPreviewPoint(null);
      } else {
        onSelectShape(null);
      }
    }

    // Backspace: undo last vertex in polyline
    if (e.key === 'Backspace' && isDrawing && activeTool === 'polygon' && currentPoints.length > 1) {
      e.preventDefault();
      setCurrentPoints(prev => prev.slice(0, -1));
    }

    // Enter: finish polyline drawing
    if (e.key === 'Enter' && isDrawing && activeTool === 'polygon' && currentPoints.length >= 2) {
      e.preventDefault();
      
      const strokeColor = STEP_COLORS[currentStep];
      const layer = currentStep === 'plot-size' ? 'plot' : currentStep === 'house-shape' ? 'house' : 'default';
      const name = currentStep === 'plot-size' ? 'Plot Boundary' : currentStep === 'house-shape' ? 'House' : undefined;
      
      const newShape: FloorplanShape = {
        id: crypto.randomUUID(),
        type: 'polygon',
        vertices: currentPoints,
        strokeMm: 0.25,
        strokeColor,
        layer,
        labelVisibility: true,
        lockAspect: false,
        name,
        rotation: 0,
      };

      onShapesChange([...shapes, newShape]);
      onSelectShape(newShape.id);
      
      setIsDrawing(false);
      setCurrentPoints([]);
      setSnapPoint(null);
      setPreviewPoint(null);
    }
  }, [isDrawing, activeTool, currentPoints, shapes, onShapesChange, onSelectShape, currentStep, spacePressed, selectedShapeId]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Spacebar: disable pan mode
    if (e.code === 'Space') {
      setSpacePressed(false);
      setIsPanning(false);
      setPanStart(null);
    }
  }, []);

  // Add keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Zoom to fit A2 sheet
  const handleZoomToFit = useCallback(() => {
    const ppf = pixelsPerFoot(DEFAULT_EDITING_DPI);
    const sheetWidthPx = A2_WIDTH_FT * ppf;
    const sheetHeightPx = A2_HEIGHT_FT * ppf;
    
    const zoomX = (canvasSize.width * 0.9) / sheetWidthPx;
    const zoomY = (canvasSize.height * 0.9) / sheetHeightPx;
    const zoom = Math.min(zoomX, zoomY, 1);
    
    onViewTransformChange({
      panX: 0,
      panY: 0,
      zoom,
    });
  }, [canvasSize, onViewTransformChange]);

  // Determine cursor style
  const getCursorClass = () => {
    if (spacePressed || activeTool === 'pan') return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    if (activeTool === 'select') return 'cursor-default';
    return 'cursor-crosshair';
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className={getCursorClass()}
        data-testid="floorplan-canvas"
      />
      
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={handleZoomToFit}
          className="px-3 py-1 bg-background/90 backdrop-blur-sm rounded-md border text-sm hover:bg-accent transition-colors"
          data-testid="button-zoom-fit"
          title="Zoom to fit (fit entire A2 sheet)"
        >
          Fit
        </button>
        <div className="px-3 py-1 bg-background/90 backdrop-blur-sm rounded-md border text-sm font-mono" data-testid="text-zoom-level">
          {(viewTransform.zoom * 100).toFixed(0)}%
        </div>
      </div>

      {/* Mouse position indicator */}
      {mousePosition && (
        <div className="absolute bottom-4 right-4 px-3 py-1 bg-background/90 backdrop-blur-sm rounded-md border text-xs font-mono" data-testid="text-mouse-position">
          X: {mousePosition.x.toFixed(1)}ft | Y: {mousePosition.y.toFixed(1)}ft
        </div>
      )}

      {/* Keyboard hints */}
      {isDrawing && activeTool === 'polygon' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/90 backdrop-blur-sm rounded-md border text-sm shadow-lg" data-testid="text-drawing-hints">
          Click to add vertex | <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Backspace</kbd> undo | <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> or double-click to finish | <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd> cancel
        </div>
      )}

      {spacePressed && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary/90 backdrop-blur-sm rounded-md text-sm text-primary-foreground shadow-lg" data-testid="text-pan-mode">
          Pan Mode Active
        </div>
      )}
      
      {/* Tooltip for selected shapes */}
      {selectedShapeId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-primary/90 backdrop-blur-sm rounded-md text-sm text-primary-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          Drag handles to resize
        </div>
      )}
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
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-grid').trim();
  ctx.strokeStyle = `hsl(${gridColor})`;
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

function drawGrassSkin(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  if (shape.vertices.length < 3) return;
  
  const canvasVertices = shape.vertices.map(v => worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height));
  
  ctx.save();
  
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.beginPath();
  ctx.moveTo(canvasVertices[0].x, canvasVertices[0].y);
  
  for (let i = 1; i < canvasVertices.length; i++) {
    ctx.lineTo(canvasVertices[i].x, canvasVertices[i].y);
  }
  
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  isSelected: boolean,
  canvasSize: { width: number; height: number },
  isHovered: boolean = false
) {
  if (shape.vertices.length < 2) return;

  const canvasVertices = shape.vertices.map(v => worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height));
  
  // Calculate center in canvas coordinates
  const xs = canvasVertices.map(v => v.x);
  const ys = canvasVertices.map(v => v.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

  ctx.save();
  
  // Apply rotation if present
  if (shape.rotation) {
    ctx.translate(centerX, centerY);
    ctx.rotate(shape.rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
  }

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
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    ctx.strokeStyle = `hsl(${primaryColor})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (isHovered) {
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    ctx.strokeStyle = `hsl(${primaryColor} / 0.4)`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  
  ctx.restore();
}

function drawTemporaryShape(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  viewTransform: ViewTransform,
  tool: ToolType,
  canvasSize: { width: number; height: number }
) {
  if (points.length < 2) return;

  const canvasPoints = points.map(p => worldToCanvas(p, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height));

  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  ctx.strokeStyle = `hsl(${primaryColor})`;
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

function drawSnapIndicator(ctx: CanvasRenderingContext2D, point: Point, viewTransform: ViewTransform, canvasSize: { width: number; height: number }) {
  const canvasPoint = worldToCanvas(point, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
  
  const snapColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-snap').trim();
  ctx.fillStyle = `hsl(${snapColor})`;
  ctx.beginPath();
  ctx.arc(canvasPoint.x, canvasPoint.y, 4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = `hsl(${snapColor})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvasPoint.x, canvasPoint.y, 8, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  shape: FloorplanShape,
  viewTransform: ViewTransform,
  hoveredHandle: { shapeId: string; handle: HandleType } | null,
  canvasSize: { width: number; height: number }
) {
  const canvasVertices = shape.vertices.map(v => worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height));

  if (canvasVertices.length === 0) return;

  const xs = canvasVertices.map(v => v.x);
  const ys = canvasVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  ctx.save();
  
  // Apply rotation if present
  if (shape.rotation) {
    ctx.translate(centerX, centerY);
    ctx.rotate(shape.rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
  }

  const rotateHandleDistance = 30;
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
    { pos: { x: (minX + maxX) / 2, y: minY - rotateHandleDistance }, type: 'rotate' },
  ];

  const handleColor = getComputedStyle(document.documentElement).getPropertyValue('--handle').trim();
  const handleHoverColor = getComputedStyle(document.documentElement).getPropertyValue('--handle-hover').trim();
  
  handles.forEach(handle => {
    const isHovered = hoveredHandle?.handle === handle.type && hoveredHandle?.shapeId === shape.id;
    const size = isHovered ? 4 : 3;
    
    ctx.fillStyle = isHovered ? `hsl(${handleHoverColor})` : `hsl(${handleColor})`;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    if (handle.type === 'center') {
      ctx.beginPath();
      ctx.arc(handle.pos.x, handle.pos.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (handle.type === 'rotate') {
      ctx.beginPath();
      ctx.arc(handle.pos.x, handle.pos.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? `hsl(${handleHoverColor})` : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo((minX + maxX) / 2, minY);
      ctx.lineTo(handle.pos.x, handle.pos.y);
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
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
  
  ctx.restore();
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
  // First check bounding box with some tolerance for easier selection
  const tolerance = 0.5; // feet
  const bounds = {
    min: {
      x: Math.min(...shape.vertices.map(v => v.x)) - tolerance,
      y: Math.min(...shape.vertices.map(v => v.y)) - tolerance,
    },
    max: {
      x: Math.max(...shape.vertices.map(v => v.x)) + tolerance,
      y: Math.max(...shape.vertices.map(v => v.y)) + tolerance,
    },
  };

  if (point.x < bounds.min.x || point.x > bounds.max.x ||
      point.y < bounds.min.y || point.y > bounds.max.y) {
    return false;
  }

  // For polygons and rectangles, use ray casting algorithm for accurate point-in-polygon test
  if (shape.type === 'polygon' || shape.type === 'rectangle') {
    return pointInPolygon(point, shape.vertices);
  }

  // For lines and freehand, check if point is near any segment
  if (shape.type === 'line' || shape.type === 'freehand') {
    const threshold = 1.0; // feet
    for (let i = 0; i < shape.vertices.length - 1; i++) {
      if (distanceToSegment(point, shape.vertices[i], shape.vertices[i + 1]) < threshold) {
        return true;
      }
    }
    return false;
  }

  return true;
}

// Ray casting algorithm for point-in-polygon test
function pointInPolygon(point: Point, vertices: Point[]): boolean {
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

// Distance from point to line segment
function distanceToSegment(point: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((point.x - v.x) ** 2 + (point.y - v.y) ** 2);
  
  let t = ((point.x - v.x) * (w.x - v.x) + (point.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
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
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
) {
  if (shape.vertices.length < 2) return;

  for (let i = 0; i < shape.vertices.length; i++) {
    const j = (i + 1) % shape.vertices.length;
    
    if (shape.type === 'line' && i > 0) break;
    if (shape.type === 'freehand' && i >= shape.vertices.length - 1) break;

    const start = worldToCanvas(shape.vertices[i], viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    const end = worldToCanvas(shape.vertices[j], viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height);
    
    const dx = shape.vertices[j].x - shape.vertices[i].x;
    const dy = shape.vertices[j].y - shape.vertices[i].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    
    // Calculate offset position based on wall orientation
    // Place labels above horizontal walls, to the left of vertical walls
    const isHorizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
    const offsetDistance = 20; // pixels
    
    let labelX = midX;
    let labelY = midY;
    
    if (isHorizontal) {
      // For horizontal walls, place label above or below
      labelY = midY - offsetDistance;
    } else {
      // For vertical walls, place label to the left or right
      labelX = midX - offsetDistance;
    }
    
    ctx.save();
    
    const label = `${length.toFixed(1)} ft`;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const metrics = ctx.measureText(label);
    const padding = 4;
    const bgWidth = metrics.width + padding * 2;
    const bgHeight = 16;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(labelX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, labelX, labelY);
    
    ctx.restore();
  }
}

function findHandleAtPoint(
  shape: FloorplanShape,
  canvasPoint: Point,
  viewTransform: ViewTransform,
  canvasSize: { width: number; height: number }
): HandleType | null {
  const canvasVertices = shape.vertices.map(v => worldToCanvas(v, viewTransform, DEFAULT_EDITING_DPI, canvasSize.width, canvasSize.height));
  
  if (canvasVertices.length === 0) return null;

  const xs = canvasVertices.map(v => v.x);
  const ys = canvasVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rotateHandleDistance = 30;
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
    { pos: { x: (minX + maxX) / 2, y: minY - rotateHandleDistance }, type: 'rotate' },
  ];

  const hitRadius = 8; // pixels
  for (const handle of handles) {
    const dx = canvasPoint.x - handle.pos.x;
    const dy = canvasPoint.y - handle.pos.y;
    const radius = handle.type === 'rotate' ? 10 : hitRadius;
    if (Math.sqrt(dx * dx + dy * dy) <= radius) {
      return handle.type;
    }
  }

  return null;
}

function transformVertices(
  originalVertices: Point[],
  handle: HandleType,
  startPoint: Point,
  currentPoint: Point,
  shiftKey: boolean,
  altKey: boolean,
  shape: FloorplanShape
) {
  return improvedTransformVertices(originalVertices, handle, startPoint, currentPoint, shiftKey, altKey, shape);
}

function calculateShapeMeasurement(vertices: Point[]): { label: string; position: Point } | null {
  if (vertices.length < 2) return null;

  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;

  return {
    label: `${width.toFixed(2)} × ${height.toFixed(2)} ft`,
    position: { x: centerX, y: centerY },
  };
}
