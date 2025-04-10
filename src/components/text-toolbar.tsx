import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ColorPicker } from "@/components/color-picker"
import { Button } from "@/components/ui/button"
import { Pin, PinOff, GripVertical } from "lucide-react"
import React, { useState, useEffect, useCallback } from "react"

export interface TextToolbarProps {
  show: boolean;
  color: string;
  onColorChange: (color: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  font: string;
  onFontChange: (font: string) => void;
  isPinned: boolean;
  onPinToggle: () => void;
}

//const PREDEFINED_FONT_SIZES = [8, 12, 16, 20, 24, 36, 48, 64, 72];
const PREDEFINED_FONTS = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Comic Sans MS"];

export const TextToolbar = React.forwardRef<HTMLDivElement, TextToolbarProps>((
  {
    show,
    color,
    onColorChange,
    fontSize,
    onFontSizeChange,
    font,
    onFontChange,
    isPinned,
    onPinToggle,
  },
  ref
) => {
  const [position, setPosition] = useState({ x: 100, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    
    if (isPinned || !(e.target as HTMLElement).closest('.drag-handle')) return;
    
    setIsDragging(true);
    setDragStartOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartOffset.x,
      y: e.clientY - dragStartOffset.y,
    });
  }, [isDragging, dragStartOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!show) return null;

  return (
    <div 
      ref={ref}
      className={`absolute z-50 bg-background p-2 rounded-md shadow-md border flex items-center gap-2 ${isDragging && !isPinned ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div 
        className={`drag-handle p-1 -ml-1 ${!isPinned ? 'cursor-grab' : 'cursor-default'}`}
        title={!isPinned ? "Move Toolbar" : "Toolbar Pinned"}
      >
        <GripVertical className={`h-5 w-5 ${isPinned ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
      </div>

      <Select value={font} onValueChange={onFontChange}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          {PREDEFINED_FONTS.map(f => (
            <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="number"
        value={fontSize}
        onChange={(e) => onFontSizeChange(parseInt(e.target.value, 10) || 1)}
        min={1}
        max={200}
        step={1}
        className="w-[70px] h-8 text-xs"
        aria-label="Font Size"
      />

      <ColorPicker color={color} onChange={onColorChange} />

      <Button 
        variant="ghost" 
        size="icon"
        onClick={onPinToggle}
        title={isPinned ? "Unpin Toolbar" : "Pin Toolbar"}
        className="h-8 w-8"
      >
        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      </Button>
    </div>
  );
});

TextToolbar.displayName = 'TextToolbar'