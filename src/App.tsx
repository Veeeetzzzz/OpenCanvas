import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Canvas } from '@/components/canvas';
import { Toolbar } from '@/components/toolbar';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';
import { Tool, DrawingState, ImageElement, DrawingAction } from '@/lib/types';
import { useState, useRef, useEffect } from 'react';

function App() {
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [history, setHistory] = useState<DrawingState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

  const handleStateChange = (newState: DrawingState) => {
    const newHistory = [...history.slice(0, historyIndex + 1), newState];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Trigger file input when 'image' tool is selected
  useEffect(() => {
    if (tool === 'image' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [tool]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        if (imageUrl) {
          // Create a default image element (adjust position/size as needed)
          const imageElement: ImageElement = {
            url: imageUrl,
            position: { x: 100, y: 100 }, // Example starting position
            width: 200, // Example starting width
            height: 150, // Example starting height
          };

          // Create a drawing action for the image
          const imageAction: DrawingAction = {
            tool: 'image',
            points: [], // No points needed for image placement
            color: '', // Color not relevant for image
            lineWidth: 0, // Line width not relevant
            imageElement: imageElement,
          };

          // Get the current state or initialize if history is empty
          const currentState = historyIndex >= 0 ? history[historyIndex] : { actions: [], currentAction: null };
          const newState: DrawingState = {
            ...currentState,
            actions: [...currentState.actions, imageAction], // Add the new image action
            currentAction: null, // Clear any ongoing action
          };

          handleStateChange(newState);
          setTool('hand'); // Switch to hand tool after placing image
        }
      };
      reader.readAsDataURL(file);

      // Reset file input value to allow uploading the same file again
       if (fileInputRef.current) {
         fileInputRef.current.value = '';
       }
    } else {
      // If no file was selected (e.g., user cancelled), switch back to previous tool or default
      setTool('hand'); // Or potentially track the previous tool
    }
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="doodle-theme">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <div className="min-h-screen bg-background">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h1 className="text-2xl font-semibold">Flow</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>Share</Button>
                <ModeToggle />
              </div>
            </div>
            <div className="flex-1 flex">
              <Toolbar
                tool={tool}
                color={color}
                onToolChange={setTool}
                onColorChange={setColor}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
              />
              <div className={cn("flex-1 h-full relative bg-muted/30")}>
                <Canvas
                  tool={tool}
                  color={color}
                  onColorChange={setColor}
                  onToolChange={setTool}
                  onStateChange={handleStateChange}
                  history={history}
                  historyIndex={historyIndex}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;