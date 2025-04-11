import { useEffect, useRef, useState, useCallback, forwardRef } from "react"
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
import { BackgroundStyle } from "@/components/settings-dialog"

interface CanvasProps {
  tool: Tool;
  color: string;
  pencilWidth: number;
  eraserWidth: number;
  onColorChange: (color: string) => void;
  onToolChange: (tool: Tool) => void;
  onStateChange: (update: DrawingState | DrawingAction, pastedImageDataUrl?: string) => void;
  history: DrawingState[];
  historyIndex: number;
  imageDataCache: Record<string, string>;
  gridEnabled?: boolean;
  backgroundColor: string;
  backgroundStyle: BackgroundStyle;
}

const DEFAULT_GRID_SIZE = 20; // Define default grid size
const BACKGROUND_STYLE_COLOR = "#CCCCCC"; // Color for dots/lines/squares

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>((
  {
    tool,
    color,
    pencilWidth,
    eraserWidth,
    onColorChange,
    onStateChange,
    history,
    historyIndex,
    imageDataCache,
    gridEnabled = false,
    backgroundColor,
    backgroundStyle,
  },
  ref
) => {
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
  const [isTextToolbarPinned, setIsTextToolbarPinned] = useState(false)

  // --- Tool State Cleanup ---
  const cleanupToolStates = useCallback(() => {
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
    // Don't reset the input ref value here, text saving handles that
  }, []); // Empty dependency array as it only uses setters

  // --- Helper Function to Save Text (Memoized) --- 
  const saveActiveText = useCallback(() => {
    if (!inputRef.current || !context || !activeTextInput) {
      if (activeTextInput) setActiveTextInput(null);
      return;
    }
    const text = inputRef.current.value;
    const isTrimmedEmpty = text.trim().length === 0;
    const isIdenticalToInitial = activeTextInput.initialValue && text === activeTextInput.initialValue;
    let shouldDeactivate = false;

    if (!isTrimmedEmpty) {
      if (isIdenticalToInitial) {
        shouldDeactivate = true;
      } else {
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
      if (activeTextInput.initialValue !== '') {
        shouldDeactivate = true;
      }
    }

    if (shouldDeactivate) {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      setActiveTextInput(null); 
    }
  // Add dependencies for useCallback
  }, [inputRef, context, activeTextInput, font, fontSize, color, history, historyIndex, onStateChange]);

  // --- Canvas Redrawing (Memoized) --- 
  const redrawCanvas = useCallback(() => {
    const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
    if (!context || !canvas) return;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // 1. Clear & Draw Background Color
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw Background Style (Dots, Squares, Lines)
    context.save();
    context.strokeStyle = BACKGROUND_STYLE_COLOR;
    context.fillStyle = BACKGROUND_STYLE_COLOR;
    context.lineWidth = 0.5;
    const styleSize = DEFAULT_GRID_SIZE; // Use grid size for spacing

    if (backgroundStyle === 'dots') {
      for (let x = styleSize; x < canvasWidth; x += styleSize) {
        for (let y = styleSize; y < canvasHeight; y += styleSize) {
          context.beginPath();
          context.arc(x, y, 1, 0, Math.PI * 2); // Draw small dots
          context.fill();
        }
      }
    } else if (backgroundStyle === 'squares' || backgroundStyle === 'lines') {
      // Vertical lines (for squares and lines)
      for (let x = styleSize; x < canvasWidth; x += styleSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvasHeight);
        context.stroke();
      }
      // Horizontal lines (for squares only)
      if (backgroundStyle === 'squares') {
        for (let y = styleSize; y < canvasHeight; y += styleSize) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(canvasWidth, y);
          context.stroke();
        }
      }
    }
    context.restore();

    // 3. Draw Drawing Grid Overlay (if enabled)
    if (gridEnabled) {
      context.save();
      context.strokeStyle = "#e0e0e0"; // Lighter color for overlay grid
      context.lineWidth = 0.5;
      const gridSize = DEFAULT_GRID_SIZE;
      // Draw vertical lines
      for (let x = gridSize; x < canvasWidth; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvasHeight);
        context.stroke();
      }
      // Draw horizontal lines
      for (let y = gridSize; y < canvasHeight; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvasWidth, y);
        context.stroke();
      }
      context.restore();
    }

    // 4. Draw History Actions (pencil, text, images)
    const currentState = history[historyIndex];
    if (currentState) {
      currentState.actions.forEach(action => {
        context.save();
        // Pencil/Eraser
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
        // Text
        } else if (action.textElement) {
          context.textBaseline = 'top';
          const { text, position, font, fontSize, color } = action.textElement;
          context.font = `${fontSize}px ${font}`;
          context.fillStyle = color;
          context.fillText(text, position.x, position.y);
        // Image
        } else if (action.imageElement) {
          const imageUrl = imageDataCache[action.imageElement.imageId];
          if (imageUrl) {
            const img = new Image();
            img.src = imageUrl;
            // Attempt to draw synchronously if already loaded, else use onload
            if (img.complete && img.naturalHeight !== 0) {
                 context.drawImage(img, action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
            } else {
                img.onload = () => {
                    if (action.imageElement) { // Check again in case action changed
                       context.drawImage(img, action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
                    }
                };
                img.onerror = () => {
                    console.error("Failed to load image for drawing:", imageUrl);
                     // Draw placeholder on error
                     if (action.imageElement) { // Check if element exists before accessing props
                      context.strokeRect(action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
                      context.fillText("?", action.imageElement.position.x + action.imageElement.width / 2, action.imageElement.position.y + action.imageElement.height / 2);
                     }
                }
            }
        } else if (action.imageElement) { // Added check for imageElement here too
             // Draw placeholder if URL missing
             context.strokeRect(action.imageElement.position.x, action.imageElement.position.y, action.imageElement.width, action.imageElement.height);
             context.fillText("?", action.imageElement.position.x + action.imageElement.width / 2, action.imageElement.position.y + action.imageElement.height / 2);
          }
        }
        context.restore();
      });
    }
    
    // 5. Draw UI elements (selection, resize handles)
    context.save();
    // Text Selection Highlight
    if (selectedText?.textElement && tool === 'hand') {
        const { text, position, font, fontSize } = selectedText.textElement;
        context.font = `${fontSize}px ${font}`;
        const metrics = context.measureText(text);
        context.strokeStyle = 'rgba(0, 100, 255, 0.7)';
        context.lineWidth = 1;
        context.setLineDash([4, 2]);
        context.strokeRect(position.x - 2, position.y - 2, metrics.width + 4, fontSize * 1.2 + 4);
        context.setLineDash([]);
    }
    // Image Resize Handles
    if (selectedImage?.imageElement && tool === 'hand') {
      const { position, width, height } = selectedImage.imageElement;
      const handleSize = 8;
      context.fillStyle = 'white';
      context.strokeStyle = 'black';
      context.lineWidth = 1;
      const handles = [
        { x: position.x, y: position.y }, // nw
        { x: position.x + width, y: position.y }, // ne
        { x: position.x, y: position.y + height }, // sw
        { x: position.x + width, y: position.y + height } // se
      ];
      handles.forEach(handle => {
        context.beginPath();
        context.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
    }
    context.restore();
  // Add dependencies for useCallback
  }, [context, backgroundColor, backgroundStyle, gridEnabled, history, historyIndex, imageDataCache, tool, selectedText, selectedImage, ref]);

  // --- Effects --- 

  // Effect for primary redraw trigger
  useEffect(() => {
    redrawCanvas();
    // Depend only on the memoized redrawCanvas function
  }, [redrawCanvas]);

  // Effect for setting up canvas context and resize observer
  useEffect(() => {
    const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
    if (canvas) {
      const observer = new ResizeObserver(() => {
         canvas.width = canvas.offsetWidth;
         canvas.height = canvas.offsetHeight;
         const ctx = canvas.getContext("2d");
         if (ctx) {
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            setContext(ctx);
            // No need to call redrawCanvas here, 
            // setContext will trigger state change -> redrawCanvas effect
         } else {
            setContext(null);
         }
      });
      observer.observe(canvas);

      // Initial context setup
      const ctx = canvas.getContext("2d");
      if (ctx) {
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          setContext(ctx);
      }
      
      // Set initial size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // The initial redraw will happen due to the setContext call triggering the other effect

      return () => observer.disconnect();
    }
  }, [ref]); // Run only once on mount

  // Effect to handle tool changes 
  useEffect(() => {
    if (tool !== 'text' && activeTextInput) {
      saveActiveText(); 
    }
    if (tool !== 'hand') {
      setSelectedImage(null);
      setSelectedImageIndex(null); 
      setSelectedText(null);
    }
    if (tool === 'pencil' || tool === 'eraser' || tool === 'image') {
      setIsTextToolbarPinned(false);
    }
  }, [tool, activeTextInput, saveActiveText]); // Dependency saveActiveText is now stable

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

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!context) return;
    cleanupToolStates(); // Call the restored cleanup function

    const { offsetX, offsetY } = event.nativeEvent;
    const point = { x: offsetX, y: offsetY };
    setIsDrawing(true);

    if (tool === 'pencil' || tool === 'eraser') {
      // Use the correct width based on the tool
      const width = tool === 'pencil' ? pencilWidth : eraserWidth;
      setCurrentAction({
        tool,
        points: [point],
        color: tool === 'eraser' ? '#000000' : color, 
        lineWidth: width, // Use the determined width
      });
    } else if (tool === 'text') {
      // Handle text activation
      setActiveTextInput({ position: point, initialValue: '' });
    } else if (tool === 'hand') {
       // Handle selection/drag initiation for hand tool
       const currentState = history[historyIndex];
       if (!currentState) return;
       
       // Check for text hit first
       const textHit = textHitTest(point);
       if (textHit) {
         setSelectedText(textHit.action);
         setSelectedTextIndex(textHit.index);
         setSelectedImage(null);
         setSelectedImageIndex(null);
         setIsDragging(true);
         setDragStart({ x: point.x - textHit.action.textElement!.position.x, y: point.y - textHit.action.textElement!.position.y });
         event.preventDefault(); // Prevent default text selection
       } else {
         // Then check for image hit
         const imageHit = hitTestImage(point);
         if (imageHit) {
           if (!imageHit.action.imageElement?.imageId) {
             console.error("Attempted to select an image action with a missing imageId.", imageHit.action);
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
             setDragStart(point); // Use raw point for resize origin
           } else {
             setIsDragging(true);
             // Use offset from top-left for drag origin
             setDragStart({ x: point.x - imageHit.action.imageElement.position.x, y: point.y - imageHit.action.imageElement.position.y });
           }
         } else {
           // If nothing is hit, clear selections
           setSelectedText(null);
           setSelectedTextIndex(null);
           setSelectedImage(null);
           setSelectedImageIndex(null);
         }
       } 
    }
  };

  const draw = (e: React.MouseEvent) => {
    if (!context) return;
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    let currentHoveredHandle: string | null = null;

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
        // Get the last point BEFORE adding the new one
        const lastPoint = currentAction.points[currentAction.points.length - 1];
        const newPoint = point; // Current mouse position

        // --- Draw the current segment FIRST for immediate feedback ---
        context.save();
        context.beginPath();
        context.strokeStyle = currentAction.color;
        context.lineWidth = currentAction.lineWidth;
        context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        context.moveTo(lastPoint.x, lastPoint.y);
        context.lineTo(newPoint.x, newPoint.y);
        context.stroke();
        context.restore();
        // --- END immediate drawing ---

        // --- THEN update the state ---
        const newPoints = [...currentAction.points, newPoint];
        const updatedAction = { ...currentAction, points: newPoints };
        setCurrentAction(updatedAction);
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
    if (!clipboardImage?.imageElement || !ref || !context) return;

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

  // --- Pin Toggle Handler ---
  const handleTextToolbarPinToggle = useCallback(() => {
    // Removed console.log
    setIsTextToolbarPinned(prev => !prev);
  }, []); // Reverted dependency, only needs setter

  // --- JSX Rendering --- 

  // Determine toolbar visibility
  const showTextToolbar = tool === "text" || !!activeTextInput || isTextToolbarPinned;
  // Removed console.log

  return (
    <div 
      className="relative w-full h-full" 
      onContextMenu={handleContextMenu}
    >
      <TextToolbar
        ref={toolbarRef}
        show={showTextToolbar} // Use the new condition
        color={color}
        onColorChange={onColorChange}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        font={font}
        onFontChange={setFont}
        isPinned={isTextToolbarPinned} // Pass pin state
        onPinToggle={handleTextToolbarPinToggle} // Pass toggle handler
      />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <canvas
            ref={ref}
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
});

Canvas.displayName = 'Canvas'; // Add display name for DevTools