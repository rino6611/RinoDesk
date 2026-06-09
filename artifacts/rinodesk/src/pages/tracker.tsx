import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, Search } from "lucide-react";
import { formatDate } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Resolution {
  id: number; ticketId: number; agentName: string; customerName: string;
  customerEmail: string; issue: string; resolution: string; resolvedAt: string;
}

export default function Tracker() {
  const [rows, setRows] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/resolutions`, { credentials: "include" });
        if (r.ok) setRows(await r.json());
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    !q || r.customerName.toLowerCase().includes(q) || r.customerEmail.toLowerCase().includes(q) ||
    r.agentName.toLowerCase().includes(q) || r.issue.toLowerCase().includes(q) || String(r.ticketId).includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resolution Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">{loading ? "Loading…" : `${filtered.length} resolved ticket${filtered.length === 1 ? "" : "s"} logged`}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tracker…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[240px] pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground"><ClipboardCheck className="h-12 w-12 mb-4 opacity-20" /><p>No resolved tickets logged yet.</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3 font-medium">Ticket</th>
                  <th className="p-3 font-medium">CS Agent</th>
                  <th className="p-3 font-medium">Guest</th>
                  <th className="p-3 font-medium">Issue</th>
                  <th className="p-3 font-medium">Resolution</th>
                  <th className="p-3 font-medium whitespace-nowrap">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top hover:bg-secondary/40">
                    <td className="p-3 font-mono">#{r.ticketId}</td>
                    <td className="p-3 whitespace-nowrap">{r.agentName}</td>
                    <td className="p-3"><div>{r.customerName}</div><div className="text-xs text-muted-foreground">{r.customerEmail}</div></td>
                    <td className="p-3 max-w-[220px]">{r.issue}</td>
                    <td className="p-3 max-w-[260px] text-muted-foreground">{r.resolution}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(r.resolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
