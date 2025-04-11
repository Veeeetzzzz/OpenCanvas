import {
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportPNG: () => void;
  onExportJPEG: () => void;
}

export function ExportDialog({
  open,
  onOpenChange,
  onExportPNG,
  onExportJPEG,
}: ExportDialogProps) {

  const handleExport = (exportFunc: () => void) => {
    exportFunc();
    onOpenChange(false); // Close dialog after selection
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Canvas</DialogTitle>
          <DialogDescription>
            Choose the format and background option for your export.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button onClick={() => handleExport(onExportPNG)} variant="outline">
            Export PNG (Transparent Background)
          </Button>
          <Button onClick={() => handleExport(onExportJPEG)} variant="outline">
            Export JPEG (White Background)
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 