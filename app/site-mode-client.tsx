"use client";

import { createContext, type ReactNode, useContext } from "react";

const SiteModeContext = createContext({ mirrorReadOnly: false });

export function SiteModeProvider({
  mirrorReadOnly,
  children,
}: {
  mirrorReadOnly: boolean;
  children: ReactNode;
}) {
  return (
    <SiteModeContext.Provider value={{ mirrorReadOnly }}>
      {children}
    </SiteModeContext.Provider>
  );
}

export function useSiteMode() {
  return useContext(SiteModeContext);
}
