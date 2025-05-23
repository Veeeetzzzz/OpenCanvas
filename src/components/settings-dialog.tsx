import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export type BackgroundStyle = 'blank' | 'dots' | 'squares' | 'lines';

export interface AppSettings {
  gridEnabled: boolean;
  showTooltips: boolean;
  backgroundColor: string;
  backgroundStyle: BackgroundStyle;
  canvasWidth: number;
  canvasHeight: number;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onSettingsChange,
  currentSettings,
}: SettingsDialogProps) {
  const handleSettingChange = (key: keyof AppSettings, value: boolean | number | string | BackgroundStyle) => {
    onSettingsChange({
      ...currentSettings,
      [key]: value,
    });
  };

  const handleNumberChange = (key: keyof AppSettings, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      handleSettingChange(key, num);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>App Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label>Canvas Size</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="canvasWidth"
                type="number"
                value={currentSettings.canvasWidth}
                onChange={(e) => handleNumberChange("canvasWidth", e.target.value)}
                min={100}
                step={10}
                className="h-8 text-sm w-full"
                placeholder="Width"
              />
              <span className="text-sm text-muted-foreground">x</span>
              <Input 
                id="canvasHeight"
                type="number"
                value={currentSettings.canvasHeight}
                onChange={(e) => handleNumberChange("canvasHeight", e.target.value)}
                min={100}
                step={10}
                className="h-8 text-sm w-full"
                placeholder="Height"
              />
              <span className="text-sm text-muted-foreground">px</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Set the dimensions of the drawing area. May require scrolling.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bgColor">Background Color</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="bgColor"
                type="color"
                value={currentSettings.backgroundColor}
                onChange={(e) => handleSettingChange("backgroundColor", e.target.value)}
                className="h-8 w-14 p-1"
              />
              <Input
                type="text"
                value={currentSettings.backgroundColor}
                onChange={(e) => handleSettingChange("backgroundColor", e.target.value)} 
                placeholder="#FFFFFF" 
                className="h-8 text-sm flex-1"
               />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bgStyle">Background Style</Label>
            <Select 
              value={currentSettings.backgroundStyle}
              onValueChange={(value: BackgroundStyle) => handleSettingChange("backgroundStyle", value)}
            >
              <SelectTrigger id="bgStyle" className="h-8 text-sm">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank</SelectItem>
                <SelectItem value="dots">Dots</SelectItem>
                <SelectItem value="squares">Squares</SelectItem>
                <SelectItem value="lines">Lines</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Drawing Grid</Label>
              <p className="text-sm text-muted-foreground">
                Overlay grid for alignment (fixed size)
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