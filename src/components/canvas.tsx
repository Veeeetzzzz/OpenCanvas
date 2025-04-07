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
  onStateChange: (update: DrawingState | DrawingAction, pastedImageDataUrl?: string) => void;
  history: DrawingState[];
  historyIndex: number;
  imageDataCache: Record<string, string>;
  gridEnabled?: boolean;
}

const DEFAULT_GRID_SIZE = 20; // Define default grid size

export function Canvas({
  tool,
  color,
  onColorChange,
  onStateChange,
  history,
  historyIndex,
  imageDataCache,
  gridEnabled = false,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null)
  const [selectedImage, setSelectedImage] = useState<DrawingAction | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [fontSize, setFontSize] = useState(16)
  const [font, setFont] = useState("Arial")
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [clipboardImage, setClipboardImage] = useState<DrawingAction | null>(null)
  const [selectedText, setSelectedText] = useState<DrawingAction | null>(null)
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null)
  const [activeTextInput, setActiveTextInput] = useState<{ position: Point; initialValue: string; width?: number; height?: number } | null>(null)
  const [hoveredResizeHandle, setHoveredResizeHandle] = useState<string | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // --- Helper Function to Save Text --- 
  const saveActiveText = () => {
    // Only proceed if the input ref and context exist, and text input is active
    if (!inputRef.current || !context || !activeTextInput) {
      // If called when not active, ensure it's null (might be redundant but safe)
      if (activeTextInput) setActiveTextInput(null);
      return;
    }

    const text = inputRef.current.value;
    const isTrimmedEmpty = text.trim().length === 0;
    const isIdenticalToInitial = activeTextInput.initialValue && text === activeTextInput.initialValue;

    let shouldDeactivate = false;

    // Condition 1: Save non-empty text
    if (!isTrimmedEmpty) {
      // If it's a re-edit and the text hasn't changed, don't create a new history state
      if (isIdenticalToInitial) {
         console.log("saveActiveText: Text identical to initial value, deactivating without saving.");
         shouldDeactivate = true;
      } else {
         console.log("saveActiveText: Saving text:", text);
         const textElement: TextElement = {
           text,
           position: activeTextInput.position, 
           font,
           fontSize,
           color
         };
         
         const currentHistoryState = history[historyIndex] ?? { actions: [], currentAction: null };
         const newActions = [...currentHistoryState.actions, {
           tool: 'text' as Tool,
           points: [],
           color,
           lineWidth: 0,
           textElement
         }];
         
         onStateChange({ actions: newActions, currentAction: null });
         shouldDeactivate = true;
      }
    } else {
       // Condition 2: Text is empty or whitespace only. 
       // Deactivate ONLY if it was a re-edit (initialValue existed). 
       // Do NOT deactivate if it was a brand new input that remained empty.
       if (activeTextInput.initialValue !== '') {
          console.log("saveActiveText: Text is empty, but was a re-edit. Deactivating.");
          shouldDeactivate = true;
       } else {
          console.log("saveActiveText: Text is empty on a new input. NOT deactivating.");
       }
    }

    // Deactivate and clear input only if conditions were met
    if (shouldDeactivate) {
      if (inputRef.current) {
         inputRef.current.value = ''; // Clear field
      }
      setActiveTextInput(null); 
    }
  };

  // --- Canvas Redrawing --- 
  const redrawCanvas = () => {
    if (!context || !canvasRef.current) return;
    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    // --- Draw Grid (if enabled) ---
    if (gridEnabled) {
      const gridSize = DEFAULT_GRID_SIZE; // Use the constant
      context.save();
      context.strokeStyle = "#e0e0e0"; // Light grey grid lines
      context.lineWidth = 0.5;

      // Vertical lines
      for (let x = gridSize; x < canvasWidth; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvasHeight);
        context.stroke();
      }

      // Horizontal lines
      for (let y = gridSize; y < canvasHeight; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvasWidth, y);
        context.stroke();
      }
      context.restore();
    }

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
            // Safety check for undefined imageId
            if (!action.imageElement?.imageId) {
              console.error("Image ID is undefined for action:", action);
              context.strokeRect(action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
              context.fillText("?", action.imageElement.position.x + action.imageElement.width / 2, action.imageElement.position.y + action.imageElement.height / 2);
              return;
            }

            // Get the image URL from the cache using the imageId
            const imageUrl = imageDataCache[action.imageElement.imageId];
            if (!imageUrl) {
              console.error("Image URL not found in cache for ID:", action.imageElement.imageId);
              context.strokeRect(action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
              context.fillText("?", action.imageElement.position.x + action.imageElement.width / 2, action.imageElement.position.y + action.imageElement.height / 2);
              return;
            }
            
            const img = new Image();
            img.src = imageUrl;
            if (img.complete) {
              context.drawImage(img, action.imageElement!.position.x, action.imageElement!.position.y, action.imageElement!.width, action.imageElement!.height);
            } else {
              img.onload = () => {
                if (action.imageElement) {
                  context.drawImage(img, action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
                }
              };
            }
          } catch (error) {
            console.error("Error drawing image:", error);
            if (action.imageElement) {
              context.strokeRect(action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
              context.fillText("Error", action.imageElement.position.x + action.imageElement.width / 2, action.imageElement.position.y + action.imageElement.height / 2);
            }
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
  }

  // --- Effects --- 

  useEffect(() => {
    redrawCanvas();
  }, [history, historyIndex, selectedText, selectedImage, gridEnabled, redrawCanvas]); // Redraw on history/selection/grid change

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
    // console.log(`Tool changed to: ${tool}`); 
    if (tool !== 'text' && activeTextInput) {
      // console.log(`Tool is ${tool}, activeTextInput exists. Saving text.`);
      saveActiveText(); 
    }
    if (tool !== 'hand') {
      // console.log(`Tool is ${tool}. Deselecting items.`);
      setSelectedImage(null);
      setSelectedImageIndex(null); // Also clear index
      setSelectedText(null);
    }
    // Reset cursor if needed when tool changes
    // document.body.style.cursor = 'default'; 
  }, [tool]); // <<<< Dependency array ONLY includes tool now

  // Effect to focus the text input when it becomes active
  useEffect(() => {
    if (activeTextInput && inputRef.current) {
      // console.log("Setting timeout to focus text input"); 
      const timerId = setTimeout(() => {
         if (inputRef.current) { 
            // console.log("Focusing text input now");
            inputRef.current.focus();
            inputRef.current.select(); 
         }
      }, 0); 
      return () => clearTimeout(timerId); 
    }
  }, [activeTextInput]); // Run only when activeTextInput changes

  // Add effect to clean up tool states when tool changes
  useEffect(() => {
    // Cleanup function to reset all tool-specific states
    const cleanupToolStates = () => {
      setActiveTextInput(null);
      setSelectedText(null);
      setSelectedTextIndex(null);
      setSelectedImage(null);
      setSelectedImageIndex(null);
      setIsDrawing(false);
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setDragStart(null);
      setCurrentAction(null);
    };

    cleanupToolStates();
  }, [tool]); // Run when tool changes

  // --- Interaction Logic Helpers ---

  // Check if a point is inside an image's bounds
  const isPointInImage = (point: Point, image: ImageElement): boolean => {
    return (
      point.x >= image.position.x &&
      point.x <= image.position.x + image.width &&
      point.y >= image.position.y &&
      point.y <= image.position.y + image.height
    );
  };

  // Find the topmost image action at a point
  const hitTestImage = (point: Point): { action: DrawingAction, index: number } | null => {
    const currentState = history[historyIndex];
    if (!currentState) return null;
    // Iterate backwards to check topmost elements first
    for (let i = currentState.actions.length - 1; i >= 0; i--) {
      const action = currentState.actions[i];
      if (action.imageElement && isPointInImage(point, action.imageElement)) {
        return { action, index: i };
      }
    }
    return null;
  };

  // Determine which resize handle (if any) is at a point
  const getResizeHandle = (point: Point, imageAction: DrawingAction): string | null => {
    if (!imageAction.imageElement) return null;
    const { position, width, height } = imageAction.imageElement;
    const handleSize = 10; // Make handle area slightly larger for easier clicking
    const handles: { [key: string]: Point } = {
      nw: { x: position.x, y: position.y },
      ne: { x: position.x + width, y: position.y },
      sw: { x: position.x, y: position.y + height },
      se: { x: position.x + width, y: position.y + height },
    };

    for (const name in handles) {
      const handle = handles[name];
      if (
        point.x >= handle.x - handleSize / 2 &&
        point.x <= handle.x + handleSize / 2 &&
        point.y >= handle.y - handleSize / 2 &&
        point.y <= handle.y + handleSize / 2
      ) {
        return name; // e.g., 'nw', 'ne', 'sw', 'se'
      }
    }
    return null;
  };

  // Find the topmost text action at a point and return action + index
  const textHitTest = (point: Point): { action: DrawingAction, index: number } | null => {
    const currentState = history[historyIndex];
    if (!context || !currentState) return null;
    // Iterate backwards to hit top elements first
    for (let i = currentState.actions.length - 1; i >= 0; i--) {
        const action = currentState.actions[i];
        if (action.textElement) {
            const { text, position, font, fontSize } = action.textElement;
            context.save();
            context.font = `${fontSize}px ${font}`;
            const metrics = context.measureText(text);
            // Approximate text bounds check (adjust height factor as needed)
            if (
                point.x >= position.x &&
                point.x <= position.x + metrics.width &&
                point.y >= position.y &&
                point.y <= position.y + fontSize * 1.2 // Approximate height
            ) {
                context.restore();
                return { action, index: i }; // Return action and index
            }
            context.restore();
        }
    }
    return null;
  };

  // Helper function to get the appropriate resize cursor class
  const getResizeCursorClassName = (handle: string | null): string => {
    if (!handle) return '';
    if (handle === 'nw' || handle === 'se') return 'cursor-nwse-resize';
    if (handle === 'ne' || handle === 'sw') return 'cursor-nesw-resize';
    // Add future handles like 'n', 's', 'e', 'w' here if needed
    // if (handle === 'n' || handle === 's') return 'cursor-ns-resize';
    // if (handle === 'e' || handle === 'w') return 'cursor-ew-resize';
    return ''; // Default case
  };

  // --- Event Handlers --- 

  const startDrawing = (e: React.MouseEvent) => {
    if (!context) return;
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };

    // Cleanup function to reset all tool-specific states
    const cleanupToolStates = () => {
      setActiveTextInput(null);
      setSelectedText(null);
      setSelectedTextIndex(null);
      setSelectedImage(null);
      setSelectedImageIndex(null);
      setIsDrawing(false);
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setDragStart(null);
      setCurrentAction(null);
    };

    // First, cleanup any existing tool states
    cleanupToolStates();

    if (tool === 'hand') {
      const currentState = history[historyIndex];
      if (!currentState) return;

      // Check for text hit first
      const textHit = textHitTest(point);
      if (textHit) {
        setSelectedText(textHit.action);
        setSelectedTextIndex(textHit.index);
        setSelectedImage(null);
        setSelectedImageIndex(null);
        setIsDrawing(true);
        setIsDragging(true);
        setDragStart({ x: point.x - textHit.action.textElement!.position.x, y: point.y - textHit.action.textElement!.position.y });
        e.preventDefault();
      } else {
        // Then check for image hit
        const imageHit = hitTestImage(point);
        if (imageHit) {
          if (!imageHit.action.imageElement?.imageId) {
            console.error("Attempted to select an image action with a missing imageId. Skipping selection.", imageHit.action);
            return;
          }

          const handle = getResizeHandle(point, imageHit.action);
          setSelectedImage(imageHit.action);
          setSelectedImageIndex(imageHit.index);
          setSelectedText(null);
          setSelectedTextIndex(null);
          
          if (handle) {
            setIsResizing(true);
            setResizeHandle(handle);
            setDragStart(point);
          } else {
            setIsDragging(true);
            setDragStart({ x: point.x - imageHit.action.imageElement.position.x, y: point.y - imageHit.action.imageElement.position.y });
          }
        }
      }
    } else if (tool === 'pencil' || tool === 'eraser') {
      setIsDrawing(true);
      setCurrentAction({
        tool,
        points: [point],
        color: tool === 'eraser' ? '#FFFFFF' : color,
        lineWidth: tool === 'eraser' ? 20 : 5,
      });
    } else if (tool === 'text') {
      setActiveTextInput({ position: point, initialValue: '' });
    } else if (tool === 'image') {
      // Image tool selection is handled by the App component
      // We just need to ensure other states are cleaned up
    }
  };

  const draw = (e: React.MouseEvent) => {
    if (!context) return; // Only check context here, allow hover updates even if not drawing
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    let currentHoveredHandle: string | null = null; // Track handle hover within this event

    // --- Handle specific tool interactions ONLY if drawing/dragging/resizing --- 
    if (isDrawing || isResizing || isDragging) {
      if (tool === 'hand' && selectedImage && selectedImage.imageElement) {
         if (isResizing && resizeHandle && dragStart) {
           // --- Resizing Logic --- (existing)
           const currentImage = selectedImage.imageElement;
           let newWidth = currentImage.width;
           let newHeight = currentImage.height;
           let newX = currentImage.position.x;
           let newY = currentImage.position.y;
           const oppositeX = currentImage.position.x + currentImage.width;
           const oppositeY = currentImage.position.y + currentImage.height;

           // Calculate new dimensions based on handle and mouse position
           if (resizeHandle.includes('e')) newWidth = Math.max(10, point.x - newX);
           if (resizeHandle.includes('w')) {
             newWidth = Math.max(10, oppositeX - point.x);
             newX = point.x;
           }
           if (resizeHandle.includes('s')) newHeight = Math.max(10, point.y - newY);
           if (resizeHandle.includes('n')) {
             newHeight = Math.max(10, oppositeY - point.y);
             newY = point.y;
           }

           // Update both selectedImage and history state
           const updatedImageElement = {
             ...currentImage,
             position: { x: newX, y: newY },
             width: newWidth,
             height: newHeight,
           };

           // Update selectedImage state
           setSelectedImage({
             ...selectedImage,
             imageElement: updatedImageElement
           });

           // Update history state
           const currentState = history[historyIndex];
           if (currentState && selectedImageIndex !== null) {
             const updatedActions = [...currentState.actions];
             updatedActions[selectedImageIndex] = {
               ...selectedImage,
               imageElement: updatedImageElement
             };
             onStateChange({ actions: updatedActions, currentAction: null });
           }

         } else if (isDragging && dragStart) {
           // --- Image Dragging Logic ---
           const newPosition = {
             x: point.x - dragStart.x,
             y: point.y - dragStart.y,
           };
           // Add safety check before updating state
           if (selectedImage.imageElement) {
             try {
               setSelectedImage({ 
                 ...selectedImage, 
                 imageElement: { 
                   ...selectedImage.imageElement, // No longer needs `!` 
                   position: newPosition 
                 }
               });
             } catch (error) {
               console.error("Error during setSelectedImage in draw (dragging image):", error);
               // Potentially stop interaction if state update fails
               setIsDragging(false);
               setIsDrawing(false);
             }
           } else {
              console.error("Dragging image, but imageElement is missing during update.");
              // Optionally stop dragging if state is corrupt?
              // setIsDragging(false);
              // setIsDrawing(false);
           }
         }
      } else if (tool === 'hand' && selectedText && selectedText.textElement && isDragging && dragStart) {
         // --- Text Dragging Logic --- (existing)
         const newPosition = {
           x: point.x - dragStart.x,
           y: point.y - dragStart.y,
         };
         // Update selectedText state for visual feedback during drag
         setSelectedText({ 
            ...selectedText, 
            textElement: { ...selectedText.textElement, position: newPosition } 
         });
         context.restore();
      } else if (currentAction && (tool === 'pencil' || tool === 'eraser')) {
        const newPoints = [...currentAction.points, point];
        setCurrentAction({ ...currentAction, points: newPoints });
        // Draw the current line segment immediately for responsiveness
        context.save();
        context.beginPath();
        context.strokeStyle = currentAction.color;
        context.lineWidth = currentAction.lineWidth;
        context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        const lastPoint = currentAction.points[currentAction.points.length - 1];
        context.moveTo(lastPoint.x, lastPoint.y);
        context.lineTo(point.x, point.y);
        context.stroke();
        context.restore();
      }
    }

    // --- Handle Hover Effects (update cursor state) --- 
    // This runs even if not actively drawing/dragging/resizing
    if (tool === 'hand' && selectedImage && !isDragging && !isResizing) {
       // Only check for handle hover if an image is selected and we're not already dragging/resizing it
       currentHoveredHandle = getResizeHandle(point, selectedImage);
    }
    
    // Update the hovered handle state at the end of the move event
    setHoveredResizeHandle(currentHoveredHandle);
  };

  const stopDrawing = (_e?: React.MouseEvent) => { 
    // Reset hover state on mouse up/leave
    setHoveredResizeHandle(null); 

    if (!isDrawing && !isResizing && !isDragging) return; // Exit if nothing was happening

    if (isDrawing && currentAction) {
      const currentState = history[historyIndex] ?? { actions: [], currentAction: null };
      const newActions = [...currentState.actions, currentAction];
      onStateChange({ actions: newActions, currentAction: null });
      setCurrentAction(null);
      setIsDrawing(false);
    } else if (tool === 'hand' && (isDragging || isResizing) && selectedImage !== null && selectedImageIndex !== null) {
      const currentState = history[historyIndex];
      if (currentState && selectedImageIndex >= 0 && selectedImageIndex < currentState.actions.length) {
        const newAction = selectedImage; // Contains the final position/size from the draw handler
        const newActions = currentState.actions.map((action, index) => 
            index === selectedImageIndex ? newAction : action
        );
        const newState: DrawingState = {
          actions: newActions,
          currentAction: null
        };
        console.log("Finalizing image drag/resize. New state:", JSON.stringify(newState)); // Log state before update
        try {
          onStateChange(newState);
        } catch (error) {
           console.error("Error during onStateChange in stopDrawing (image drag/resize):", error);
        }
      } else {
        console.error("Could not find selected image index in history on stopDrawing");
      }
       // Reset interaction states, but keep selection
       setIsDrawing(false);
       setIsDragging(false);
       setIsResizing(false);
       setDragStart(null);
       setResizeHandle(null);
       // Don't reset selectedImage or selectedImageIndex here to keep it selected

    } else if (tool === 'hand' && isDragging && selectedText !== null && selectedTextIndex !== null) {
       // Finalize Text Dragging
       const currentState = history[historyIndex];
       if (currentState && selectedTextIndex >= 0 && selectedTextIndex < currentState.actions.length) {
         const finalMovedTextAction = selectedText; // Contains the final position from the draw handler state
         const newActions = currentState.actions.map((action, index) => 
             index === selectedTextIndex ? finalMovedTextAction : action
         );
         // Create a new state object for the history
         const newState: DrawingState = {
           actions: newActions,
           currentAction: null
         };
         onStateChange(newState);
       } else {
         console.error("Could not find selected text index in history on stopDrawing");
       }
       // Reset interaction states, but keep text selected
       setIsDrawing(false);
       setIsDragging(false);
       setDragStart(null);
       // Keep selectedText and selectedTextIndex

    } else if (isDrawing && currentAction && (tool === 'pencil' || tool === 'eraser')) {
       // Finalize pencil/eraser action
       const currentState = history[historyIndex] ?? { actions: [], currentAction: null };
       const newActions = [...currentState.actions, currentAction];
       onStateChange({ actions: newActions, currentAction: null });
       setCurrentAction(null);
       setIsDrawing(false);
    } else {
       // If simply clicking without dragging (e.g., selecting without moving) or other tools end interaction
       setIsDrawing(false);
       setIsDragging(false);
       setIsResizing(false);
       setDragStart(null);
       setResizeHandle(null);
    }

    // Reset states that should always reset on mouse up/leave
    setCurrentAction(null); // Ensure current drawing action is cleared if not finalized
  };

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

  // --- Context Menu Handlers ---

  const handleCopyImage = () => {
    if (selectedImage) {
      setClipboardImage(selectedImage);
      toast({ title: "Image copied" });
    }
  }

  const handlePasteImage = () => {
    // Simplified Paste: Works if original imageId is still in cache.
    // Does NOT add the pasted image data back to cache under the new ID yet.
    if (!clipboardImage?.imageElement || !canvasRef.current || !context) return;

    // Get the original image URL from the cache using the ID from the clipboard state.
    const cachedUrl = imageDataCache[clipboardImage.imageElement.imageId];
    if (!cachedUrl) {
      console.error("Paste Error: Original image data not found in cache for ID:", clipboardImage.imageElement.imageId);
      toast({ title: "Paste Error", description: "Original image data not found.", variant: "destructive" });
      return;
    }

    // We have the URL, dimensions, create new action with new ID.
    const pastePosition = { x: 20, y: 20 }; 
    const newImageId = `img_${Date.now()}_paste_${Math.random().toString(36).substring(2, 9)}`;

    const newImageElement: ImageElement = {
      imageId: newImageId, // Assign the new ID
      position: {
        x: pastePosition.x - clipboardImage.imageElement.width / 2,
        y: pastePosition.y - clipboardImage.imageElement.height / 2
      },
      width: clipboardImage.imageElement.width,
      height: clipboardImage.imageElement.height,
    };

    const newImageAction: DrawingAction = {
      tool: 'image' as Tool,
      points: [],
      color: '',
      lineWidth: 0,
      imageElement: newImageElement
    };
    
    // Pass the single new action AND the original URL to handleStateChange in App
    onStateChange(newImageAction, cachedUrl);
    toast({ title: "Image pasted" });
    // No need to call setContextMenuPosition as it was removed from state
  }

  const handleDeleteImage = () => {
    if (selectedImage && selectedImageIndex !== null) {
      const currentHistoryState = history[historyIndex];
      if (!currentHistoryState) return;

      // Create new actions array excluding the selected image
      const newActions = currentHistoryState.actions.filter((_, index) => index !== selectedImageIndex);

      onStateChange({ actions: newActions, currentAction: null });
      setSelectedImage(null);
      setSelectedImageIndex(null);
      toast({ title: "Image deleted" });
    }
  }

  // Function to delete selected text (assuming selectedText state holds the action)
  const handleDeleteText = () => {
    if (selectedText) {
      const currentHistoryState = history[historyIndex];
      if (!currentHistoryState) return;

      // Find the index of the selected text action for robust deletion
      const textIndex = currentHistoryState.actions.findIndex(action => action === selectedText);

      if (textIndex !== -1) {
        const newActions = currentHistoryState.actions.filter((_, index) => index !== textIndex);
        onStateChange({ actions: newActions, currentAction: null });
        setSelectedText(null);
        toast({ title: "Text deleted" });
      } else {
        console.error("Selected text not found in current history state for deletion.");
        setSelectedText(null); // Clear selection anyway
      }
    }
  }

  // --- Context Menu & Double Click --- 

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Always prevent default browser context menu
    saveActiveText(); // Save any active text first
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };

    // Check if right-clicking on an existing image or text to select it
    const imageHit = hitTestImage(point);
    const textHit = textHitTest(point);

    if (imageHit) {
      setSelectedImage(imageHit.action);
      setSelectedImageIndex(imageHit.index);
      setSelectedText(null);
    } else if (textHit) {
      setSelectedText(textHit.action);
      setSelectedTextIndex(textHit.index);
      setSelectedImage(null);
      setSelectedImageIndex(null);
    } else {
      // Right-clicked on empty space: DO NOTHING to selection
    }
    
    // Let ContextMenuTrigger show the menu
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'hand') return; // Only allow editing with hand tool
    saveActiveText(); // Save any existing text first
    const currentState = history[historyIndex];
    if (!currentState) return;
    const clickPos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    
    // Check if we double-clicked on existing text to re-edit
    const textHit = textHitTest(clickPos);
    if (textHit?.action.textElement) {
        // Start editing the hit text element
        setActiveTextInput({ 
            position: textHit.action.textElement.position, 
            initialValue: textHit.action.textElement.text,
            // Optional: Consider setting width/height if needed for input sizing
        });
        setSelectedText(textHit.action); // Keep it selected visually
       setSelectedImage(null);
       setSelectedImageIndex(null);
        // Remove the action being edited from the *current* state to prevent redraw overlap
        // const currentState = history[historyIndex]; // Already defined above
        // if (currentState) { // Already checked above
           // const actionsWithoutEditingText = currentState.actions.filter(a => a !== textHit.action); // TS6133 unused
           // This temporary state update might be complex with undo/redo.
           // A simpler approach might be to just rely on the input overlaying.
           // Let's avoid modifying history directly here for simplicity.
           // onStateChange({ ...currentState, actions: actionsWithoutEditingText });
        // }
       setTimeout(() => inputRef.current?.focus(), 0); // Focus the input after render
     } else {
        // Double click on image or empty space - do nothing for now?
        // Maybe select image if double clicking on it?
        const imageHit = hitTestImage(clickPos); // Use the new image hit test
        if (imageHit) {
           setSelectedImage(imageHit.action);
           setSelectedImageIndex(imageHit.index);
           setSelectedText(null);
        }
     }
   };

  // --- JSX Rendering --- 

  return (
    <div 
      className="relative w-full h-full" 
      onContextMenu={handleContextMenu}
    >
      <TextToolbar
        ref={toolbarRef}
        show={tool === "text" || !!activeTextInput} 
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
              activeTextInput ? 'cursor-text' :
              tool === 'text' ? 'cursor-text' :
              tool === 'hand' 
                ? isResizing 
                  ? getResizeCursorClassName(resizeHandle) // Resizing: specific arrow
                  : hoveredResizeHandle 
                    ? getResizeCursorClassName(hoveredResizeHandle) // Hover handle: specific arrow
                    : isDragging 
                      ? 'cursor-grabbing' // Dragging item: grabbing hand
                      : (selectedImage || selectedText) 
                        ? 'cursor-grab' // Hover selected item: open hand
                        : 'cursor-default' // Hand tool, nothing selected: default
                : 'cursor-crosshair' // Other tools: crosshair
            }`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing} // Handle mouse leaving canvas
            onDoubleClick={handleDoubleClick}
          />
        </ContextMenuTrigger>
        <ContextMenuContent 
          onCloseAutoFocus={(e) => e.preventDefault()} // Prevent refocusing canvas after menu closes
        >
          {/* General Paste Option */} 
          {clipboardImage && (
            <ContextMenuItem onClick={handlePasteImage}> {/* No event passed anymore */}
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
          onKeyDown={handleTextInput}
          placeholder="Type..."
        />
      )}
    </div>
  )
}