import { describe, it, expect } from "vitest";
import {
  prepareSupplierLedgerRows,
  generateSupplierLedgerCSV,
  exportSupplierLedgerToExcel,
  exportSupplierLedgerToPDF,
  type PreparedLedgerRow,
} from "../export-ledger";
import type { Supplier, Bill, Payment } from "../types";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Supplier based on user's screenshot
const supplier: Supplier = {
  id: "131f1d7a-3e1a-48f4-b9fa-4f65a226a126",
  code: "SUP057",
  supplierName: "jyotirmai cotton compeny",
  companyName: "jyotirmai cotton compeny",
  contactPerson: "Manager",
  phone: "9440263501",
  altPhone: "",
  email: "",
  gstNumber: "37adkpp7298n1ze",
  panNumber: "",
  address: "Vijayawada",
  city: "Vijayawada",
  state: "Andhra Pradesh",
  pincode: "520001",
  country: "India",
  paymentTerms: "",
  creditDays: 30,
  preferredPaymentMethod: "bank",
  openingOutstanding: 0,
  openingBalanceDate: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
  category: "wholesaler",
  status: "active",
  archived: false,
  notes: "",
  remarks: "",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

const bills: Bill[] = [
  {
    id: "bill-3838",
    supplierId: "131f1d7a-3e1a-48f4-b9fa-4f65a226a126",
    invoiceNumber: "3838",
    invoiceDate: "2026-09-30",
    dueDate: "2026-10-30",
    subtotal: 35000,
    discount: 0,
    taxableValue: 35000,
    gstRate: 12,
    gst: 4200,
    roundOff: 60,
    grandTotal: 39260,
    total: 39260,
    status: "overdue",
    remarks: "Cotton bales purchase",
    createdAt: "2026-09-30T10:00:00Z",
    updatedAt: "2026-09-30T10:00:00Z",
  },
  // Other supplier bill that should be excluded
  {
    id: "bill-other",
    supplierId: "other-supplier-id",
    invoiceNumber: "9999",
    invoiceDate: "2026-10-01",
    dueDate: "2026-11-01",
    subtotal: 50000,
    discount: 0,
    taxableValue: 50000,
    gstRate: 18,
    gst: 9000,
    roundOff: 0,
    grandTotal: 59000,
    total: 59000,
    status: "pending",
    remarks: "Other supplier",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
  },
];

const payments: Payment[] = [
  {
    id: "pay-1",
    supplierId: "131f1d7a-3e1a-48f4-b9fa-4f65a226a126",
    billId: "bill-3838",
    amount: 10000,
    paymentDate: "2026-10-18",
    mode: "bank",
    reference: "ark2111",
    remarks: "part",
    createdAt: "2026-10-18T10:00:00Z",
  },
  {
    id: "pay-2",
    supplierId: "131f1d7a-3e1a-48f4-b9fa-4f65a226a126",
    billId: "bill-3838",
    amount: 15000,
    paymentDate: "2026-10-19",
    mode: "bank",
    reference: "ark 2111",
    remarks: "part payment",
    createdAt: "2026-10-19T10:00:00Z",
  },
  // Other supplier's payment
  {
    id: "pay-other",
    supplierId: "other-supplier-id",
    billId: "bill-other",
    amount: 25000,
    paymentDate: "2026-10-19",
    mode: "bank",
    reference: "other",
    createdAt: "2026-10-19T10:00:00Z",
  },
];

describe("Supplier Ledger Export", () => {
  const rows = prepareSupplierLedgerRows(supplier, bills, payments);

  it("extracts exactly 3 ledger entries matching screenshot", () => {
    expect(rows.length).toBe(3);
  });

  it("calculates Row 1 as Invoice with debit 39,260 and balance 39,260", () => {
    expect(rows[0].type).toBe("Invoice");
    expect(rows[0].invoice).toBe("3838");
    expect(rows[0].debit).toBe(39260);
    expect(rows[0].credit).toBe(0);
    expect(rows[0].balance).toBe(39260);
  });

  it("calculates Row 2 as Payment with credit 10,000 and balance 29,260", () => {
    expect(rows[1].type).toBe("Payment");
    expect(rows[1].debit).toBe(0);
    expect(rows[1].credit).toBe(10000);
    expect(rows[1].balance).toBe(29260);
  });

  it("calculates Row 3 closing balance as 14,260, exactly matching screen Outstanding: ₹14,260", () => {
    expect(rows[2].type).toBe("Payment");
    expect(rows[2].debit).toBe(0);
    expect(rows[2].credit).toBe(15000);
    expect(rows[2].balance).toBe(14260);
  });

  it("generates CSV with correct headers and ledger values", () => {
    const csv = generateSupplierLedgerCSV(supplier, rows);
    expect(csv).toContain('"Date","Type","Invoice Number","Debit","Credit","Balance","Status","Remarks"');
    expect(csv).toContain("3838");
    expect(csv).toContain("14260");
  });

  it("generates Excel and PDF ledger files without error", () => {
    const tmpDir = os.tmpdir();
    const filenameBase = path.join(tmpDir, `ledger_test_${Date.now()}`);

    exportSupplierLedgerToExcel(supplier, rows, filenameBase);
    expect(fs.existsSync(`${filenameBase}.xlsx`)).toBe(true);
    fs.unlinkSync(`${filenameBase}.xlsx`);

    exportSupplierLedgerToPDF(supplier, rows, filenameBase, "ARK Flow Master");
    expect(fs.existsSync(`${filenameBase}.pdf`)).toBe(true);
    fs.unlinkSync(`${filenameBase}.pdf`);
  });
});
