export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${value}`);
};

// Game phases used by the host/room UI
export type GamePhase = "LOBBY" | "IN_ROUND" | "LOCKED" | "REVEAL" | "RESULT";

export interface SnapshotMeta {
  pngBase64?: string;
  strokesJson?: any;
  updatedAt: string;
}

export interface Round {
  index: number;
  snapshots: Record<string, SnapshotMeta | null>;
  judgments: Record<string, boolean | null>;
  allCorrect?: boolean;
}

export interface Player {
  id: string;
  name?: string;
  isHost?: boolean;
  uuid?: string;
  connected?: boolean;
  score?: number;
}

export interface ClientRoomState {
  roomId: string;
  hostId: string;
  hostName?: string;
  phase?: GamePhase | string;
  roundIndex?: number;
  rounds?: Round[];
  revealMode?: "realtime" | "onDecision";
  // map of memberUuid -> score (integer)
  scores?: Record<string, number>;
  members: Player[];
}
