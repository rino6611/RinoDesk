import { useState } from "react";
import { useListTickets, getListTicketsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, Play, Loader2, CheckCircle2, Search, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatTimeAgo } from "@/lib/format";

const TRIAGE_WINDOW_MS = 10 * 60 * 1000;
const PRANK: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };

function isAutoTriaging(t: { processedAt?: string | null; createdAt: string }) {
  if (t.processedAt) return false;
  return Date.now() - new Date(t.createdAt).getTime() < TRIAGE_WINDOW_MS;
}
function initials(name: string) {
  return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function priorityBar(p: string) {
  return p === "urgent" ? "bg-red-500" : p === "high" ? "bg-orange-500" : p === "medium" ? "bg-amber-400" : "bg-slate-500/40";
}
function statusPill(s: string) {
  return s === "resolved" ? "bg-green-500/15 text-green-400" : s === "in_progress" ? "bg-blue-500/15 text-blue-400" : "bg-primary/15 text-primary";
}
function priorityPill(p: string) {
  return p === "urgent" || p === "high" ? "bg-red-500/15 text-red-400" : p === "medium" ? "bg-amber-500/15 text-amber-400" : "bg-secondary text-muted-foreground";
}

async function processOne(ticketId: number) {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const resp = await fetch(`${BASE}/api/tickets/${ticketId}/process`, { method: "POST", credentials: "include" });
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  while (true) { const { done, value } = await reader.read(); if (done) break; decoder.decode(value); }
}

const VIEWS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
];

export default function Tickets() {
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [sortKey, setSortKey] = useState<"createdAt" | "subject" | "customerName" | "priority">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ticketParams = { status: view !== "all" ? view : undefined };
  const { data: tickets, isLoading } = useListTickets(ticketParams, {
    query: {
      queryKey: getListTicketsQueryKey(ticketParams),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!Array.isArray(data)) return false;
        return data.some(isAutoTriaging) ? 4000 : false;
      },
    },
  });

  const q = search.trim().toLowerCase();
  let rows = (tickets ?? []).filter((t) =>
    !q || t.subject?.toLowerCase().includes(q) || t.customerName?.toLowerCase().includes(q) ||
    t.customerEmail?.toLowerCase().includes(q) || String(t.id).includes(q)
  );
  rows = [...rows].sort((a: any, b: any) => {
    let av: any, bv: any;
    if (sortKey === "priority") { av = PRANK[a.priority] ?? 0; bv = PRANK[b.priority] ?? 0; }
    else if (sortKey === "createdAt") { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
    else { av = (a[sortKey] || "").toLowerCase(); bv = (b[sortKey] || "").toLowerCase(); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const setSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "subject" || key === "customerName" ? "asc" : "desc"); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey !== k ? <ChevronDown className="h-3 w-3 opacity-30" /> : sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = rows.length > 0 && rows.every((t) => selected.includes(t.id));
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((t) => t.id));

  const runAgents = async (id: number) => {
    setProcessingId(id);
    try { await processOne(id); toast({ title: "Agents completed", description: `Ticket #${id} processed` }); queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() }); }
    catch { toast({ title: "Error", description: "Failed to run agents", variant: "destructive" }); }
    finally { setProcessingId(null); }
  };
  const runBulk = async () => {
    setBulkRunning(true); let ok = 0;
    for (const id of selected) { try { await processOne(id); ok++; } catch {} }
    setBulkRunning(false); setSelected([]);
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    toast({ title: "Bulk processing done", description: `Ran agents on ${ok} of ${selected.length}` });
  };

  return (
    <div className="space-y-5 rd-fade">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ticket Inbox</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{isLoading ? "Loading…" : `${rows.length} ticket${rows.length === 1 ? "" : "s"}`}</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${view === v.key ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/70"}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full lg:w-[260px] pl-9 h-9" />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          {selected.length > 0 ? (
            <div className="flex items-center gap-3 w-full rd-fade">
              <span className="font-medium normal-case text-foreground">{selected.length} selected</span>
              <Button size="sm" className="gap-2 ml-auto h-7" onClick={runBulk} disabled={bulkRunning}>
                {bulkRunning ? <><Loader2 className="h-3 w-3 animate-spin" />Processing…</> : <><Play className="h-3 w-3" />Run Agents on {selected.length}</>}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button onClick={() => setSort("subject")} className="flex items-center gap-1 hover:text-foreground transition-colors flex-1 text-left">Subject <SortIcon k="subject" /></button>
              <button onClick={() => setSort("customerName")} className="hidden lg:flex items-center gap-1 hover:text-foreground transition-colors w-[180px]">Requester <SortIcon k="customerName" /></button>
              <button onClick={() => setSort("createdAt")} className="hidden md:flex items-center gap-1 hover:text-foreground transition-colors w-[110px]">Requested <SortIcon k="createdAt" /></button>
              <span className="hidden sm:block w-[100px]">Status</span>
              <button onClick={() => setSort("priority")} className="hidden sm:flex items-center gap-1 hover:text-foreground transition-colors w-[90px]">Priority <SortIcon k="priority" /></button>
              <span className="w-[88px]" />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground rd-fade">
            <BrainCircuit className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">No tickets match this view.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((t, i) => (
              <div key={t.id} className={`rd-row relative flex items-center gap-3 pl-5 pr-4 py-3 transition-colors duration-150 hover:bg-secondary/40 ${selected.includes(t.id) ? "bg-secondary/30" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${priorityBar(t.priority)}`} />
                <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} />
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary/70 to-primary/30 text-[11px] font-semibold text-primary-foreground shrink-0">{initials(t.customerName)}</div>
                <Link href={`/tickets/${t.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate group-hover:text-primary transition-colors">{t.subject}</span>
                    {isAutoTriaging(t) && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                    {t.processedAt && t.agentSummary && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5 lg:hidden">#{t.id} · {t.customerName} · {formatTimeAgo(t.createdAt)}</div>
                </Link>
                <div className="hidden lg:block w-[180px] min-w-0">
                  <div className="text-sm truncate">{t.customerName}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.customerEmail}</div>
                </div>
                <div className="hidden md:block w-[110px] text-xs text-muted-foreground">{formatTimeAgo(t.createdAt)}</div>
                <span className={`hidden sm:inline-flex w-[100px] justify-center text-[10px] font-medium uppercase px-2 py-0.5 rounded ${statusPill(t.status)}`}>{t.status.replace("_", " ")}</span>
                <span className={`hidden sm:inline-flex w-[90px] justify-center text-[10px] font-medium uppercase px-2 py-0.5 rounded ${priorityPill(t.priority)}`}>{t.priority}</span>
                <div className="flex items-center gap-1 w-[88px] justify-end">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Run Agents" onClick={() => runAgents(t.id)} disabled={processingId === t.id}>
                    {processingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Link href={`/tickets/${t.id}`} className="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors"><ChevronRight className="h-4 w-4" /></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
