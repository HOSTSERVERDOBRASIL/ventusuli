"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = "Nenhum registro encontrado.",
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111f35]/85 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
      <table className="min-w-full text-sm">
        <thead className="bg-[#0d1a2f] text-slate-200">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn("px-4 py-3 text-left font-semibold", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-300">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={getRowKey(row)} className="border-t border-white/10 text-slate-100 transition-colors hover:bg-white/5">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3 align-top", column.className)}>
                    {column.cell(row)}
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
