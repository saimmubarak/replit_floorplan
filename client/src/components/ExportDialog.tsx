import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { type ExportFormat, type ExportDPI, type ExportOptions } from "@shared/schema";
import { Download } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => void;
}

export function ExportDialog({ open, onOpenChange, onExport }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [dpi, setDpi] = useState<ExportDPI>('300');
  const [includeGrid, setIncludeGrid] = useState(false);
  const [includeMeasurements, setIncludeMeasurements] = useState(true);

  const handleExport = () => {
    onExport({
      format,
      dpi,
      includeGrid,
      includeMeasurements,
    });
    onOpenChange(false);
  };

  const getDpiInfo = (dpiValue: ExportDPI): { description: string; pixelsPerFoot: string; strokePx: string } => {
    const dpiNum = parseInt(dpiValue);
    const ppf = (dpiNum / 3.1).toFixed(14);
    const stroke = ((0.25 / 25.4) * dpiNum).toFixed(14);
    
    const descriptions = {
      '96': 'Screen quality (fastest)',
      '150': 'Low print quality',
      '300': 'High print quality',
      '600': 'Professional print (slowest)',
    };
    
    return {
      description: descriptions[dpiValue],
      pixelsPerFoot: ppf,
      strokePx: stroke,
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="export-dialog">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Export Floorplan</DialogTitle>
          <DialogDescription>
            Configure export settings for your floorplan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="png" id="format-png" data-testid="format-png" />
                <Label htmlFor="format-png" className="font-normal cursor-pointer">
                  PNG Image
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="format-pdf" data-testid="format-pdf" />
                <Label htmlFor="format-pdf" className="font-normal cursor-pointer">
                  PDF Document
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* DPI Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Resolution (DPI)</Label>
            <RadioGroup value={dpi} onValueChange={(v) => setDpi(v as ExportDPI)}>
              <div className="grid grid-cols-2 gap-3">
                {(['96', '150', '300', '600'] as ExportDPI[]).map((dpiValue) => {
                  const info = getDpiInfo(dpiValue);
                  return (
                    <div
                      key={dpiValue}
                      className={`
                        relative flex flex-col p-3 rounded-lg border-2 cursor-pointer
                        transition-all hover-elevate
                        ${dpi === dpiValue ? 'border-primary bg-primary/5' : 'border-border'}
                      `}
                      onClick={() => setDpi(dpiValue)}
                    >
                      <div className="flex items-center space-x-2 mb-1.5">
                        <RadioGroupItem
                          value={dpiValue}
                          id={`dpi-${dpiValue}`}
                          data-testid={`dpi-${dpiValue}`}
                        />
                        <Label
                          htmlFor={`dpi-${dpiValue}`}
                          className="font-mono font-semibold cursor-pointer"
                        >
                          {dpiValue} DPI
                        </Label>
                      </div>
                      <div className="text-xs text-muted-foreground pl-6">
                        {info.description}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground pl-6 mt-1 space-y-0.5">
                        <div>px/ft: {parseFloat(info.pixelsPerFoot).toFixed(2)}</div>
                        <div>0.25mm: {parseFloat(info.strokePx).toFixed(2)}px</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Export Options */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="include-grid" className="text-sm">
                Include Grid
              </Label>
              <Switch
                id="include-grid"
                checked={includeGrid}
                onCheckedChange={setIncludeGrid}
                data-testid="switch-include-grid"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="include-measurements" className="text-sm">
                Include Measurements
              </Label>
              <Switch
                id="include-measurements"
                checked={includeMeasurements}
                onCheckedChange={setIncludeMeasurements}
                data-testid="switch-include-measurements"
              />
            </div>
          </div>

          {/* Technical Details */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md font-mono">
            <p className="mb-1">Stroke weight: 0.25mm physical</p>
            <p>
              {dpi === '96' && 'Pixels per foot: 30.97, Stroke: 0.94px'}
              {dpi === '150' && 'Pixels per foot: 48.39, Stroke: 1.48px'}
              {dpi === '300' && 'Pixels per foot: 96.77, Stroke: 2.95px'}
              {dpi === '600' && 'Pixels per foot: 193.55, Stroke: 5.91px'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-export">
            Cancel
          </Button>
          <Button onClick={handleExport} data-testid="button-confirm-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
