import axiosInstance from "./APIClient";

export interface RoomCreateResponse {
  room_id: string;
  host_token: string;
  user_id: string;
}

export interface RoomCheckResponse {
  exists: boolean;
  participant_count: number;
}

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
      const response = await axiosInstance.get<RoomCheckResponse>(
        `/api/v1/rooms/${roomId}`
      );
      return response.data;
    } catch (err: any) {
      if (err.status === 404) {
        return { exists: false, participant_count: 0 };
      }
      throw err;
    }
  },
};
