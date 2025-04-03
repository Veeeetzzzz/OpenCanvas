import { useEffect, useRef, useState } from "react"
import { Tool, DrawingState, DrawingAction, Point, TextElement, ImageElement } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { TextToolbar } from "@/components/text-toolbar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Copy, Trash } from "lucide-react"

interface CanvasProps {
  tool: Tool;
  color: string;
  onColorChange: (color: string) => void;
  onStateChange: (state: DrawingState) => void;
  history: DrawingState[];
  historyIndex: number;
}

export function Canvas({ tool, color, onColorChange, onStateChange, history, historyIndex }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null)
  const [selectedImage, setSelectedImage] = useState<DrawingAction | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<'se' | 'sw' | 'ne' | 'nw' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [fontSize, setFontSize] = useState(16)
  const [font, setFont] = useState("Arial")
  const [textArea, setTextArea] = useState<{ start: Point; end: Point } | null>(null)
  const [imageArea, setImageArea] = useState<{ start: Point; end: Point } | null>(null)
  const [imageInput, setImageInput] = useState<HTMLInputElement | null>(null)
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [clipboardImage, setClipboardImage] = useState<DrawingAction | null>(null)

  // Clear canvas and redraw all actions
  const redrawCanvas = () => {
    if (!context || !canvasRef.current) return
    
    // Store the current context state
    const currentGlobalCompositeOperation = context.globalCompositeOperation
    const currentStrokeStyle = context.strokeStyle
    const currentLineWidth = context.lineWidth
    
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    
    history.slice(0, historyIndex + 1).forEach(state => {
      state.actions.forEach(action => {
        if (action.tool === 'pencil' || action.tool === 'eraser') {
          context.beginPath()
          context.strokeStyle = action.color
          context.lineWidth = action.lineWidth
          
          action.points.forEach((point, i) => {
            if (i === 0) {
              context.moveTo(point.x, point.y)
            } else {
              context.lineTo(point.x, point.y)
            }
          })
          
          if (action.tool === 'eraser') {
            context.globalCompositeOperation = 'destination-out'
          }
          context.stroke()
          context.globalCompositeOperation = 'source-over'
        } else if (action.textElement) {
          // Draw text
          if (!action.textElement) return
          context.save()
          context.textBaseline = 'top'
          const { text, position, font, fontSize, color } = action.textElement
          context.font = `${fontSize}px ${font}`
          context.fillStyle = color
          context.fillText(text, position.x, position.y)
        } else if (action.imageElement) {
          const img = new Image()
          img.src = action.imageElement.url
          context.drawImage(
            img,
            action.imageElement.position.x,
            action.imageElement.position.y,
            action.imageElement.width,
            action.imageElement.height
          )
        }
      })
      
      // Draw resize handles if an image is selected
      if (selectedImage?.imageElement && tool === 'hand') {
        const { position, width, height } = selectedImage.imageElement
        const handleSize = 8
        context.fillStyle = 'white'
        context.strokeStyle = 'black'
        context.lineWidth = 1
        ;[
          [position.x + width, position.y + height],
          [position.x, position.y + height],
          [position.x + width, position.y],
          [position.x, position.y]
        ].forEach(([x, y]) => {
          context.beginPath()
          context.arc(x, y, handleSize / 2, 0, Math.PI * 2)
          context.fill()
          context.stroke()
        })
      }
    })
    
    // Restore the context state
    context.globalCompositeOperation = currentGlobalCompositeOperation
    context.strokeStyle = currentStrokeStyle
    context.lineWidth = currentLineWidth
  }

  useEffect(() => {
    redrawCanvas()
  }, [history, historyIndex])

  useEffect(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const img = new Image()
          img.onload = async () => {
            if (context && canvasRef.current && imageArea) {
              const width = Math.abs(imageArea.end.x - imageArea.start.x)
              const height = Math.abs(imageArea.end.y - imageArea.start.y)
              const x = Math.min(imageArea.start.x, imageArea.end.x)
              const y = Math.min(imageArea.start.y, imageArea.end.y)
              
              const imageElement: ImageElement = {
                url: img.src,
                position: { x, y },
                width,
                height
              }
              
              onStateChange({
                actions: [{
                  tool: 'image',
                  points: [],
                  color: '',
                  lineWidth: 0,
                  imageElement
                }],
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
  }, [context, imageArea, onStateChange])

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

  useEffect(() => {
    if (tool !== 'text') {
      setTextArea(null)
    }
  }, [tool])

  const getResizeHandle = (point: Point, image: DrawingAction) => {
    if (!image.imageElement) return null
    const { position, width, height } = image.imageElement
    const handleSize = 8
    
    const corners = [
      { handle: 'se' as const, x: position.x + width, y: position.y + height },
      { handle: 'sw' as const, x: position.x, y: position.y + height },
      { handle: 'ne' as const, x: position.x + width, y: position.y },
      { handle: 'nw' as const, x: position.x, y: position.y }
    ]
    
    for (const corner of corners) {
      if (
        Math.abs(point.x - corner.x) < handleSize &&
        Math.abs(point.y - corner.y) < handleSize
      ) {
        return corner.handle
      }
    }
    return null
  }

  const hitTest = (point: Point) => {
    for (let i = history.length - 1; i >= 0; i--) {
      const state = history[i]
      for (let j = state.actions.length - 1; j >= 0; j--) {
        const action = state.actions[j]
        if (action.imageElement) {
          const { position, width, height } = action.imageElement
          if (
            point.x >= position.x &&
            point.x <= position.x + width &&
            point.y >= position.y &&
            point.y <= position.y + height
          ) {
            return action
          }
        }
      }
    }
    return null
  }

  const startDrawing = (e: React.MouseEvent) => {
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    
    if (tool === "hand") {
      if (selectedImage?.imageElement) {
        const handle = getResizeHandle(point, selectedImage)
        if (handle) {
          setIsResizing(true)
          setResizeHandle(handle)
          setDragStart(point)
          return
        }
      }
      
      const hitImage = hitTest(point)
      if (hitImage) {
        setSelectedImage(hitImage)
      } else {
        setSelectedImage(null)
      }
      
      setIsDragging(true)
      setDragStart(point)
      return
    }
    
    if (tool === "text") {
      setTextArea({
        start: point,
        end: point
      })
      return
    }

    if (tool === "image") {
      setImageArea({
        start: point,
        end: point
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
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    
    if (tool === "hand" && isDragging && dragStart && selectedImage?.imageElement) {
      if (isResizing && resizeHandle) {
        const dx = point.x - dragStart.x
        const dy = point.y - dragStart.y
        const { position, width, height } = selectedImage.imageElement
        
        let newWidth = width
        let newHeight = height
        let newX = position.x
        let newY = position.y
        
        switch (resizeHandle) {
          case 'se':
            newWidth = width + dx
            newHeight = height + dy
            break
          case 'sw':
            newWidth = width - dx
            newHeight = height + dy
            newX = position.x + dx
            break
          case 'ne':
            newWidth = width + dx
            newHeight = height - dy
            newY = position.y + dy
            break
          case 'nw':
            newWidth = width - dx
            newHeight = height - dy
            newX = position.x + dx
            newY = position.y + dy
            break
        }
        
        // Ensure minimum size
        if (newWidth >= 20 && newHeight >= 20) {
          selectedImage.imageElement.width = newWidth
          selectedImage.imageElement.height = newHeight
          selectedImage.imageElement.position.x = newX
          selectedImage.imageElement.position.y = newY
          setDragStart(point)
          redrawCanvas()
        }
        return
      }
      
      const dx = point.x - dragStart.x
      const dy = point.y - dragStart.y
      
      if (selectedImage.imageElement) {
        selectedImage.imageElement.position.x += dx
        selectedImage.imageElement.position.y += dy
        setDragStart(point)
        redrawCanvas()
      }
      return
    }
    
    if (tool === "hand" && isDragging) {
      const hitImage = hitTest(point)
      if (hitImage) {
        document.body.style.cursor = 'grab'
      } else {
        document.body.style.cursor = 'default'
      }
      setDragStart(point)
      redrawCanvas()
      return
    }
    
    if (tool === "image" && imageArea) {
      setImageArea({
        ...imageArea,
        end: point
      })
      return
    }

    if (tool === "text" && textArea) {
      setTextArea({
        ...textArea,
        end: point
      })
      return
    }

    if (!isDrawing || !context || !currentAction || tool === "hand" || tool === "text") return
    
    const updatedAction = {
      ...currentAction,
      points: [...currentAction.points, point]
    }
    setCurrentAction(updatedAction)
    
    if (tool === "eraser") {
      const size = 20
      context.clearRect(
        point.x - size/2,
        point.y - size/2,
        size,
        size
      )
    } else {
      context.beginPath()
      context.moveTo(updatedAction.points[updatedAction.points.length - 2].x, updatedAction.points[updatedAction.points.length - 2].y)
      context.lineTo(point.x, point.y)
      context.strokeStyle = color
      context.lineWidth = 2
      context.stroke()
    }
  }

  const stopDrawing = () => {
    if (tool === "hand") {
      setIsDragging(false)
      setIsResizing(false)
      setResizeHandle(null)
      setDragStart(null)
      if (selectedImage?.imageElement) {
        onStateChange({
          actions: [selectedImage],
          currentAction: null
        })
      }
      return
    }
    
    if (tool === "image" && imageArea && imageInput) {
      imageInput.click()
      setImageArea(null)
      return
    }
    
    if (tool === "text" && textArea) {
      const x = Math.min(textArea.start.x, textArea.end.x)
      setTimeout(() => inputRef.current?.focus(), 0)
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
    if (e.key === 'Enter' && context && textArea && (e.target as HTMLInputElement).value.trim()) {
      const text = (e.target as HTMLInputElement).value
      const textElement: TextElement = {
        text,
        position: {
          x: Math.min(textArea.start.x, textArea.end.x),
          y: Math.max(textArea.start.y, textArea.end.y)
        },
        font,
        fontSize,
        color
      }
      
      onStateChange({
        actions: [{
          tool: 'text',
          points: [],
          color,
          lineWidth: fontSize,
          textElement
        }],
        currentAction: null
      })
      
      setTextArea(null)
      ;(e.target as HTMLInputElement).value = ''
    }
  }

  const handleBlur = () => {
    setTextArea(null)
  }

  const handleCopyImage = () => {
    if (selectedImage) {
      setClipboardImage(selectedImage)
      toast({
        title: "Image copied",
        description: "You can now paste the image anywhere on the canvas"
      })
    }
  }

  const handlePasteImage = (e: React.MouseEvent) => {
    if (clipboardImage?.imageElement) {
      const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
      const newImage: DrawingAction = {
        ...clipboardImage,
        imageElement: {
          ...clipboardImage.imageElement,
          position: point
        }
      }
      onStateChange({
        actions: [newImage],
        currentAction: null
      })
      toast({
        title: "Image pasted",
        description: "Image has been pasted at the selected location"
      })
    }
  }

  const handleDeleteImage = () => {
    if (selectedImage) {
      // Create a new state with the selected image filtered out
      const newState: DrawingState = {
        actions: history[historyIndex].actions.filter(action => action !== selectedImage),
        currentAction: null
      }
      
      onStateChange(newState)
      setSelectedImage(null)
      toast({
        title: "Image deleted",
        description: "The selected image has been removed"
      })
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }
    const hitImage = hitTest(point)
    if (hitImage) {
      setSelectedImage(hitImage)
    }
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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <canvas
            ref={canvasRef}
            className={`w-full h-full ${
              tool === "hand" 
                ? selectedImage 
                  ? "cursor-move" 
                  : "cursor-default"
                : tool === "text" 
                  ? "cursor-text" 
                  : "cursor-crosshair"
            }`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onContextMenu={handleContextMenu}
            onClick={(e) => clipboardImage && handlePasteImage(e)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          {selectedImage && (
            <>
              <ContextMenuItem onClick={handleCopyImage}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Image
              </ContextMenuItem>
              <ContextMenuItem onClick={handleDeleteImage}>
                <Trash className="mr-2 h-4 w-4" />
                Delete Image
              </ContextMenuItem>
            </>
          )}
          {clipboardImage && (
            <ContextMenuItem onClick={(e) => handlePasteImage(e as unknown as React.MouseEvent)}>
              Paste Image
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {textArea && (
        <div
          className="absolute border-2 border-primary bg-primary/10"
          style={{
            left: Math.min(textArea.start.x, textArea.end.x),
            top: Math.min(textArea.start.y, textArea.end.y),
            width: Math.abs(textArea.end.x - textArea.start.x),
            height: Math.abs(textArea.end.y - textArea.start.y),
            pointerEvents: 'none'
          }}
        />
      )}
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
      {textArea && (
        <input
          ref={inputRef}
          type="text"
          className="absolute bg-transparent border-none outline-none px-1 py-0.5 z-50"
          style={{
            left: Math.min(textArea.start.x, textArea.end.x),
            top: Math.min(textArea.start.y, textArea.end.y),
            fontFamily: font,
            fontSize: `${fontSize}px`,
            color: color,
            minWidth: '200px',
            caretColor: color,
            pointerEvents: 'all',
            background: 'rgba(128, 128, 128, 0.1)',
            width: 'auto'
          }}
          onKeyDown={handleTextInput}
          onBlur={handleBlur}
          placeholder="Type here..."
        />
      )}
    </div>
  )
}