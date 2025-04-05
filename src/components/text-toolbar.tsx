import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ColorPicker } from "@/components/color-picker"
import { useState, useRef, forwardRef } from "react"
import { GripVertical } from "lucide-react"

interface TextToolbarProps {
  show: boolean;
  color: string;
  onColorChange: (color: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  font: string;
  onFontChange: (font: string) => void;
}

const fonts = [
  "Arial",
  "Times New Roman",
  "Helvetica",
  "Georgia",
  "Courier New",
  "Verdana"
]

export const TextToolbar = forwardRef<HTMLDivElement, TextToolbarProps>((
  {
    show,
    color,
    onColorChange,
    fontSize,
    onFontSizeChange,
    font,
    onFontChange
  },
  ref
) => {
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div
      ref={ref}
      className="absolute bg-background border rounded-md shadow-lg select-none z-50"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default',
        display: show ? 'block' : 'none'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-t-md cursor-grab border-b"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Text Tool Options</span>
      </div>
      
      <div className="px-3 py-2 flex items-center gap-6">
        <div className="flex items-center gap-2 min-w-[140px]">
          <Label className="text-sm">Font:</Label>
          <select 
            className="flex-1 h-8 px-2 text-sm border rounded bg-background"
            value={font}
            onChange={(e) => onFontChange(e.target.value)}
          >
            {fonts.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Size: {fontSize}px</Label>
          <Slider
            className="w-24"
            value={[fontSize]}
            onValueChange={(value) => onFontSizeChange(value[0])}
            min={8}
            max={72}
            step={1}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm">Color:</Label>
          <div className="flex items-center gap-1">
            <ColorPicker color={color} onChange={onColorChange} />
            <span className="text-xs text-muted-foreground font-mono">{color}</span>
          </div>
        </div>
      </div>
    </div>
  )
})

TextToolbar.displayName = 'TextToolbar'