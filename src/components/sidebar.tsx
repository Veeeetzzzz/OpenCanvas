import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Plus, FolderOpen, Trash2, Copy } from "lucide-react"
import { DrawingState } from '@/lib/types'; // Assuming DrawingState is exported from types

// Define the structure for a single document (matches App.tsx)
interface Document {
  id: string;
  name: string;
  history: DrawingState[];
  historyIndex: number;
}

// Define the props for the Sidebar component
interface SidebarProps {
  documents: Document[];
  currentDocumentId: string | null;
  onNewDocument: () => void;
  onSwitchDocument: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onCopyDocument: (docId: string) => void;
}

export function Sidebar({ documents, currentDocumentId, onNewDocument, onSwitchDocument, onDeleteDocument, onCopyDocument }: SidebarProps) {
  return (
    <div className="w-[300px] border-r bg-muted/40 flex flex-col">
      <div className="p-4 border-b">
        <Button className="w-full justify-start gap-2" onClick={onNewDocument}>
          <Plus className="h-4 w-4" />
          New Document
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Recent Documents</h2>
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center group">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 flex-1 truncate",
                    doc.id === currentDocumentId && "bg-accent"
                  )}
                  onClick={() => onSwitchDocument(doc.id)}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{doc.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyDocument(doc.id);
                  }}
                  aria-label={`Copy ${doc.name}`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {documents.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 text-destructive hover:text-destructive/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(doc.id);
                    }}
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}