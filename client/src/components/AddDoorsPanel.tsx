import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type DoorType } from "@shared/schema";
import { DoorClosed } from "lucide-react";

interface AddDoorsPanelProps {
  onAddDoor: (doorType: DoorType, width: number) => void;
  isPlacementMode: boolean;
}

export function AddDoorsPanel({ onAddDoor, isPlacementMode }: AddDoorsPanelProps) {
  const [doorType, setDoorType] = useState<DoorType>('single');
  const [width, setWidth] = useState<number>(3);

  const presetWidths = {
    single: [3, 3.5, 4],
    double: [5, 6, 7],
  };

  const handleAddDoor = () => {
    onAddDoor(doorType, width);
  };

  return (
    <div className="flex flex-col gap-6 p-4" data-testid="add-doors-panel">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Add doors to your house walls. Click "Add Door" then click on a wall segment to place.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold mb-3 block">Door Type</Label>
            <RadioGroup value={doorType} onValueChange={(value) => setDoorType(value as DoorType)} data-testid="door-type-radio">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" data-testid="radio-single" />
                <Label htmlFor="single" className="cursor-pointer">Single Door</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="double" id="double" data-testid="radio-double" />
                <Label htmlFor="double" className="cursor-pointer">Double Door</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="width" className="text-base font-semibold mb-2 block">
              Width (feet)
            </Label>
            <Input
              id="width"
              type="number"
              min="2"
              max="15"
              step="0.5"
              value={width}
              onChange={(e) => setWidth(parseFloat(e.target.value) || 3)}
              className="mb-2"
              data-testid="input-door-width"
            />
            <div className="flex gap-2">
              {presetWidths[doorType].map((presetWidth) => (
                <Button
                  key={presetWidth}
                  variant="outline"
                  size="sm"
                  onClick={() => setWidth(presetWidth)}
                  className="flex-1"
                  data-testid={`preset-${presetWidth}`}
                >
                  {presetWidth} ft
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleAddDoor}
            className="w-full"
            variant={isPlacementMode ? "default" : "outline"}
            data-testid="button-add-door"
          >
            <DoorClosed className="w-4 h-4 mr-2" />
            {isPlacementMode ? "Placing Door (click wall)" : "Add Door"}
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-0.5">
          <li>• Click a wall segment to place the door</li>
          <li>• Doors must be placed on house walls only</li>
          <li>• Use select tool to move or resize doors</li>
          <li>• Doors can be moved along their wall</li>
        </ul>
      </div>
    </div>
  );
}
