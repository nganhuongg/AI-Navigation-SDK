"use client";

/*
  DemoContext — stores whether the AI Navigation SDK is "enabled" for this demo session.

  This is NOT real SDK state — it's a presentation tool. The toggle lives outside the
  phone frame so the presenter can flip it on stage without it feeling like an app feature.

  Pattern: React Context
    - One Provider at the top of the tree shares a single value downward.
    - Any component can call useDemo() to read or change the value.
    - When the value changes, only components that called useDemo() re-render.
*/

import { createContext, useContext, useState } from "react";
import type { PatientSession } from "@/lib/api";

type DemoContextType = {
  sdkEnabled: boolean;
  session: PatientSession | null;
  toggle: () => void;
  setSession: (session: PatientSession | null) => void;
};

const DemoContext = createContext<DemoContextType>({
  sdkEnabled: false,
  session: null,
  toggle: () => {},
  setSession: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [sdkEnabled, setSdkEnabled] = useState(false);
  const [session, setSession] = useState<PatientSession | null>(null);
  return (
    <DemoContext.Provider
      value={{ sdkEnabled, session, setSession, toggle: () => setSdkEnabled(v => !v) }}
    >
      {children}
    </DemoContext.Provider>
  );
}

/* Call this inside any client component to read the current demo state. */
export function useDemo() {
  return useContext(DemoContext);
}
