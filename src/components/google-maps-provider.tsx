"use client";

import { APIProvider } from "@vis.gl/react-google-maps";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  return (
    <APIProvider apiKey={MAPS_KEY} libraries={["marker"]}>
      {children}
    </APIProvider>
  );
}
