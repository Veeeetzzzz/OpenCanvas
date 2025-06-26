import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Link2, UserPlus } from 'lucide-react';
import { collaborationService } from '@/lib/collaboration';
import { CollaborationUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
}

export function ShareDialog({ isOpen, onOpenChange, documentId, documentName }: ShareDialogProps) {
  const [shareLink, setShareLink] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CollaborationUser[]>([]);
  const { toast } = useToast();

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const link = collaborationService.generateShareLink(documentId);
      setShareLink(link);
      
      // Subscribe to user changes
      collaborationService.onUsersChange((users) => {
        setConnectedUsers(users);
      });

      toast({
        title: "Share link generated!",
        description: "Anyone with this link can collaborate on your document.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({
        title: "Link copied!",
        description: "The share link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleStopSharing = () => {
    collaborationService.disconnect();
    setShareLink('');
    setConnectedUsers([]);
    toast({
      title: "Sharing stopped",
      description: "The document is no longer shared.",
    });
  };

  const isSharing = collaborationService.isInSharedSession();
  const currentUser = collaborationService.getCurrentUser();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share "{documentName}"
          </DialogTitle>
          <DialogDescription>
            Create a secret link to collaborate with others in real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isSharing ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Generate a unique link that others can use to collaborate on this document in real-time.
              </div>
              <Button 
                onClick={handleGenerateLink} 
                disabled={isGenerating}
                className="w-full"
              >
                <Link2 className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Share Link'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="share-link">Share Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="share-link"
                    value={shareLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button size="sm" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Anyone with this link can view and edit the document
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Connected Users ({connectedUsers.length})
                </Label>
                <div className="space-y-2 mt-2">
                  {currentUser && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: currentUser.color }}
                      />
                      <span className="text-sm font-medium">{currentUser.name} (You)</span>
                    </div>
                  )}
                  {connectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: user.color }}
                      />
                      <span className="text-sm">{user.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Online
                      </Badge>
                    </div>
                  ))}
                  {connectedUsers.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No one else has joined yet.
                      <br />
                      Share the link to start collaborating!
                    </div>
                  )}
                </div>
              </div>

              <Button 
                variant="destructive" 
                onClick={handleStopSharing}
                className="w-full"
              >
                Stop Sharing
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 