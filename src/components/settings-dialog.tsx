import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export interface AppSettings {
  gridEnabled: boolean;
  showTooltips: boolean;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onSettingsChange,
  currentSettings,
}: SettingsDialogProps) {
  const handleSettingChange = (key: keyof AppSettings, value: boolean | number) => {
    onSettingsChange({
      ...currentSettings,
      [key]: value,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>App Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Grid</Label>
              <p className="text-sm text-muted-foreground">
                Show grid on canvas (fixed size)
              </p>
            </div>
            <Switch
              checked={currentSettings.gridEnabled}
              onCheckedChange={(checked) => handleSettingChange("gridEnabled", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Tooltips</Label>
              <p className="text-sm text-muted-foreground">
                Show tooltips for tools and buttons
              </p>
            </div>
            <Switch
              checked={currentSettings.showTooltips}
              onCheckedChange={(checked) => handleSettingChange("showTooltips", checked)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 