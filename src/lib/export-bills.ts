import jsPDFModule from "jspdf";
import autoTableModule from "jspdf-autotable";
import * as XLSX from "xlsx";
import { fmtDate, inr, todayISO } from "@/lib/format";
import type { Bill, BillStatus, Payment, Supplier } from "@/lib/types";
import { toast } from "sonner";

// Cross-environment compatible constructors
const jsPDFConstructor = (
  typeof jsPDFModule === "function"
    ? jsPDFModule
    : (jsPDFModule as Record<string, unknown>).jsPDF ||
      (jsPDFModule as Record<string, unknown>).default ||
      jsPDFModule
) as typeof jsPDFModule;

const autoTableFn = (
  typeof autoTableModule === "function"
    ? autoTableModule
    : (autoTableModule as Record<string, unknown>).default || autoTableModule
) as typeof autoTableModule;

export type ExportBillsFormat = "xlsx" | "pdf" | "csv";

export interface PreparedBillRow {
  supplierName: string;
  supplierCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  discount: number;
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  roundOff: number;
  finalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  remarks: string;
}

/**
 * Safely sanitizes a name for use in file downloads across OSes.
 */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|#%&{}\\$!'@+`=]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "Supplier"
  );
}

/**
 * Computes bill status dynamically based on payments and due date.
 * Mirrors the app's established logic in store.tsx.
 */
export function computeBillStatus(bill: Bill, paid: number): BillStatus {
  const total = bill.grandTotal ?? bill.total;
  if (paid >= total - 0.5) return "paid";
  const overdue = new Date(bill.dueDate) < new Date(todayISO());
  if (paid > 0) return overdue && paid < total ? "overdue" : "partial";
  return overdue ? "overdue" : "pending";
}

const statusLabelMap: Record<BillStatus, string> = {
  paid: "Paid",
  partial: "Partially Paid",
  pending: "Pending",
  overdue: "Overdue",
};

/**
 * Prepares bill rows for export, calculating total paid and outstanding balances accurately.
 * Filters strictly to the selected supplier and excludes deleted bills.
 */
export function prepareSupplierBillRows(
  supplier: Supplier,
  bills: Bill[],
  payments: Payment[],
): PreparedBillRow[] {
  const supplierId = supplier.id;
  const supplierName = supplier.companyName || supplier.supplierName;
  const supplierCode = supplier.code || "—";

  // Filter bills strictly by supplier ID and active state
  const supplierBills = bills
    .filter((b) => b.supplierId === supplierId && !b.deletedAt)
    .sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""));

  return supplierBills.map((b) => {
    // Aggregate payments for this specific bill (prevents duplicate rows)
    const billPayments = payments.filter((p) => p.billId === b.id);
    const paidAmount = billPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const finalAmount = Number(b.grandTotal ?? b.total ?? 0);
    const outstandingAmount = Math.max(0, finalAmount - paidAmount);
    const status = computeBillStatus(b, paidAmount);

    return {
      supplierName,
      supplierCode,
      invoiceNumber: b.invoiceNumber,
      invoiceDate: b.invoiceDate,
      dueDate: b.dueDate,
      status: statusLabelMap[status] || status,
      subtotal: Number(b.subtotal ?? 0),
      discount: Number(b.discount ?? 0),
      taxableValue: Number(b.taxableValue ?? 0),
      gstRate: Number(b.gstRate ?? 0),
      gstAmount: Number(b.gst ?? 0),
      roundOff: Number(b.roundOff ?? 0),
      finalAmount,
      paidAmount,
      outstandingAmount,
      remarks: b.remarks || "",
    };
  });
}

/**
 * Exports supplier bills as an Excel (.xlsx) spreadsheet.
 */
