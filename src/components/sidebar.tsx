import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Plus, FolderOpen, Settings } from "lucide-react"

export function Sidebar() {
  return (
    <div className="w-[300px] border-r bg-muted/40 flex flex-col">
      <div className="p-4 border-b">
        <Button className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          New Document
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Recent Documents</h2>
            {[1, 2, 3].map((i) => (
              <Button
                key={i}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2",
                  i === 1 && "bg-accent"
                )}
              >
                <FolderOpen className="h-4 w-4" />
                Document {i}
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  )
}