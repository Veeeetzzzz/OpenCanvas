import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Canvas } from '@/components/canvas';
import { Toolbar } from '@/components/toolbar';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';
import { Tool, DrawingState, ImageElement, DrawingAction } from '@/lib/types';
import { useState, useRef, useEffect } from 'react';

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
  // State to hold all documents
  const [documents, setDocuments] = useState<Document[]>([]);
  // State to track the ID of the currently active document
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

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


  // Update state change handler to modify the correct document
  const handleStateChange = (newState: DrawingState) => {
    if (!currentDocumentId) return; // Don't do anything if no document is active

    const nextHistory = [...currentHistory.slice(0, currentHistoryIndex + 1), newState];
    const nextHistoryIndex = nextHistory.length - 1;

    setDocuments(docs =>
      docs.map(doc =>
        doc.id === currentDocumentId
          ? { ...doc, history: nextHistory, historyIndex: nextHistoryIndex }
          : doc
      )
    );
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
    // Prevent deleting the last document
    if (documents.length <= 1) return;

    setDocuments(docs => docs.filter(doc => doc.id !== docId));

    // If the deleted document was the current one, switch to another
    if (currentDocumentId === docId) {
        const remainingDocs = documents.filter(doc => doc.id !== docId);
        setCurrentDocumentId(remainingDocs[0]?.id ?? null);
    }
  };

  // Function to copy/duplicate a document
  const handleCopyDocument = (docId: string) => {
    const docToCopy = documents.find(doc => doc.id === docId);
    if (!docToCopy) return;

    const newDocId = `doc_${Date.now()}_copy`;
    const newDocName = `${docToCopy.name} Copy`;
    const newDocument: Document = {
      ...docToCopy, // Copy properties like historyIndex
      id: newDocId,
      name: newDocName,
      // Deep copy history to prevent shared state issues
      history: JSON.parse(JSON.stringify(docToCopy.history)),
    };

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
          const currentState = currentHistoryIndex >= 0 ? currentHistory[currentHistoryIndex] : { actions: [], currentAction: null };
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
                canUndo={currentHistoryIndex > 0}
                canRedo={currentHistoryIndex < currentHistory.length - 1}
              />
              <div className={cn("flex-1 h-full relative bg-muted/30")}>
                <Canvas
                  tool={tool}
                  color={color}
                  onColorChange={setColor}
                  onToolChange={setTool}
                  onStateChange={handleStateChange}
                  history={currentHistory}
                  historyIndex={currentHistoryIndex}
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