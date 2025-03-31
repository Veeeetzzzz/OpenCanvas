import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const colors = [
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#008000",
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full relative"
        >
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: color }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2">
        <div className="grid grid-cols-5 gap-1">
          {colors.map((c) => (
            <Button
              key={c}
              variant="ghost"
              size="icon"
              className="rounded-full p-0 h-6 w-6"
              onClick={() => onChange(c)}
            >
              <div
                className="w-full h-full rounded-full"
                style={{ backgroundColor: c }}
              />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}