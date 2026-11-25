import { createContext, useContext, type Dispatch } from "react";
import type { ConfiguratorAction, ConfiguratorState } from "./reducer";

export type ConfiguratorContextValue = {
  state: ConfiguratorState;
  dispatch: Dispatch<ConfiguratorAction>;
};

export const ConfiguratorContext =
  createContext<ConfiguratorContextValue | null>(null);

export function useConfigurator() {
  const value = useContext(ConfiguratorContext);
  if (!value) {
    throw new Error("useConfigurator must be used inside <ConfiguratorProvider>.");
  }
  return value;
}
