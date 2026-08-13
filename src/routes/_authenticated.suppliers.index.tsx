import { useMemo, useRef, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Trash2,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
  Upload,
  Download,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { SupplierForm } from "@/components/SupplierForm";
import { useData, mapSupplier } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";
import { inr } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suppliers/")({
  component: SuppliersPage,
});

function SuppliersPage() {
  const { suppliers, archiveSupplier, restoreSupplier, deleteSupplier, outstandingBySupplier, importSuppliers } =
    useData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [outstandingFilter, setOutstandingFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [filtered, setFiltered] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        let q = (supabase as any).from("suppliers_with_balances").select("*");
        
        // 1. Status Filter
        if (statusFilter === "archived") {
          q = q.eq("archived", true);
        } else {
          q = q.eq("archived", false);
          if (statusFilter === "active") q = q.eq("status", "active");
          if (statusFilter === "inactive") q = q.eq("status", "inactive");
        }

        // 2. Category Filter
        if (categoryFilter !== "all") {
          q = q.eq("category", categoryFilter);
        }

        // 3. Outstanding Filter
        if (outstandingFilter === "yes") {
          q = q.gt("total_outstanding", 0);
        } else if (outstandingFilter === "no") {
          q = q.eq("total_outstanding", 0);
        }

        // 4. Search text (matches code, supplier_name, company_name, contact_person, phone, gst_number, city)
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
          const searchPattern = `%${trimmedQuery}%`;
          q = q.or(`code.ilike.${searchPattern},supplier_name.ilike.${searchPattern},company_name.ilike.${searchPattern},contact_person.ilike.${searchPattern},phone.ilike.${searchPattern},gst_number.ilike.${searchPattern},city.ilike.${searchPattern}`);
        }

        q = q.order("supplier_name");

        const { data, error } = await q;
        if (!active) return;
        if (error) {
          toast.error(`Failed to load suppliers: ${error.message}`);
        } else if (data) {
          setFiltered(data.map((r: any) => ({
            ...mapSupplier(r),
            total_outstanding: Number(r.total_outstanding ?? 0)
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchFiltered();

    return () => {
      active = false;
    };
  }, [suppliers, query, statusFilter, categoryFilter, outstandingFilter]);

  const exportToExcel = () => {
    if (filtered.length === 0) {
      toast.error("No suppliers to export");
      return;
    }
    const rows = filtered.map((s: any) => ({
      Code: s.code,
      "Supplier Name": s.supplierName,
      "Company Name": s.companyName,
      "Contact Person": s.contactPerson,
      Phone: s.phone,
      "Alt Phone": s.altPhone,
      Email: s.email,
      GSTIN: s.gstNumber,
      PAN: s.panNumber,
      Address: s.address,
      City: s.city,
      State: s.state,
      Pincode: s.pincode,
      "Credit Days": s.creditDays,
      Category: s.category,
      Status: s.status,
      "Outstanding Balance": s.total_outstanding ?? outstandingBySupplier(s.id)
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    XLSX.writeFile(wb, "suppliers-export.xlsx");
    toast.success("Suppliers exported successfully");
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setFormOpen(true);
  };

  const onImportFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const mapped = rows.map((r) => {
        const g = (keys: string[]): string => {
          for (const k of keys) {
            const found = Object.keys(r).find((x) => x.toLowerCase().trim() === k.toLowerCase());
            if (found && r[found] != null && String(r[found]).trim() !== "") return String(r[found]);
          }
          return "";
        };
        return {
          supplierName: g(["Supplier Name", "Name", "Supplier"]),
          phone: g(["Phone", "Phone Number", "Mobile"]),
          gstNumber: g(["GST", "GST Number", "GSTIN"]),
          openingOutstanding: Number(g(["Opening Outstanding", "Opening Balance", "Opening"])) || 0,
          creditDays: Number(g(["Credit Days", "Credit"])) || 30,
          address: g(["Address"]),
        };
      });
      const res = importSuppliers(mapped);
      toast.success(`Imported ${res.added} suppliers (${res.skipped} skipped)`);
    } catch (e) {
      toast.error("Failed to import file");
      console.error(e);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Supplier Name": "Example Supplier",
        Phone: "+91 98765 43210",
        GST: "27AABCB1234F1Z5",
        "Opening Outstanding": 0,
        "Credit Days": 30,
        Address: "Address line",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    XLSX.writeFile(wb, "supplier-import-template.xlsx");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Master"
        description="Central directory of all suppliers used across bills, payments and reports."
        actions={
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 w-full md:w-auto">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
            />
            <Button variant="outline" onClick={downloadTemplate} className="w-full md:w-auto">
              <Download className="h-4 w-4 mr-2" /> Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full md:w-auto">
              <Upload className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button variant="outline" onClick={exportToExcel} className="w-full md:w-auto">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            {can(user, "add") && (
              <Button onClick={openAdd} className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" /> Add Supplier
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-4 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="relative w-full md:max-w-md md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by code, name, phone, GST, city..."
              className="pl-9 w-full"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All (non-archived)</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outstandingFilter} onValueChange={setOutstandingFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All balances</SelectItem>
                <SelectItem value="yes">Has outstanding</SelectItem>
                <SelectItem value="no">No outstanding</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="manufacturer">Manufacturer</SelectItem>
                <SelectItem value="distributor">Distributor</SelectItem>
                <SelectItem value="wholesaler">Wholesaler</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="w-fit md:ml-auto">{filtered.length} suppliers</Badge>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No suppliers" description="Adjust filters or add a new supplier." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const out = (s as any).total_outstanding ?? outstandingBySupplier(s.id);
                  return (
                    <TableRow key={s.id} className={s.archived ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell>
                        <Link
                          to="/suppliers/$id"
                          params={{ id: s.id }}
                          className="font-medium hover:underline"
                        >
                          {s.supplierName}
                        </Link>
                        {s.companyName && s.companyName !== s.supplierName && (
                          <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                            {s.companyName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{s.contactPerson || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.phone || "—"}</TableCell>
                      <TableCell>{s.city || "—"}</TableCell>
                      <TableCell>{s.creditDays} days</TableCell>
                      <TableCell className="text-right font-semibold">{inr(out)}</TableCell>
                      <TableCell>
                        {s.archived ? (
                          <Badge variant="outline">Archived</Badge>
                        ) : s.status === "active" ? (
                          <Badge className="bg-success/15 text-success border-success/20" variant="outline">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 sm:h-9 sm:w-9"
                            title="View"
                            onClick={() => navigate({ to: "/suppliers/$id", params: { id: s.id } })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {can(user, "edit") && (
                            <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9" title="Edit" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {s.archived
                            ? can(user, "restore") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 sm:h-9 sm:w-9"
                                  title="Restore"
                                  onClick={() => {
                                    restoreSupplier(s.id);
                                    toast.success("Supplier restored");
                                  }}
                                >
                                  <ArchiveRestore className="h-4 w-4" />
                                </Button>
                              )
                            : can(user, "archive") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 sm:h-9 sm:w-9"
                                  title="Archive"
                                  onClick={() => {
                                    archiveSupplier(s.id);
                                    toast.success("Supplier archived");
                                  }}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              )}
                          {can(user, "delete") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 sm:h-9 sm:w-9"
                              title="Delete"
                              onClick={() => setDeleteId(s.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <SupplierForm open={formOpen} onOpenChange={setFormOpen} supplier={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the supplier and all associated bills and payments. Only Owners can
              delete. Consider archiving instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deleteSupplier(deleteId);
                  toast.success("Supplier deleted");
                }
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="h-3.5 w-3.5" /> Click a supplier row to view profile, ledger and history.
      </div>
    </div>
  );
}
