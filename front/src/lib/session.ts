/**
 * Gestionnaire centralisé de session utilisateur pour les salons Synk.
 * Évite d'éparpiller les clés de sessionStorage et localStorage en dur dans le code.
 */

export interface RoomSession {
  username: string | null;
  token: string | null;
  userId: string | null;
}

export interface ActiveRoomSession {
  roomId: string;
  username: string;
  joinedAt: number;
}

const STORAGE_KEYS = {
  username: (roomId: string) => `synk_username_${roomId}`,
  token: (roomId: string) => `synk_host_token_${roomId}`,
  userId: (roomId: string) => `synk_user_id_${roomId}`,
  lastUsername: "synk_last_username",
  activeRoom: "synk_active_room",
} as const;

export const sessionManager = {
  /**
   * Récupère les données de session associées à un salon.
   */
  getRoomSession(roomId: string): RoomSession {
    return {
      username: sessionStorage.getItem(STORAGE_KEYS.username(roomId)),
      token: sessionStorage.getItem(STORAGE_KEYS.token(roomId)),
      userId: sessionStorage.getItem(STORAGE_KEYS.userId(roomId)),
    };
  },

  /**
   * Enregistre les identifiants de session pour un salon.
   */
  setRoomSession(
    roomId: string,
    data: { username: string; token?: string | null; userId?: string | null }
  ): void {
    sessionStorage.setItem(STORAGE_KEYS.username(roomId), data.username);
    if (data.token) {
      sessionStorage.setItem(STORAGE_KEYS.token(roomId), data.token);
    } else if (data.token === null) {
      sessionStorage.removeItem(STORAGE_KEYS.token(roomId));
    }
    if (data.userId) {
      sessionStorage.setItem(STORAGE_KEYS.userId(roomId), data.userId);
    }
    localStorage.setItem(STORAGE_KEYS.lastUsername, data.username);
  },

  /**
   * Met à jour le token hôte d'un salon (ex: suite à une promotion).
   */
  setHostToken(roomId: string, token: string): void {
    sessionStorage.setItem(STORAGE_KEYS.token(roomId), token);
  },

  /**
   * Révoque et nettoie le token hôte stocké (ex: rôle perdu ou transféré).
   */
  clearHostToken(roomId: string): void {
    sessionStorage.removeItem(STORAGE_KEYS.token(roomId));
  },

  /**
   * Récupère le dernier pseudo utilisé sur l'appareil (avec nettoyage de tout résidu de suffixe).
   */
  getLastUsername(): string {
    const raw = localStorage.getItem(STORAGE_KEYS.lastUsername) || "";
    return raw.replace(/\s*\(\d+\)$/, "").trim();
  },

  /**
   * Sauvegarde le dernier pseudo utilisé.
   */
  setLastUsername(username: string): void {
    localStorage.setItem(STORAGE_KEYS.lastUsername, username);
  },

  /**
   * Récupère la session de salon active en cours (expire après 2h, TTL Redis).
   */
  getActiveRoom(): ActiveRoomSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.activeRoom);
      if (!raw) return null;
      const data = JSON.parse(raw) as ActiveRoomSession;
      if (!data.roomId || !data.joinedAt) return null;
      if (Date.now() - data.joinedAt > 7200 * 1000) {
        localStorage.removeItem(STORAGE_KEYS.activeRoom);
        return null;
      }
      return data;
    } catch {
      localStorage.removeItem(STORAGE_KEYS.activeRoom);
      return null;
    }
  },

  /**
   * Enregistre le salon actuellement actif.
   */
  setActiveRoom(roomId: string, username: string): void {
    const data: ActiveRoomSession = {
      roomId: roomId.trim(),
      username: username.trim(),
      joinedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.activeRoom, JSON.stringify(data));
  },

  /**
   * Supprime le salon actif mémorisé.
   */
  clearActiveRoom(): void {
    localStorage.removeItem(STORAGE_KEYS.activeRoom);
  },
};
