import { describe, expect, it } from "vitest";
import { DORM, SIM_TARGETS, km, seedResidents, seedRoutes, simulationPlan } from "@/lib/dorm-data";
import { purgeExpired } from "@/lib/privacy";

describe("Dorm seed data", () => {
  it("generates 812 residents across 12 floors", () => {
    const residents = seedResidents();
    expect(residents.length).toBe(812);
    const floors = new Set(residents.map((r) => r.floor));
    expect(floors.size).toBe(12);
  });

  it("includes Nguyen Van An with mobility assistance on 9F", () => {
    const residents = seedResidents();
    const nguyen = residents.find((r) => r.room === 912 && r.mobility);
    expect(nguyen?.name).toBe("Nguyen Van An");
    expect(nguyen?.floor).toBe(9);
  });

  it("calculates realistic distances near Banqiao", () => {
    const dist = km(DORM, { lat: 25.0186, lng: 121.4706 });
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(3.0);
  });

  it("includes East Stairwell B blockage in seed routes", () => {
    const routes = seedRoutes();
    const east = routes.find((r) => r.id === "east-b");
    expect(east).toBeDefined();
    expect(east?.status).toBe("BLOCKED");
  });

  it("creates a simulation plan prioritizing mobility assistance", () => {
    const residents = seedResidents();
    const plan = simulationPlan(residents, []);
    // UNKNOWN residents are left out of the plan
    expect(plan.length).toBe(SIM_TARGETS.SAFE + SIM_TARGETS.INSIDE + SIM_TARGETS.HELP);
    const special = residents.find((r) => r.room === 912 && r.mobility);
    const nguyen = plan.find((p) => p.id === special?.id);
    expect(nguyen?.status).toBe("HELP");
  });

  it("purges expired location events according to retention policy", () => {
    const now = 100_000_000;
    const store = {
      locationEvents: [
        { residentId: "r1", location: "Room 101", at: now - 80 * 3600 * 1000, kind: "CHECK_IN" as const },
        { residentId: "r2", location: "Room 102", at: now - 10 * 3600 * 1000, kind: "CHECK_IN" as const },
      ],
      reports: [],
      residents: seedResidents(),
    };
    const res = purgeExpired(store, 72, now);
    expect(res.locationEvents.length).toBe(1);
    expect(res.locationEvents[0]?.residentId).toBe("r2");
    expect(res.removed).toBe(1);
  });
});
