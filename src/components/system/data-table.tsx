"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface SystemDataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  className?: string;
  compactOnMobile?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = "Nenhum registro encontrado.",
  className,
  compactOnMobile = true,
}: SystemDataTableProps<T>) {
  return (
    <div
      className={cn(
        "w-full max-w-full overflow-x-auto rounded-xl border border-white/[0.07] bg-[#112240] shadow-[0_4px_24px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      {/* Mobile hint */}
      <div className="border-b border-white/[0.05] px-4 py-1.5 text-[10px] font-medium text-white/25 md:hidden">
        Deslize para ver todas as colunas
      </div>

      <table className={cn("min-w-full", compactOnMobile ? "text-xs sm:text-[13px]" : "text-[13px]")}>
        <thead>
          <tr className="bg-white/[0.03]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "border-b border-white/[0.05] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-[13px] text-white/30">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-white/[0.04] text-white/80 transition-colors last:border-0 hover:bg-white/[0.03]"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      compactOnMobile ? "px-3 py-3 sm:px-4" : "px-4 py-3",
                      "align-middle",
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
