import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ColorPicker } from "@/components/color-picker"
import { Tool } from "@/lib/types"
import {
  Pencil,
  Eraser,
  Type,
  Image,
  Hand,
  Undo,
  Redo,
} from "lucide-react"

interface ToolbarProps {
  tool: Tool;
  color: string;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar({
  tool,
  color,
  onToolChange,
  onColorChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div className="w-[50px] border-r bg-muted/40 flex flex-col items-center py-4 gap-4">
      <Button
        variant={tool === "hand" ? "secondary" : "ghost"}
        size="icon"
        className="rounded-full"
        onClick={() => onToolChange("hand")}
      >
        <Hand className="h-4 w-4" />
      </Button>
      <Separator className="w-8" />
      <Button
        variant={tool === "pencil" ? "secondary" : "ghost"}
        size="icon"
        className="rounded-full"
        onClick={() => onToolChange("pencil")}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant={tool === "eraser" ? "secondary" : "ghost"}
        size="icon"
        className="rounded-full"
        onClick={() => onToolChange("eraser")}
      >
        <Eraser className="h-4 w-4" />
      </Button>
      <Button
        variant={tool === "text" ? "secondary" : "ghost"}
        size="icon"
        className="rounded-full"
        onClick={() => onToolChange("text")}
      >
        <Type className="h-4 w-4" />
      </Button>
      <Button
        variant={tool === "image" ? "secondary" : "ghost"}
        size="icon"
        className="rounded-full"
        onClick={() => onToolChange("image")}
      >
        <Image className="h-4 w-4" />
      </Button>
      <ColorPicker color={color} onChange={onColorChange} />
      <Separator className="w-8" />
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={onUndo}
        disabled={!canUndo}
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={onRedo}
        disabled={!canRedo}
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  )
}