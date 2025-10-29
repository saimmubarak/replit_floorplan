import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type ToolType } from "@shared/schema";
import { Pencil, Square, Pentagon } from "lucide-react";

interface WallsPanelProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export function WallsPanel({ activeTool, onToolChange }: WallsPanelProps) {
  return (
    <div className="flex flex-col gap-6 p-4" data-testid="walls-panel">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Draw walls using the polygon tool. Walls will be drawn in purple with a decorative brick pattern.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold mb-3 block">Drawing Tools</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={activeTool === 'line' ? 'default' : 'outline'}
                onClick={() => onToolChange('line')}
                className="w-full"
                data-testid="button-line-tool"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Line
              </Button>
              <Button
                variant={activeTool === 'rectangle' ? 'default' : 'outline'}
                onClick={() => onToolChange('rectangle')}
                className="w-full"
                data-testid="button-rectangle-tool"
              >
                <Square className="w-4 h-4 mr-2" />
                Rectangle
              </Button>
              <Button
                variant={activeTool === 'polygon' ? 'default' : 'outline'}
                onClick={() => onToolChange('polygon')}
                className="w-full col-span-2"
                data-testid="button-polygon-tool"
              >
                <Pentagon className="w-4 h-4 mr-2" />
                Polygon
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-0.5">
          <li>• Use line tool for single wall segments</li>
          <li>• Use rectangle for room outlines</li>
          <li>• Use polygon tool for complex shapes</li>
          <li>• Click multiple points for polygon</li>
          <li>• Right-click or press Esc to finish polygon</li>
          <li>• Walls will be colored purple automatically</li>
        </ul>
      </div>
    </div>
  );
}
