import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/lib/auth";
import Dashboard from "@/pages/dashboard";
import Tickets from "@/pages/tickets";
import TicketDetail from "@/pages/ticket-detail";
import Insights from "@/pages/insights";
import Chat from "@/pages/chat";
import Settings from "@/pages/settings";
import Tracker from "@/pages/tracker";
import KnowledgeBase from "@/pages/knowledge-base";
import Submit from "@/pages/submit";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

function ProtectedApp() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="dark min-h-screen grid place-items-center bg-background text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/tickets/:id" component={TicketDetail} />
        <Route path="/insights" component={Insights} />
        <Route path="/chat" component={Chat} />
        <Route path="/settings" component={Settings} />
        <Route path="/tracker" component={Tracker} />
        <Route path="/kb" component={KnowledgeBase} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/submit" component={Submit} />
      <Route path="/login" component={Login} />
      <Route>
        <ProtectedApp />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