export function exportSupplierBillsToExcel(
  supplier: Supplier,
  rows: PreparedBillRow[],
  filename: string,
) {
  const excelData = rows.map((r) => ({
    "Supplier Name": r.supplierName,
    "Supplier Code": r.supplierCode,
    "Invoice Number": r.invoiceNumber,
    "Invoice Date": r.invoiceDate,
    "Due Date": r.dueDate,
    "Bill Status": r.status,
    Subtotal: r.subtotal,
    Discount: r.discount,
    "Taxable Value": r.taxableValue,
    "GST Rate (%)": r.gstRate,
    "GST Amount": r.gstAmount,
    "Round-off": r.roundOff,
    "Final Invoice Amount": r.finalAmount,
    "Total Paid": r.paidAmount,
    "Outstanding Amount": r.outstandingAmount,
    Remarks: r.remarks,
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set proportional column widths
  ws["!cols"] = [
    { wch: 25 }, // Supplier Name
    { wch: 14 }, // Supplier Code
    { wch: 18 }, // Invoice Number
    { wch: 14 }, // Invoice Date
    { wch: 14 }, // Due Date
    { wch: 16 }, // Bill Status
    { wch: 14 }, // Subtotal
    { wch: 12 }, // Discount
    { wch: 14 }, // Taxable Value
    { wch: 13 }, // GST Rate (%)
    { wch: 14 }, // GST Amount
    { wch: 12 }, // Round-off
    { wch: 20 }, // Final Invoice Amount
    { wch: 14 }, // Total Paid
    { wch: 20 }, // Outstanding Amount
    { wch: 25 }, // Remarks
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = sanitizeFilename(supplier.companyName || supplier.supplierName).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Bills");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exports supplier bills as a CSV (.csv) file.
/**
 * Generates CSV string content for supplier bills.
 */
export function generateSupplierBillsCSV(rows: PreparedBillRow[]): string {
  const headers = [
    "Supplier Name",
    "Supplier Code",
    "Invoice Number",
    "Invoice Date",
    "Due Date",
    "Bill Status",
    "Subtotal",
    "Discount",
    "Taxable Value",
    "GST Rate (%)",
    "GST Amount",
    "Round-off",
    "Final Invoice Amount",
    "Total Paid",
    "Outstanding Amount",
    "Remarks",
  ];

  const dataLines = rows.map((r) => [
    r.supplierName,
    r.supplierCode,
    r.invoiceNumber,
    r.invoiceDate,
    r.dueDate,
    r.status,
    r.subtotal,
    r.discount,
    r.taxableValue,
    r.gstRate,
    r.gstAmount,
    r.roundOff,
    r.finalAmount,
    r.paidAmount,
    r.outstandingAmount,
    r.remarks,
  ]);

  return [headers, ...dataLines]
    .map((row) => row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

/**
 * Exports supplier bills as a CSV (.csv) file.
 */
export function exportSupplierBillsToCSV(rows: PreparedBillRow[], filename: string) {
  const csvContent = generateSupplierBillsCSV(rows);

  if (typeof document === "undefined") {
    return;
  }

  // UTF-8 BOM ensures proper character rendering in Excel
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports supplier bills as a high-quality PDF (.pdf) in landscape orientation.
 */
export function exportSupplierBillsToPDF(
  supplier: Supplier,
  rows: PreparedBillRow[],
  filename: string,
  companyName = "ARK Distributors",
) {
  const doc = new jsPDFConstructor({ orientation: "landscape" });
  const supplierName = supplier.companyName || supplier.supplierName;
  const supplierCode = supplier.code || "—";
  const gstNumber = supplier.gstNumber || "—";
  const phone = supplier.phone || "—";

  // Totals
  const totalBilled = rows.reduce((acc, r) => acc + r.finalAmount, 0);
  const totalPaid = rows.reduce((acc, r) => acc + r.paidAmount, 0);
  const totalOutstanding = rows.reduce((acc, r) => acc + r.outstandingAmount, 0);
  const sumSubtotal = rows.reduce((acc, r) => acc + r.subtotal, 0);
  const sumDiscount = rows.reduce((acc, r) => acc + r.discount, 0);
  const sumTaxable = rows.reduce((acc, r) => acc + r.taxableValue, 0);
  const sumGst = rows.reduce((acc, r) => acc + r.gstAmount, 0);
  const sumRoundOff = rows.reduce((acc, r) => acc + r.roundOff, 0);

  // 1. Header Banner
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138); // Deep corporate blue
  doc.text(companyName, 14, 13);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("PURCHASE BILLS STATEMENT  ·  SUPPLIER INVOICES", 14, 19);

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${dateStr} ${timeStr}`, 283, 13, { align: "right" });
  doc.text("Status: Active Bills", 283, 18, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, 22, 283, 22);

  // 2. Supplier Details Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 25, 269, 17, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 25, 269, 17, 2, 2, "S");

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Supplier: ${supplierName} (${supplierCode})`, 18, 31.5);

  const address = [supplier.address, supplier.city, supplier.state, supplier.pincode]
    .filter(Boolean)
    .join(", ");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Address: ${address || "—"}`, 18, 37.5);

  doc.text(
    `GSTIN: ${gstNumber}   |   PAN: ${supplier.panNumber || "—"}   |   Phone: ${phone}`,
    279,
    34,
    { align: "right" },
  );

  // 3. Financial Summary KPI Cards
  const cardWidth = 65;
  const cardGap = 3;
  const cardY = 45;
  const cardH = 12.5;

  // Card 1: Bills Count
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL BILLS", 17, cardY + 4.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${rows.length} Invoices`, 17, cardY + 9.5);

  // Card 2: Total Invoiced
  const card2X = 14 + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card2X, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL INVOICED AMOUNT", card2X + 3, cardY + 4.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Rs. ${totalBilled.toLocaleString("en-IN")}`, card2X + 3, cardY + 9.5);

  // Card 3: Total Paid
  const card3X = card2X + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card3X, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL AMOUNT PAID", card3X + 3, cardY + 4.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(`Rs. ${totalPaid.toLocaleString("en-IN")}`, card3X + 3, cardY + 9.5);

  // Card 4: Total Outstanding
  const card4X = card3X + cardWidth + cardGap;
  const hasOut = totalOutstanding > 0;
  doc.setFillColor(hasOut ? 254 : 248, hasOut ? 242 : 250, hasOut ? 242 : 252);
  doc.setDrawColor(hasOut ? 254 : 226, hasOut ? 202 : 232, hasOut ? 202 : 240);
  doc.roundedRect(card4X, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(hasOut ? 185 : 100, hasOut ? 28 : 116, hasOut ? 28 : 139);
  doc.text("TOTAL OUTSTANDING", card4X + 3, cardY + 4.5);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(hasOut ? 185 : 15, hasOut ? 28 : 23, hasOut ? 28 : 42);
  doc.text(`Rs. ${totalOutstanding.toLocaleString("en-IN")}`, card4X + 3, cardY + 9.5);

  const headers = [
    "Invoice #",
    "Inv Date",
    "Due Date",
    "Status",
    "Subtotal (Rs.)",
    "Disc",
    "Taxable (Rs.)",
    "GST %",
    "GST (Rs.)",
    "R.Off",
    "Total (Rs.)",
    "Paid (Rs.)",
    "Balance (Rs.)",
    "Remarks",
  ];

  const bodyData = rows.map((r) => [
    r.invoiceNumber,
    fmtDate(r.invoiceDate),
    fmtDate(r.dueDate),
    r.status,
    r.subtotal.toLocaleString("en-IN"),
    r.discount > 0 ? r.discount.toLocaleString("en-IN") : "—",
    r.taxableValue.toLocaleString("en-IN"),
    `${r.gstRate}%`,
    r.gstAmount.toLocaleString("en-IN"),
    r.roundOff !== 0 ? r.roundOff.toLocaleString("en-IN") : "0",
    r.finalAmount.toLocaleString("en-IN"),
    r.paidAmount > 0 ? r.paidAmount.toLocaleString("en-IN") : "—",
    r.outstandingAmount.toLocaleString("en-IN"),
    r.remarks || "—",
  ]);

  const footData = [
    [
      "Total",
      "",
      "",
      "",
      sumSubtotal.toLocaleString("en-IN"),
      sumDiscount > 0 ? sumDiscount.toLocaleString("en-IN") : "—",
      sumTaxable.toLocaleString("en-IN"),
      "",
      sumGst.toLocaleString("en-IN"),
      sumRoundOff !== 0 ? sumRoundOff.toLocaleString("en-IN") : "0",
      totalBilled.toLocaleString("en-IN"),
      totalPaid.toLocaleString("en-IN"),
      totalOutstanding.toLocaleString("en-IN"),
      "",
    ],
  ];

  autoTableFn(doc, {
    head: [headers],
    body: bodyData,
    foot: footData,
    startY: 61,
    theme: "striped",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontSize: 7.5,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Invoice #
      1: { cellWidth: 18 }, // Inv Date
      2: { cellWidth: 18 }, // Due Date
      3: { cellWidth: 17, halign: "center" }, // Status
      4: { cellWidth: 21, halign: "right" }, // Subtotal
      5: { cellWidth: 15, halign: "right" }, // Discount
      6: { cellWidth: 21, halign: "right" }, // Taxable
      7: { cellWidth: 14, halign: "center" }, // GST %
      8: { cellWidth: 18, halign: "right" }, // GST Amt
      9: { cellWidth: 14, halign: "right" }, // R.Off
      10: { cellWidth: 22, halign: "right" }, // Total
      11: { cellWidth: 20, halign: "right" }, // Paid
      12: { cellWidth: 22, halign: "right" }, // Outstanding
      13: { cellWidth: "auto" }, // Remarks
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("ARK Accounts Hub · Computer Generated Bills Report", 14, 202);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 14,
        202,
        { align: "right" },
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Main export handler that coordinates formatting, validation, and file generation.
 */
export function downloadSupplierBills({
  format,
  supplier,
  bills,
  payments,
  companyName,
}: {
  format: ExportBillsFormat;
  supplier: Supplier;
  bills: Bill[];
  payments: Payment[];
  companyName?: string;
}): boolean {
  const rows = prepareSupplierBillRows(supplier, bills, payments);

  if (rows.length === 0) {
    toast.info("No bills available to download for this supplier.");
    return false;
  }

  const safeSupplierName = sanitizeFilename(supplier.companyName || supplier.supplierName);
  const filename = `${safeSupplierName}_Bills_${todayISO()}`;

  switch (format) {
    case "xlsx":
      exportSupplierBillsToExcel(supplier, rows, filename);
      toast.success(`${filename}.xlsx downloaded`);
      return true;
    case "pdf":
      exportSupplierBillsToPDF(supplier, rows, filename, companyName);
      toast.success(`${filename}.pdf downloaded`);
      return true;
    case "csv":
      exportSupplierBillsToCSV(rows, filename);
      toast.success(`${filename}.csv downloaded`);
      return true;
    default:
      return false;
  }
}
