import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useListGeminiConversations,
  useCreateGeminiConversation,
  useDeleteGeminiConversation,
  getListGeminiConversationsQueryKey,
  getListGeminiMessagesQueryKey,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Plus, Send, User, Bot, Trash2, TerminalSquare, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatTimeAgo } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

const SUGGESTIONS = [
  "Summarize the most common support issues this week",
  "Draft a response policy for billing disputes",
  "What are best practices for handling urgent escalations?",
  "Help me write a follow-up email for unresolved tickets",
];

export default function Chat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [activeConvTitle, setActiveConvTitle] = useState<string>('');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  const { data: conversations, isLoading: convsLoading } = useListGeminiConversations();
  const createConv = useCreateGeminiConversation();
  const deleteConv = useDeleteGeminiConversation();

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const loadConversation = useCallback(async (id: number, title: string) => {
    setActiveConvId(id);
    setActiveConvTitle(title);
    setStreamingContent('');
    setLoadingMessages(true);
    try {
      const res = await fetch(`${BASE}/api/gemini/conversations/${id}/messages`);
      const data = await res.json();
      setMessages(data.map((m: { id: number; role: 'user' | 'assistant'; content: string }) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })));
    } catch {
      toast({ title: 'Failed to load messages', variant: 'destructive' });
    } finally {
      setLoadingMessages(false);
    }
  }, [BASE, toast]);

  const handleNewChat = () => {
    const title = `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    createConv.mutate({ data: { title } }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
        setActiveConvId(data.id);
        setActiveConvTitle(data.title);
        setMessages([]);
        setStreamingContent('');
        setTimeout(() => inputRef.current?.focus(), 100);
      },
    });
  };

  const handleDelete = async (e: React.MouseEvent, convId: number) => {
    e.stopPropagation();
    deleteConv.mutate({ id: convId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
        if (activeConvId === convId) {
          setActiveConvId(null);
          setMessages([]);
          setStreamingContent('');
        }
      },
      onError: () => toast({ title: 'Failed to delete conversation', variant: 'destructive' }),
    });
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !activeConvId || isSending) return;
    setInput('');
    setIsSending(true);
    setStreamingContent('');

    // Optimistic user message
    const tempUserMsg: Message = { role: 'user', content, pending: true };
    setMessages(prev => [...prev, tempUserMsg]);
    scrollToBottom();

    let accumulated = '';

    try {
      const resp = await fetch(`${BASE}/api/gemini/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!resp.ok || !resp.body) throw new Error('Request failed');

      // Update the optimistic message to confirmed
      setMessages(prev => prev.map(m => m.pending ? { ...m, pending: false } : m));

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              accumulated += event.content;
              setStreamingContent(accumulated);
              scrollToBottom();
            }
            if (event.done) {
              // Commit streamed response as a real message
              setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
              setStreamingContent('');
              accumulated = '';
              // Invalidate so sidebar reflects updated last message
              queryClient.invalidateQueries({ queryKey: getListGeminiMessagesQueryKey(activeConvId) });
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch {
      setMessages(prev => prev.filter(m => !m.pending));
      toast({ title: 'Failed to send message', variant: 'destructive' });
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] gap-0 rounded-xl border border-border overflow-hidden bg-card">
      {/* Sidebar */}
      <div className="w-60 flex flex-col border-r border-border bg-card shrink-0">
        <div className="p-3 border-b border-border">
          <Button
            onClick={handleNewChat}
            className="w-full gap-2 h-9"
            variant="outline"
            disabled={createConv.isPending}
          >
            {createConv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {convsLoading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full mb-1" />)
          ) : conversations?.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center pt-8 px-4">No conversations yet. Start a new chat.</p>
          ) : (
            conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id, conv.title)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors group flex items-start justify-between gap-1 ${
                  activeConvId === conv.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-[13px]">{conv.title}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{formatTimeAgo(conv.createdAt)}</div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDelete(e, conv.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, conv.id); }}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded transition-opacity shrink-0 mt-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId ? (
          <>
            {/* Header */}
            <div className="h-12 border-b border-border flex items-center px-5 shrink-0">
              <TerminalSquare className="h-4 w-4 text-primary mr-2 shrink-0" />
              <h2 className="font-medium text-sm truncate">{activeConvTitle}</h2>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {loadingMessages ? (
                <div className="space-y-5">
                  <div className="flex gap-3 justify-end"><Skeleton className="h-10 w-48 rounded-2xl" /></div>
                  <div className="flex gap-3"><Skeleton className="h-16 w-64 rounded-2xl" /></div>
                  <div className="flex gap-3 justify-end"><Skeleton className="h-10 w-36 rounded-2xl" /></div>
                  <div className="flex gap-3"><Skeleton className="h-24 w-72 rounded-2xl" /></div>
                </div>
              ) : (
                <>
                  {messages.length === 0 && !streamingContent && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 pt-8 text-center">
                      <Bot className="h-8 w-8 text-primary opacity-40" />
                      <p className="text-sm text-muted-foreground">Ask anything about your support tickets or customers.</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={msg.id ?? `opt-${i}`} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border'
                      }`}>
                        {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl max-w-[78%] text-sm whitespace-pre-wrap leading-relaxed ${
                        msg.role === 'user'
                          ? `bg-primary text-primary-foreground rounded-tr-sm ${msg.pending ? 'opacity-60' : ''}`
                          : 'bg-secondary border border-border text-foreground rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {streamingContent && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-secondary border border-border">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[78%] text-sm whitespace-pre-wrap leading-relaxed bg-secondary border border-border text-foreground">
                        {streamingContent}
                        <span className="ml-1 inline-block w-1.5 h-3.5 bg-primary animate-pulse align-middle rounded-sm" />
                      </div>
                    </div>
                  )}
                  {isSending && !streamingContent && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-secondary border border-border">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-secondary border border-border flex gap-1.5 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border shrink-0">
              <div className="flex gap-2 items-end bg-secondary/50 border border-border rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message the AI agent… (Enter to send, Shift+Enter for new line)"
                  disabled={isSending}
                  rows={1}
                  className="flex-1 bg-transparent text-sm resize-none outline-none text-foreground placeholder:text-muted-foreground min-h-[24px] max-h-32 overflow-y-auto py-0.5 disabled:opacity-50"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                  }}
                />
                <Button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isSending || !input.trim()}
                  size="icon"
                  className="h-7 w-7 shrink-0 mb-0.5"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center opacity-50">Powered by Gemini 2.5 Flash</p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">AI Agent Chat</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">Ask about tickets, draft responses, get policy guidance, or analyse customer patterns.</p>
              </div>
            </div>
            <div className="w-full max-w-sm space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">Suggested prompts</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={async () => {
                    // Create a new chat and send the suggestion
                    const title = s.slice(0, 40) + (s.length > 40 ? '…' : '');
                    createConv.mutate({ data: { title } }, {
                      onSuccess: async (data) => {
                        queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
                        setActiveConvId(data.id);
                        setActiveConvTitle(data.title);
                        setMessages([]);
                        setStreamingContent('');
                        // Small delay so state updates propagate
                        await new Promise(r => setTimeout(r, 80));
                        setInput(s);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      },
                    });
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary hover:border-primary/30 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <Button onClick={handleNewChat} className="gap-2" disabled={createConv.isPending}>
              {createConv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Start New Chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
