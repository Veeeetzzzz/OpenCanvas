import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ColorPicker } from "@/components/color-picker"
import { Slider } from "@/components/ui/slider"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface ToolbarProps {
  tool: Tool;
  color: string;
  pencilWidth: number;
  eraserWidth: number;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onPencilWidthChange: (width: number) => void;
  onEraserWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showTooltips?: boolean;
}

export function Toolbar({
  tool,
  color,
  pencilWidth,
  eraserWidth,
  onToolChange,
  onColorChange,
  onPencilWidthChange,
  onEraserWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showTooltips = true,
}: ToolbarProps) {
  const TooltipButton = ({
    tooltipText,
    children,
    disabled = false,
  }: {
    tooltipText: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => {
    if (!showTooltips || disabled) {
      return <>{children}</>;
    }
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="w-[60px] border-r bg-muted/40 flex flex-col items-center py-4 gap-4">
      <TooltipButton tooltipText="Select / Move (V)">
        <Button
          variant={tool === "hand" ? "secondary" : "ghost"}
          size="icon"
          className="rounded-full"
          onClick={() => onToolChange("hand")}
          aria-label="Select / Move Tool"
        >
          <Hand className="h-4 w-4" />
        </Button>
      </TooltipButton>
      <Separator className="w-8" />
      <TooltipButton tooltipText="Pencil (P)">
        <Button
          variant={tool === "pencil" ? "secondary" : "ghost"}
          size="icon"
          className="rounded-full"
          onClick={() => onToolChange("pencil")}
          aria-label="Pencil Tool"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </TooltipButton>
      {tool === 'pencil' && (
        <>
          <div className="px-2 w-full flex flex-col items-center gap-1 mt-1">
            <span className="text-xs text-muted-foreground">Thickness</span>
            <Slider
              value={[pencilWidth]}
              onValueChange={([value]) => onPencilWidthChange(value)}
              min={1}
              max={50}
              step={1}
              className="w-full"
              aria-label="Pencil Thickness"
            />
            <span className="text-xs text-muted-foreground">{pencilWidth}px</span>
          </div>
          <div className="pt-2">
            <ColorPicker color={color} onChange={onColorChange} />
          </div>
        </>
      )}
      <TooltipButton tooltipText="Eraser (E)">
        <Button
          variant={tool === "eraser" ? "secondary" : "ghost"}
          size="icon"
          className="rounded-full"
          onClick={() => onToolChange("eraser")}
          aria-label="Eraser Tool"
        >
          <Eraser className="h-4 w-4" />
        </Button>
      </TooltipButton>
      {tool === 'eraser' && (
        <>
          <div className="px-2 w-full flex flex-col items-center gap-1 mt-1">
            <span className="text-xs text-muted-foreground">Size</span>
            <Slider
              value={[eraserWidth]}
              onValueChange={([value]) => onEraserWidthChange(value)}
              min={1}
              max={100}
              step={1}
              className="w-full"
              aria-label="Eraser Size"
            />
            <span className="text-xs text-muted-foreground">{eraserWidth}px</span>
          </div>
        </>
      )}
      <TooltipButton tooltipText="Text (T)">
        <Button
          variant={tool === "text" ? "secondary" : "ghost"}
          size="icon"
          className="rounded-full"
          onClick={() => onToolChange("text")}
          aria-label="Text Tool"
        >
          <Type className="h-4 w-4" />
        </Button>
      </TooltipButton>
      <TooltipButton tooltipText="Image (I)">
        <Button
          variant={tool === "image" ? "secondary" : "ghost"}
          size="icon"
          className="rounded-full"
          onClick={() => onToolChange("image")}
          aria-label="Image Tool"
        >
          <Image className="h-4 w-4" />
        </Button>
      </TooltipButton>
      <Separator className="w-8 mt-auto" />
      <TooltipButton tooltipText="Undo (Ctrl+Z)" disabled={!canUndo}>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo Action"
        >
          <Undo className="h-4 w-4" />
        </Button>
      </TooltipButton>
      <TooltipButton tooltipText="Redo (Ctrl+Y)" disabled={!canRedo}>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo Action"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </TooltipButton>
    </div>
  )
}