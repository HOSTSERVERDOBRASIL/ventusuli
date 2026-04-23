import { AdminCollectiveGroup } from "@/services/types";

export const DEMO_ADMIN_COLLECTIVE_GROUPS: AdminCollectiveGroup[] = [
  {
    id: "grp-tech-runners",
    name: "Tech Runners Squad",
    company: "Norte Tech",
    contactName: "Larissa Campos",
    athletesCount: 14,
    status: "READY",
  },
  {
    id: "grp-time-operacoes",
    name: "Time Operacoes Sul",
    company: "Logistica Serra",
    contactName: "Marcelo Teixeira",
    athletesCount: 9,
    status: "READY",
  },
  {
    id: "grp-credito-ativo",
    name: "Credito Ativo Running",
    company: "Credito Ativo SA",
    contactName: "Camila Porto",
    athletesCount: 22,
    status: "PENDING_APPROVAL",
  },
];
