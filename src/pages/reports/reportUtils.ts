import * as XLSX from 'xlsx';

export type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'last-year' | 'all-time' | 'custom';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export const presetRange = (preset: DatePreset, today: Date = new Date()): DateRange => {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (preset) {
    case 'this-month':
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59) };
    case 'last-month':
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59) };
    case 'this-quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { from: new Date(y, qStart, 1), to: new Date(y, qStart + 3, 0, 23, 59, 59) };
    }
    case 'this-year':
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59) };
    case 'last-year':
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59) };
    case 'all-time':
      return { from: null, to: null };
    case 'custom':
      return { from: null, to: null };
  }
};

export const inRange = (iso: string, range: DateRange): boolean => {
  if (!range.from && !range.to) return true;
  const d = new Date(iso);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
};

export const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

export const exportSheet = (
  filename: string,
  sheetName: string,
  rows: Record<string, any>[],
  colWidths?: number[]
) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) ws['!cols'] = colWidths.map(w => ({ width: w }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const accountTypeLabel = (type: string) =>
  type.charAt(0).toUpperCase() + type.slice(1);

export const debitNatured = (type: string) => type === 'asset' || type === 'expense';
