import { useState } from 'react';
import { useListInsights, getListInsightsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { formatTimeAgo } from '@/lib/format';

export default function Insights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: insights, isLoading } = useListInsights();
  const [generating, setGenerating] = useState(false);
  const [liveMessages, setLiveMessages] = useState<string[]>([]);

  const generateInsights = async () => {
    setGenerating(true);
    setLiveMessages([]);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${BASE}/api/insights`, { method: "POST" });
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
              if (event.type === 'status') {
                setLiveMessages(prev => [...prev, event.data.message]);
              } else if (event.type === 'insight_created') {
                setLiveMessages(prev => [...prev, `Generated insight: ${event.data.insight.title}`]);
              }
            } catch (e) {}
          }
        }
      }
      toast({ title: 'Insights generation complete' });
      queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate insights', variant: 'destructive' });
    } finally {
      setGenerating(false);
      setTimeout(() => setLiveMessages([]), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Insights</h1>
          <p className="text-muted-foreground mt-1">AI-generated analysis of support trends and agent performance.</p>
        </div>
        <Button onClick={generateInsights} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
          Generate Insights
        </Button>
      </div>

      {liveMessages.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-mono text-primary flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              SYSTEM PROCESSING
            </div>
            <div className="font-mono text-sm space-y-1 h-32 overflow-y-auto">
              {liveMessages.map((msg, i) => (
                <div key={i} className="opacity-80">{'>'} {msg}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : insights?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            No insights available. Click generate to analyze recent tickets.
          </div>
        ) : (
          insights?.map((insight) => (
            <Card key={insight.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg text-primary">{insight.title}</CardTitle>
                  <Badge variant="outline" className="uppercase font-mono text-[10px]">{insight.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{insight.content}</p>
                <div className="text-xs text-muted-foreground mt-4 font-mono">
                  {formatTimeAgo(insight.createdAt)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
