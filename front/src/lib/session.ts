/**
 * Gestionnaire centralisé de session utilisateur pour les salons Synk.
 * Évite d'éparpiller les clés de sessionStorage et localStorage en dur dans le code.
 */

export interface RoomSession {
  username: string | null;
  token: string | null;
  userId: string | null;
}

const STORAGE_KEYS = {
  username: (roomId: string) => `synk_username_${roomId}`,
  token: (roomId: string) => `synk_host_token_${roomId}`,
  userId: (roomId: string) => `synk_user_id_${roomId}`,
  lastUsername: "synk_last_username",
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
   * Récupère le dernier pseudo utilisé sur l'appareil.
   */
  getLastUsername(): string {
    return localStorage.getItem(STORAGE_KEYS.lastUsername) || "";
  },

  /**
   * Sauvegarde le dernier pseudo utilisé.
   */
  setLastUsername(username: string): void {
    localStorage.setItem(STORAGE_KEYS.lastUsername, username);
  },
};
