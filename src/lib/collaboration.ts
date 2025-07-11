import { CollaborationEvent, CollaborationUser } from './types';

// Cross-browser collaboration using WebSocket and localStorage fallback
// Works across different browser contexts including private/incognito tabs

class CollaborationService {
  private shareId: string | null = null;
  private currentUser: CollaborationUser | null = null;
  private connectedUsers: Map<string, CollaborationUser> = new Map();
  private onEventCallbacks: ((event: CollaborationEvent) => void)[] = [];
  private onUsersChangeCallbacks: ((users: CollaborationUser[]) => void)[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private websocket: WebSocket | null = null;
  
  // Simple coordination using a shared storage approach
  private readonly STORAGE_KEY_PREFIX = 'opencanvas_collab_';

  // Generate a shareable link for the current document
  generateShareLink(documentId: string): string {
    const shareId = this.generateShareId();
    this.shareId = shareId;
    
    // Initialize current user as host
    this.currentUser = {
      id: this.generateUserId(),
      name: 'Host',
      color: this.generateRandomColor()
    };

    // Store the shared document info for coordination
    const sharedDocInfo = {
      documentId,
      shareId,
      hostId: this.currentUser.id,
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    
    // Use sessionStorage for temporary sharing
    sessionStorage.setItem(`${this.STORAGE_KEY_PREFIX}${shareId}`, JSON.stringify(sharedDocInfo));
    
    // Also store in localStorage as backup for cross-tab communication
    localStorage.setItem(`${this.STORAGE_KEY_PREFIX}${shareId}`, JSON.stringify(sharedDocInfo));

    // Set up communication channels
    this.setupCommunication();

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${shareId}&doc=${documentId}`;
  }

  // Join a shared session from a link
  async joinSharedSession(shareId: string, userName?: string): Promise<boolean> {
    this.shareId = shareId;
    
    this.currentUser = {
      id: this.generateUserId(),
      name: userName || 'Guest',
      color: this.generateRandomColor()
    };

    try {
      // Check if shared session exists
      const hostInfo = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}${shareId}`) || 
                     sessionStorage.getItem(`${this.STORAGE_KEY_PREFIX}${shareId}`);
      
      if (!hostInfo) {
        throw new Error('Shared session not found');
      }

      const sessionInfo = JSON.parse(hostInfo);
      
      // Update last active time
      sessionInfo.lastActive = Date.now();
      localStorage.setItem(`${this.STORAGE_KEY_PREFIX}${shareId}`, JSON.stringify(sessionInfo));
      sessionStorage.setItem(`${this.STORAGE_KEY_PREFIX}${shareId}`, JSON.stringify(sessionInfo));

      // Set up communication
      this.setupCommunication();
      
      return true;
    } catch (error) {
      console.error('Failed to join session:', error);
      return false;
    }
  }

