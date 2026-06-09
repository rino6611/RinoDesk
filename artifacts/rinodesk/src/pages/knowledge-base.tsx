import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Plus, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Article { id: number; title: string; content: string; updatedAt: string; }

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await fetch(`${BASE}/api/kb`, { credentials: "include" });
      if (r.ok) setArticles(await r.json());
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditingId("new"); setTitle(""); setContent(""); }
  function startEdit(a: Article) { setEditingId(a.id); setTitle(a.title); setContent(a.content); }
  function cancel() { setEditingId(null); setTitle(""); setContent(""); }

  async function save() {
    if (!title.trim() || !content.trim()) { toast({ title: "Title and content required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = editingId === "new" ? `${BASE}/api/kb` : `${BASE}/api/kb/${editingId}`;
      const method = editingId === "new" ? "POST" : "PATCH";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title, content }) });
      if (!r.ok) throw new Error();
      toast({ title: "Saved" });
      cancel();
      await load();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this article?")) return;
    try {
      await fetch(`${BASE}/api/kb/${id}`, { method: "DELETE", credentials: "include" });
      await load();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">Articles the AI uses to ground its replies.</p>
        </div>
        {editingId === null && (<Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> New Article</Button>)}
      </div>

      {editingId !== null && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Article title (e.g. Refund Policy)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Write the policy / answer the AI should use…" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[160px] text-sm" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancel} className="gap-2"><X className="h-4 w-4" /> Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : articles.length === 0 && editingId === null ? (
        <Card><CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground"><BookOpen className="h-12 w-12 mb-4 opacity-20" /><p>No articles yet. Add your policies so the AI can ground its replies.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{a.content}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
