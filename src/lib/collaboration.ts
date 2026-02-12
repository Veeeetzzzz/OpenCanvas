import { CollaborationEvent, CollaborationUser } from './types';

// Cross-browser collaboration using WebSocket and localStorage fallback
// Works across different browser contexts including private/incognito tabs

const VALID_COLLABORATION_TYPES = new Set(['drawing', 'cursor', 'document_update', 'user_join', 'user_leave']);

export function isCollaborationEventPayload(value: unknown): value is CollaborationEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CollaborationEvent>;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.type === 'string' &&
    VALID_COLLABORATION_TYPES.has(candidate.type)
  );
}

class CollaborationService {
  private shareId: string | null = null;
  private currentUser: CollaborationUser | null = null;
  private connectedUsers: Map<string, CollaborationUser> = new Map();
  private onEventCallbacks: ((event: CollaborationEvent) => void)[] = [];
  private onUsersChangeCallbacks: ((users: CollaborationUser[]) => void)[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private websocket: WebSocket | null = null;
  private storageListener: ((event: StorageEvent) => void) | null = null;
  private pollIntervalId: number | null = null;
  private broadcastListener: ((event: MessageEvent) => void) | null = null;
  private communicationReady = false;
  private activeShareId: string | null = null;
  
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
    
    try {
      // Use sessionStorage for temporary sharing
      sessionStorage.setItem(`${this.STORAGE_KEY_PREFIX}${shareId}`, JSON.stringify(sharedDocInfo));
      
      // Also store in localStorage as backup for cross-tab communication
      localStorage.setItem(`${this.STORAGE_KEY_PREFIX}${shareId}`, JSON.stringify(sharedDocInfo));
    } catch (error) {
      console.error('Failed to store shared session info:', error);
    }

    // Set up communication channels
    this.setupCommunication();

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${shareId}&doc=${documentId}`;
  }

  // Join a shared session from a link
  async joinSharedSession(shareId: string, userName?: string): Promise<boolean> {
    if (!this.isValidShareId(shareId)) {
      console.error('Invalid share ID format:', shareId);
      return false;
    }

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

      const sessionInfo = this.safeParse(hostInfo);
      if (!sessionInfo || typeof sessionInfo !== 'object') {
        throw new Error('Shared session data is malformed');
      }
      
      // Update last active time
      (sessionInfo as Record<string, unknown>).lastActive = Date.now();
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
    return () => {
      this.onEventCallbacks = this.onEventCallbacks.filter(existing => existing !== callback);
    };
  }

  // Subscribe to user list changes
  onUsersChange(callback: (users: CollaborationUser[]) => void) {
    this.onUsersChangeCallbacks.push(callback);
    return () => {
      this.onUsersChangeCallbacks = this.onUsersChangeCallbacks.filter(existing => existing !== callback);
    };
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

    this.teardownCommunication();

    // Close websocket if connected
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    // Clear all data
    this.connectedUsers.clear();
    this.shareId = null;
    this.currentUser = null;
    this.activeShareId = null;
    this.communicationReady = false;
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
    if (this.communicationReady && this.activeShareId === this.shareId) return;
    if (this.activeShareId && this.activeShareId !== this.shareId) {
      this.teardownCommunication();
    }

    this.activeShareId = this.shareId;
    this.communicationReady = true;

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
      if (this.broadcastChannel) {
        if (this.broadcastListener) {
          this.broadcastChannel.removeEventListener('message', this.broadcastListener);
          this.broadcastListener = null;
        }
        this.broadcastChannel.close();
        this.broadcastChannel = null;
      }
      this.broadcastChannel = new BroadcastChannel(`opencanvas_${this.shareId}`);
      
      this.broadcastListener = (event: MessageEvent) => {
        if (!this.isCollaborationEvent(event.data)) {
          return;
        }
        this.handleCollaborationEvent(event.data);
      };
      this.broadcastChannel.addEventListener('message', this.broadcastListener);
    } catch (error) {
      console.warn('BroadcastChannel not supported:', error);
    }
  }

  private setupStorageListener() {
    if (this.storageListener) return;

    // Listen for storage events (works across tabs)
    this.storageListener = (event) => {
      if (!event.key || !event.key.startsWith(`${this.STORAGE_KEY_PREFIX}event_`)) return;
      if (!event.newValue) return;
      
      try {
        const eventData = this.safeParse(event.newValue);
        if (!eventData || typeof eventData !== 'object') return;
        const parsedEventData = eventData as { shareId?: unknown; event?: unknown };
        if (parsedEventData.shareId === this.shareId && this.isCollaborationEvent(parsedEventData.event)) {
          this.handleCollaborationEvent(parsedEventData.event);
        }
      } catch (error) {
        console.error('Error parsing storage event:', error);
      }
    };

    window.addEventListener('storage', this.storageListener);

    // Also poll for events in case storage events don't fire
    this.pollIntervalId = window.setInterval(() => {
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
          const raw = localStorage.getItem(key);
          const eventData = raw ? this.safeParse(raw) : null;
          if (!eventData || typeof eventData !== 'object') return;
          const parsedEventData = eventData as { timestamp?: unknown; event?: unknown };
          if (
            typeof parsedEventData.timestamp === 'number' &&
            parsedEventData.timestamp > now - 10000 &&
            this.isCollaborationEvent(parsedEventData.event)
          ) { // Last 10 seconds
            this.handleCollaborationEvent(parsedEventData.event);
          }
        } catch {
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
      const sortedKeys = eventKeys
        .map(key => {
          try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : null;
            const timestamp = typeof parsed?.timestamp === 'number' ? parsed.timestamp : 0;
            return { key, timestamp };
          } catch {
            return { key, timestamp: 0 };
          }
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(entry => entry.key);

      // Remove old events (keep only last 10)
      sortedKeys.slice(10).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error cleaning up events:', error);
    }
  }

  private teardownCommunication() {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }

    if (this.pollIntervalId !== null) {
      window.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    if (this.broadcastChannel) {
      if (this.broadcastListener) {
        this.broadcastChannel.removeEventListener('message', this.broadcastListener);
        this.broadcastListener = null;
      }
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }

  private handleCollaborationEvent(collaborationEvent: CollaborationEvent) {
    if (!this.isCollaborationEvent(collaborationEvent)) {
      return;
    }
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

  private safeParse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private isValidShareId(shareId: string): boolean {
    return /^share_[a-z0-9]+$/i.test(shareId);
  }

  private isCollaborationEvent(value: unknown): value is CollaborationEvent {
    return isCollaborationEventPayload(value);
  }
}

// Singleton instance
export const collaborationService = new CollaborationService(); 