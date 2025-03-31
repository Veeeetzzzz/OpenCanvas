import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ColorPicker } from "@/components/color-picker"
import { useState, useRef, useEffect } from "react"
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

export function TextToolbar({
  show,
  color,
  onColorChange,
  fontSize,
  onFontSizeChange,
  font,
  onFontChange
}: TextToolbarProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)

  if (!show) return null

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
      ref={toolbarRef}
      className="absolute bg-background border rounded-lg shadow-lg w-64 select-none"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="flex items-center gap-2 p-2 border-b bg-muted/50 rounded-t-lg cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Text Properties</span>
      </div>
      
      <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Font</Label>
        <select 
          className="w-full p-2 border rounded-md bg-background"
          value={font}
          onChange={(e) => onFontChange(e.target.value)}
        >
          {fonts.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      
      <div className="space-y-2">
        <Label>Font Size: {fontSize}px</Label>
        <Slider
          value={[fontSize]}
          onValueChange={(value) => onFontSizeChange(value[0])}
          min={8}
          max={72}
          step={1}
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex items-center gap-2">
          <ColorPicker color={color} onChange={onColorChange} />
          <span className="text-sm text-muted-foreground">{color}</span>
        </div>
      </div>
      </div>
    </div>
  )
}