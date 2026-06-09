import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTimeAgo } from "@/lib/format";
import { UserCircle2, StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface User { id: number; name: string; email: string; picture: string | null; }
interface Note { id: number; authorName: string; body: string; createdAt: string; }

export function CollabPanel({ ticketId, assigneeId }: { ticketId: number; assigneeId: number | null }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [assignee, setAssignee] = useState<string>(assigneeId ? String(assigneeId) : "unassigned");
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      const r = await fetch(`${BASE}/api/users`, { credentials: "include" });
      if (r.ok) setUsers(await r.json());
    } catch {}
  }
  async function loadNotes() {
    try {
      const r = await fetch(`${BASE}/api/tickets/${ticketId}/notes`, { credentials: "include" });
      if (r.ok) setNotes(await r.json());
    } catch {}
  }

  useEffect(() => {
    loadUsers();
    loadNotes();
  }, [ticketId]);

  async function changeAssignee(val: string) {
    setAssignee(val);
    try {
      await fetch(`${BASE}/api/tickets/${ticketId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assigneeId: val === "unassigned" ? null : Number(val) }),
      });
      toast({ title: "Assignee updated" });
    } catch {
      toast({ title: "Failed to update assignee", variant: "destructive" });
    }
  }

  async function addNote() {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        setDraft("");
        await loadNotes();
      }
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-primary" /> Assignee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={assignee} onValueChange={changeAssignee}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-primary" /> Internal Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a private note for your team…"
              className="min-h-[70px] text-sm"
            />
            <Button size="sm" onClick={addNote} disabled={saving || !draft.trim()} className="w-full">
              {saving ? "Saving…" : "Add Note"}
            </Button>
          </div>
          <div className="space-y-3 pt-2">
            {notes.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">No notes yet.</div>
            )}
            {notes.map((n) => (
              <div key={n.id} className="text-sm border-b border-border pb-2 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">{n.authorName}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(n.createdAt)}</span>
                </div>
                <div className="whitespace-pre-wrap text-muted-foreground">{n.body}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
