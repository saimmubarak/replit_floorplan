import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { type FloorplanShape } from "@shared/schema";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertiesPanelProps {
  selectedShape: FloorplanShape | null;
  onUpdateShape: (updates: Partial<FloorplanShape>) => void;
}

export function PropertiesPanel({ selectedShape, onUpdateShape }: PropertiesPanelProps) {
  if (!selectedShape) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Select a shape to view and edit its properties
        </p>
      </div>
    );
  }

  const bounds = getShapeBounds(selectedShape);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto" data-testid="properties-panel">
      {/* Object Info */}
      <div>
        <h3 className="text-base font-semibold mb-4">Object Info</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-1.5">Type</Label>
            <div className="text-sm font-mono text-muted-foreground capitalize">
              {selectedShape.type}
            </div>
          </div>
          {selectedShape.name && (
            <div>
              <Label className="text-sm mb-1.5">Name</Label>
              <div className="text-sm text-muted-foreground">
                {selectedShape.name}
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Dimensions */}
      <div>
        <h3 className="text-base font-semibold mb-4">Dimensions</h3>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <div>
            <Label htmlFor="prop-width" className="text-sm mb-1.5">Width</Label>
            <div className="relative">
              <Input
                id="prop-width"
                type="number"
                value={width.toFixed(1)}
                readOnly
                className="font-mono pr-10"
                data-testid="property-width"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ft
              </span>
            </div>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onUpdateShape({ lockAspect: !selectedShape.lockAspect })}
            className="mb-0.5"
            data-testid="button-lock-aspect"
          >
            {selectedShape.lockAspect ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </Button>

          <div>
            <Label htmlFor="prop-height" className="text-sm mb-1.5">Height</Label>
            <div className="relative">
              <Input
                id="prop-height"
                type="number"
                value={height.toFixed(1)}
                readOnly
                className="font-mono pr-10"
                data-testid="property-height"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ft
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Appearance */}
      <div>
        <h3 className="text-base font-semibold mb-4">Appearance</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="stroke-width" className="text-sm mb-1.5">Stroke Weight</Label>
            <div className="relative">
              <Input
                id="stroke-width"
                type="number"
                value={selectedShape.strokeMm}
                onChange={(e) => onUpdateShape({ strokeMm: parseFloat(e.target.value) })}
                className="font-mono pr-12"
                min="0.1"
                step="0.05"
                data-testid="property-stroke-mm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                mm
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="stroke-color" className="text-sm mb-1.5">Stroke Color</Label>
            <div className="flex gap-2">
              <Input
                id="stroke-color"
                type="color"
                value={selectedShape.strokeColor}
                onChange={(e) => onUpdateShape({ strokeColor: e.target.value })}
                className="h-10 w-20 cursor-pointer"
                data-testid="property-stroke-color"
              />
              <Input
                type="text"
                value={selectedShape.strokeColor}
                onChange={(e) => onUpdateShape({ strokeColor: e.target.value })}
                className="flex-1 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Behavior */}
      <div>
        <h3 className="text-base font-semibold mb-4">Behavior</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="layer" className="text-sm mb-1.5">Layer</Label>
            <Input
              id="layer"
              value={selectedShape.layer}
              onChange={(e) => onUpdateShape({ layer: e.target.value })}
              data-testid="property-layer"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="label-visibility" className="text-sm">
              Show Measurements
            </Label>
            <Switch
              id="label-visibility"
              checked={selectedShape.labelVisibility}
              onCheckedChange={(checked) => onUpdateShape({ labelVisibility: checked })}
              data-testid="property-label-visibility"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function getShapeBounds(shape: FloorplanShape): { min: { x: number; y: number }; max: { x: number; y: number } } {
  if (shape.vertices.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }

  const xs = shape.vertices.map(v => v.x);
  const ys = shape.vertices.map(v => v.y);

  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}
