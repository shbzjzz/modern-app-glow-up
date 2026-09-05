export type RawRow = Record<string, unknown> & { RowIndex?: number };

export interface ProcRow {
  _idx: number;
  RowIndex: number;
  Store: string;
  StoreCode: string;
  Article: string;
  Barcode: string;
  Description: string;
  Department: string;
  Stock: string;
  ExpiryDate: string;
  DaysLeft: number | "";
  "Expiry Risk Bucket": string;
  "Action Taken": string;
  "RTC Price": string;
  "Transfer To": string;
  "Action Date": string;
  "Transfer Qty": string;
  Start: string;
  End: string;
  "Action Status": string;
  "Previous Action Info": string;
  "Previous Price Info": string;
  EmailSent: number;
  StaffName?: string;
  Week: string;
  "Submission Month": string;
  "Sub Month Display": string;
  MonthNum: number | null;
  Year: number | null;
  _tsDate: Date | null;
  _raw: RawRow;
  [key: string]: unknown;
}

export interface StoreRef {
  code: string;
  name: string;
}

export interface EmailMapEntry {
  storeCode: string;
  toEmail?: string;
  ccEmail?: string;
}

export interface AppUser {
  id?: number;
  username: string;
  isAdmin?: boolean;
  departments?: string;
  stores?: string;
}
