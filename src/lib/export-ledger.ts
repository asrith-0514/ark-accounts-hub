import jsPDFModule from "jspdf";
import autoTableModule from "jspdf-autotable";
import * as XLSX from "xlsx";
import { fmtDate, inr, todayISO } from "@/lib/format";
import type { Bill, BillStatus, Payment, Supplier } from "@/lib/types";
import { toast } from "sonner";
import { computeBillStatus, sanitizeFilename } from "@/lib/export-bills";

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

export type ExportLedgerFormat = "xlsx" | "pdf" | "csv";

export interface PreparedLedgerRow {
  date: string;
  type: string;
  invoice: string;
  debit: number;
  credit: number;
  balance: number;
  status: string;
  remarks: string;
}

const statusLabelMap: Record<BillStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  pending: "Pending",
  overdue: "Overdue",
};

/**
 * Prepares ledger entries strictly for the selected supplier in chronological order.
 * Computes running balances matching the application ledger.
 */
export function prepareSupplierLedgerRows(
  supplier: Supplier,
  bills: Bill[],
  payments: Payment[],
): PreparedLedgerRow[] {
  const rows: {
    date: string;
    type: string;
    invoice: string;
    debit: number;
    credit: number;
    status: string;
    remarks: string;
  }[] = [];

  // 1. Opening Balance
  if (supplier.openingOutstanding > 0) {
    rows.push({
      date: supplier.openingBalanceDate || supplier.createdAt?.slice(0, 10) || todayISO(),
      type: "Opening Balance",
      invoice: "—",
      debit: Number(supplier.openingOutstanding),
      credit: 0,
      status: "—",
      remarks: "Opening outstanding at go-live",
    });
  }

  // 2. Invoices (Bills)
  const activeBills = bills.filter((b) => b.supplierId === supplier.id && !b.deletedAt);
  for (const b of activeBills) {
    const total = Number(b.grandTotal ?? b.total ?? 0);
    const billPayments = payments.filter((p) => p.billId === b.id);
    const paidForBill = billPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const status = computeBillStatus(b, paidForBill);

    rows.push({
      date: b.invoiceDate,
      type: "Invoice",
      invoice: b.invoiceNumber,
      debit: total,
      credit: 0,
      status: statusLabelMap[status] || status,
      remarks: b.remarks || "—",
    });
  }

  // 3. Payments
  const supplierPayments = payments.filter((p) => p.supplierId === supplier.id);
  for (const p of supplierPayments) {
    const inv = activeBills.find((b) => b.id === p.billId);
    const paymentDesc = `${p.mode?.toUpperCase() || "PAYMENT"}${p.reference ? ` · ${p.reference}` : ""}${
      p.remarks ? ` · ${p.remarks}` : ""
    }`;

    rows.push({
      date: p.paymentDate,
      type: "Payment",
      invoice: inv?.invoiceNumber ?? "—",
      debit: 0,
      credit: Number(p.amount || 0),
      status: "—",
      remarks: paymentDesc,
    });
  }

  // Sort chronologically by date
  rows.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Calculate running balance
  let runningBalance = 0;
  return rows.map((r) => {
    runningBalance += r.debit - r.credit;
    return {
      ...r,
      balance: runningBalance,
    };
  });
}

/**
 * Exports supplier ledger as an Excel (.xlsx) workbook.
 */
