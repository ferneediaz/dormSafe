import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { StatusPicker } from "@/components/dorm/ui";
import { DormProvider, useDorm } from "@/lib/dorm-store";
import { can } from "@/lib/privacy";

const wrapper = ({ children }: { children: ReactNode }) => <DormProvider>{children}</DormProvider>;

describe("coordinator status override", () => {
  it("only coordinators may update status", () => {
    expect(can("COORDINATOR", "updateStatus")).toBe(true);
    expect(can("FLOOR_WARDEN", "updateStatus")).toBe(false);
    expect(can("FIRST_RESPONDER", "updateStatus")).toBe(false);
    expect(can("RESIDENT", "updateStatus")).toBe(false);
  });

  it("coordinator sets a resident's status with STAFF provenance and clears SOS", () => {
    const { result } = renderHook(() => useDorm(), { wrapper });
    const id = result.current.residents[0]!.id;
    act(() => result.current.sos(id));
    act(() => result.current.setStatus(id, "SAFE"));
    const r = result.current.residents.find((x) => x.id === id)!;
    expect(r.status).toBe("SAFE");
    expect(r.provenance).toBe("STAFF");
    expect(r.sos).toBe(false);
    expect(result.current.accessLog[0]?.what).toContain("→ SAFE");
  });

  it("is ignored for other roles", () => {
    const { result } = renderHook(() => useDorm(), { wrapper });
    const id = result.current.residents[0]!.id;
    const before = result.current.residents[0]!.status;
    act(() => result.current.setRole("FLOOR_WARDEN"));
    act(() => result.current.setStatus(id, before === "HELP" ? "SAFE" : "HELP"));
    expect(result.current.residents[0]!.status).toBe(before);
  });

  it("StatusPicker reports the chosen status", () => {
    const onChange = vi.fn();
    render(<StatusPicker value="UNKNOWN" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Set Need Help"));
    expect(onChange).toHaveBeenCalledWith("HELP");
    fireEvent.click(screen.getByLabelText("Set Unknown"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
