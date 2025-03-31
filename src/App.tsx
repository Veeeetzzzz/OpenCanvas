import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/mode-toggle';
import { Canvas } from '@/components/canvas';
import { Toolbar } from '@/components/toolbar';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';
import { Tool, DrawingState } from '@/lib/types';
import { useState } from 'react';

function App() {
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [history, setHistory] = useState<DrawingState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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
  return (
    <ThemeProvider defaultTheme="light" storageKey="doodle-theme">
      <div className="min-h-screen bg-background">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h1 className="text-2xl font-semibold">Flow</h1>
              <div className="flex items-center gap-2">
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
                  onStateChange={handleStateChange}
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