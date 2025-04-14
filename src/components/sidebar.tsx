import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { 
  Plus, 
  FolderOpen, 
  Trash2, 
  Copy, 
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react"
import { DrawingState } from '@/lib/types'; // Assuming DrawingState is exported from types
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"

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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  documents, 
  currentDocumentId, 
  onNewDocument, 
  onSwitchDocument, 
  onDeleteDocument, 
  onCopyDocument,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  return (
    <aside 
      className={cn(
        "border-r bg-muted/40 flex flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[60px]" : "w-[300px]"
      )}
    >
      <div className={cn("p-2 border-b flex items-center", isCollapsed ? "justify-center" : "justify-between")} >
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                className={cn("justify-start gap-2", isCollapsed ? "w-full justify-center" : "flex-grow")}
                onClick={onNewDocument}
                size={isCollapsed ? "icon" : "default"}
                variant="ghost"
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">New Document</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right"><p>New Document</p></TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
               <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 flex-shrink-0"
                  onClick={onToggleCollapse}
                  aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
               >
                  {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
               </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
               <p>{isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {!isCollapsed && (
            <h2 className="px-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Documents</h2>
          )}
          {documents.map((doc) => (
            <TooltipProvider key={doc.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={cn(
                      "flex items-center group rounded-md", 
                      doc.id === currentDocumentId && "bg-accent",
                      isCollapsed ? "justify-center" : "justify-start"
                    )}
                    onClick={() => onSwitchDocument(doc.id)}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full gap-2 flex-1 truncate h-8", 
                        doc.id === currentDocumentId && "bg-accent",
                        isCollapsed ? "justify-center px-0" : "justify-start px-2"
                      )}
                      aria-label={doc.name}
                    >
                      <FolderOpen className="h-4 w-4 flex-shrink-0" />
                      {!isCollapsed && <span className="flex-1 truncate text-sm font-normal">{doc.name}</span>}
                    </Button>
                    {!isCollapsed && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 ml-1"
                          onClick={(e) => { e.stopPropagation(); onCopyDocument(doc.id); }}
                          aria-label={`Copy ${doc.name}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {documents.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 text-destructive hover:text-destructive/80"
                            onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }}
                            aria-label={`Delete ${doc.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right"><p>{doc.name}</p></TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}