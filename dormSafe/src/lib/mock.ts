// SIMULATED data for the hackathon prototype. No real residents.
import type { Resident, Room, Route } from './types';

export const FLOORS = 12;
export const SLOTS_PER_SIDE = 17;
/** Ground-floor slot left empty for the lobby. */
export const LOBBY_SLOT = 8;

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roomId(floor: number, side: 'north' | 'south', slot: number) {
  const n = (side === 'north' ? 0 : SLOTS_PER_SIDE) + slot + 1;
  return `${floor}${String(n).padStart(2, '0')}`;
}

export function buildRooms(): Room[] {
  const rooms: Room[] = [];
  for (let floor = 1; floor <= FLOORS; floor++) {
    for (const side of ['north', 'south'] as const) {
      for (let slot = 0; slot < SLOTS_PER_SIDE; slot++) {
        if (floor === 1 && slot === LOBBY_SLOT) continue;
        rooms.push({ id: roomId(floor, side, slot), floor, slot, side });
      }
    }
  }
  return rooms;
}

/** Dorm A: 812 residents, two per room. */
export function buildResidents(rooms: Room[], seed = 42): Resident[] {
  const rand = mulberry32(seed);
  const residents: Resident[] = [];
  for (const room of rooms) {
    for (let bed = 0; bed < 2; bed++) {
      // Upper floors evacuate slower, and most non-responders live there.
      const silentChance = room.floor >= 10 ? 0.09 : 0.012;
      residents.push({
        id: `${room.id}-${bed + 1}`,
        floor: room.floor,
        room: room.id,
        status: 'unknown',
        provenance: 'UNKNOWN',
        silent: rand() < silentChance,
      });
    }
  }
  return residents;
}

export function buildRoutes(): Route[] {
  return [
    { id: 'stair-a', name: 'West Stairwell A', kind: 'stair', side: 'west', status: 'unverified', verification: 'REPORTED' },
    { id: 'stair-b', name: 'East Stairwell B', kind: 'stair', side: 'east', status: 'unverified', verification: 'REPORTED' },
    { id: 'elevator', name: 'Elevator', kind: 'elevator', side: 'center', status: 'unavailable', verification: 'STAFF_VERIFIED' },
  ];
}
