import { describe, it, expect } from "vitest";
import {
  prepareSupplierBillRows,
  exportSupplierBillsToExcel,
  exportSupplierBillsToPDF,
  generateSupplierBillsCSV,
} from "../export-bills";
import type { Supplier, Bill, Payment } from "../types";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const testSupplier: Supplier = {
  id: "sup-test",
  code: "SUP777",
  supplierName: "Apex Logistics / Cargo & Freight Inc.",
  companyName: "Apex Logistics India Pvt Ltd",
  contactPerson: "Rahul Verma",
  phone: "9123456780",
  altPhone: "",
  email: "apex@example.com",
  gstNumber: "37AAAAA0000A1Z5",
  panNumber: "AAAAA0000A",
  address: "Plot 42, Port Road",
  city: "Visakhapatnam",
  state: "Andhra Pradesh",
  pincode: "530001",
  country: "India",
  paymentTerms: "Net 30",
  creditDays: 30,
  preferredPaymentMethod: "bank",
  openingOutstanding: 0,
  openingBalanceDate: "2026-01-01",
  bankName: "SBI",
  accountHolderName: "Apex Logistics",
  accountNumber: "111222333",
  ifsc: "SBIN0001111",
  upiId: "",
  category: "distributor",
  status: "active",
  archived: false,
  notes: "",
  remarks: "",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const testBills: Bill[] = [
  {
    id: "b-1",
    supplierId: "sup-test",
    invoiceNumber: "INV-APEX-01",
    invoiceDate: "2026-04-01",
    dueDate: "2026-05-01",
    subtotal: 10000,
    discount: 500,
    taxableValue: 9500,
    gstRate: 18,
    gst: 1710,
    otherCharges: 0,
    roundOff: 0,
    grandTotal: 11210,
    total: 11210,
    gstType: "cgst_sgst",
    status: "paid",
    workflowStatus: "approved",
    remarks: "Delivered on schedule",
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "b-2",
    supplierId: "sup-test",
    invoiceNumber: "INV-APEX-02",
    invoiceDate: "2026-04-15",
    dueDate: "2026-05-15",
    subtotal: 25000,
    discount: 1000,
    taxableValue: 24000,
    gstRate: 18,
    gst: 4320,
    otherCharges: 0,
    roundOff: 0,
    grandTotal: 28320,
    total: 28320,
    gstType: "cgst_sgst",
    status: "partial",
    workflowStatus: "approved",
    remarks: "Partial shipment",
    createdAt: "2026-04-15T00:00:00Z",
  },
];

const testPayments: Payment[] = [
  {
    id: "p-1",
    supplierId: "sup-test",
    billId: "b-1",
    amount: 11210,
    paymentDate: "2026-04-20",
    mode: "bank",
    reference: "RTGS999",
    createdAt: "2026-04-20T00:00:00Z",
  },
  {
    id: "p-2",
    supplierId: "sup-test",
    billId: "b-2",
    amount: 15000,
    paymentDate: "2026-04-25",
    mode: "bank",
    reference: "NEFT888",
    createdAt: "2026-04-25T00:00:00Z",
  },
];

describe("Supplier Bills File Generators", () => {
  const tmpDir = os.tmpdir();
  const filenameBase = path.join(tmpDir, `test_export_${Date.now()}`);
  const rows = prepareSupplierBillRows(testSupplier, testBills, testPayments);

  it("prepares exactly 2 rows for supplier bills", () => {
    expect(rows.length).toBe(2);
  });

  it("generates an Excel spreadsheet successfully", () => {
    exportSupplierBillsToExcel(testSupplier, rows, filenameBase);
    const xlsxPath = `${filenameBase}.xlsx`;
    expect(fs.existsSync(xlsxPath)).toBe(true);
    const stat = fs.statSync(xlsxPath);
    expect(stat.size).toBeGreaterThan(1000);
    fs.unlinkSync(xlsxPath);
  });

  it("generates a PDF document successfully", () => {
    exportSupplierBillsToPDF(testSupplier, rows, filenameBase, "ARK Flow Master");
    const pdfPath = `${filenameBase}.pdf`;
    expect(fs.existsSync(pdfPath)).toBe(true);
    const stat = fs.statSync(pdfPath);
    expect(stat.size).toBeGreaterThan(1000);
    fs.unlinkSync(pdfPath);
  });

  it("generates CSV content with proper escaping and columns", () => {
    const csvContent = generateSupplierBillsCSV(rows);
    expect(csvContent).toContain('"Supplier Name","Supplier Code"');
    expect(csvContent).toContain("INV-APEX-01");
    expect(csvContent).toContain("INV-APEX-02");
  });
});
