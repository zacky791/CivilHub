import { createContext, useContext } from "react";
import type { CompanyId } from "./types";
export const ActionsContext = createContext<{
  newJob: (companyId?: CompanyId) => void;
  viewJob: (id: string) => void;
}>({ newJob: () => {}, viewJob: () => {} });
export const useActions = () => useContext(ActionsContext);
