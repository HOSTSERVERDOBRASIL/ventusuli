"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AthleteTableRow {
  id: string;
  photoUrl?: string | null;
  name: string;
  email: string;
  status: "ATIVO" | "PENDENTE" | "INATIVO";
  inscricoes: number;
  ultimoPagamento?: string | null;
}

type SortKey = "name" | "email" | "status" | "inscricoes" | "ultimoPagamento";

export function AthletesTable({ data }: { data: AthleteTableRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(() => {
    const searched = data.filter((row) => {
      const q = query.toLowerCase();
      return row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q);
    });

    const sorted = [...searched].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "inscricoes") {
        return (a.inscricoes - b.inscricoes) * dir;
      }

      const aValue = (a[sortKey] ?? "") as string;
      const bValue = (b[sortKey] ?? "") as string;
      return aValue.localeCompare(bValue) * dir;
    });

    return sorted;
  }, [data, query, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: SortKey) => {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const headerButton = (label: string, key: SortKey) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium"
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortKey !== key ? (
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
      ) : sortDirection === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 text-[#F5A623]" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 text-[#F5A623]" />
      )}
    </button>
  );

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(event) => {
          setPage(1);
          setQuery(event.target.value);
        }}
        placeholder="Buscar atleta por nome ou email"
        className="border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400"
      />

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#142b47,#10233a)] shadow-[0_10px_35px_rgba(0,0,0,0.25)]">
        <div className="border-b border-white/10 px-3 py-1 text-[11px] text-slate-400 md:hidden">
          Arraste a tabela para o lado para ver todas as colunas.
        </div>
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-[#0c1e35] text-slate-200">
            <tr>
              <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Atleta</th>
              <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">{headerButton("Email", "email")}</th>
              <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">{headerButton("Status", "status")}</th>
              <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">{headerButton("Inscricoes", "inscricoes")}</th>
              <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">{headerButton("Ultimo pagamento", "ultimoPagamento")}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-300">
                  Nenhum atleta encontrado.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="border-t border-white/10 text-slate-100 transition-colors hover:bg-white/5">
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex items-center gap-3">
                      {row.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.photoUrl} alt={row.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#0F2743] text-xs font-semibold">
                          {row.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.email}</td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.status}</td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.inscricoes}</td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.ultimoPagamento ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300">
        <p>
          Pagina {currentPage} de {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 bg-[#0F2743] text-white hover:bg-[#14375C]"
            disabled={currentPage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 bg-[#0F2743] text-white hover:bg-[#14375C]"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Proxima
          </Button>
        </div>
      </div>
    </div>
  );
}
