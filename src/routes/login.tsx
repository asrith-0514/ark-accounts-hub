import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import arkLogo from "@/assets/ark-logo.png.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signup(email, password, name);
        toast.success("Account created. Signing you in...");
        await login(email, password);
      } else {
        await login(email, password);
        toast.success("Welcome back!");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-gradient-to-br from-primary via-primary to-info text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white p-1.5 grid place-items-center">
              <img src={arkLogo.url} alt="ARK Distributors" className="h-full w-auto object-contain" />
            </div>
            <span className="font-semibold text-lg">ARK Distributors</span>
          </div>
        </div>
        <div className="relative space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Accounts Payable, streamlined.
          </h1>
          <p className="text-primary-foreground/80 max-w-md">
            Track supplier bills, payments and dues across your wholesale operations with a
            calm, focused dashboard.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} ARK Distributors Pvt. Ltd.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 shadow-elevated">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <img src={arkLogo.url} alt="ARK Distributors" className="h-9 w-auto object-contain" />
            <span className="font-semibold">ARK Distributors</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin"
              ? "Enter your credentials to access the dashboard."
              : "The first account created becomes the Owner. Subsequent accounts join as Accountants."}
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "Need an account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
