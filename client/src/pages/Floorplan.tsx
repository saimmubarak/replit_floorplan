import { useState, useCallback, useEffect } from "react";
import { WizardSteps } from "@/components/WizardSteps";
import { PlotSizePanel } from "@/components/PlotSizePanel";
import { HouseShapePanel } from "@/components/HouseShapePanel";
import { AddDoorsPanel } from "@/components/AddDoorsPanel";
import { FloorplanCanvas } from "@/components/FloorplanCanvas";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { Toolbar } from "@/components/Toolbar";
import { ExportDialog } from "@/components/ExportDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCreateProject, useUpdateProject, usePrepareExport } from "@/hooks/useFloorplanProject";
import {
  type WizardStep,
  type FloorplanShape,
  type ViewTransform,
  type ToolType,
  type ExportOptions,
  type Door,
  type DoorType,
  A2_WIDTH_FT,
  A2_HEIGHT_FT,
} from "@shared/schema";
import { ChevronLeft, ChevronRight } from "lucide-react";

const initialViewTransform: ViewTransform = {
  panX: 0,
  panY: 0,
  zoom: 1,
};

export default function Floorplan() {
  const { toast } = useToast();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const prepareExport = usePrepareExport();
  
  const [projectId, setProjectId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<WizardStep>('plot-size');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [shapes, setShapes] = useState<FloorplanShape[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [viewTransform, setViewTransform] = useState<ViewTransform>(initialViewTransform);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [doorPlacementMode, setDoorPlacementMode] = useState<{ active: boolean; doorType: DoorType; width: number }>({ active: false, doorType: 'single', width: 3 });

  const selectedShape = shapes.find(s => s.id === selectedShapeId) || null;

  // Initialize project on mount
  useEffect(() => {
    const initProject = async () => {
      if (!projectId) {
        try {
          const result = await createProject.mutateAsync({
            name: 'New Floorplan',
            currentStep: 'plot-size',
            shapes: [],
            viewTransform: initialViewTransform,
          });
          setProjectId(result.id);
        } catch (error) {
          console.error('Failed to initialize project:', error);
        }
      }
    };

    initProject();
  }, []);

  // Auto-save when shapes or view transform changes
  useEffect(() => {
    if (projectId) {
      const timeoutId = setTimeout(() => {
        updateProject.mutate({
          id: projectId,
          updates: {
            currentStep,
            shapes,
            viewTransform,
          },
        });
      }, 1000); // Debounce saves by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [shapes, viewTransform, currentStep, projectId]);

  // Wizard Navigation
  const handleNext = useCallback(() => {
    const stepOrder: WizardStep[] = ['plot-size', 'house-shape', 'add-doors', 'details', 'export-save'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    // Validate current step
    if (currentStep === 'plot-size' && shapes.length === 0) {
      toast({
        title: "Plot Required",
        description: "Please create a plot boundary before proceeding.",
        variant: "destructive",
      });
      return;
    }
    
    if (currentIndex < stepOrder.length - 1) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  }, [currentStep, completedSteps, shapes.length, toast]);

  const handlePrevious = useCallback(() => {
    const stepOrder: WizardStep[] = ['plot-size', 'house-shape', 'add-doors', 'details', 'export-save'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }, [currentStep]);

  // Plot Creation
  const handleCreatePreset = useCallback((width: number, height: number) => {
    // Center the plot on the A2 canvas
    const centerX = A2_WIDTH_FT / 2;
    const centerY = A2_HEIGHT_FT / 2;
    const startX = centerX - (width / 2);
    const startY = centerY - (height / 2);
    
    const newShape: FloorplanShape = {
      id: crypto.randomUUID(),
      type: 'rectangle',
      vertices: [
        { x: startX, y: startY },
        { x: startX + width, y: startY },
        { x: startX + width, y: startY + height },
        { x: startX, y: startY + height },
      ],
      strokeMm: 0.25,
      strokeColor: '#1e3a8a', // Dark blue
      layer: 'plot',
      labelVisibility: true,
      lockAspect: false,
      name: 'Plot Boundary',
      rotation: 0,
    };

    setShapes([newShape]);
    setSelectedShapeId(newShape.id);
    toast({
      title: "Plot Created",
      description: `Created ${width} × ${height} ft plot boundary`,
    });
  }, [toast]);

  const handleStartCustomDraw = useCallback(() => {
    setActiveTool('freehand');
    toast({
      title: "Custom Draw Mode",
      description: "Draw your custom boundary. Click 'Esc' or right-click when done.",
    });
  }, [toast]);

  const handleReset = useCallback(() => {
    setShapes([]);
    setSelectedShapeId(null);
    toast({
      title: "Plot Reset",
      description: "All shapes have been removed",
    });
  }, [toast]);

  // House Shape Creation
  const handleCreateHouseShape = useCallback((shapeType: 'rectangular' | 'l-shaped' | 'mirror-l' | 'u-shaped') => {
    // Find the plot boundary to center the house inside it
    const plotShape = shapes.find(s => s.layer === 'plot');
    if (!plotShape) {
      toast({
        title: "No Plot Found",
        description: "Please create a plot boundary first",
        variant: "destructive",
      });
      return;
    }

    // Calculate plot center
    const plotXs = plotShape.vertices.map(v => v.x);
    const plotYs = plotShape.vertices.map(v => v.y);
    const plotCenterX = (Math.min(...plotXs) + Math.max(...plotXs)) / 2;
    const plotCenterY = (Math.min(...plotYs) + Math.max(...plotYs)) / 2;

    // Default house size ~10 ft
    const size = 10;
    let vertices: { x: number; y: number }[] = [];

    // Generate vertices based on shape type
    switch (shapeType) {
      case 'rectangular':
        vertices = [
          { x: plotCenterX - size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY + size / 2 },
          { x: plotCenterX - size / 2, y: plotCenterY + size / 2 },
        ];
        break;
      case 'l-shaped':
        vertices = [
          { x: plotCenterX - size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY },
          { x: plotCenterX, y: plotCenterY },
          { x: plotCenterX, y: plotCenterY + size / 2 },
          { x: plotCenterX - size / 2, y: plotCenterY + size / 2 },
        ];
        break;
      case 'mirror-l':
        vertices = [
          { x: plotCenterX - size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY + size / 2 },
          { x: plotCenterX, y: plotCenterY + size / 2 },
          { x: plotCenterX, y: plotCenterY },
          { x: plotCenterX - size / 2, y: plotCenterY },
        ];
        break;
      case 'u-shaped':
        vertices = [
          { x: plotCenterX - size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX - size / 4, y: plotCenterY - size / 2 },
          { x: plotCenterX - size / 4, y: plotCenterY + size / 4 },
          { x: plotCenterX + size / 4, y: plotCenterY + size / 4 },
          { x: plotCenterX + size / 4, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY - size / 2 },
          { x: plotCenterX + size / 2, y: plotCenterY + size / 2 },
          { x: plotCenterX - size / 2, y: plotCenterY + size / 2 },
        ];
        break;
    }

    const newShape: FloorplanShape = {
      id: crypto.randomUUID(),
      type: 'polygon',
      vertices,
      strokeMm: 0.25,
      strokeColor: '#9a3412', // Brick red
      layer: 'house',
      labelVisibility: true,
      lockAspect: false,
      name: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} House`,
      rotation: 0,
    };

    setShapes([...shapes, newShape]);
    setSelectedShapeId(newShape.id);
    toast({
      title: "House Shape Created",
      description: `Added ${shapeType} house outline`,
    });
  }, [shapes, toast]);

  const handleStartHouseCustomDraw = useCallback(() => {
    setActiveTool('polygon');
    toast({
      title: "Custom House Draw Mode",
      description: "Click to draw house outline. Right-click or Esc when done.",
    });
  }, [toast]);

  // Door Management
  const handleAddDoor = useCallback((doorType: DoorType, width: number) => {
    setDoorPlacementMode({ active: true, doorType, width });
    setActiveTool('select');
    toast({
      title: "Door Placement Mode",
      description: "Click on a house wall to place the door",
    });
  }, [toast]);

  const handlePlaceDoor = useCallback((door: Door) => {
    setDoors([...doors, door]);
    setDoorPlacementMode({ active: false, doorType: 'single', width: 3 });
    toast({
      title: "Door Added",
      description: "Door placed on wall successfully",
    });
  }, [doors, toast]);

  const handleUpdateDoor = useCallback((doorId: string, updates: Partial<Door>) => {
    setDoors(doors.map(d => d.id === doorId ? { ...d, ...updates } : d));
  }, [doors]);

  const handleDeleteDoor = useCallback((doorId: string) => {
    setDoors(doors.filter(d => d.id !== doorId));
    if (selectedDoorId === doorId) {
      setSelectedDoorId(null);
    }
  }, [doors, selectedDoorId]);

  // Shape Updates
  const handleUpdateShape = useCallback((updates: Partial<FloorplanShape>) => {
    if (!selectedShapeId) return;

    setShapes(shapes.map(s =>
      s.id === selectedShapeId ? { ...s, ...updates } : s
    ));
  }, [selectedShapeId, shapes]);

  // View Controls
  const handleZoomIn = useCallback(() => {
    setViewTransform(t => ({ ...t, zoom: Math.min(t.zoom * 1.2, 5) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewTransform(t => ({ ...t, zoom: Math.max(t.zoom / 1.2, 0.1) }));
  }, []);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < commandHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, commandHistory.length]);

  // Export
  const handleExport = useCallback(async (options: ExportOptions) => {
    try {
      const result = await prepareExport.mutateAsync({
        shapes,
        options,
      });
      
      console.log('Export data prepared:', result);
      toast({
        title: "Export Ready",
        description: `${options.format.toUpperCase()} export prepared at ${options.dpi} DPI`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to prepare export data",
        variant: "destructive",
      });
    }
  }, [shapes, prepareExport, toast]);

  // Save
  const handleSave = useCallback(async () => {
    try {
      if (!projectId) {
        // Create new project
        const result = await createProject.mutateAsync({
          name: 'Floorplan Project',
          currentStep,
          shapes,
          viewTransform,
        });
        setProjectId(result.id);
        toast({
          title: "Project Created",
          description: "Your floorplan has been saved successfully",
        });
      } else {
        // Update existing project
        await updateProject.mutateAsync({
          id: projectId,
          updates: {
            currentStep,
            shapes,
            viewTransform,
          },
        });
        toast({
          title: "Project Saved",
          description: "Your floorplan has been updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save your floorplan",
        variant: "destructive",
      });
    }
  }, [projectId, currentStep, shapes, viewTransform, createProject, updateProject, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tool shortcuts
      if (e.key === '1') setActiveTool('select');
      if (e.key === '2') setActiveTool('line');
      if (e.key === '3') setActiveTool('rectangle');
      if (e.key === '4') setActiveTool('polygon');
      if (e.key === '5') setActiveTool('freehand');
      if (e.key === '6') setActiveTool('delete');
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setActiveTool(prev => prev === 'pan' ? 'select' : 'pan');
      }

      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        }
        if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
        if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }

      // Delete selected shape or door
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (selectedShapeId) {
          setShapes(shapes.filter(s => s.id !== selectedShapeId));
          setSelectedShapeId(null);
        } else if (selectedDoorId) {
          handleDeleteDoor(selectedDoorId);
        }
      }

      // Toggle grid
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        setGridEnabled(!gridEnabled);
      }

      // Toggle snap
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        setSnapEnabled(!snapEnabled);
      }

      // Escape to cancel door placement
      if (e.key === 'Escape' && doorPlacementMode.active) {
        setDoorPlacementMode({ active: false, doorType: 'single', width: 3 });
        toast({
          title: "Cancelled",
          description: "Door placement cancelled",
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, selectedDoorId, shapes, gridEnabled, snapEnabled, doorPlacementMode.active, handleUndo, handleRedo, handleSave, handleDeleteDoor, toast]);

  const getStepPrompt = (): string => {
    switch (currentStep) {
      case 'plot-size':
        return 'Guide us on how big your house is. Choose a plot or draw custom.';
      case 'house-shape':
        return 'Tell us about house shape.';
      case 'add-doors':
        return 'Add doors to your house walls. Click a wall segment to place doors.';
      case 'details':
        return 'Add walls, paths, and other details to your floorplan';
      case 'export-save':
        return 'Export your floorplan or save your progress';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Steps Bar */}
      <div className="h-20 border-b px-8 flex items-center justify-between bg-muted/20">
        <WizardSteps
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={setCurrentStep}
        />
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 'plot-size'}
            data-testid="button-previous"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentStep === 'export-save'}
            data-testid="button-next"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 border-r bg-muted/5 overflow-y-auto flex-shrink-0 shadow-sm">
          {currentStep === 'plot-size' && (
            <PlotSizePanel
              onCreatePreset={handleCreatePreset}
              onStartCustomDraw={handleStartCustomDraw}
              onReset={handleReset}
              hasPlot={shapes.length > 0}
            />
          )}
          {currentStep === 'house-shape' && (
            <HouseShapePanel
              onCreateHouseShape={handleCreateHouseShape}
              onStartCustomDraw={handleStartHouseCustomDraw}
            />
          )}
          {currentStep === 'add-doors' && (
            <AddDoorsPanel
              onAddDoor={handleAddDoor}
              isPlacementMode={doorPlacementMode.active}
            />
          )}
          {currentStep === 'details' && (
            <div className="p-4">
              <h3 className="text-base font-semibold mb-4">Add Details</h3>
              <p className="text-sm text-muted-foreground">
                Add walls, rooms, and architectural details to your floorplan
              </p>
            </div>
          )}
          {currentStep === 'export-save' && (
            <div className="p-4">
              <h3 className="text-base font-semibold mb-4">Export & Save</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your floorplan is ready for export
              </p>
              <Button
                onClick={() => setExportDialogOpen(true)}
                className="w-full"
                data-testid="button-open-export"
              >
                Configure Export
              </Button>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <FloorplanCanvas
              shapes={shapes}
              doors={doors}
              viewTransform={viewTransform}
              selectedShapeId={selectedShapeId}
              selectedDoorId={selectedDoorId}
              activeTool={activeTool}
              gridEnabled={gridEnabled}
              snapEnabled={snapEnabled}
              currentStep={currentStep}
              doorPlacementMode={doorPlacementMode}
              onShapesChange={setShapes}
              onDoorsChange={setDoors}
              onViewTransformChange={setViewTransform}
              onSelectShape={setSelectedShapeId}
              onSelectDoor={setSelectedDoorId}
              onPlaceDoor={handlePlaceDoor}
            />
          </div>

          {/* Step Prompt */}
          <div className="h-14 border-t px-6 flex items-center bg-muted/20">
            <p className="text-sm font-medium text-foreground">{getStepPrompt()}</p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 border-l bg-muted/5 overflow-y-auto flex-shrink-0 shadow-sm">
          <PropertiesPanel
            selectedShape={selectedShape}
            onUpdateShape={handleUpdateShape}
          />
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        gridEnabled={gridEnabled}
        snapEnabled={snapEnabled}
        onToggleGrid={() => setGridEnabled(!gridEnabled)}
        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={() => setExportDialogOpen(true)}
        onSave={handleSave}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < commandHistory.length - 1}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
      />
    </div>
  );
}
