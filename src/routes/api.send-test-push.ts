import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { DEFAULT_VAPID_PUBLIC_KEY } from "@/lib/push";

export const Route = createFileRoute("/api/send-test-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. First Layer Check: Secret push token validation
        const url = new URL(request.url);
        const querySecret = url.searchParams.get("secret");
        const headerSecret = request.headers.get("X-Push-Secret");
        const expectedSecret = process.env.PUSH_NOTIFICATION_SECRET;

        if (!expectedSecret || (querySecret !== expectedSecret && headerSecret !== expectedSecret)) {
          return new Response(JSON.stringify({ error: "Unauthorized: Invalid secret token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 2. Second Layer Check: Authenticated Owner validation
        const authHeader = request.headers.get("Authorization");
        let token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

        // Strip leading/trailing double quotes if present (common when copy-pasting from terminal/configs)
        if (token && token.startsWith('"') && token.endsWith('"')) {
          token = token.slice(1, -1);
        }

        if (!token) {
          return new Response(JSON.stringify({ error: "Unauthorized: Missing auth token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://yamzfnayjrdyjnwtxpoy.supabase.co";
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
          return new Response(JSON.stringify({ error: "Server Configuration Error: Missing service_role key" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Confined client instance to read subscriptions and check role data safely
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // Retrieve active session details
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
          return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Verify owner role
        const { data: roleData, error: roleError } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "owner")
          .maybeSingle();

        if (roleError || !roleData) {
          return new Response(JSON.stringify({ error: "Forbidden: Owner access required" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Configure push client
        const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || `mailto:${user.email || "admin@example.com"}`;

        if (!vapidPrivateKey) {
          return new Response(JSON.stringify({ error: "Server Configuration Error: Missing VAPID private key" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

        // Optional custom body payload
        let customTitle = "ARK Accounts Hub";
        let customBody = "Test notification from ARK Accounts Hub";
        let customUrl = "/notifications";
        let targetUserId: string | null = null;

        try {
          if (request.headers.get("Content-Type")?.includes("application/json")) {
            const bodyJson = await request.json();
            if (bodyJson.title) customTitle = bodyJson.title;
            if (bodyJson.body) customBody = bodyJson.body;
            if (bodyJson.url) customUrl = bodyJson.url;
            if (bodyJson.user_id) targetUserId = bodyJson.user_id;
          }
        } catch {
          // Fall back to defaults if body cannot be parsed
        }

        // Fetch subscriptions (optionally filtered by target user)
        let query = supabaseAdmin.from("push_subscriptions").select("*");
        if (targetUserId) {
          query = query.eq("user_id", targetUserId);
        }

        const { data: subscriptions, error: subsError } = await query;

        if (subsError) {
          return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(
            JSON.stringify({
              message: "No active push subscriptions found",
              sentCount: 0,
              results: [],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const payload = JSON.stringify({
          title: customTitle,
          body: customBody,
          icon: "/favicon.png",
          url: customUrl,
          tag: "ark-push-" + Date.now(),
        });

        const results = await Promise.allSettled(
          subscriptions.map(async (sub) => {
            try {
              const res = await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh_key,
                    auth: sub.auth_key,
                  },
                },
                payload,
                {
                  urgency: "high",
                  TTL: 86400,
                }
              );
              let endpointHost = "unknown";
              try {
                endpointHost = new URL(sub.endpoint).host;
              } catch {}
              return {
                id: sub.id,
                host: endpointHost,
                statusCode: res.statusCode,
                success: true,
              };
            } catch (pushErr: any) {
              // Cleanup expired or deleted subscriptions
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
                return { id: sub.id, success: false, deleted: true, reason: "Subscription expired/unsubscribed" };
              }
              return {
                id: sub.id,
                success: false,
                statusCode: pushErr.statusCode,
                message: pushErr.message || "Failed to deliver push",
              };
            }
          })
        );

        const mappedResults = results.map((r) =>
          r.status === "fulfilled" ? r.value : { success: false, error: "Push dispatch error" }
        );

        return new Response(
          JSON.stringify({
            message: "Push notification dispatch complete",
            totalSubscriptions: subscriptions.length,
            results: mappedResults,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
