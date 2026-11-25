import { InputCommand, PlayerId, WorldState } from '../sim/types';

/**
 * Phase-2 Wi-Fi LAN Co-op Transport Contract.
 * The simulation core (`GameWorld`) already consumes `InputCommand[]` keyed by `playerId`
 * and uses deterministic `SeededRNG`, so dropping in a WebSocket / WebRTC LAN transport
 * requires zero gameplay rewrite.
 */
export interface LanDeltaSnapshot {
  tick: number;
  floor: number;
  status: WorldState['status'];
  players: WorldState['players'];
  enemyPositions: Array<{ id: string; x: number; y: number; hp: number }>;
}

export interface LanTransport {
  readonly role: 'offline' | 'host' | 'client';
  readonly connectedPeers: PlayerId[];
  sendCommand(cmd: InputCommand): void;
  onRemoteCommand(cb: (cmd: InputCommand) => void): void;
  broadcastSnapshot(snapshot: LanDeltaSnapshot): void;
  onSnapshot(cb: (snapshot: LanDeltaSnapshot) => void): void;
  disconnect(): void;
}

export class OfflineLocalTransport implements LanTransport {
  readonly role = 'offline' as const;
  readonly connectedPeers: PlayerId[] = [];
  sendCommand(_cmd: InputCommand): void {}
  onRemoteCommand(_cb: (cmd: InputCommand) => void): void {}
  broadcastSnapshot(_snapshot: LanDeltaSnapshot): void {}
  onSnapshot(_cb: (snapshot: LanDeltaSnapshot) => void): void {}
  disconnect(): void {}
}
