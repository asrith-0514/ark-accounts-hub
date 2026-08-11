import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileDown, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/store";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(title: string, header: string[], rows: (string | number)[][]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("ARK Distributors", 14, 15);
  doc.setFontSize(11);
  doc.text(title, 14, 22);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 28);
  autoTable(doc, {
    head: [header],
    body: rows.map((r) => r.map((c) => String(c))),
    startY: 34,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

function ReportsPage() {
  const { suppliers, bills, payments, outstandingByBill, outstandingBySupplier } =
    useData();
  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.companyName || s.supplierName])),
    [suppliers],
  );

  const outstandingRows = useMemo(
    () =>
      bills
        .map((b) => ({ ...b, supplier: supplierMap[b.supplierId], out: outstandingByBill(b.id) }))
        .filter((b) => b.out > 0),
    [bills, supplierMap, outstandingByBill],
  );

  const monthlyPurchase = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const b of bills) {
      const key = b.invoiceDate.slice(0, 7);
      const cur = map.get(key) || { total: 0, count: 0 };
      cur.total += b.total;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [bills]);

  // Aging buckets based on invoice due date vs today
  const aging = useMemo(() => {
    const t = todayISO();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
    const rows: Array<{
      supplier: string;
      current: number;
      d30: number;
      d60: number;
      d90: number;
      d90p: number;
      total: number;
    }> = [];
    for (const s of suppliers) {
      const b = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
      for (const bl of bills.filter((x) => x.supplierId === s.id)) {
        const out = outstandingByBill(bl.id);
        if (out <= 0) continue;
        const days = Math.round(
          (new Date(t).getTime() - new Date(bl.dueDate).getTime()) / 86400000,
        );
        if (days <= 0) b.current += out;
        else if (days <= 30) b.d30 += out;
        else if (days <= 60) b.d60 += out;
        else if (days <= 90) b.d90 += out;
        else b.d90p += out;
      }
      const total = b.current + b.d30 + b.d60 + b.d90 + b.d90p;
      if (total > 0) {
        rows.push({ supplier: s.companyName || s.supplierName, ...b, total });
        buckets.current += b.current;
        buckets.d30 += b.d30;
        buckets.d60 += b.d60;
        buckets.d90 += b.d90;
        buckets.d90p += b.d90p;
      }
    }
    return { rows: rows.sort((a, b) => b.total - a.total), totals: buckets };
  }, [suppliers, bills, outstandingByBill]);

  // GST report: group by month + type
  const gst = useMemo(() => {
    const map = new Map<
      string,
      { taxable: number; cgst: number; sgst: number; igst: number; total: number; count: number }
    >();
    for (const b of bills) {
      const key = b.invoiceDate.slice(0, 7);
      const cur = map.get(key) || {
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
        count: 0,
      };
      cur.taxable += b.subtotal;
      cur.cgst += b.cgstAmount ?? 0;
      cur.sgst += b.sgstAmount ?? 0;
      cur.igst += b.igstAmount ?? 0;
      cur.total += b.gst;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [bills]);

  const exportCSV = (name: string, header: string[], data: (string | number)[][]) => {
    downloadCSV(name, [header, ...data]);
    toast.success(`${name}.csv downloaded`);
  };
  const exportRepPDF = (title: string, header: string[], data: (string | number)[][]) => {
    exportPDF(title, header, data);
    toast.success(`${title} exported`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Outstanding, Aging, GST, Ledger, and Purchase reports with CSV & PDF export."
      />

      <Tabs defaultValue="outstanding">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
          <TabsTrigger value="supplier">Supplier</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="purchase">Monthly Purchase</TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-semibold">Outstanding Report</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCSV(
                      "outstanding-report",
                      ["Invoice", "Supplier", "Due Date", "Total", "Outstanding", "Status"],
                      outstandingRows.map((r) => [
                        r.invoiceNumber,
                        r.supplier,
                        r.dueDate,
                        r.total,
                        r.out,
                        r.status,
                      ]),
                    )
                  }
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportRepPDF(
                      "Outstanding Report",
                      ["Invoice", "Supplier", "Due Date", "Total", "Outstanding", "Status"],
                      outstandingRows.map((r) => [
                        r.invoiceNumber,
                        r.supplier,
                        fmtDate(r.dueDate),
                        inr(r.total),
                        inr(r.out),
                        r.status,
                      ]),
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstandingRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.invoiceNumber}</TableCell>
                      <TableCell>{r.supplier}</TableCell>
                      <TableCell>{fmtDate(r.dueDate)}</TableCell>
                      <TableCell className="text-right">{inr(r.total)}</TableCell>
                      <TableCell className="text-right font-semibold">{inr(r.out)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="aging">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-semibold">Aging Report</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCSV(
                      "aging-report",
                      ["Supplier", "Current", "1-30", "31-60", "61-90", "90+", "Total"],
                      aging.rows.map((r) => [
                        r.supplier,
                        r.current,
                        r.d30,
                        r.d60,
                        r.d90,
                        r.d90p,
                        r.total,
                      ]),
                    )
                  }
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportRepPDF(
                      "Aging Report",
                      ["Supplier", "Current", "1-30", "31-60", "61-90", "90+", "Total"],
                      aging.rows.map((r) => [
                        r.supplier,
                        inr(r.current),
                        inr(r.d30),
                        inr(r.d60),
                        inr(r.d90),
                        inr(r.d90p),
                        inr(r.total),
                      ]),
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">1-30 days</TableHead>
                    <TableHead className="text-right">31-60 days</TableHead>
                    <TableHead className="text-right">61-90 days</TableHead>
                    <TableHead className="text-right">90+ days</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.rows.map((r) => (
                    <TableRow key={r.supplier}>
                      <TableCell className="font-medium">{r.supplier}</TableCell>
                      <TableCell className="text-right">{inr(r.current)}</TableCell>
                      <TableCell className="text-right">{inr(r.d30)}</TableCell>
                      <TableCell className="text-right">{inr(r.d60)}</TableCell>
                      <TableCell className="text-right">{inr(r.d90)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {inr(r.d90p)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{inr(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Grand Total</TableCell>
                    <TableCell className="text-right">{inr(aging.totals.current)}</TableCell>
                    <TableCell className="text-right">{inr(aging.totals.d30)}</TableCell>
                    <TableCell className="text-right">{inr(aging.totals.d60)}</TableCell>
                    <TableCell className="text-right">{inr(aging.totals.d90)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {inr(aging.totals.d90p)}
                    </TableCell>
                    <TableCell className="text-right">
                      {inr(
                        aging.totals.current +
                          aging.totals.d30 +
                          aging.totals.d60 +
                          aging.totals.d90 +
                          aging.totals.d90p,
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gst">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-semibold">GST Summary (Purchase)</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCSV(
                      "gst-summary",
                      ["Month", "Bills", "Taxable", "CGST", "SGST", "IGST", "Total GST"],
                      gst.map(([m, v]) => [m, v.count, v.taxable, v.cgst, v.sgst, v.igst, v.total]),
                    )
                  }
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportRepPDF(
                      "GST Summary",
                      ["Month", "Bills", "Taxable", "CGST", "SGST", "IGST", "Total GST"],
                      gst.map(([m, v]) => [
                        m,
                        v.count,
                        inr(v.taxable),
                        inr(v.cgst),
                        inr(v.sgst),
                        inr(v.igst),
                        inr(v.total),
                      ]),
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Total GST</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gst.map(([m, v]) => (
                    <TableRow key={m}>
                      <TableCell className="font-medium">{m}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right">{inr(v.taxable)}</TableCell>
                      <TableCell className="text-right">{inr(v.cgst)}</TableCell>
                      <TableCell className="text-right">{inr(v.sgst)}</TableCell>
                      <TableCell className="text-right">{inr(v.igst)}</TableCell>
                      <TableCell className="text-right font-semibold">{inr(v.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="supplier">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-semibold">Supplier Report</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCSV(
                      "supplier-report",
                      ["Company", "Contact", "GST", "Credit Days", "Outstanding"],
                      suppliers.map((s) => [
                        s.companyName || s.supplierName,
                        s.contactPerson,
                        s.gstNumber,
                        s.creditDays,
                        outstandingBySupplier(s.id),
                      ]),
                    )
                  }
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportRepPDF(
                      "Supplier Report",
                      ["Company", "Contact", "GST", "Credit Days", "Outstanding"],
                      suppliers.map((s) => [
                        s.companyName || s.supplierName,
                        s.contactPerson,
                        s.gstNumber,
                        s.creditDays,
                        inr(outstandingBySupplier(s.id)),
                      ]),
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Credit Days</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.companyName || s.supplierName}</TableCell>
                      <TableCell>{s.contactPerson}</TableCell>
                      <TableCell className="font-mono text-xs">{s.gstNumber}</TableCell>
                      <TableCell>{s.creditDays}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {inr(outstandingBySupplier(s.id))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-semibold">Payment History</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCSV(
                      "payment-history",
                      ["Date", "Supplier", "Reference", "Mode", "Amount"],
                      payments.map((p) => [
                        p.paymentDate,
                        supplierMap[p.supplierId],
                        p.reference,
                        p.mode,
                        p.amount,
                      ]),
                    )
                  }
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportRepPDF(
                      "Payment History",
                      ["Date", "Supplier", "Reference", "Mode", "Amount"],
                      payments.map((p) => [
                        fmtDate(p.paymentDate),
                        supplierMap[p.supplierId],
                        p.reference,
                        p.mode,
                        inr(p.amount),
                      ]),
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...payments]
                    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
                    .map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{fmtDate(p.paymentDate)}</TableCell>
                        <TableCell>{supplierMap[p.supplierId]}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                        <TableCell className="uppercase text-xs">{p.mode}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {inr(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="purchase">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="font-semibold">Monthly Purchase Report</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCSV(
                      "monthly-purchase",
                      ["Month", "Bills", "Total"],
                      monthlyPurchase.map(([m, v]) => [m, v.count, v.total]),
                    )
                  }
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportRepPDF(
                      "Monthly Purchase",
                      ["Month", "Bills", "Total Value"],
                      monthlyPurchase.map(([m, v]) => [m, v.count, inr(v.total)]),
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyPurchase.map(([m, v]) => (
                    <TableRow key={m}>
                      <TableCell className="font-medium">{m}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right font-semibold">{inr(v.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
