import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabaseClient";

const CycleContext = createContext(null);

export const DEFAULT_CYCLES = [
  {
    id: "cycle-2024-2025",
    name: "2024/2025",
    startDate: "2024-01-01",
    endDate: "2025-12-31",
    isActive: true,
    isVisible: true,
    description: "ADSS Academic Cycle 2024/2025"
  },
  {
    id: "cycle-2023-2024",
    name: "2023/2024",
    startDate: "2023-01-01",
    endDate: "2023-12-31",
    isActive: false,
    isVisible: true,
    description: "ADSS Academic Cycle 2023/2024"
  }
];

export function CycleProvider({ children }) {
  const [cycles, setCycles] = useState(() => {
    try {
      const cached = localStorage.getItem("adss_cycles_cache");
      return cached ? JSON.parse(cached) : DEFAULT_CYCLES;
    } catch {
      return DEFAULT_CYCLES;
    }
  });

  const [activeCycleId, setActiveCycleId] = useState(() => {
    try {
      return localStorage.getItem("adss_active_cycle_id") || "cycle-2024-2025";
    } catch {
      return "cycle-2024-2025";
    }
  });

  // selectedCycleId can be:
  // - "active": dynamically follows active cycle
  // - "all": shows data across all time
  // - specific cycle id: e.g. "cycle-2023-2024"
  const [selectedCycleId, setSelectedCycleId] = useState(() => {
    try {
      return localStorage.getItem("adss_selected_cycle_id") || "active";
    } catch {
      return "active";
    }
  });

  const [loading, setLoading] = useState(true);

  // Active cycle object
  const activeCycle = useMemo(() => {
    return (
      cycles.find((c) => c.id === activeCycleId || c.isActive) ||
      cycles[0] ||
      DEFAULT_CYCLES[0]
    );
  }, [cycles, activeCycleId]);

  // Current selected cycle object (resolves "active" to activeCycle; if "all", returns null)
  const selectedCycle = useMemo(() => {
    if (selectedCycleId === "all") return null;
    if (selectedCycleId === "active") return activeCycle;
    return cycles.find((c) => c.id === selectedCycleId) || activeCycle;
  }, [cycles, selectedCycleId, activeCycle]);

  // Visible cycles for standard user dropdowns/filters (where isVisible !== false, plus active cycle is always included)
  const visibleCycles = useMemo(() => {
    return cycles.filter((c) => c.isVisible !== false || c.id === activeCycle?.id);
  }, [cycles, activeCycle]);

  const loadFromDb = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["academic_cycles", "active_cycle_id"]);

      if (!error && data && data.length > 0) {
        const cyclesItem = data.find((d) => d.key === "academic_cycles");
        const activeItem = data.find((d) => d.key === "active_cycle_id");

        let loadedCycles = null;
        if (cyclesItem && cyclesItem.value) {
          try {
            const parsed = JSON.parse(cyclesItem.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedCycles = parsed;
            }
          } catch (e) {
            console.error("Failed to parse academic_cycles:", e);
          }
        }

        let loadedActiveId = activeItem?.value || null;

        if (loadedCycles) {
          if (!loadedActiveId) {
            const activeObj = loadedCycles.find((c) => c.isActive);
            loadedActiveId = activeObj ? activeObj.id : loadedCycles[0].id;
          }
          setCycles(loadedCycles);
          setActiveCycleId(loadedActiveId);
          try {
            localStorage.setItem("adss_cycles_cache", JSON.stringify(loadedCycles));
            localStorage.setItem("adss_active_cycle_id", loadedActiveId);
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Could not load cycles from DB, using fallback:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromDb();

    // Listen to real-time changes on system_settings
    const sub = supabase
      .channel("system-settings-cycles-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        (payload) => {
          const key = payload.new?.key;
          if (key === "academic_cycles" || key === "active_cycle_id") {
            loadFromDb();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [loadFromDb]);

  const handleSetSelectedCycleId = useCallback((id) => {
    setSelectedCycleId(id);
    try {
      localStorage.setItem("adss_selected_cycle_id", id);
    } catch {}
  }, []);

  // Helper function to check if a date string/timestamp falls within the given cycle
  // If no targetCycle is specified, uses selectedCycle. If selectedCycle is null (all), returns true.
  const isWithinCycle = useCallback(
    (dateStringOrTimestamp, targetCycle = selectedCycle) => {
      if (!targetCycle) return true; // "all" cycles selected
      if (!dateStringOrTimestamp) return false;

      try {
        let dStr = "";
        if (typeof dateStringOrTimestamp === "string") {
          dStr = dateStringOrTimestamp.substring(0, 10);
        } else if (dateStringOrTimestamp instanceof Date) {
          dStr = dateStringOrTimestamp.toISOString().substring(0, 10);
        } else {
          dStr = String(dateStringOrTimestamp).substring(0, 10);
        }

        if (targetCycle.startDate && dStr < targetCycle.startDate) return false;
        if (targetCycle.endDate && dStr > targetCycle.endDate) return false;
        return true;
      } catch {
        return true;
      }
    },
    [selectedCycle]
  );

  // Save new cycles & active cycle to Supabase system_settings
  const saveCycles = useCallback(async (newCycles, newActiveId) => {
    try {
      const activeId =
        newActiveId || newCycles.find((c) => c.isActive)?.id || newCycles[0]?.id;
      const normalized = newCycles.map((c) => ({
        ...c,
        isActive: c.id === activeId
      }));

      const [res1, res2] = await Promise.all([
        supabase.from("system_settings").upsert(
          {
            key: "academic_cycles",
            value: JSON.stringify(normalized)
          },
          { onConflict: "key" }
        ),
        supabase.from("system_settings").upsert(
          {
            key: "active_cycle_id",
            value: activeId
          },
          { onConflict: "key" }
        )
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      setCycles(normalized);
      setActiveCycleId(activeId);
      try {
        localStorage.setItem("adss_cycles_cache", JSON.stringify(normalized));
        localStorage.setItem("adss_active_cycle_id", activeId);
      } catch {}

      return { success: true };
    } catch (err) {
      console.error("Error saving cycles to system_settings:", err);
      return { success: false, error: err.message || "Failed to save cycles" };
    }
  }, []);

  return (
    <CycleContext.Provider
      value={{
        cycles,
        visibleCycles,
        activeCycle,
        activeCycleId,
        selectedCycleId,
        selectedCycle,
        setSelectedCycleId: handleSetSelectedCycleId,
        isWithinCycle,
        saveCycles,
        reloadCycles: loadFromDb,
        loading
      }}
    >
      {children}
    </CycleContext.Provider>
  );
}

export function useCycle() {
  const ctx = useContext(CycleContext);
  if (!ctx) {
    throw new Error("useCycle must be used within a CycleProvider");
  }
  return ctx;
}
