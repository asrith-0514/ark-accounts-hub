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
import { supabase } from "@/lib/supabase";
import { DEFAULT_VAPID_PUBLIC_KEY, registerPushServiceWorker } from "@/lib/push";
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

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(true);

  // Helper to convert URLsafe base64 to Uint8Array for applicationServerKey
  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  useEffect(() => {
    async function checkSubscription() {
      console.log("[Push Notification Setup] Running initial subscription status check...");
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        console.warn("[Push Notification Setup] Service worker or PushManager not supported in this browser context.");
        setPushSupported(false);
        setIsPushLoading(false);
        return;
      }
      setPushSupported(true);

      try {
        console.log("[Push Notification Setup] Registering the push service worker...");
        const registration = await registerPushServiceWorker();
        console.log("[Push Notification Setup] Service worker registered. Checking push subscription...");
        const subscription = await registration.pushManager.getSubscription();
        console.log("[Push Notification Setup] Subscription check complete. Current sub exists:", !!subscription);
        setPushEnabled(!!subscription);
      } catch (err) {
        console.error("[Push Notification Setup] Error during status check:", err);
      } finally {
        setIsPushLoading(false);
      }
    }
    checkSubscription();
  }, []);

  const togglePush = async (checked: boolean) => {
    if (!pushSupported) return;
    setIsPushLoading(true);
    console.log(`[Push Notification Setup] Toggling push notifications to: ${checked}`);
    try {
      const actionPromise = (async () => {
        console.log("[Push Notification Setup] Registering the push service worker...");
        const registration = await registerPushServiceWorker();
        console.log("[Push Notification Setup] Service worker registered.");

        if (checked) {
          console.log("[Push Notification Setup] Requesting browser notification permission...");
          const permission = await Notification.requestPermission();
          console.log(`[Push Notification Setup] Permission request returned: ${permission}`);
          if (permission !== "granted") {
            throw new Error("Permission for push notifications was denied");
          }

          const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
          console.log(`[Push Notification Setup] VAPID Public Key loaded (length: ${vapidPublicKey?.length ?? 0})`);

          console.log("[Push Notification Setup] Subscribing to push service...");
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
          console.log("[Push Notification Setup] Subscription successful! Endpoint:", subscription.endpoint);

          const subJSON = subscription.toJSON();
          let p256dh = subJSON.keys?.p256dh;
          let auth = subJSON.keys?.auth;

          if (!p256dh || !auth) {
            const rawKey = subscription.getKey ? subscription.getKey("p256dh") : null;
            const rawAuth = subscription.getKey ? subscription.getKey("auth") : null;
            if (rawKey && rawAuth) {
              p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))));
              auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));
            }
          }

          if (!p256dh || !auth) {
            throw new Error("Failed to retrieve subscription keys from the browser");
          }

          console.log("[Push Notification Setup] Registering subscription keys in Supabase database...");
          // Delete any existing subscription for this endpoint first to avoid unique key conflicts
          await (supabase as any)
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user?.id)
            .eq("endpoint", subscription.endpoint);

          const { error } = await (supabase as any).from("push_subscriptions").insert({
            user_id: user?.id,
            endpoint: subscription.endpoint,
            p256dh_key: p256dh,
            auth_key: auth,
          });

          if (error) {
            console.error("[Push Notification Setup] Supabase save error. Cleaning up subscription...", error);
            await subscription.unsubscribe();
            throw error;
          }

          console.log("[Push Notification Setup] Subscription successfully recorded in database.");
          setPushEnabled(true);
          toast.success("Push notifications enabled on this device!");
        } else {
          console.log("[Push Notification Setup] Unsubscribing device...");
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
            console.log("[Push Notification Setup] Unsubscribed from browser push service. Deleting from DB...");
            const { error } = await (supabase as any)
              .from("push_subscriptions")
              .delete()
              .eq("user_id", user?.id)
              .eq("endpoint", subscription.endpoint);
            if (error) console.error("[Push Notification Setup] Failed to delete subscription row from Supabase", error);
          }
          setPushEnabled(false);
          toast.success("Push notifications disabled on this device.");
        }
      })();

      await actionPromise;
    } catch (err: any) {
      console.error("[Push Notification Setup] Error during toggle:", err);
      toast.error(err.message || "Failed to toggle push notifications");
      // Reset checkbox state to match actual state
      try {
        const registration = await registerPushServiceWorker();
        const subscription = await registration.pushManager.getSubscription();
        setPushEnabled(!!subscription);
      } catch (innerErr) {
        console.error("Error resetting switch state", innerErr);
      }
    } finally {
      setIsPushLoading(false);
    }
  };

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
              <p className="text-sm font-medium">Push notifications on this device</p>
              <p className="text-xs text-muted-foreground">
                {!pushSupported
                  ? "Not supported on this browser"
                  : pushEnabled
                  ? "Enabled for lockscreen notifications"
                  : "Request permission and register device"}
              </p>
            </div>
            <Switch
              disabled={!pushSupported || isPushLoading}
              checked={pushEnabled}
              onCheckedChange={togglePush}
            />
          </div>
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
