import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { 
  Plus, 
  FolderOpen, 
  Trash2, 
  Copy, 
  PanelLeftClose,
  PanelLeftOpen,
  Pencil
} from "lucide-react"
import { DrawingState } from '@/lib/types'; // Assuming DrawingState is exported from types
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuTrigger 
} from "@/components/ui/context-menu"
import React, { useRef, useEffect, useState } from "react"

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
  renamingDocId: string | null;
  onStartRename: (docId: string) => void;
  onConfirmRename: (finalName: string) => void;
  onCancelRename: () => void;
}

export function Sidebar({
  documents, 
  currentDocumentId, 
  onNewDocument, 
  onSwitchDocument, 
  onDeleteDocument, 
  onCopyDocument,
  isCollapsed,
  onToggleCollapse,
  renamingDocId,
  onStartRename,
  onConfirmRename,
  onCancelRename
}: SidebarProps) {
  // Log received props on every render
  console.log("[Sidebar] Rendered. renamingDocId:", renamingDocId);
  
  const renameInputRef = useRef<HTMLInputElement>(null);
  // Local state for the input value during rename
  const [localRenameValue, setLocalRenameValue] = useState("");

  // Effect to focus input and set local value when renaming starts
  useEffect(() => {
    if (renamingDocId) {
      // Find the doc being renamed to get initial value
      const docBeingRenamed = documents.find(d => d.id === renamingDocId);
      setLocalRenameValue(docBeingRenamed?.name || ""); // Set local state
      
      const timerId = setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus();
          renameInputRef.current.select();
        }
      }, 0);
      return () => clearTimeout(timerId);
    } else {
      setLocalRenameValue(""); // Clear local state when not renaming
    }
  }, [renamingDocId, documents]); // Depend on documents too

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Pass the *local* value up on confirm
      onConfirmRename(localRenameValue); 
    } else if (e.key === 'Escape') {
      onCancelRename();
    }
  };

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
            <ContextMenu key={doc.id}>
              <ContextMenuTrigger 
                disabled={isCollapsed || !!renamingDocId} // Disable trigger when collapsed or another item is being renamed
                className={cn(
                  "flex items-center group rounded-md w-full", 
                  doc.id === currentDocumentId && !renamingDocId && "bg-accent", // Don't highlight when renaming
                  isCollapsed ? "justify-center" : "justify-start"
                )}
              >
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className={cn(
                          "flex items-center w-full", 
                          isCollapsed ? "justify-center" : "justify-start"
                        )}
                        onClick={renamingDocId === doc.id ? undefined : () => onSwitchDocument(doc.id)} // Prevent switching while renaming
                      >
                        <Button
                          variant="ghost"
                          className={cn(
                            "gap-2 flex-1 truncate h-8",
                            isCollapsed ? "justify-center px-0 w-auto" : "justify-start px-2 w-full",
                             // Ensure button matches div bg only when NOT renaming
                            doc.id === currentDocumentId && !renamingDocId && "bg-accent hover:bg-accent", 
                            // Dim button slightly when renaming THIS item
                            renamingDocId === doc.id && "opacity-70" 
                          )}
                          aria-label={doc.name}
                          disabled={renamingDocId === doc.id} // Disable button part when renaming
                        >
                          <FolderOpen className="h-4 w-4 flex-shrink-0" />
                          {/* Conditionally render Input or Span */} 
                          {!isCollapsed && (
                             renamingDocId === doc.id ? (
                               <Input 
                                 ref={renameInputRef}
                                 value={localRenameValue}
                                 onChange={(e) => setLocalRenameValue(e.target.value)}
                                 onKeyDown={handleRenameKeyDown}
                                 className="h-6 text-sm font-normal flex-1 ml-1 p-1 bg-transparent border rounded border-primary"
                               />
                             ) : (
                               <span className="flex-1 truncate text-sm font-normal">{doc.name}</span>
                             )
                          )}
                        </Button>
                        {!isCollapsed && renamingDocId !== doc.id && (
                           // Show Copy/Delete only when expanded and NOT renaming THIS item
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 text-destructive hover:text-destructive/80"
                              onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }}
                              aria-label={`Delete ${doc.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right"><p>{doc.name}</p></TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={(e) => { 
                    e.stopPropagation(); // Prevent click from bubbling further
                    onStartRename(doc.id); 
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  <span>Rename</span>
                </ContextMenuItem>
                {/* Add other context items like Copy/Delete here if desired */}
                <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCopyDocument(doc.id); }}>
                   <Copy className="mr-2 h-4 w-4" />
                   <span>Duplicate</span>
                </ContextMenuItem>
                <ContextMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }}>
                   <Trash2 className="mr-2 h-4 w-4" />
                   <span>Delete</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}