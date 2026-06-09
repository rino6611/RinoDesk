import { useGetTicketStats, useGetInsightsSummary } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, TicketCheck, TrendingUp, Users } from 'lucide-react';
import { formatTimeAgo } from '@/lib/format';

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetTicketStats();
  const { data: summary, isLoading: isSummaryLoading } = useGetInsightsSummary();

  if (isStatsLoading || isSummaryLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <TicketCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.open || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Of {stats?.total || 0} total tickets
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalations</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.escalated || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.highPriority || 0} high priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgResolutionHours?.toFixed(1) || 0}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg time to close
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Performance</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.agentPerformance?.[0]?.successRate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Top agent success rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary?.recentInsights?.map((insight) => (
              <div key={insight.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="font-medium text-sm text-primary mb-1">{insight.title}</div>
                <div className="text-sm text-muted-foreground">{insight.content}</div>
                <div className="text-xs text-muted-foreground mt-2">{formatTimeAgo(insight.createdAt)}</div>
              </div>
            ))}
            {!summary?.recentInsights?.length && (
              <div className="text-sm text-muted-foreground">No recent insights available.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.topCategories?.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{cat.category}</span>
                  <span className="text-sm text-muted-foreground">{cat.count} tickets</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
