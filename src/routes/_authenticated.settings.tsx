import { useState, useEffect, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload, RotateCcw, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { INDIAN_STATES } from "@/lib/india-locations";
import { useData } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, updateSettings, resetDemoData } = useData();
  const { user } = useAuth();
  const [name, setName] = useState(settings.companyName);
  const [companyState, setCompanyState] = useState(settings.companyState || "Andhra Pradesh");

  const isOwner = user?.role === "owner";

  useEffect(() => {
    setName(settings.companyName);
    setCompanyState(settings.companyState || "Andhra Pradesh");
  }, [settings]);

  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ logoDataUrl: reader.result as string });
      toast.success("Logo uploaded");
    };
    reader.readAsDataURL(file);
  };

  const toggleTheme = (dark: boolean) => {
    updateSettings({ theme: dark ? "dark" : "light" });
    document.documentElement.classList.toggle("dark", dark);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Company profile, notifications and theme." />

      {!isOwner && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive dark:text-destructive">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle className="font-semibold text-destructive">Access Denied</AlertTitle>
          <AlertDescription className="text-destructive/80">
            Only users with the <strong>Owner</strong> role can modify company profile details and preferences.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 shadow-soft space-y-4">
          <h3 className="font-semibold">Company profile</h3>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-muted grid place-items-center overflow-hidden border">
              {settings.logoDataUrl ? (
                <img src={settings.logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">
                  {settings.companyName.charAt(0)}
                </span>
              )}
            </div>
            <div>
              {!isOwner ? (
                <p className="text-xs text-muted-foreground">Only owners can change logo.</p>
              ) : (
                <div>
                  <Label className="cursor-pointer inline-flex items-center gap-2 text-sm text-primary hover:underline">
                    <Upload className="h-4 w-4" /> Upload logo
                    <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">PNG or JPG, up to 2MB.</p>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
          </div>
          <div className="space-y-2">
            <Label>Company state</Label>
            <Select value={companyState} onValueChange={setCompanyState} disabled={!isOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used to auto-calculate GST on purchase bills (IGST for out-of-state, CGST+SGST for local).
            </p>
          </div>
          <Button
            disabled={!isOwner}
            onClick={() => {
              updateSettings({ companyName: name, companyState });
              toast.success("Saved");
            }}
          >
            Save changes
          </Button>
        </Card>

        <Card className="p-5 shadow-soft space-y-4">
          <h3 className="font-semibold">Notifications</h3>
          {[
            { k: "notifyToday", label: "Payments due today" },
            { k: "notifyTomorrow", label: "Payments due tomorrow" },
            { k: "notifyOverdue", label: "Overdue bills" },
          ].map((row) => (
            <div key={row.k} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">Show in notification list</p>
              </div>
              <Switch
                disabled={!isOwner}
                checked={settings[row.k as keyof typeof settings] as boolean}
                onCheckedChange={(v) => updateSettings({ [row.k]: v } as never)}
              />
            </div>
          ))}
          <div className="flex items-center justify-between py-1 pt-3 border-t">
            <div>
              <p className="text-sm font-medium">Dark theme</p>
              <p className="text-xs text-muted-foreground">Use a darker interface</p>
            </div>
            <Switch checked={settings.theme === "dark"} onCheckedChange={toggleTheme} disabled={!isOwner} />
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Signed in as</h3>
          <p className="text-sm">
            <span className="font-medium">{user?.name}</span> · <span className="text-muted-foreground capitalize">{user?.role}</span>
          </p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Demo data</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Reset all suppliers, bills and payments to the original demo dataset. (Disabled on cloud database)
          </p>
          <Button
            variant="outline"
            disabled={true}
            onClick={() => {
              resetDemoData();
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Reset demo data (Disabled)
          </Button>
        </Card>
      </div>
    </div>
  );
}
