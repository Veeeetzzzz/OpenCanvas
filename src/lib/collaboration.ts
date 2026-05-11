import { isOpenCanvasDocumentLike } from './document-state';
import { CollaborationEvent, CollaborationUser, OpenCanvasDocument } from './types';

const VALID_COLLABORATION_TYPES = new Set([
  'drawing',
  'cursor',
  'document_update',
  'user_join',
  'user_leave',
]);

type SharedSessionInfo = {
  documentId: string;
  shareId: string;
  hostId: string;
  createdAt: number;
  lastActive: number;
  document: OpenCanvasDocument;
};

export function isCollaborationEventPayload(
  value: unknown
): value is CollaborationEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CollaborationEvent>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.type === 'string' &&
    VALID_COLLABORATION_TYPES.has(candidate.type)
  );
}

function isCollaborationUser(value: unknown): value is CollaborationUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CollaborationUser>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.color === 'string'
  );
}

export function createProcessedEventTracker(limit = 500) {
  const seenIds = new Set<string>();
  const orderedIds: string[] = [];

  return {
    remember(eventId: string): boolean {
      if (seenIds.has(eventId)) {
        return false;
      }

      seenIds.add(eventId);
      orderedIds.push(eventId);

      while (orderedIds.length > limit) {
        const staleId = orderedIds.shift();
        if (staleId) {
          seenIds.delete(staleId);
        }
      }

      return true;
    },
  };
}

export class CollaborationService {
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
  private processedEvents = createProcessedEventTracker();

  private readonly STORAGE_KEY_PREFIX = 'opencanvas_collab_';

