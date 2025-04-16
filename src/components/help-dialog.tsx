import {
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogClose // Import DialogClose for simple closing
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area"; // For scrollable content

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Increase max width for more content */}
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>How to Use OpenCanvas</DialogTitle>
          <DialogDescription>
            A quick guide to the tools and features.
          </DialogDescription>
        </DialogHeader>
        
        {/* Make content scrollable */}
        <ScrollArea className="max-h-[60vh] p-4 border rounded-md">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-1">Toolbar (Left Side)</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><b>Select/Move (Hand):</b> Click to select text or images. Click and drag selected items to move them. Click and drag handles on selected images to resize. Double-click text to edit.</li>
                <li><b>Pencil:</b> Click and drag to draw freehand lines. Thickness can be adjusted below the tool icon when active.</li>
                <li><b>Eraser:</b> Click and drag to erase parts of the drawing. Size can be adjusted below the tool icon when active.</li>
                <li><b>Text:</b> Click on the canvas to create a text box. Type your text. Press Enter to confirm, Escape to cancel. Use the toolbar that appears at the top to change font, size, and color.</li>
                <li><b>Image:</b> Click to open a file browser and upload an image onto the canvas.</li>
                <li><b>Color Picker:</b> Select the color for the Pencil and Text tools.</li>
                <li><b>Thickness/Size Slider:</b> Appears below Pencil/Eraser when active. Adjusts line thickness or eraser size.</li>
                <li><b>Undo/Redo:</b> Step backward or forward through your action history.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Document Sidebar (Far Left)</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><b>New Document:</b> Creates a blank new document.</li>
                <li><b>Switching:</b> Click on a document name to open it.</li>
                <li><b>Renaming:</b> Right-click a document name (when sidebar is expanded) and select "Rename". Type new name, press Enter to save or Escape to cancel.</li>
                <li><b>Duplicating:</b> Right-click a document name and select "Duplicate".</li>
                <li><b>Deleting:</b> Right-click a document name and select "Delete". You can delete the last document (the canvas will prompt you to create a new one).</li>
                <li><b>Collapse/Expand:</b> Click the arrow icon in the header to collapse or expand the sidebar. Document names appear as tooltips when collapsed.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Top Header</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><b>Export:</b> Opens a dialog to save your current canvas view as a PNG (transparent background) or JPEG (white background) image.</li>
                <li><b>Share:</b> (Disabled) Intended for future cloud sharing features.</li>
                <li><b>Settings:</b> Opens the settings dialog to adjust background color/style, drawing grid overlay, and tooltips.</li>
                <li><b>Theme Toggle:</b> Switches between light and dark mode.</li>
              </ul>
            </section>

             <section>
              <h3 className="font-semibold mb-1">Canvas Interactions</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                 <li><b>Right-Click:</b> Opens a context menu. If clicked on an image or text (with Hand tool selected), provides options like Copy/Delete. If clicked on empty space, might allow pasting if an image was copied.</li>
                 <li><b>Text Editing:</b> Double-click existing text with the Hand tool to edit it. Use the toolbar at the top for styling.</li>
                 <li><b>Text Toolbar Pinning:</b> Click the pin icon on the floating text toolbar to keep it visible even when not editing text (useful with Hand tool). Click again to unpin. It auto-unpins when switching to drawing tools.</li>
                 <li><b>Toolbar Dragging:</b> The floating text toolbar can be moved by clicking and dragging the grip handle on its left side (when not pinned).</li>
              </ul>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter>
          {/* Use DialogClose for simple closing */}
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 