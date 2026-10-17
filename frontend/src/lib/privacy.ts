import type { Report, Resident } from "./dorm-data";

export type AccessRole = "COORDINATOR" | "FLOOR_WARDEN" | "FIRST_RESPONDER" | "RESIDENT";
export const ROLES: AccessRole[] = ["COORDINATOR", "FLOOR_WARDEN", "FIRST_RESPONDER", "RESIDENT"];

export interface RolePermissions {
  canViewRosterDetails: boolean;
  canViewPhone: boolean;
  canViewMedicalNotes: boolean;
  canExportResponderHandoff: boolean;
  canTriggerRollCall: boolean;
  canManageRoutes: boolean;
  floorScope?: number;
  description: string;
}

export const ACCESS_PERMS: Record<AccessRole, RolePermissions> = {
  COORDINATOR: {
    canViewRosterDetails: true,
    canViewPhone: true,
    canViewMedicalNotes: true,
    canExportResponderHandoff: true,
    canTriggerRollCall: true,
    canManageRoutes: true,
    description: "Full dorm visibility, roll call controls, contact directory, and responder handoff export.",
  },
  FLOOR_WARDEN: {
    canViewRosterDetails: true,
    canViewPhone: true,
    canViewMedicalNotes: true,
    canExportResponderHandoff: false,
    canTriggerRollCall: false,
    canManageRoutes: true,
    floorScope: 9,
    description: "Floor 9 scoped view: resident names, room statuses, peer check-in notes for Floor 9 only.",
  },
  FIRST_RESPONDER: {
    canViewRosterDetails: false,
    canViewPhone: false,
    canViewMedicalNotes: true,
    canExportResponderHandoff: true,
    canTriggerRollCall: false,
    canManageRoutes: false,
    description: "Emergency-only view: headcount totals, HELP/SOS list, mobility notes, and blocked route statuses.",
  },
  RESIDENT: {
    canViewRosterDetails: false,
    canViewPhone: false,
    canViewMedicalNotes: false,
    canExportResponderHandoff: false,
    canTriggerRollCall: false,
    canManageRoutes: false,
    description: "Self and roommate check-in, SOS reporting, shelter directory, and evacuation routes.",
  },
};

export const ROLE_META: Record<AccessRole, { en: string; zh: string; desc: string }> = {
  COORDINATOR: { en: "Coordinator", zh: "管理員", desc: ACCESS_PERMS.COORDINATOR.description },
  FLOOR_WARDEN: { en: "Floor warden", zh: "樓層負責人", desc: ACCESS_PERMS.FLOOR_WARDEN.description },
  FIRST_RESPONDER: { en: "First responder", zh: "救援人員", desc: ACCESS_PERMS.FIRST_RESPONDER.description },
  RESIDENT: { en: "Resident", zh: "住民", desc: ACCESS_PERMS.RESIDENT.description },
};

export type Permission =
  | "viewAllFloors"
  | "viewContacts"
  | "viewLocations"
  | "manageRoutes"
  | "manageReports"
  | "manageBuilding"
  | "managePrivacy";

export function can(role: AccessRole, what: Permission): boolean {
  const p = ACCESS_PERMS[role];
  switch (what) {
    case "viewAllFloors":
      return p.floorScope === undefined;
    case "viewContacts":
      return p.canViewPhone;
    case "viewLocations":
      return p.canViewMedicalNotes;
    case "manageRoutes":
      return p.canManageRoutes;
    case "manageReports":
      return role === "COORDINATOR" || role === "FLOOR_WARDEN";
    case "manageBuilding":
    case "managePrivacy":
      return role === "COORDINATOR";
  }
}

export interface LocationEvent {
  residentId: string;
  location: string;
  at: number;
  kind: "CHECK_IN" | "SOS" | "INCIDENT";
}

export function purgeExpired(
  store: { locationEvents: LocationEvent[]; reports: Report[]; residents: Resident[] },
  retentionHours: number,
  now: number = Date.now()
) {
  const cutoff = now - retentionHours * 3600 * 1000;
  const filteredEvents = store.locationEvents.filter((e) => e.at >= cutoff);
  const filteredReports = store.reports.filter((r) => r.at >= cutoff);
  const clearedResidents = store.residents.map((r) => {
    if (r.updatedAt && r.updatedAt < cutoff) {
      return { ...r, location: undefined };
    }
    return r;
  });
  const removed = (store.locationEvents.length - filteredEvents.length) + (store.reports.length - filteredReports.length);
  return {
    locationEvents: filteredEvents,
    reports: filteredReports,
    residents: clearedResidents,
    removed,
  };
}
