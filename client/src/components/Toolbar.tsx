import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Minus,
  Square,
  Pentagon,
  Pencil,
  Hand,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  Magnet,
  Undo,
  Redo,
  Download,
  Save,
} from "lucide-react";
import { type ToolType } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  gridEnabled: boolean;
  snapEnabled: boolean;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const tools = [
  { type: 'select' as ToolType, icon: MousePointer2, label: 'Select (1)', shortcut: '1' },
  { type: 'line' as ToolType, icon: Minus, label: 'Line (2)', shortcut: '2' },
  { type: 'rectangle' as ToolType, icon: Square, label: 'Rectangle (3)', shortcut: '3' },
  { type: 'polygon' as ToolType, icon: Pentagon, label: 'Polygon (4)', shortcut: '4' },
  { type: 'freehand' as ToolType, icon: Pencil, label: 'Freehand (5)', shortcut: '5' },
  { type: 'pan' as ToolType, icon: Hand, label: 'Pan (Space)', shortcut: 'Space' },
];

export function Toolbar({
  activeTool,
  onToolChange,
  gridEnabled,
  snapEnabled,
  onToggleGrid,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  onExport,
  onSave,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-14 border-t bg-background/95 backdrop-blur-sm z-50"
      data-testid="toolbar"
    >
      <div className="h-full px-4 flex items-center justify-center gap-1">
        {/* Drawing Tools */}
        <div className="flex items-center gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.type;
            
            return (
              <Tooltip key={tool.type}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={isActive ? 'default' : 'ghost'}
                    onClick={() => onToolChange(tool.type)}
                    className={isActive ? 'ring-2 ring-primary/20' : ''}
                    data-testid={`tool-${tool.type}`}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{tool.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />

        {/* View Controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onZoomIn}
                data-testid="button-zoom-in"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Zoom In</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onZoomOut}
                data-testid="button-zoom-out"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Zoom Out</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={gridEnabled ? 'default' : 'ghost'}
                onClick={onToggleGrid}
                className={gridEnabled ? 'ring-2 ring-primary/20' : ''}
                data-testid="button-toggle-grid"
              >
                <Grid3x3 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Toggle Grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={snapEnabled ? 'default' : 'ghost'}
                onClick={onToggleSnap}
                className={snapEnabled ? 'ring-2 ring-primary/20' : ''}
                data-testid="button-toggle-snap"
              >
                <Magnet className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Toggle Snap</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />

        {/* History */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onUndo}
                disabled={!canUndo}
                data-testid="button-undo"
              >
                <Undo className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onRedo}
                disabled={!canRedo}
                data-testid="button-redo"
              >
                <Redo className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onExport}
                data-testid="button-export"
              >
                <Download className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Export</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onSave}
                data-testid="button-save"
              >
                <Save className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Save (Ctrl+S)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
