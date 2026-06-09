import { useState } from "react";
import { useGetSettings, useUpdateSettings, useSendTestAlert, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Bell, BellOff, CheckCircle, XCircle, Send, ExternalLink, ShieldAlert } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const sendTestAlert = useSendTestAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [webhookEditing, setWebhookEditing] = useState(false);

  const handleToggle = async (field: "alertsEnabled" | "alertOnHigh" | "alertOnMedium", value: boolean) => {
    try {
      await updateSettings.mutateAsync({ data: { [field]: value } });
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  const handleSaveWebhook = async () => {
    try {
      await updateSettings.mutateAsync({ data: { slackWebhookUrl: webhookUrl } });
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      setWebhookEditing(false);
      setWebhookUrl("");
      toast({ title: "Webhook URL saved" });
    } catch {
      toast({ title: "Failed to save webhook URL", variant: "destructive" });
    }
  };

  const handleTestAlert = async () => {
    try {
      const result = await sendTestAlert.mutateAsync();
      if (result.success) {
        toast({ title: "Test alert sent", description: result.message });
      } else {
        toast({ title: "Test alert failed", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send test alert", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const hasWebhook = !!settings?.slackWebhookUrl;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Escalation Alerts</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure real-time Slack notifications when the EscalationDetector agent flags high-risk tickets.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.alertsEnabled ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-base">Alerts Active</CardTitle>
                <CardDescription>Enable or disable all escalation notifications</CardDescription>
              </div>
            </div>
            <Switch
              data-testid="toggle-alerts-enabled"
              checked={settings?.alertsEnabled ?? false}
              onCheckedChange={(val) => handleToggle("alertsEnabled", val)}
              disabled={updateSettings.isPending}
            />
          </div>
        </CardHeader>

        {settings?.alertsEnabled && (
          <>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Alert Thresholds</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <div>
                    <Label className="text-sm font-medium">High Escalation Risk</Label>
                    <p className="text-xs text-muted-foreground">Fires when agent detects high risk</p>
                  </div>
                </div>
                <Switch
                  data-testid="toggle-alert-on-high"
                  checked={settings?.alertOnHigh ?? true}
                  onCheckedChange={(val) => handleToggle("alertOnHigh", val)}
                  disabled={updateSettings.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-4 w-4 text-yellow-500" />
                  <div>
                    <Label className="text-sm font-medium">Medium Escalation Risk</Label>
                    <p className="text-xs text-muted-foreground">Fires when agent detects medium risk</p>
                  </div>
                </div>
                <Switch
                  data-testid="toggle-alert-on-medium"
                  checked={settings?.alertOnMedium ?? false}
                  onCheckedChange={(val) => handleToggle("alertOnMedium", val)}
                  disabled={updateSettings.isPending}
                />
              </div>
            </CardContent>
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Slack Webhook</CardTitle>
              <CardDescription>Paste your Slack Incoming Webhook URL to receive alerts in a channel</CardDescription>
            </div>
            <Badge variant={hasWebhook ? "default" : "secondary"} className="font-mono text-[10px]">
              {hasWebhook ? "CONFIGURED" : "NOT SET"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasWebhook && !webhookEditing ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm text-muted-foreground font-mono truncate">
                {settings?.slackWebhookUrl?.replace(/\/T[^/]+\/B[^/]+\/[^/]+$/, "/…hidden…")}
              </span>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-change-webhook"
                onClick={() => { setWebhookEditing(true); setWebhookUrl(""); }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url" className="text-xs text-muted-foreground">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  data-testid="input-webhook-url"
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  data-testid="button-save-webhook"
                  onClick={handleSaveWebhook}
                  disabled={!webhookUrl.startsWith("https://hooks.slack.com") || updateSettings.isPending}
                >
                  Save Webhook
                </Button>
                {webhookEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setWebhookEditing(false)}>Cancel</Button>
                )}
              </div>
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                How to create a Slack Incoming Webhook
              </a>
            </div>
          )}

          {hasWebhook && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="button-test-alert"
                onClick={handleTestAlert}
                disabled={sendTestAlert.isPending}
              >
                <Send className="h-3.5 w-3.5 mr-2" />
                {sendTestAlert.isPending ? "Sending..." : "Send Test Alert"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { step: "1", text: "An agent submits a ticket and clicks Run Agents" },
            { step: "2", text: "The EscalationDetector AI agent analyzes the ticket for risk signals" },
            { step: "3", text: "If the risk level matches your threshold, a Slack alert fires immediately" },
            { step: "4", text: "Your team sees ticket ID, subject, customer, priority, and escalation reason in Slack" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-secondary text-xs flex items-center justify-center font-mono shrink-0 mt-0.5">{step}</span>
              <span className="text-sm text-muted-foreground">{text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
