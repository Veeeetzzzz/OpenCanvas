import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Canvas } from '@/components/canvas';
import { Toolbar } from '@/components/toolbar';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';
import { Tool, DrawingState, ImageElement, DrawingAction } from '@/lib/types';
import { useState, useRef, useEffect } from 'react';
import { SettingsDialog, AppSettings, BackgroundStyle } from "@/components/settings-dialog";
import { FileDown } from "lucide-react";
import { ExportDialog } from "@/components/export-dialog";

// Define the structure for a single document
interface Document {
  id: string;
  name: string;
  history: DrawingState[];
  historyIndex: number;
}

function App() {
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [pencilWidth, setPencilWidth] = useState(5);
  const [eraserWidth, setEraserWidth] = useState(20);
  // State to hold all documents
  const [documents, setDocuments] = useState<Document[]>([]);
  // State to track the ID of the currently active document
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  // State for image data cache (maps imageId to data URL)
  const [imageDataCache, setImageDataCache] = useState<Record<string, string>>({}); 
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input
  const [settings, setSettings] = useState<AppSettings>({
    gridEnabled: false,
    showTooltips: true,
    backgroundColor: '#FFFFFF', // Default background color
    backgroundStyle: 'blank', // Default background style
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false); // State for export dialog
  const canvasRef = useRef<HTMLCanvasElement>(null); // Create ref for Canvas

  // Find the current document based on the ID
  const currentDocument = documents.find(doc => doc.id === currentDocumentId);
  // Derive current history and index from the current document
  const currentHistory = currentDocument?.history ?? [];
  const currentHistoryIndex = currentDocument?.historyIndex ?? -1;

  // Effect to load documents from sessionStorage on mount
  useEffect(() => {
    const savedDocs = sessionStorage.getItem('openCanvasDocuments');
    const savedCurrentId = sessionStorage.getItem('openCanvasCurrentId');
    if (savedDocs) {
      try {
        const parsedDocs: Document[] = JSON.parse(savedDocs);
        if (Array.isArray(parsedDocs) && parsedDocs.length > 0) {
          setDocuments(parsedDocs);
          // Restore the last active document ID, or default to the first one
          setCurrentDocumentId(savedCurrentId ?? parsedDocs[0]?.id ?? null);
          return; // Exit early if loaded successfully
        }
      } catch (error) {
        console.error("Failed to parse documents from sessionStorage:", error);
        // Clear potentially corrupted data
        sessionStorage.removeItem('openCanvasDocuments');
        sessionStorage.removeItem('openCanvasCurrentId');
      }
    }
    // If no saved data or parsing failed, initialize with one new document
    handleNewDocument();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to save documents and current ID to sessionStorage whenever they change
  useEffect(() => {
    if (documents.length > 0 && currentDocumentId) {
        sessionStorage.setItem('openCanvasDocuments', JSON.stringify(documents));
        sessionStorage.setItem('openCanvasCurrentId', currentDocumentId);
    }
  }, [documents, currentDocumentId]);


  // Update state change handler to optionally accept image data for caching
  const handleStateChange = (update: DrawingState | DrawingAction, pastedImageDataUrl?: string) => {
    if (!currentDocumentId) return; 

    // Update image cache first if necessary
    if (pastedImageDataUrl && !('actions' in update) && update.imageElement) {
      const newImageId = update.imageElement.imageId;
      setImageDataCache(prevCache => ({ ...prevCache, [newImageId]: pastedImageDataUrl }));
    }

    // Now update the documents state (history)
    setDocuments(docs => {
      const docIndex = docs.findIndex(d => d.id === currentDocumentId);
      if (docIndex === -1) return docs; // Should not happen

      const currentDoc = docs[docIndex];
      let nextHistory: DrawingState[];
      let nextHistoryIndex: number;

      if ('actions' in update) { 
        // Received a full DrawingState (e.g., from canvas stopDrawing)
        const newState = update;
        nextHistory = [...currentDoc.history.slice(0, currentDoc.historyIndex + 1), newState];
        nextHistoryIndex = nextHistory.length - 1;
      } else {
        // Received a single DrawingAction (e.g., from image upload)
        const newAction = update;
        const currentState = currentDoc.history[currentDoc.historyIndex] ?? { actions: [], currentAction: null };
        const newState: DrawingState = {
          ...currentState,
          actions: [...currentState.actions, newAction],
          currentAction: null, // Ensure currentAction is cleared when adding a discrete action
        };
        nextHistory = [...currentDoc.history.slice(0, currentDoc.historyIndex + 1), newState];
        nextHistoryIndex = nextHistory.length - 1;
      }

      const updatedDoc = { ...currentDoc, history: nextHistory, historyIndex: nextHistoryIndex };

      // Create a new array with the updated document
      const newDocs = [...docs];
      newDocs[docIndex] = updatedDoc;
      return newDocs;
    });
  };

  // Update undo handler
  const handleUndo = () => {
    if (!currentDocumentId || currentHistoryIndex <= 0) return;

    setDocuments(docs =>
      docs.map(doc =>
        doc.id === currentDocumentId
          ? { ...doc, historyIndex: currentHistoryIndex - 1 }
          : doc
      )
    );
  };

  // Update redo handler
  const handleRedo = () => {
    if (!currentDocumentId || currentHistoryIndex >= currentHistory.length - 1) return;

    setDocuments(docs =>
      docs.map(doc =>
        doc.id === currentDocumentId
          ? { ...doc, historyIndex: currentHistoryIndex + 1 }
          : doc
      )
    );
  };

  // Function to switch the active document
  const handleSwitchDocument = (docId: string) => {
    setCurrentDocumentId(docId);
  };

   // Function to create a new document
  const handleNewDocument = () => {
    const newDocId = `doc_${Date.now()}`; // Simple unique ID
    // Determine a simple name for the new document
    const newDocName = `Document ${documents.length + 1}`;
    const newDocument: Document = {
      id: newDocId,
      name: newDocName,
      history: [],
      historyIndex: -1,
    };
    setDocuments(docs => [...docs, newDocument]);
    setCurrentDocumentId(newDocId);
    setTool('pencil'); // Reset tool for new document
    setColor('#000000'); // Reset color
  };

  // Function to delete a document
  const handleDeleteDocument = (docId: string) => {
    setDocuments(docs => {
      const newDocs = docs.filter(doc => doc.id !== docId);
      
      // If this was the last document, create a new empty one
      if (newDocs.length === 0) {
        const newDocId = `doc_${Date.now()}`;
        const newDocument: Document = {
          id: newDocId,
          name: "Untitled",
          history: [],
          historyIndex: -1,
        };
        setCurrentDocumentId(newDocId);
        return [newDocument];
      }

      // If the deleted document was the current one, switch to another
      if (currentDocumentId === docId) {
        const remainingDoc = newDocs[0];
        setCurrentDocumentId(remainingDoc.id);
      }

      return newDocs;
    });
  };

  // Function to copy/duplicate a document
  const handleCopyDocument = (docId: string) => {
    const docToCopy = documents.find(doc => doc.id === docId);
    if (!docToCopy) return;

    const newDocId = `doc_${Date.now()}_copy`;
    const newDocName = `${docToCopy.name} Copy`;
    
    // Deep copy history to prevent shared state issues
    const copiedHistory = JSON.parse(JSON.stringify(docToCopy.history));

    // Create the new document structure
    const newDocument: Document = {
      ...docToCopy, // Copy historyIndex
      id: newDocId,
      name: newDocName,
      history: copiedHistory,
    };

    // Ensure image data used in the copied history is also present in the cache
    // This typically won't be needed if cache persists, but good practice
    copiedHistory.forEach((state: DrawingState) => {
      state.actions.forEach((action: DrawingAction) => {
        if (action.imageElement?.imageId && imageDataCache[action.imageElement.imageId]) {
          // If we needed to transfer cache state, we could do it here
          // But since the cache is in App state, it should be available
        }
      });
    });

    // Insert the new document right after the original one
    const originalIndex = documents.findIndex(doc => doc.id === docId);
    setDocuments(docs => [
      ...docs.slice(0, originalIndex + 1),
      newDocument,
      ...docs.slice(originalIndex + 1),
    ]);

    // Optionally, switch to the new copy immediately
    // setCurrentDocumentId(newDocId);
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
          const img = new Image();
          img.onload = () => {
            // Use natural dimensions directly, removed settings dependency
            const width = img.naturalWidth;
            const height = img.naturalHeight;

            const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            setImageDataCache(prevCache => ({ 
              ...prevCache, 
              [imageId]: imageUrl 
            }));

            const imageElement: ImageElement = {
              imageId: imageId,
              position: { x: 100, y: 100 }, 
              width: width,
              height: height,
            };
            
            const imageAction: DrawingAction = {
              tool: 'image',
              points: [],
              color: '',
              lineWidth: 0,
              imageElement: imageElement,
            };
            
            handleStateChange(imageAction);
            setTool('hand');
          };
          img.onerror = () => {
            console.error("Error loading image to get dimensions.");
            setTool('hand');
          };
          img.src = imageUrl;
        }
      };
      reader.readAsDataURL(file);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setTool('hand');
    }
  };

  // --- Helper: Trigger Download --- 
  const triggerDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Export Functions --- 
  const handleExportPNG = () => {
    if (!canvasRef.current) return;
    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL("image/png");
      const docName = currentDocument?.name || "Untitled";
      const filename = `${docName.replace(/\s+/g, '_')}_export.png`;
      triggerDownload(dataUrl, filename);
    } catch (error) {
      console.error("Failed to export canvas as PNG:", error);
      // TODO: Show toast notification
    }
  };

  const handleExportJPEG = () => {
    if (!canvasRef.current) return;
    try {
      const originalCanvas = canvasRef.current;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalCanvas.width;
      tempCanvas.height = originalCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        throw new Error("Could not get temporary canvas context");
      }

      // Draw white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw original canvas content on top
      tempCtx.drawImage(originalCanvas, 0, 0);

      // Get data URL as JPEG
      const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.9); // Quality 0.9
      const docName = currentDocument?.name || "Untitled";
      const filename = `${docName.replace(/\s+/g, '_')}_export.jpg`; // Use .jpg extension
      triggerDownload(dataUrl, filename);

    } catch (error) {
      console.error("Failed to export canvas as JPEG:", error);
      // TODO: Show toast notification
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
          <Sidebar
            documents={documents}
            currentDocumentId={currentDocumentId}
            onNewDocument={handleNewDocument}
            onSwitchDocument={handleSwitchDocument}
            onDeleteDocument={handleDeleteDocument}
            onCopyDocument={handleCopyDocument}
          />
          <main className="flex-1 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div></div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsExportDialogOpen(true)}
                  title="Export Canvas"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" disabled>Share</Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsSettingsOpen(true)}
                >
                  Settings
                </Button>
                <ModeToggle />
              </div>
            </div>
            <div className="flex-1 flex">
              <Toolbar
                tool={tool}
                color={color}
                pencilWidth={pencilWidth}
                eraserWidth={eraserWidth}
                onToolChange={setTool}
                onColorChange={setColor}
                onPencilWidthChange={setPencilWidth}
                onEraserWidthChange={setEraserWidth}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={currentHistoryIndex > 0}
                canRedo={currentHistoryIndex < currentHistory.length - 1}
                showTooltips={settings.showTooltips}
              />
              <div className={cn("flex-1 h-full relative bg-muted/30")}>
                <Canvas
                  ref={canvasRef}
                  tool={tool}
                  color={color}
                  pencilWidth={pencilWidth}
                  eraserWidth={eraserWidth}
                  onColorChange={setColor}
                  onToolChange={setTool}
                  onStateChange={handleStateChange}
                  history={currentHistory}
                  historyIndex={currentHistoryIndex}
                  imageDataCache={imageDataCache}
                  gridEnabled={settings.gridEnabled}
                  backgroundColor={settings.backgroundColor}
                  backgroundStyle={settings.backgroundStyle}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExportPNG={handleExportPNG}
        onExportJPEG={handleExportJPEG}
      />
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onSettingsChange={setSettings}
        currentSettings={settings}
      />
    </ThemeProvider>
  );
}

export default App;