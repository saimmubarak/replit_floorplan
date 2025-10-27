import { Button } from "@/components/ui/button";
import { Square, Edit3 } from "lucide-react";

interface HouseShapePanelProps {
  onCreateHouseShape: (shapeType: 'rectangular' | 'l-shaped' | 'mirror-l' | 'u-shaped') => void;
  onStartCustomDraw: () => void;
}

// Icon component for L-shape
const LShapeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4 L4 16 L16 16 L16 10 L10 10 L10 4 Z" />
  </svg>
);

// Icon component for Mirror L-shape
const MirrorLIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4 L16 16 L4 16 L4 10 L10 10 L10 4 Z" />
  </svg>
);

// Icon component for U-shape
const UShapeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4 L4 16 L16 16 L16 4 L12 4 L12 12 L8 12 L8 4 Z" />
  </svg>
);

export function HouseShapePanel({ onCreateHouseShape, onStartCustomDraw }: HouseShapePanelProps) {
  const shapeOptions = [
    { id: 'rectangular' as const, name: 'Rectangular', Icon: Square },
    { id: 'l-shaped' as const, name: 'L-shaped', Icon: LShapeIcon },
    { id: 'mirror-l' as const, name: 'Mirror L', Icon: MirrorLIcon },
    { id: 'u-shaped' as const, name: 'U-shaped', Icon: UShapeIcon },
  ];

  return (
    <div className="flex flex-col gap-6 p-4" data-testid="house-shape-panel">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Tell us about house shape.
        </p>
        <h3 className="text-base font-semibold mb-3">Select House Shape</h3>
        <div className="grid grid-cols-2 gap-3">
          {shapeOptions.map(({ id, name, Icon }) => (
            <Button
              key={id}
              variant="outline"
              onClick={() => onCreateHouseShape(id)}
              className="h-auto py-4 flex-col gap-1"
              data-testid={`shape-${id}`}
            >
              <Icon className="w-5 h-5" />
              <div className="text-sm font-medium">{name}</div>
            </Button>
          ))}
          <Button
            variant="outline"
            onClick={onStartCustomDraw}
            className="h-auto py-4 flex-col gap-1"
            data-testid="shape-custom"
          >
            <Edit3 className="w-5 h-5" />
            <div className="text-sm font-medium">Custom</div>
            <div className="text-xs opacity-80">Draw</div>
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-0.5">
          <li>• Use handles to stretch and resize</li>
          <li>• Use numeric fields for exact dimensions</li>
          <li>• Shapes are placed centered in your plot</li>
        </ul>
      </div>
    </div>
  );
}
