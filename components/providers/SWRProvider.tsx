"use client";

import React from "react";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr-fetcher";

interface SWRProviderProps {
  children: React.ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 3000, // Deduplicate requests within 3 seconds
      }}
    >
      {children}
    </SWRConfig>
  );
}