  generateShareLink(document: OpenCanvasDocument): string {
    const shareId = this.generateShareId();
    this.shareId = shareId;
    this.processedEvents = createProcessedEventTracker();

    this.currentUser = {
      id: this.generateUserId(),
      name: 'Host',
      color: this.generateRandomColor(),
    };

    this.writeSharedSessionInfo({
      documentId: document.id,
      shareId,
      hostId: this.currentUser.id,
      createdAt: Date.now(),
      lastActive: Date.now(),
      document,
    });

    this.setupCommunication();

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${shareId}&doc=${document.id}`;
  }

  async joinSharedSession(
    shareId: string,
    userName?: string
  ): Promise<OpenCanvasDocument | null> {
    if (!this.isValidShareId(shareId)) {
      console.error('Invalid share ID format:', shareId);
      return null;
    }

    const sessionInfo = this.readSharedSessionInfo(shareId);
    if (!sessionInfo) {
      console.error('Shared session not found or malformed:', shareId);
      return null;
    }

    this.shareId = shareId;
    this.processedEvents = createProcessedEventTracker();
    this.currentUser = {
      id: this.generateUserId(),
      name: userName || 'Guest',
      color: this.generateRandomColor(),
    };

    this.writeSharedSessionInfo({
      ...sessionInfo,
      lastActive: Date.now(),
    });

    this.setupCommunication();

    return sessionInfo.document;
  }

  updateSharedDocumentSnapshot(document: OpenCanvasDocument) {
    if (!this.shareId) return;

    const sessionInfo = this.readSharedSessionInfo(this.shareId);
    if (!sessionInfo) return;

    this.writeSharedSessionInfo({
      ...sessionInfo,
      documentId: document.id,
      document,
      lastActive: Date.now(),
    });
  }

  broadcastEvent(event: Omit<CollaborationEvent, 'id' | 'userId' | 'timestamp'>) {
    if (!this.currentUser || !this.shareId) return;

    const fullEvent: CollaborationEvent = {
      ...event,
      id: this.generateEventId(),
      userId: this.currentUser.id,
      timestamp: Date.now(),
    };

    this.processedEvents.remember(fullEvent.id);

    const eventKey = `${this.STORAGE_KEY_PREFIX}event_${this.shareId}_${fullEvent.timestamp}_${fullEvent.id}`;
    const eventData = {
      event: fullEvent,
      shareId: this.shareId,
      timestamp: fullEvent.timestamp,
    };

    try {
      localStorage.setItem(eventKey, JSON.stringify(eventData));
      this.cleanupOldEvents();
      this.broadcastChannel?.postMessage(fullEvent);
    } catch (error) {
      console.error('Failed to broadcast event:', error);
    }
  }

  onEvent(callback: (event: CollaborationEvent) => void) {
    this.onEventCallbacks.push(callback);
    return () => {
      this.onEventCallbacks = this.onEventCallbacks.filter(
        (existing) => existing !== callback
      );
    };
  }

  onUsersChange(callback: (users: CollaborationUser[]) => void) {
    this.onUsersChangeCallbacks.push(callback);
    return () => {
      this.onUsersChangeCallbacks = this.onUsersChangeCallbacks.filter(
        (existing) => existing !== callback
      );
    };
  }

  getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }

  getConnectedUsers(): CollaborationUser[] {
    return Array.from(this.connectedUsers.values());
  }

  disconnect() {
    if (this.currentUser) {
      this.broadcastEvent({
        type: 'user_leave',
        data: this.currentUser,
      });
    }

    this.teardownCommunication();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.connectedUsers.clear();
    this.shareId = null;
    this.currentUser = null;
    this.activeShareId = null;
    this.communicationReady = false;
    this.processedEvents = createProcessedEventTracker();
  }

  isInSharedSession(): boolean {
    return this.shareId !== null;
  }

  private writeSharedSessionInfo(sessionInfo: SharedSessionInfo) {
    try {
      const serialized = JSON.stringify(sessionInfo);
      localStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}${sessionInfo.shareId}`,
        serialized
      );
      sessionStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}${sessionInfo.shareId}`,
        serialized
      );
    } catch (error) {
      console.error('Failed to store shared session info:', error);
    }
  }

  private readSharedSessionInfo(shareId: string): SharedSessionInfo | null {
    try {
      const raw =
        localStorage.getItem(`${this.STORAGE_KEY_PREFIX}${shareId}`) ||
        sessionStorage.getItem(`${this.STORAGE_KEY_PREFIX}${shareId}`);
      const parsed = raw ? this.safeParse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return null;

      const candidate = parsed as Partial<SharedSessionInfo>;
      if (
        typeof candidate.documentId !== 'string' ||
        typeof candidate.shareId !== 'string' ||
        typeof candidate.hostId !== 'string' ||
        typeof candidate.createdAt !== 'number' ||
        typeof candidate.lastActive !== 'number' ||
        !isOpenCanvasDocumentLike(candidate.document)
      ) {
        return null;
      }

      return candidate as SharedSessionInfo;
    } catch {
      return null;
    }
  }

  private generateShareId(): string {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);

    const randomPart = Array.from(array)
      .map((byte) => byte.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 16);

    return 'share_' + randomPart;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).slice(2, 11);
  }

  private generateRandomColor(): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
    ];
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

    this.setupBroadcastChannel();
    this.setupStorageListener();

    if (this.currentUser) {
      this.broadcastEvent({
        type: 'user_join',
        data: this.currentUser,
      });
    }
  }

  private setupBroadcastChannel() {
    if (!this.shareId) return;

    try {
      if (this.broadcastChannel) {
        if (this.broadcastListener) {
          this.broadcastChannel.removeEventListener(
            'message',
            this.broadcastListener
          );
          this.broadcastListener = null;
        }
        this.broadcastChannel.close();
        this.broadcastChannel = null;
      }
      this.broadcastChannel = new BroadcastChannel(`opencanvas_${this.shareId}`);

      this.broadcastListener = (event: MessageEvent) => {
        if (this.isCollaborationEvent(event.data)) {
          this.handleCollaborationEvent(event.data);
        }
      };
      this.broadcastChannel.addEventListener('message', this.broadcastListener);
    } catch (error) {
      console.warn('BroadcastChannel not supported:', error);
    }
  }

  private setupStorageListener() {
    if (this.storageListener) return;

    this.storageListener = (event) => {
      if (!event.key || !event.key.startsWith(`${this.STORAGE_KEY_PREFIX}event_`)) {
        return;
      }
      if (!event.newValue) return;

      const eventData = this.safeParse(event.newValue);
      if (!eventData || typeof eventData !== 'object') return;
      const parsedEventData = eventData as { shareId?: unknown; event?: unknown };
      if (
        parsedEventData.shareId === this.shareId &&
        this.isCollaborationEvent(parsedEventData.event)
      ) {
        this.handleCollaborationEvent(parsedEventData.event);
      }
    };

    window.addEventListener('storage', this.storageListener);
    this.pollIntervalId = window.setInterval(() => {
      this.pollForEvents();
    }, 1000);
  }

  private pollForEvents() {
    if (!this.shareId) return;

    try {
      const eventKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith(`${this.STORAGE_KEY_PREFIX}event_${this.shareId}_`)
      );
      const now = Date.now();

      eventKeys.forEach((key) => {
        const raw = localStorage.getItem(key);
        const eventData = raw ? this.safeParse(raw) : null;
        if (!eventData || typeof eventData !== 'object') return;

        const parsedEventData = eventData as {
          timestamp?: unknown;
          event?: unknown;
        };
        if (
          typeof parsedEventData.timestamp === 'number' &&
          parsedEventData.timestamp > now - 10000 &&
          this.isCollaborationEvent(parsedEventData.event)
        ) {
          this.handleCollaborationEvent(parsedEventData.event);
        }
      });
    } catch (error) {
      console.error('Error polling for events:', error);
    }
  }

  private cleanupOldEvents() {
    if (!this.shareId) return;

    try {
      const eventKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith(`${this.STORAGE_KEY_PREFIX}event_${this.shareId}_`)
      );

      const sortedKeys = eventKeys
        .map((key) => {
          const raw = localStorage.getItem(key);
          const parsed = raw ? this.safeParse(raw) : null;
          const timestamp =
            parsed &&
            typeof parsed === 'object' &&
            'timestamp' in parsed &&
            typeof parsed.timestamp === 'number'
              ? parsed.timestamp
              : 0;
          return { key, timestamp };
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((entry) => entry.key);

      sortedKeys.slice(100).forEach((key) => {
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
        this.broadcastChannel.removeEventListener(
          'message',
          this.broadcastListener
        );
        this.broadcastListener = null;
      }
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }

  private handleCollaborationEvent(collaborationEvent: CollaborationEvent) {
    if (!this.isCollaborationEvent(collaborationEvent)) return;
    if (!this.processedEvents.remember(collaborationEvent.id)) return;
    if (collaborationEvent.userId === this.currentUser?.id) return;

    if (
      collaborationEvent.type === 'user_join' &&
      isCollaborationUser(collaborationEvent.data)
    ) {
      this.connectedUsers.set(collaborationEvent.userId, collaborationEvent.data);
      this.triggerUsersChange();
    } else if (collaborationEvent.type === 'user_leave') {
      this.connectedUsers.delete(collaborationEvent.userId);
      this.triggerUsersChange();
    } else {
      this.triggerEvent(collaborationEvent);
    }
  }

  private triggerEvent(event: CollaborationEvent) {
    this.onEventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });
  }

  private triggerUsersChange() {
    const users = this.getConnectedUsers();

    this.onUsersChangeCallbacks.forEach((callback) => {
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

export const collaborationService = new CollaborationService();
