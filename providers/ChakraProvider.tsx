"use client";

import { ChakraProvider as Provider, defaultSystem } from "@chakra-ui/react";
import type { ReactNode } from "react";

export default function ChakraProvider({ children }: { children: ReactNode }) {
  return <Provider value={defaultSystem}>{children}</Provider>;
}
