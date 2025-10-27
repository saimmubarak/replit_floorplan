import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PRESET_PLOTS } from "@shared/schema";
import { Ruler, Edit3 } from "lucide-react";

interface PlotSizePanelProps {
  onCreatePreset: (width: number, height: number) => void;
  onStartCustomDraw: () => void;
  onReset: () => void;
  hasPlot: boolean;
}

export function PlotSizePanel({ onCreatePreset, onStartCustomDraw, onReset, hasPlot }: PlotSizePanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customWidth, setCustomWidth] = useState<string>("50");
  const [customHeight, setCustomHeight] = useState<string>("50");

  const handlePresetSelect = (key: string) => {
    setSelectedPreset(key);
    const preset = PRESET_PLOTS[key as keyof typeof PRESET_PLOTS];
    setCustomWidth(preset.width.toString());
    setCustomHeight(preset.height.toString());
  };

  const handleCreate = () => {
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);
    
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      onCreatePreset(width, height);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4" data-testid="plot-size-panel">
      <div>
        <h3 className="text-base font-semibold mb-4">Select Plot Size</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PRESET_PLOTS).map(([key, preset]) => (
            <Card
              key={key}
              onClick={() => handlePresetSelect(key)}
              className={`
                p-4 cursor-pointer transition-all hover-elevate
                ${selectedPreset === key ? 'ring-2 ring-primary border-primary' : 'border-2'}
              `}
              data-testid={`preset-${key}`}
            >
              <div className="flex flex-col items-center gap-2">
                <Ruler className="w-6 h-6 text-primary" />
                <div className="text-sm font-medium text-center">{preset.name}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  {preset.width} × {preset.height} ft
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-base font-semibold mb-4">Custom Dimensions</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="width" className="text-sm mb-1.5">Width</Label>
            <div className="relative">
              <Input
                id="width"
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="font-mono pr-10"
                min="1"
                step="0.1"
                data-testid="input-width"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ft
              </span>
            </div>
          </div>
          <div>
            <Label htmlFor="height" className="text-sm mb-1.5">Height</Label>
            <div className="relative">
              <Input
                id="height"
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                className="font-mono pr-10"
                min="1"
                step="0.1"
                data-testid="input-height"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ft
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-6 flex flex-col gap-3">
        <Button
          onClick={handleCreate}
          className="w-full"
          size="default"
          data-testid="button-create-plot"
        >
          Create Plot Boundary
        </Button>
        
        <Button
          onClick={onStartCustomDraw}
          variant="outline"
          className="w-full"
          data-testid="button-custom-draw"
        >
          <Edit3 className="w-4 h-4 mr-2" />
          Use Custom Draw
        </Button>

        {hasPlot && (
          <Button
            onClick={onReset}
            variant="destructive"
            className="w-full"
            data-testid="button-reset"
          >
            Reset Plot
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p className="font-medium mb-1">Keyboard Shortcuts:</p>
        <ul className="space-y-0.5">
          <li>• Space - Toggle pan mode</li>
          <li>• Shift - Constrain aspect ratio</li>
          <li>• Alt - Symmetric scaling</li>
        </ul>
      </div>
    </div>
  );
}
