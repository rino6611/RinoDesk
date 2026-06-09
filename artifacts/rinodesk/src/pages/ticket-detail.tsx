import { useState } from "react";
import { useParams } from "wouter";
import { useGetTicket, useUpdateTicket, useListAgentRuns, getGetTicketQueryKey, getListAgentRunsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatTimeAgo, formatDate } from "@/lib/format";
import { BrainCircuit, Play, CheckCircle2, AlertCircle, Save, Send, Sparkles, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CollabPanel } from "@/components/collab-panel";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function TicketDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ticket, isLoading } = useGetTicket(id, { query: { enabled: !!id, queryKey: getGetTicketQueryKey(id) } });
  const { data: agentRuns, isLoading: runsLoading } = useListAgentRuns({ ticketId: id }, { query: { enabled: !!id, queryKey: getListAgentRunsQueryKey({ ticketId: id }) } });

  const updateTicket = useUpdateTicket();

  const [draftContent, setDraftContent] = useState("");
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveAgentStatus, setLiveAgentStatus] = useState<Record<string, string>>({});

  const handleEditDraft = () => {
    setDraftContent(ticket?.draftResponse || "");
    setIsEditingDraft(true);
  };

  const handleSaveDraft = () => {
    updateTicket.mutate({ id, data: { draftResponse: draftContent } }, {
      onSuccess: () => {
        toast({ title: "Draft saved" });
        setIsEditingDraft(false);
        queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
      },
    });
  };

  const handleEnhance = async () => {
    if (!draftContent.trim()) { toast({ title: "Write a draft first", variant: "destructive" }); return; }
    setEnhancing(true);
    try {
      const resp = await fetch(`${BASE}/api/tickets/${id}/enhance-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draft: draftContent }),
      });
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      setDraftContent((data.enhanced || draftContent).trim());
      toast({ title: "Draft enhanced with AI" });
    } catch {
      toast({ title: "Enhance failed", description: "Make sure your Gemini API key is set.", variant: "destructive" });
    } finally {
      setEnhancing(false);
    }
  };

  const handleResolve = async () => {
    try {
      const resp = await fetch(`${BASE}/api/tickets/${id}/resolve`, { method: "POST", credentials: "include" });
      if (!resp.ok) throw new Error();
      toast({ title: "Ticket resolved", description: "Logged to the tracker." });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
    } catch {
      toast({ title: "Error", description: "Failed to resolve ticket", variant: "destructive" });
    }
  };

  const runAgents = async () => {
    setProcessing(true);
    setLiveAgentStatus({});
    try {
      const resp = await fetch(`${BASE}/api/tickets/${id}/process`, { method: "POST", credentials: "include" });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.agent && event.status === "running") {
                setLiveAgentStatus((prev) => ({ ...prev, [event.agent]: "running" }));
              } else if (event.agent && event.status === "done") {
                setLiveAgentStatus((prev) => ({ ...prev, [event.agent]: "success" }));
              } else if (event.status === "error") {
                toast({ title: "Agent Error", description: event.error || "Agent failed", variant: "destructive" });
              }
            } catch (e) {}
          }
        }
      }
      toast({ title: "Agents completed" });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListAgentRunsQueryKey({ ticketId: id }) });
    } catch (error) {
      toast({ title: "Error", description: "Failed to run agents", variant: "destructive" });
    } finally {
      setProcessing(false);
      setTimeout(() => setLiveAgentStatus({}), 3000);
    }
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!ticket) {
    return <div>Ticket not found</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-mono text-muted-foreground">#{ticket.id}</span>
            <Badge variant={ticket.status === "open" ? "default" : "secondary"} className="uppercase">{ticket.status}</Badge>
            <Badge variant={ticket.priority === "urgent" || ticket.priority === "high" ? "destructive" : "outline"} className="uppercase">{ticket.priority}</Badge>
            {ticket.category && (<Badge variant="outline" className="border-primary text-primary">{ticket.category}</Badge>)}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{ticket.subject}</h1>
          <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
            <span>{ticket.customerName} ({ticket.customerEmail})</span>
            <span>•</span>
            <span>Created {formatDate(ticket.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={runAgents} disabled={processing} className="gap-2">
            {processing ? (<><div className="h-2 w-2 bg-primary rounded-full animate-pulse" /> Running Agents</>) : (<><Play className="h-4 w-4" /> Run Agents</>)}
          </Button>
          {ticket.status !== "resolved" && (
            <Button onClick={handleResolve} variant="outline" className="gap-2"><CheckCircle2 className="h-4 w-4" /> Resolve Ticket</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Customer Message</CardTitle></CardHeader>
            <CardContent><div className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.body}</div></CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row justify-between items-center pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" /> Response Draft</CardTitle>
              {!isEditingDraft && (<Button variant="ghost" size="sm" onClick={handleEditDraft}>{ticket.draftResponse ? "Edit" : "Write Draft"}</Button>)}
            </CardHeader>
            <CardContent>
              {isEditingDraft ? (
                <div className="space-y-4">
                  <Textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} placeholder="Write your reply to the customer…" className="min-h-[200px] text-sm" />
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={handleEnhance} disabled={enhancing} className="gap-2">
                      {enhancing ? (<><Loader2 className="h-4 w-4 animate-spin" /> Enhancing…</>) : (<><Sparkles className="h-4 w-4" /> Enhance with AI</>)}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingDraft(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleSaveDraft} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
                    </div>
                  </div>
                </div>
              ) : ticket.draftResponse ? (
                <div className="space-y-4">
                  <div className="whitespace-pre-wrap text-sm border border-primary/20 p-4 rounded-md bg-background/50">{ticket.draftResponse}</div>
                  <Button onClick={handleResolve} className="w-full gap-2"><Send className="h-4 w-4" /> Send & Resolve</Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-8 text-center italic">Write a draft, or run agents to generate one with AI.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> Ticket Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Ticket #</span><span className="font-mono">{ticket.id}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Guest</span><span className="text-right">{ticket.customerName}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Email</span><span className="text-right truncate max-w-[150px]" title={ticket.customerEmail}>{ticket.customerEmail}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Received</span><span className="text-right">{formatDate(ticket.createdAt)}</span></div>
              <div className="pt-2 border-t border-border"><div className="text-muted-foreground mb-1">Issue</div><div>{ticket.agentSummary || ticket.subject}</div></div>
              <div className="pt-2 border-t border-border"><div className="text-muted-foreground mb-1">Resolution</div><div className="whitespace-pre-wrap">{ticket.draftResponse || (ticket.status === "resolved" ? "Resolved" : "Pending")}</div></div>
            </CardContent>
          </Card>

          <CollabPanel ticketId={ticket.id} assigneeId={(ticket as any).assigneeId ?? null} />

          {ticket.escalationRisk && (
            <Card className={ticket.escalationRisk === "high" ? "border-destructive bg-destructive/5" : ""}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertCircle className={`h-4 w-4 ${ticket.escalationRisk === "high" ? "text-destructive" : "text-muted-foreground"}`} /> Escalation Risk: <span className="uppercase font-bold">{ticket.escalationRisk}</span></CardTitle></CardHeader>
              <CardContent><p className="text-sm">{ticket.escalationReason || "No specific reason detected."}</p></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Agent Runs</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(liveAgentStatus).length > 0 && (
                <div className="space-y-2 mb-4 p-3 bg-secondary/50 rounded-md border border-border">
                  <div className="text-xs font-mono uppercase text-muted-foreground mb-2">Live Activity</div>
                  {Object.entries(liveAgentStatus).map(([agent, status]) => (
                    <div key={agent} className="flex items-center justify-between text-xs"><span className="font-mono">{agent}</span><span className="text-primary animate-pulse uppercase">{status}</span></div>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                {agentRuns?.map((run) => (
                  <div key={run.id} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                    <div><div className="font-mono text-xs">{run.agentName}</div><div className="text-[10px] text-muted-foreground">{formatTimeAgo(run.createdAt)}</div></div>
                    <Badge variant={run.status === "success" ? "outline" : "destructive"} className="text-[10px]">{run.status} {run.durationMs ? `(${run.durationMs}ms)` : ""}</Badge>
                  </div>
                ))}
                {!runsLoading && !agentRuns?.length && (<div className="text-xs text-muted-foreground text-center py-2">No runs recorded</div>)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
