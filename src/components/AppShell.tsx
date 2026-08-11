import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  IndianRupee,
  BarChart3,
  Bell,
  Settings,
  Search,
  LogOut,
  Menu,
  Activity as ActivityIcon,
} from "lucide-react";
import arkLogo from "@/assets/ark-logo.png.asset.json";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/store";
import { todayISO } from "@/lib/format";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/suppliers", label: "Suppliers", icon: Users },
  { to: "/bills", label: "Bills", icon: FileText },
  { to: "/payments", label: "Payments", icon: IndianRupee },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/notifications", label: "Reminders", icon: Bell },
  { to: "/activity", label: "Activity Log", icon: ActivityIcon },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { settings } = useData();
  const { bills, outstandingByBill } = useData();

  const alerts = useMemo(() => {
    const t = todayISO();
    return bills.filter((b) => {
      const out = outstandingByBill(b.id);
      if (out <= 0) return false;
      return b.dueDate <= t || b.status === "overdue";
    }).length;
  }, [bills, outstandingByBill]);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <img src={arkLogo.url} alt="ARK Distributors" className="h-10 w-auto object-contain" />
        <div className="min-w-0">
          <p className="font-semibold truncate leading-tight">{settings.companyName}</p>
          <p className="text-xs text-muted-foreground">Accounts Payable</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active =
            pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.to === "/notifications" && alerts > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground">
                  {alerts}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} ARK Distributors
        </p>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { suppliers, bills, payments, outstandingByBill } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);

  const alerts = useMemo(() => {
    const t = todayISO();
    return bills.filter((b) => {
      const out = outstandingByBill(b.id);
      if (out <= 0) return false;
      return b.dueDate <= t || b.status === "overdue";
    }).length;
  }, [bills, outstandingByBill]);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return {
      suppliers: suppliers
        .filter(
          (s) =>
            s.companyName.toLowerCase().includes(q) ||
            s.contactPerson.toLowerCase().includes(q) ||
            s.gstNumber.toLowerCase().includes(q),
        )
        .slice(0, 4),
      bills: bills.filter((b) => b.invoiceNumber.toLowerCase().includes(q)).slice(0, 4),
      payments: payments.filter((p) => p.reference.toLowerCase().includes(q)).slice(0, 4),
    };
  }, [query, suppliers, bills, payments]);

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  const initials = (user?.name || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-sidebar-border sticky top-0 h-screen">
        <SidebarContent />
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                placeholder="Search suppliers, invoices, references..."
                className="pl-9 h-10 bg-muted/50 border-transparent focus-visible:bg-card"
              />
              {showResults && results && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-popover border rounded-xl shadow-elevated p-2 max-h-80 overflow-auto z-40">
                  {results.suppliers.length === 0 &&
                  results.bills.length === 0 &&
                  results.payments.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No results found</p>
                  ) : (
                    <>
                      {results.suppliers.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground px-2 py-1.5">Suppliers</p>
                          {results.suppliers.map((s) => (
                            <Link
                              key={s.id}
                              to="/suppliers/$id"
                              params={{ id: s.id }}
                              className="block px-2 py-2 hover:bg-accent rounded-md text-sm"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setQuery("");
                                setShowResults(false);
                              }}
                            >
                              <span className="font-medium">{s.companyName}</span>
                              <span className="text-muted-foreground"> · {s.contactPerson}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {results.bills.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground px-2 py-1.5">Bills</p>
                          {results.bills.map((b) => (
                            <Link
                              key={b.id}
                              to="/bills"
                              className="block px-2 py-2 hover:bg-accent rounded-md text-sm"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setQuery("");
                                setShowResults(false);
                              }}
                            >
                              <span className="font-medium">{b.invoiceNumber}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {results.payments.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground px-2 py-1.5">Payments</p>
                          {results.payments.map((p) => (
                            <Link
                              key={p.id}
                              to="/payments"
                              className="block px-2 py-2 hover:bg-accent rounded-md text-sm"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setQuery("");
                                setShowResults(false);
                              }}
                            >
                              <span className="font-medium">{p.reference}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <Link
              to="/notifications"
              className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {alerts > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[8px] flex items-center justify-center bg-destructive text-destructive-foreground rounded-full">
                  {alerts}
                </Badge>
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 px-2 gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left leading-tight">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
