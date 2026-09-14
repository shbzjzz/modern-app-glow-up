import * as XLSX from "xlsx";
import type { ProcRow } from "./types";
import { formatDateToStr, parseDate } from "./utils";

export const EXP_COLS = [
  "RowIndex",
  "Store",
  "StoreCode",
  "Article",
  "Barcode",
  "Description",
  "Department",
  "Stock",
  "ExpiryDate",
  "DaysLeft",
  "Action Status",
  "Previous Action Info",
  "Previous Price Info",
  "Action Taken",
  "RTC Price",
  "Start",
  "End",
  "Transfer To",
  "Transfer Qty",
  "Action Date",
  "Week",
  "Submission Month",
  "Sub Month Display",
  "Expiry Risk Bucket",
  "Year",
];

type Sheet = ReturnType<typeof XLSX.utils.json_to_sheet>;

export function autoFitAndTable(ws: Sheet, data: Record<string, unknown>[], cols: string[]) {
  ws["!cols"] = cols.map((col) => {
    let maxLen = col.length;
    data.forEach((row) => {
      const val = row[col] === undefined || row[col] === null ? "" : String(row[col]);
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(maxLen + 2, 60) };
  });
  const rowCount = data.length;
  const colCount = cols.length;
  if (rowCount > 0 && colCount > 0) {
    const endCol =
      colCount <= 26
        ? String.fromCharCode(64 + colCount)
        : "A" + String.fromCharCode(64 + colCount - 26);
    (ws as Record<string, unknown>)["!tables"] = [
      {
        ref: `A1:${endCol}${rowCount + 1}`,
        name: "Table1",
        displayName: "Table1",
        headerRowCount: 1,
        totalsRowCount: 0,
        tableStyleInfo: {
          name: "TableStyleMedium2",
          showFirstColumn: false,
          showLastColumn: false,
          showRowStripes: true,
          showColumnStripes: false,
        },
      },
    ];
  }
  return ws;
}

export function flatRow(r: ProcRow): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const numCols = ["Stock", "DaysLeft", "Transfer Qty", "RowIndex"];
  const dateCols = ["ExpiryDate", "Start", "End", "Action Date"];
  EXP_COLS.forEach((c) => {
    let val: unknown = c === "RowIndex" ? r._idx : (r[c] ?? "");
    if (numCols.includes(c)) {
      val = val === "" || val === null ? "" : Number(val);
    } else if (dateCols.includes(c)) {
      const parsed = parseDate(val);
      val = parsed ? formatDateToStr(parsed) : val || "";
    }
    o[c] = val;
  });
  return o;
}

export function downloadSheet(
  data: Record<string, unknown>[],
  cols: string[],
  fname: string,
  sheetName = "Data",
) {
  if (!data.length) return false;
  const useCols = cols.length ? cols : Object.keys(data[0] ?? {}).filter((c) => !c.startsWith("_"));
  const ws = XLSX.utils.json_to_sheet(data, { header: useCols });
  autoFitAndTable(ws, data, useCols);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fname}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}

export function readSheetFile(
  file: File,
  opts: XLSX.Sheet2JSONOpts & { cellDates?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Cannot read file"));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), {
          type: "array",
          ...(opts.cellDates ? { cellDates: true } : {}),
        });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        resolve(XLSX.utils.sheet_to_json(ws, { defval: "", ...opts }));
      } catch (err) {
        reject(err as Error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
