import { useEffect, useRef, useState, useCallback } from "react"
import { Tool, DrawingState, DrawingAction } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { TextToolbar } from "@/components/text-toolbar"

interface CanvasProps {
  tool: Tool;
  color: string;
  onColorChange: (color: string) => void;
  onStateChange: (state: DrawingState) => void;
}

export function Canvas({ tool, color, onColorChange, onStateChange }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null)
  const [imageInput, setImageInput] = useState<HTMLInputElement | null>(null)
  const [fontSize, setFontSize] = useState(16)
  const [font, setFont] = useState("Arial")
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [imageArea, setImageArea] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            if (context && canvasRef.current) {
              context.drawImage(img, 0, 0)
              onStateChange({
                actions: [],
                currentAction: null
              })
            }
          }
          img.src = e.target?.result as string
        }
        reader.readAsDataURL(file)
      }
    }
    setImageInput(input)
    return () => input.remove()
  }, [context, onStateChange])

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.lineJoin = "round"
        ctx.lineCap = "round"
        setContext(ctx)
      }
    }
  }, [])

  // Reset text position when tool changes
  useEffect(() => {
    if (tool !== 'text') {
      setTextPosition(null)
    }
  }, [tool])

  const startDrawing = (e: React.MouseEvent) => {
    if (tool === "hand") return
    
    if (tool === "text" && context) {
      setTextPosition({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }

    if (tool === "image") {
      setImageArea({
        start: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        end: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
      })
      return
    }
    
    setIsDrawing(true)
    const newAction: DrawingAction = {
      tool,
      color,
      lineWidth: tool === "eraser" ? 20 : 2,
      points: [{ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }]
    }
    setCurrentAction(newAction)
  }

  const draw = (e: React.MouseEvent) => {
    if (tool === "image" && imageArea) {
      setImageArea({
        ...imageArea,
        end: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
      })
      return
    }

    if (!isDrawing || !context || !currentAction || tool === "hand" || tool === "text") return
    
    const newPoint = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    const updatedAction = {
      ...currentAction,
      points: [...currentAction.points, newPoint]
    }
    setCurrentAction(updatedAction)
    
    if (tool === "eraser") {
      const size = 20
      context.clearRect(
        e.nativeEvent.offsetX - size/2,
        e.nativeEvent.offsetY - size/2,
        size,
        size
      )
    } else {
      context.beginPath()
      context.moveTo(updatedAction.points[updatedAction.points.length - 2].x, updatedAction.points[updatedAction.points.length - 2].y)
      context.lineTo(newPoint.x, newPoint.y)
      context.strokeStyle = color
      context.lineWidth = 2
      context.stroke()
    }
  }

  const stopDrawing = () => {
    if (tool === "image" && imageArea && imageInput) {
      imageInput.click()
      setImageArea(null)
      return
    }
    
    if (currentAction) {
      onStateChange({
        actions: [currentAction],
        currentAction: null
      })
    }
    setIsDrawing(false)
    setCurrentAction(null)
  }

  const handleTextInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && context && textPosition) {
      const text = (e.target as HTMLInputElement).value
      if (text) {
        context.font = `${fontSize}px ${font}`
        context.fillStyle = color
        context.fillText(text, textPosition.x, textPosition.y)
        
        onStateChange({
          actions: [{
            tool: 'text',
            points: [{ x: textPosition.x, y: textPosition.y }],
            color,
            lineWidth: fontSize,
            text,
            font
          }],
          currentAction: null
        })
        
        setTextPosition(null)
        ;(e.target as HTMLInputElement).value = ''
      }
    }
  }

  const handleBlur = () => {
    setTextPosition(null)
  }

  return (
    <div className="relative w-full h-full">
      <TextToolbar
        show={tool === "text"}
        color={color}
        onColorChange={onColorChange}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        font={font}
        onFontChange={setFont}
      />
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${tool === "hand" ? "cursor-grab" : tool === "text" ? "cursor-text" : "cursor-crosshair"}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
      />
      {imageArea && (
        <div
          className="absolute border-2 border-primary bg-primary/10"
          style={{
            left: Math.min(imageArea.start.x, imageArea.end.x),
            top: Math.min(imageArea.start.y, imageArea.end.y),
            width: Math.abs(imageArea.end.x - imageArea.start.x),
            height: Math.abs(imageArea.end.y - imageArea.start.y),
            pointerEvents: 'none'
          }}
        />
      )}
      {textPosition && (
        <input
          ref={inputRef}
          type="text"
          className="absolute bg-transparent border-none outline-none px-1 py-0.5 z-50"
          style={{
            left: textPosition.x,
            top: textPosition.y - fontSize,
            font: `${fontSize}px ${font}`,
            color: color,
            minWidth: '200px',
            caretColor: color,
            pointerEvents: 'all',
            background: 'rgba(128, 128, 128, 0.1)'
          }}
          autoFocus
          onKeyDown={handleTextInput}
          onBlur={handleBlur}
          placeholder="Type and press Enter..."
        />
      )}
    </div>
  )
}