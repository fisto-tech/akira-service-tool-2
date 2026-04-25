import { useLocation } from "react-router-dom";

export function usePageTitle() {
  const location = useLocation();

  const titles = {
    "/dashboard": "Dashboard",
    "/customers": "Customers Data",
    "/escalation": "Escalation",
    "/serviceCall": "Service Call",
    "/serviceMaterial": "Service Material",
    "/productionMaterial": "Production Material",
    "/troubleshoot": "Troubleshoot"
  };

  return titles[location.pathname] || "Dashboard";
}