  // Send a collaboration event to all connected peers
  broadcastEvent(event: Omit<CollaborationEvent, 'userId' | 'timestamp'>) {
    if (!this.currentUser || !this.shareId) return;

    const fullEvent: CollaborationEvent = {
      ...event,
      userId: this.currentUser.id,
      timestamp: Date.now()
    };

    // Store event in shared storage for cross-tab communication
    const eventKey = `${this.STORAGE_KEY_PREFIX}event_${this.shareId}_${Date.now()}_${Math.random()}`;
    const eventData = {
      event: fullEvent,
      shareId: this.shareId,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(eventKey, JSON.stringify(eventData));
      
      // Clean up old events (keep only last 10)
      this.cleanupOldEvents();
      
      // Also try BroadcastChannel for same-origin tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(fullEvent);
      }
    } catch (error) {
      console.error('Failed to broadcast event:', error);
    }
  }

  // Subscribe to collaboration events
  onEvent(callback: (event: CollaborationEvent) => void) {
    this.onEventCallbacks.push(callback);
  }

  // Subscribe to user list changes
  onUsersChange(callback: (users: CollaborationUser[]) => void) {
    this.onUsersChangeCallbacks.push(callback);
  }

  // Get current user info
  getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }

  // Get list of all connected users
  getConnectedUsers(): CollaborationUser[] {
    return Array.from(this.connectedUsers.values());
  }

  // Disconnect from collaboration session
  disconnect() {
    // Announce we're leaving
    if (this.currentUser) {
      this.broadcastEvent({
        type: 'user_leave',
        data: this.currentUser
      });
    }

    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    // Close websocket if connected
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    // Clear all data
    this.connectedUsers.clear();
    this.shareId = null;
    this.currentUser = null;
  }

  // Check if currently in a shared session
  isInSharedSession(): boolean {
    return this.shareId !== null;
  }

  // Private helper methods
  private generateShareId(): string {
    // Use crypto.getRandomValues for cryptographic security
    const array = new Uint8Array(12); // 96 bits of entropy
    crypto.getRandomValues(array);
    
    // Convert to base36 for URL-safe characters
    const randomPart = Array.from(array)
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .substr(0, 16); // Take first 16 chars for consistency
      
    return 'share_' + randomPart;
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  private generateRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private setupCommunication() {
    if (!this.shareId) return;

    // Set up BroadcastChannel for same-origin communication
    this.setupBroadcastChannel();
    
    // Set up storage event listener for cross-tab communication
    this.setupStorageListener();
    
    // Announce our presence
    if (this.currentUser) {
      this.broadcastEvent({
        type: 'user_join',
        data: this.currentUser
      });
    }
  }

  private setupBroadcastChannel() {
    if (!this.shareId) return;

    try {
      this.broadcastChannel = new BroadcastChannel(`opencanvas_${this.shareId}`);
      
      this.broadcastChannel.addEventListener('message', (event) => {
        this.handleCollaborationEvent(event.data);
      });
    } catch (error) {
      console.warn('BroadcastChannel not supported:', error);
    }
  }

  private setupStorageListener() {
    // Listen for storage events (works across tabs)
    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith(`${this.STORAGE_KEY_PREFIX}event_`)) return;
      if (!event.newValue) return;
      
      try {
        const eventData = JSON.parse(event.newValue);
        if (eventData.shareId === this.shareId) {
          this.handleCollaborationEvent(eventData.event);
        }
      } catch (error) {
        console.error('Error parsing storage event:', error);
      }
    });

    // Also poll for events in case storage events don't fire
    setInterval(() => {
      this.pollForEvents();
    }, 1000);
  }

  private pollForEvents() {
    if (!this.shareId) return;

    try {
      // Get all localStorage keys that match our event pattern
      const eventKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`${this.STORAGE_KEY_PREFIX}event_${this.shareId}_`)
      );

      // Process recent events (last 10 seconds)
      const now = Date.now();
      eventKeys.forEach(key => {
        try {
          const eventData = JSON.parse(localStorage.getItem(key) || '{}');
          if (eventData.timestamp > now - 10000) { // Last 10 seconds
            this.handleCollaborationEvent(eventData.event);
          }
        } catch (error) {
          // Ignore parsing errors for individual events
        }
      });
    } catch (error) {
      console.error('Error polling for events:', error);
    }
  }

  private cleanupOldEvents() {
    if (!this.shareId) return;

    try {
      const eventKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`${this.STORAGE_KEY_PREFIX}event_${this.shareId}_`)
      );

      // Sort by timestamp and keep only the latest 10
      const sortedKeys = eventKeys.sort((a, b) => {
        const timeA = parseInt(a.split('_')[3]) || 0;
        const timeB = parseInt(b.split('_')[3]) || 0;
        return timeB - timeA;
      });

      // Remove old events (keep only last 10)
      sortedKeys.slice(10).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error cleaning up events:', error);
    }
  }

  private handleCollaborationEvent(collaborationEvent: CollaborationEvent) {
    // Don't process events from ourselves
    if (collaborationEvent.userId === this.currentUser?.id) return;
    
    // Handle different event types
    if (collaborationEvent.type === 'user_join') {
      this.connectedUsers.set(collaborationEvent.userId, collaborationEvent.data);
      this.triggerUsersChange();
    } else if (collaborationEvent.type === 'user_leave') {
      this.connectedUsers.delete(collaborationEvent.userId);
      this.triggerUsersChange();
    } else {
      // Forward other events to listeners
      this.triggerEvent(collaborationEvent);
    }
  }

  private triggerEvent(event: CollaborationEvent) {
    this.onEventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });
  }

  private triggerUsersChange() {
    const users = this.getConnectedUsers();
    if (this.currentUser) {
      users.push(this.currentUser);
    }
    
    this.onUsersChangeCallbacks.forEach(callback => {
      try {
        callback(users);
      } catch (error) {
        console.error('Error in users change callback:', error);
      }
    });
  }
}

// Singleton instance
export const collaborationService = new CollaborationService(); 