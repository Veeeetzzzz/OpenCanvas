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
  onToolChange: (tool: Tool) => void;
  onStateChange: (state: DrawingState) => void;
  history: DrawingState[];
  historyIndex: number;
}

export function Canvas({ tool, color, onColorChange, onToolChange, onStateChange, history, historyIndex }: CanvasProps) {
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
  const [imageInput, setImageInput] = useState<HTMLInputElement | null>(null)
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [clipboardImage, setClipboardImage] = useState<DrawingAction | null>(null)
  const [selectedText, setSelectedText] = useState<DrawingAction | null>(null)
  const [activeTextInput, setActiveTextInput] = useState<{ position: Point; initialValue: string; width?: number; height?: number } | null>(null)

  // --- Helper Function to Save Text --- 
  const saveActiveText = () => {
    if (inputRef.current && context && activeTextInput && inputRef.current.value.trim()) {
      const text = inputRef.current.value;
      // Don't save if text is identical to initial value during re-edit (unless position changed?)
      // This prevents saving an unchanged text just by blurring.
      // We might need a more robust check if position matters for saving.
      if (text === activeTextInput.initialValue && activeTextInput.initialValue !== '') {
         // Maybe check if position differs if drag-while-editing is implemented
         setActiveTextInput(null); // Still deactivate input
         return;
      }

      const textElement: TextElement = {
        text,
        position: activeTextInput.position, // Use the input's current position
        font,
        fontSize,
        color
      };
      
      // Add the new text action to the *current* history state
      const currentHistoryState = history[historyIndex] ?? { actions: [], currentAction: null };
      const newActions = [...currentHistoryState.actions, {
        tool: 'text' as Tool,
        points: [],
        color,
        lineWidth: 0,
        textElement
      }];
      
      onStateChange({ actions: newActions, currentAction: null });
      
      inputRef.current.value = ''; // Clear field
    }
    setActiveTextInput(null); // Always deactivate input after attempt
  };

  // --- Canvas Redrawing --- 
  const redrawCanvas = () => {
    if (!context || !canvasRef.current) return;
    
    const currentGlobalCompositeOperation = context.globalCompositeOperation;
    const currentStrokeStyle = context.strokeStyle;
    const currentLineWidth = context.lineWidth;
    const currentFillStyle = context.fillStyle;
    const currentFont = context.font;
    const currentTextBaseline = context.textBaseline;
    
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Draw actions from the current point in history
    const currentState = history[historyIndex];
    if (currentState) {
      currentState.actions.forEach(action => {
        context.save(); // Save context before drawing each action
        if (action.tool === 'pencil' || action.tool === 'eraser') {
          context.beginPath();
          context.strokeStyle = action.color;
          context.lineWidth = action.lineWidth;
          context.globalCompositeOperation = action.tool === 'eraser' ? 'destination-out' : 'source-over';
          
          action.points.forEach((point, i) => {
            if (i === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
          });
          context.stroke();

        } else if (action.textElement) {
          context.textBaseline = 'top';
          const { text, position, font, fontSize, color } = action.textElement;
          context.font = `${fontSize}px ${font}`;
          context.fillStyle = color;
          context.fillText(text, position.x, position.y);

        } else if (action.imageElement) {
          try {
            const img = new Image();
            img.src = action.imageElement.url;
            if (img.complete) {
              context.drawImage(img, action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
            } else {
              // Draw placeholder or handle loading state?
              img.onload = () => {
                 // Check if the action still exists in the current state before drawing async
                 if (history[historyIndex]?.actions.includes(action)) { 
                    context.drawImage(img, action.imageElement!.position.x, action.imageElement!.position.y, action.imageElement!.width, action.imageElement!.height);
                 }
              }
              img.onerror = () => console.error("Error loading image:", action.imageElement?.url);
            }
          } catch (error) {
             console.error("Error processing image action:", error);
          }
        }
        context.restore(); // Restore context after drawing each action
      });
    }
    
    // --- Draw UI elements over the actions --- 
    context.save();

    // Draw selection highlight for text (hand tool)
    if (selectedText?.textElement && tool === 'hand') {
      const { text, position, font, fontSize } = selectedText.textElement;
      context.font = `${fontSize}px ${font}`;
      const metrics = context.measureText(text);
      context.strokeStyle = 'rgba(0, 100, 255, 0.7)';
      context.lineWidth = 1;
      context.setLineDash([4, 2]);
      context.strokeRect(position.x - 2, position.y - 2, metrics.width + 4, fontSize * 1.2 + 4);
      context.setLineDash([]); // Reset line dash
    }
    
    // Draw resize handles for image (hand tool)
    if (selectedImage?.imageElement && tool === 'hand') {
      const { position, width, height } = selectedImage.imageElement;
      const handleSize = 8;
      context.fillStyle = 'white';
      context.strokeStyle = 'black';
      context.lineWidth = 1;
      const handles = [
        [position.x + width, position.y + height], [position.x, position.y + height],
        [position.x + width, position.y], [position.x, position.y]
      ];
      handles.forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, handleSize / 2, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
    }

    context.restore();
    
    // Restore the original context state if needed elsewhere, though save/restore per element is safer
    // context.globalCompositeOperation = currentGlobalCompositeOperation; // Probably not needed now
    // ... restore other states ...
  }

  // --- Effects --- 

  useEffect(() => {
    redrawCanvas();
  }, [history, historyIndex, selectedText, selectedImage]); // Redraw on history/selection change

  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) { 
        const reader = new FileReader();
        reader.onload = (event) => {
          if (!event.target?.result || !context || !canvasRef.current) return;
          const img = new Image();
          img.onload = () => {
            // Calculate default placement (e.g., center)
            const canvasWidth = canvasRef.current?.width ?? 500;
            const canvasHeight = canvasRef.current?.height ?? 500;
            // Scale image if too large? (Example: max 300px width)
            const scale = Math.min(1, 300 / img.width);
            const width = img.width * scale;
            const height = img.height * scale;
            const x = (canvasWidth - width) / 2;
            const y = (canvasHeight - height) / 2;
            
            const imageElement: ImageElement = { url: img.src, position: { x, y }, width, height };
            
            const newAction: DrawingAction = {
              tool: 'image' as Tool, 
              points: [], 
              color: '', 
              lineWidth: 0, 
              imageElement
            };

            const currentHistoryState = history[historyIndex] ?? { actions: [], currentAction: null };
            const newActions = [...currentHistoryState.actions, newAction];
            onStateChange({ actions: newActions, currentAction: null });
            
            // Select the newly added image and switch to hand tool
            setSelectedImage(newAction);
            onToolChange('hand');
            // Reset the input value to allow uploading the same file again
            if (input) input.value = ''; 

          };
          img.onerror = () => toast({ title: "Error loading image", variant: "destructive" });
          img.src = event.target.result as string;
        };
        reader.onerror = () => toast({ title: "Error reading file", variant: "destructive" });
        reader.readAsDataURL(file);
      } else {
        // If no file selected, maybe switch back to previous tool or hand tool?
         onToolChange('hand'); 
      }
    };
    setImageInput(input);
    return () => input.remove();
  }, [context, historyIndex, onStateChange, onToolChange, toast]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      // Debounce resize handling?
      const observer = new ResizeObserver(() => {
         canvas.width = canvas.offsetWidth;
         canvas.height = canvas.offsetHeight;
         const ctx = canvas.getContext("2d");
         if (ctx) {
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            setContext(ctx);
            redrawCanvas(); // Redraw after resize
         } else {
            setContext(null);
         }
      });
      observer.observe(canvas);

      const ctx = canvas.getContext("2d");
      if (ctx) {
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          setContext(ctx);
      }
      return () => observer.disconnect();
    }
  }, []);

  // Effect to handle tool changes
  useEffect(() => {
    if (tool !== 'text' && activeTextInput) {
      saveActiveText(); // Save pending text if switching away
    }
    if (tool !== 'hand') {
      setSelectedImage(null);
      setSelectedText(null);
    }
    // Reset cursor if needed when tool changes
    document.body.style.cursor = 'default'; 
  }, [tool]);

  // Effect to trigger image input when tool is selected
  useEffect(() => {
    if (tool === 'image' && imageInput) {
      // Clear any previous selection before showing dialog
      setSelectedImage(null);
      setSelectedText(null);
      saveActiveText(); // Save any pending text input

      imageInput.click(); 
      // Switch back to hand tool immediately after triggering click?
      // Or wait for upload/cancel in the input's onChange?
      // Let's wait for onChange to handle tool switch back for better UX.
    }
  }, [tool, imageInput]); // Run when tool or imageInput changes

  // --- Hit Testing & Selection Helpers --- 

  const getResizeHandle = (point: Point, image: DrawingAction): 'se' | 'sw' | 'ne' | 'nw' | null => {
    if (!image.imageElement) return null;
    // Assert Point type for position to help linter
    const position = image.imageElement.position as Point; 
    const { width, height } = image.imageElement; 
    const handleSize = 10; 
    const halfHandle = handleSize / 2;
    
    // Check corners using position.x and position.y
    if (Math.abs(point.x - (position.x + width)) < halfHandle && Math.abs(point.y - (position.y + height)) < halfHandle) return 'se';
    if (Math.abs(point.x - position.x) < halfHandle && Math.abs(point.y - (position.y + height)) < halfHandle) return 'sw';
    if (Math.abs(point.x - (position.x + width)) < halfHandle && Math.abs(point.y - position.y) < halfHandle) return 'ne';
    if (Math.abs(point.x - position.x) < halfHandle && Math.abs(point.y - position.y) < halfHandle) return 'nw';
    
    return null;
  }

  const hitTest = (point: Point): DrawingAction | null => {
    if (!history[historyIndex]) return null;
    // Iterate backwards through the *current* state's actions
    const actions = history[historyIndex].actions;
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      if (action.imageElement) {
        const { position, width, height } = action.imageElement;
        if (point.x >= position.x && point.x <= position.x + width && point.y >= position.y && point.y <= position.y + height) {
          return action;
        }
      }
    }
    return null;
  }

  const textHitTest = (point: Point): DrawingAction | null => {
    if (!context || !history[historyIndex]) return null;
    const actions = history[historyIndex].actions;
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      if (action.textElement) {
        const { text, position, font, fontSize } = action.textElement;
        context.save();
        context.font = `${fontSize}px ${font}`;
        const metrics = context.measureText(text);
        context.restore();
        const width = metrics.width;
        const height = fontSize * 1.2; // Approximation

        if (point.x >= position.x && point.x <= position.x + width && point.y >= position.y && point.y <= position.y + height) {
          return action;
        }
      }
    }
    return null;
  }

  // --- Mouse Event Handlers --- 

  const startDrawing = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left clicks
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };

    // If text input is active, a click outside should save and deactivate it
    if (activeTextInput && inputRef.current && !inputRef.current.contains(e.target as Node)) {
      saveActiveText();
      // Continue to handle the click based on the current tool below
    }

    if (tool === "hand") {
      setIsDrawing(false); // Not drawing lines/shapes with hand tool
      if (selectedImage?.imageElement) {
        const handle = getResizeHandle(point, selectedImage);
        if (handle) {
          setIsResizing(true);
          setResizeHandle(handle);
          setDragStart(point);
          setSelectedText(null);
          document.body.style.cursor = 'crosshair'; // Indicate resizing
          return;
        }
      }
      
      const hitText = textHitTest(point);
      if (hitText) {
        setSelectedText(hitText);
        setSelectedImage(null);
        setIsDragging(true);
        setDragStart(point);
        document.body.style.cursor = 'move';
        return;
      }
      
      const hitImage = hitTest(point);
      if (hitImage) {
        setSelectedImage(hitImage);
        setSelectedText(null);
        setIsDragging(true);
        setDragStart(point);
        document.body.style.cursor = 'move';
      } else {
        setSelectedImage(null);
        setSelectedText(null);
        setIsDragging(false);
        document.body.style.cursor = 'default';
      }
      return;
    }
    
    // --- Handle other tools --- 
    setSelectedImage(null);
    setSelectedText(null);

    if (tool === "text") {
      setActiveTextInput({ position: point, initialValue: '' });
      setTimeout(() => inputRef.current?.focus(), 0);
      setIsDrawing(false);
      return;
    }

    if (tool === "image") {
      // No longer setting imageArea, trigger input via useEffect
      // setImageArea({ start: point, end: point });
      setIsDrawing(false); // Not drawing a box anymore
      return;
    }
    
    // Pencil/Eraser
    setIsDrawing(true);
    const newAction: DrawingAction = {
      tool,
      color: tool === 'eraser' ? 'rgba(0,0,0,1)' : color, // Eraser needs a nominal color for type
      lineWidth: tool === "eraser" ? 20 : 2,
      points: [point]
    };
    setCurrentAction(newAction);
    // Draw initial point/dot immediately for feedback
    if (context && tool === 'pencil') {
       context.fillStyle = color;
       context.beginPath();
       context.arc(point.x, point.y, newAction.lineWidth / 2, 0, Math.PI * 2);
       context.fill();
    } else if (context && tool === 'eraser') {
       context.save();
       context.globalCompositeOperation = 'destination-out';
       context.beginPath();
       context.arc(point.x, point.y, newAction.lineWidth / 2, 0, Math.PI * 2);
       context.fill();
       context.restore();
    }
  }

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing && !isDragging) return;
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };

    // Handle Hand Tool Dragging/Resizing
    if (tool === "hand" && isDragging && dragStart) {
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;

      if (selectedImage?.imageElement) {
        if (isResizing && resizeHandle) {
          const { position, width, height } = selectedImage.imageElement;
          let { x: newX, y: newY, width: newWidth, height: newHeight } = selectedImage.imageElement;

          switch (resizeHandle) {
            case 'se': newWidth = Math.max(20, width + dx); newHeight = Math.max(20, height + dy); break;
            case 'sw': newWidth = Math.max(20, width - dx); newHeight = Math.max(20, height + dy); newX = position.x + dx; break;
            case 'ne': newWidth = Math.max(20, width + dx); newHeight = Math.max(20, height - dy); newY = position.y + dy; break;
            case 'nw': newWidth = Math.max(20, width - dx); newHeight = Math.max(20, height - dy); newX = position.x + dx; newY = position.y + dy; break;
          }
          
          // Update element directly for immediate feedback
          selectedImage.imageElement.width = newWidth;
          selectedImage.imageElement.height = newHeight;
          selectedImage.imageElement.position.x = newX;
          selectedImage.imageElement.position.y = newY;
          setDragStart(point); // Update for next delta calculation
          redrawCanvas();

        } else { // Image dragging
          selectedImage.imageElement.position.x += dx;
          selectedImage.imageElement.position.y += dy;
          setDragStart(point);
          redrawCanvas();
        }
      } else if (selectedText?.textElement) { // Text dragging
        selectedText.textElement.position.x += dx;
        selectedText.textElement.position.y += dy;
        setDragStart(point);
        redrawCanvas();
      }
      return;
    }

    // Handle Image Tool (drawing selection box)
    // Remove this block - imageArea is gone
    /*
    if (tool === "image" && isDrawing && imageArea) {
      setImageArea({ ...imageArea, end: point });
      redrawCanvas(); // Redraw to show the selection box updating
      return;
    }
    */

    // Handle Pencil/Eraser Drawing
    if (isDrawing && currentAction && (tool === 'pencil' || tool === 'eraser')) {
      const updatedAction = { ...currentAction, points: [...currentAction.points, point] };
      setCurrentAction(updatedAction);
      
      if (context) {
        const prevPoint = currentAction.points[currentAction.points.length - 1];
        context.save();
        context.beginPath();
        context.moveTo(prevPoint.x, prevPoint.y);
        context.lineTo(point.x, point.y);
        context.lineWidth = updatedAction.lineWidth;
        context.strokeStyle = updatedAction.color; 
        if (tool === "eraser") {
            context.globalCompositeOperation = 'destination-out';
        }
        context.stroke();
        context.restore();
      }
    }
  }

  const stopDrawing = (e?: React.MouseEvent) => { // Optional event for mouseleave check
    // Prevent state changes if mouse leaves canvas while drawing/dragging
    if (e?.type === 'mouseleave' && (isDrawing || isDragging)) {
       // Decide how to handle: cancel action or complete it?
       // For now, let's reset state cleanly
       setIsDrawing(false);
       setIsDragging(false);
       setIsResizing(false);
       setDragStart(null);
       setResizeHandle(null);
       setCurrentAction(null);
       // Don't save text on mouse leave, rely on blur/enter/tool change
       redrawCanvas(); // Redraw to clean up visuals
       document.body.style.cursor = 'default';
       return;
    }
    
    // --- Normal Stop Drawing Logic --- 
    const wasDragging = isDragging; // Store state before resetting
    const wasResizing = isResizing;

    setIsDrawing(false);
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragStart(null);
    document.body.style.cursor = 'default';

    // Handle Hand Tool (save final position after drag/resize)
    if (tool === "hand" && (wasDragging || wasResizing)) {
      if ((selectedImage || selectedText) && historyIndex >= 0 && history[historyIndex]) {
        const currentHistoryState = history[historyIndex];
        const updatedActions = currentHistoryState.actions.map(action => {
          if (action === selectedImage && selectedImage?.imageElement) return { ...selectedImage }; 
          if (action === selectedText && selectedText?.textElement) return { ...selectedText };
          return action;
        });
        // Create a *new* history entry with the updated state
        onStateChange({ actions: updatedActions, currentAction: null });
      }
      return;
    }
    
    // Handle Image Tool (trigger file input)
    // Remove this block - input triggered by useEffect now
    /*
    if (tool === "image" && imageArea && imageInput) {
      if (Math.abs(imageArea.start.x - imageArea.end.x) > 5 && Math.abs(imageArea.start.y - imageArea.end.y) > 5) {
         imageInput.click();
      } else {
         setImageArea(null); // Cancel if area is too small
      }
      return;
    }
    */
    
    // Handle Text Tool (input handled elsewhere)
    if (tool === "text") return;
    
    // Handle Pencil/Eraser (save action to history)
    if (currentAction) {
       const currentHistoryState = history[historyIndex] ?? { actions: [], currentAction: null };
       // Filter out zero-length actions (e.g., single click with pencil/eraser)
       if (currentAction.points.length > 1) { 
         const newActions = [...currentHistoryState.actions, currentAction];
         onStateChange({ actions: newActions, currentAction: null });
       }
    }
    setCurrentAction(null);
  }

  // --- Text Input Handlers --- 

  const handleTextInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveActiveText();
    } else if (e.key === 'Escape') {
      setActiveTextInput(null);
      if (inputRef.current) inputRef.current.value = activeTextInput?.initialValue ?? ''; // Revert on escape? Or just close?
       // For now, just close without saving by setting activeTextInput to null
    }
    // Auto-resize input width?
    if (inputRef.current) {
        inputRef.current.style.width = `${inputRef.current.scrollWidth}px`;
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
     // Check if the new focused element is related (e.g., TextToolbar controls)
     // If so, don't save/close immediately. This is complex to get right reliably.
     // Simplest approach: save on blur after a short delay.
    setTimeout(() => {
        // Check if still active - might have been closed by Enter/Escape/Tool change
        if (activeTextInput) { 
           saveActiveText(); 
        }
    }, 100); // Delay allows clicks on other elements to potentially prevent blur saving
  };

  // --- Context Menu Handlers --- 

  const handleCopyImage = () => {
     if (selectedImage) {
      setClipboardImage(selectedImage);
      toast({ title: "Image copied" });
    }
  }

  const handlePasteImage = (e?: React.MouseEvent) => { // Make event optional
    if (clipboardImage?.imageElement) {
      // Use mouse position if event provided, otherwise center of view
      const canvasWidth = canvasRef.current?.width ?? 200; // Default width if canvas not ready
      const canvasHeight = canvasRef.current?.height ?? 200; // Default height
      const point = e 
        ? { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY } 
        : { x: canvasWidth / 2, y: canvasHeight / 2 }; 
      
      const newImageAction: DrawingAction = {
        ...clipboardImage,
        // Create a *new* element object with updated position
        imageElement: {
          ...clipboardImage.imageElement,
          position: point 
        }
      };

      const currentHistoryState = history[historyIndex] ?? { actions: [], currentAction: null };
      const newActions = [...currentHistoryState.actions, newImageAction];
      onStateChange({ actions: newActions, currentAction: null });
      toast({ title: "Image pasted" });
    }
  }

  const handleDeleteImage = () => {
     if (selectedImage) {
      const currentHistoryState = history[historyIndex];
      if (!currentHistoryState) return;

      const newActions = currentHistoryState.actions.filter(action => action !== selectedImage);
      
      onStateChange({ actions: newActions, currentAction: null });
      setSelectedImage(null);
      toast({ title: "Image deleted" });
    }
  }
  
  // Function to delete selected text
  const handleDeleteText = () => {
     if (selectedText) {
      const currentHistoryState = history[historyIndex];
      if (!currentHistoryState) return;

      const newActions = currentHistoryState.actions.filter(action => action !== selectedText);
      
      onStateChange({ actions: newActions, currentAction: null });
      setSelectedText(null);
      toast({ title: "Text deleted" });
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default browser context menu
    saveActiveText(); // Save any pending text input

    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    const hitImage = hitTest(point);
    const hitText = textHitTest(point);
    
    // Prioritize image selection if both hit?
    if (hitImage) {
      setSelectedImage(hitImage);
      setSelectedText(null);
    } else if (hitText) {
      setSelectedText(hitText);
      setSelectedImage(null);
    } else {
      setSelectedImage(null);
      setSelectedText(null);
    }
  }

  // --- Double Click Handler (Re-editing Text) --- 

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left double clicks
    // Allow double click to edit only when hand tool is active
    if (tool !== 'hand' || !context) return; 

    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    const hitTextAction = textHitTest(point);

    if (hitTextAction?.textElement) {
      // Prevent re-triggering if already editing this text
      if (activeTextInput?.position === hitTextAction.textElement.position && activeTextInput?.initialValue === hitTextAction.textElement.text) {
         return; 
      }
      
      // 1. Save any different active text first
      saveActiveText();

      // 2. Find and remove the original text action from the current history state
      const currentHistoryState = history[historyIndex];
      if (!currentHistoryState) return; // Should not happen if text was hittable
      const actionsWithoutOriginal = currentHistoryState.actions.filter(a => a !== hitTextAction);
      onStateChange({ actions: actionsWithoutOriginal, currentAction: null });

      // 3. Set component state for editing
      const { text, position, font: textFont, fontSize: textFontSize, color: textColor } = hitTextAction.textElement;
      setSelectedText(null); // Clear visual selection highlight
      setSelectedImage(null);
      onColorChange(textColor);
      setFont(textFont);
      setFontSize(textFontSize);
      // Switch tool to text implicitly by activating input? Or explicitly?
      // onToolChange('text'); // Maybe not needed if toolbar shows on activeTextInput

      // 4. Calculate dimensions for input styling
      context.save();
      context.font = `${textFontSize}px ${textFont}`;
      const metrics = context.measureText(text);
      context.restore();

      // 5. Activate the text input
      setActiveTextInput({
        position: position,
        initialValue: text, // Store initial value to check on save
        width: metrics.width,
        height: textFontSize * 1.2 
      });

      // 6. Focus input
      setTimeout(() => {
        if (inputRef.current) {
            inputRef.current.select();
            inputRef.current.focus();
            // Auto-resize input width
             inputRef.current.style.width = `${Math.max(metrics.width + 5, 20)}px`; 
        }
      }, 0);
    }
  };

  // --- JSX Rendering --- 

  return (
    <div className="relative w-full h-full overflow-hidden"> {/* Prevent scrollbars from input */} 
      <TextToolbar
        show={tool === "text" || !!activeTextInput} // Show toolbar if text tool OR editing
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
              activeTextInput ? 'cursor-text' : // Highest priority cursor
              tool === "hand" 
                ? isDragging ? "cursor-grabbing" : (selectedImage || selectedText) ? "cursor-grab" : "cursor-default"
                : tool === "text" 
                  ? "cursor-text" 
                  : "cursor-crosshair"
            }`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing} // Handle mouse leaving canvas
            onContextMenu={handleContextMenu}
            onDoubleClick={handleDoubleClick}
          />
        </ContextMenuTrigger>
        <ContextMenuContent 
          onCloseAutoFocus={(e) => e.preventDefault()} // Prevent refocusing canvas after menu closes
        >
          {/* General Paste Option */} 
          {clipboardImage && (
            <ContextMenuItem onClick={() => handlePasteImage()}> {/* No event needed here */}
              Paste Image
            </ContextMenuItem>
          )}
          {/* Image Specific Options */} 
          {selectedImage && (
            <>
              <ContextMenuItem onClick={handleCopyImage}>
                <Copy className="mr-2 h-4 w-4" /> Copy Image
              </ContextMenuItem>
              <ContextMenuItem onClick={handleDeleteImage} className="text-destructive">
                <Trash className="mr-2 h-4 w-4" /> Delete Image
              </ContextMenuItem>
            </>
          )}
          {/* Text Specific Options */} 
           {selectedText && (
            <>
              {/* Add Copy Text? 
              <ContextMenuItem onClick={handleCopyText}> 
                 <Copy className="mr-2 h-4 w-4" /> Copy Text
              </ContextMenuItem> */} 
              <ContextMenuItem onClick={handleDeleteText} className="text-destructive">
                <Trash className="mr-2 h-4 w-4" /> Delete Text
              </ContextMenuItem>
            </>
          )}
          {/* Add clear canvas option? */} 
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Active text input field */}
      {activeTextInput && (
        <input
          ref={inputRef}
          type="text"
          defaultValue={activeTextInput.initialValue}
          className="absolute bg-transparent border-none outline-none p-0 z-50" // No padding/border/outline initially
          style={{
            left: activeTextInput.position.x,
            top: activeTextInput.position.y,
            fontFamily: font,
            fontSize: `${fontSize}px`,
            color: color,
            width: 'auto', // Let browser determine width initially
            minWidth: '20px', // Ensure minimum size
            height: activeTextInput.height ? `${activeTextInput.height}px` : 'auto', // Use calculated height
            lineHeight: 1,
            // Add focus styles dynamically?
            // border: '1px dashed gray', // Example focus style
            caretColor: color,
            whiteSpace: 'pre', // Prevent wrapping
          }}
          onInput={(e) => {
             // Auto-resize input width based on content
             const target = e.target as HTMLInputElement;
             target.style.width = 'auto'; // Reset width
             target.style.width = `${target.scrollWidth}px`;
             // Adjust height too? Might be complex with multi-line
          }}
          onFocus={(e) => {
             // Select text on focus
             e.target.select();
             // Auto-resize on focus as well
             e.target.style.width = 'auto';
             e.target.style.width = `${e.target.scrollWidth}px`;
          }}
          onKeyDown={handleTextInput}
          onBlur={handleBlur} // Save on blur (with delay)
          placeholder="Type..."
        />
      )}
    </div>
  )
}