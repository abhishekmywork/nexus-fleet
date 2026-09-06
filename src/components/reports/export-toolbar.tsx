"use client";

import { FileDown, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportToolbarProps {
  data: any[];
  columns: { key: string; label: string; getValue?: (row: any) => any; formatExport?: (val: any, row: any) => string }[];
  fileName: string;
}

function fallbackFormat(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return `${val.length} points`;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function cellValue(col: any, row: any): string {
  const raw = col.getValue ? col.getValue(row) : row[col.key];
  return col.formatExport ? col.formatExport(raw, row) : fallbackFormat(raw);
}

export function ExportToolbar({ data, columns, fileName }: ExportToolbarProps) {
  const exportExcel = () => {
    const rows = data.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        obj[col.label] = cellValue(col, row);
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportCSV = () => {
    const header = columns.map((c) => c.label).join(",");
    const rows = data
      .map((row) =>
        columns
          .map((col) => `"${cellValue(col, row).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const csv = `${header}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    autoTable(doc, {
      head: [columns.map((c) => c.label)],
      body: data.map((row) => columns.map((col) => cellValue(col, row))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`${fileName}.pdf`);
  };

  const printTable = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={exportExcel}>
        <FileSpreadsheet className="size-3.5" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <FileDown className="size-3.5" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF}>
        <FileText className="size-3.5" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={printTable}>
        <Printer className="size-3.5" />
        Print
      </Button>
    </div>
  );
}