export function exportSupplierLedgerToExcel(
  supplier: Supplier,
  rows: PreparedLedgerRow[],
  filename: string,
) {
  const excelData = rows.map((r) => ({
    Date: r.date,
    Type: r.type,
    "Invoice #": r.invoice,
    Debit: r.debit,
    Credit: r.credit,
    Balance: r.balance,
    Status: r.status,
    Remarks: r.remarks,
  }));

  const totalDebit = rows.reduce((acc, r) => acc + r.debit, 0);
  const totalCredit = rows.reduce((acc, r) => acc + r.credit, 0);
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0;

  // Add summary row at the end
  excelData.push({
    Date: "Closing Balance",
    Type: "",
    "Invoice #": "",
    Debit: totalDebit,
    Credit: totalCredit,
    Balance: closingBalance,
    Status: "",
    Remarks: "",
  });

  const ws = XLSX.utils.json_to_sheet(excelData);

  ws["!cols"] = [
    { wch: 14 }, // Date
    { wch: 18 }, // Type
    { wch: 16 }, // Invoice #
    { wch: 16 }, // Debit
    { wch: 16 }, // Credit
    { wch: 18 }, // Balance
    { wch: 14 }, // Status
    { wch: 35 }, // Remarks
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = sanitizeFilename(supplier.companyName || supplier.supplierName).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Ledger");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Generates CSV string content for supplier ledger.
 */
export function generateSupplierLedgerCSV(supplier: Supplier, rows: PreparedLedgerRow[]): string {
  const headers = [
    "Supplier Name",
    "Supplier Code",
    "Date",
    "Type",
    "Invoice Number",
    "Debit",
    "Credit",
    "Balance",
    "Status",
    "Remarks",
  ];

  const supplierName = supplier.companyName || supplier.supplierName;
  const supplierCode = supplier.code || "—";

  const dataLines = rows.map((r) => [
    supplierName,
    supplierCode,
    r.date,
    r.type,
    r.invoice,
    r.debit,
    r.credit,
    r.balance,
    r.status,
    r.remarks,
  ]);

  return [headers, ...dataLines]
    .map((row) => row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

/**
 * Exports supplier ledger as a CSV (.csv) file.
 */
export function exportSupplierLedgerToCSV(
  supplier: Supplier,
  rows: PreparedLedgerRow[],
  filename: string,
) {
  const csvContent = generateSupplierLedgerCSV(supplier, rows);

  if (typeof document === "undefined") {
    return;
  }

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
 * Exports supplier ledger as a formal PDF (.pdf) statement.
 */
export function exportSupplierLedgerToPDF(
  supplier: Supplier,
  rows: PreparedLedgerRow[],
  filename: string,
  companyName = "ARK Distributors",
) {
  const doc = new jsPDFConstructor({ orientation: "landscape" });
  const supplierName = supplier.companyName || supplier.supplierName;
  const supplierCode = supplier.code || "—";
  const gstNumber = supplier.gstNumber || "—";
  const phone = supplier.phone || "—";

  const totalDebit = rows.reduce((acc, r) => acc + r.debit, 0);
  const totalCredit = rows.reduce((acc, r) => acc + r.credit, 0);
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0;

  // 1. Header Banner
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138); // Deep corporate blue
  doc.text(companyName, 14, 13);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("STATEMENT OF ACCOUNT  ·  SUPPLIER LEDGER", 14, 19);

  // Generation timestamp top right
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
  doc.text("Status: Active Transactions", 283, 18, { align: "right" });

  // Divider
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

  // 3. Financial Summary KPI Cards (4 cards across width)
  const cardWidth = 65;
  const cardGap = 3;
  const cardY = 45;
  const cardH = 12.5;

  // Card 1: Entries
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL TRANSACTIONS", 17, cardY + 4.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${rows.length} Entries`, 17, cardY + 9.5);

  // Card 2: Total Billed (Debits)
  const card2X = 14 + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card2X, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL BILLED (DEBIT)", card2X + 3, cardY + 4.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Rs. ${totalDebit.toLocaleString("en-IN")}`, card2X + 3, cardY + 9.5);

  // Card 3: Total Paid (Credits)
  const card3X = card2X + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card3X, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL PAID (CREDIT)", card3X + 3, cardY + 4.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52); // Success green
  doc.text(`Rs. ${totalCredit.toLocaleString("en-IN")}`, card3X + 3, cardY + 9.5);

  // Card 4: Closing Balance
  const card4X = card3X + cardWidth + cardGap;
  const hasOut = closingBalance > 0;
  doc.setFillColor(hasOut ? 254 : 248, hasOut ? 242 : 250, hasOut ? 242 : 252);
  doc.setDrawColor(hasOut ? 254 : 226, hasOut ? 202 : 232, hasOut ? 202 : 240);
  doc.roundedRect(card4X, cardY, cardWidth, cardH, 1.5, 1.5, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(hasOut ? 185 : 100, hasOut ? 28 : 116, hasOut ? 28 : 139);
  doc.text("CLOSING BALANCE", card4X + 3, cardY + 4.5);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(hasOut ? 185 : 15, hasOut ? 28 : 23, hasOut ? 28 : 42);
  doc.text(`Rs. ${closingBalance.toLocaleString("en-IN")}`, card4X + 3, cardY + 9.5);

  // 4. Data Table
  const headers = [
    "Date",
    "Type",
    "Invoice #",
    "Debit (Rs.)",
    "Credit (Rs.)",
    "Balance (Rs.)",
    "Status",
    "Remarks",
  ];

  const bodyData = rows.map((r) => [
    fmtDate(r.date),
    r.type,
    r.invoice,
    r.debit > 0 ? r.debit.toLocaleString("en-IN") : "—",
    r.credit > 0 ? r.credit.toLocaleString("en-IN") : "—",
    r.balance.toLocaleString("en-IN"),
    r.status,
    r.remarks || "—",
  ]);

  const footData = [
    [
      "Closing Balance",
      "",
      "",
      totalDebit.toLocaleString("en-IN"),
      totalCredit.toLocaleString("en-IN"),
      closingBalance.toLocaleString("en-IN"),
      "",
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
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 138], // Deep navy blue
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 26 }, // Date
      1: { cellWidth: 26 }, // Type
      2: { cellWidth: 24 }, // Invoice #
      3: { cellWidth: 33, halign: "right" }, // Debit (Rs.)
      4: { cellWidth: 33, halign: "right" }, // Credit (Rs.)
      5: { cellWidth: 35, halign: "right" }, // Balance (Rs.)
      6: { cellWidth: 22, halign: "center" }, // Status
      7: { cellWidth: "auto" }, // Remarks
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("ARK Accounts Hub · Computer Generated Statement of Account", 14, 202);
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
 * Main export handler that coordinates formatting, validation, and file generation for supplier ledger.
 */
export function downloadSupplierLedger({
  format,
  supplier,
  bills,
  payments,
  companyName,
}: {
  format: ExportLedgerFormat;
  supplier: Supplier;
  bills: Bill[];
  payments: Payment[];
  companyName?: string;
}): boolean {
  const rows = prepareSupplierLedgerRows(supplier, bills, payments);

  if (rows.length === 0) {
    toast.info("No ledger entries available to download for this supplier.");
    return false;
  }

  const safeSupplierName = sanitizeFilename(supplier.companyName || supplier.supplierName);
  const filename = `${safeSupplierName}_Ledger_${todayISO()}`;

  switch (format) {
    case "xlsx":
      exportSupplierLedgerToExcel(supplier, rows, filename);
      toast.success(`${filename}.xlsx downloaded`);
      return true;
    case "pdf":
      exportSupplierLedgerToPDF(supplier, rows, filename, companyName);
      toast.success(`${filename}.pdf downloaded`);
      return true;
    case "csv":
      exportSupplierLedgerToCSV(supplier, rows, filename);
      toast.success(`${filename}.csv downloaded`);
      return true;
    default:
      return false;
  }
}
