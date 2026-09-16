import { axiosInstance } from "./APIClient";
import { RoomCreateResponse, RoomCheckResponse } from "@/types/room";

export const roomApi = {
  /**
   * Crée un nouveau salon et renvoie les identifiants de l'hôte.
   */
  async createRoom(username: string): Promise<RoomCreateResponse> {
    const response = await axiosInstance.post<RoomCreateResponse>("/api/v1/rooms", {
      username,
    });
    return response.data;
  },

  /**
   * Vérifie l'existence et l'état d'un salon via l'API REST.
   */
  async checkRoom(roomId: string): Promise<RoomCheckResponse> {
    try {
      const sanitizedId = encodeURIComponent(roomId.trim());
      const response = await axiosInstance.get<RoomCheckResponse>(
        `/api/v1/rooms/${sanitizedId}`
      );
      return response.data;
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 404) {
        return { exists: false, participant_count: 0 };
      }
      throw err;
    }
  },
};
