import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Sparkles, BrainCircuit, Database, ChevronDown } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@shared/lib/apiClient';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { cn } from '@shared/utils/cn';
import { Card } from '@shared/ui/card';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
}

export const AiChatPage = () => {
  const [input, setInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [ragSourceKey, setRagSourceKey] = useState('');
  const [ragTitle, setRagTitle] = useState('');
  const [ragBody, setRagBody] = useState('');
  const [deleteSourceKey, setDeleteSourceKey] = useState('');
  const [isRagOpen, setIsRagOpen] = useState(() => {
    try { return localStorage.getItem('wallet-rag-panel-open') === 'true'; }
    catch { return false; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleRag = (next?: boolean) => {
    const value = next ?? !isRagOpen;
    setIsRagOpen(value);
    try {
      localStorage.setItem('wallet-rag-panel-open', String(value));
    } catch {
      // localStorage may be blocked (private mode); panel persistence is best-effort.
      void 0;
    }
  };

  const { data: providers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['ai', 'providers'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string }[]>('/ai/providers');
      return data;
    },
  });

  useEffect(() => {
    if (providers.length > 0 && !selectedProvider) {
      setSelectedProvider(providers[0].id);
    }
  }, [providers, selectedProvider]);

  const { data: history = [], isLoading: isLoadingHistory, refetch } = useQuery<Message[]>({
    queryKey: ['/ai/history'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ai/history');
      return data.reverse(); // Ordem cronológica
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const body = selectedProvider ? { message, provider: selectedProvider } : { message };
      const { data } = await apiClient.post('/ai/chat', body);
      return data;
    },
    onSuccess: () => {
      setInput('');
      refetch();
    },
    onError: () => {
      toast.error('Erro ao enviar mensagem para a IA.');
    },
  });

  const upsertRagMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sourceKey: ragSourceKey.trim(),
        title: ragTitle.trim() || undefined,
        body: ragBody.trim(),
      };
      const { data } = await apiClient.post('/users/me/rag/documents', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Documento pessoal atualizado na base RAG.');
      setRagBody('');
    },
    onError: () => {
      toggleRag(true);
      toast.error('Falha ao atualizar documento RAG pessoal.');
    },
  });

  const deleteRagMutation = useMutation({
    mutationFn: async () => {
      const encoded = encodeURIComponent(deleteSourceKey.trim());
      const { data } = await apiClient.delete<{ deleted: boolean }>(`/users/me/rag/documents/${encoded}`);
      return data;
    },
    onSuccess: (data) => {
      if (data.deleted) {
        toast.success('Documento pessoal removido da base RAG.');
      } else {
        toast.message('Nenhum documento removido para esta chave.');
      }
      setDeleteSourceKey('');
    },
    onError: () => {
      toggleRag(true);
      toast.error('Falha ao remover documento RAG pessoal.');
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, chatMutation.isPending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    chatMutation.mutate(input);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Painel RAG recolhível */}
      <div
        id="rag-panel"
        aria-hidden={!isRagOpen}
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isRagOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}
      >
        <div className="overflow-hidden">
          <Card className="border-white/10 bg-slate-900/30 backdrop-blur-xl p-4 mb-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">RAG pessoal (self-service)</h2>
                <p className="text-xs text-muted-foreground">
                  Adicione conhecimento pessoal para melhorar respostas da IA neste workspace.
                </p>
                <Input
                  value={ragSourceKey}
                  onChange={(event) => setRagSourceKey(event.target.value)}
                  placeholder="sourceKey (ex.: notas-financas-abril)"
                  className="bg-white/5 border-white/10 focus:border-sky-500/50"
                  tabIndex={isRagOpen ? undefined : -1}
                />
                <Input
                  value={ragTitle}
                  onChange={(event) => setRagTitle(event.target.value)}
                  placeholder="Título (opcional)"
                  className="bg-white/5 border-white/10 focus:border-sky-500/50"
                  tabIndex={isRagOpen ? undefined : -1}
                />
                <textarea
                  value={ragBody}
                  onChange={(event) => setRagBody(event.target.value)}
                  rows={5}
                  placeholder="Cole o conteúdo em texto/markdown"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-sky-500/50"
                  tabIndex={isRagOpen ? undefined : -1}
                />
                <Button
                  type="button"
                  disabled={upsertRagMutation.isPending || !ragSourceKey.trim() || !ragBody.trim()}
                  onClick={() => upsertRagMutation.mutate()}
                  tabIndex={isRagOpen ? undefined : -1}
                >
                  {upsertRagMutation.isPending ? 'Guardando…' : 'Guardar no RAG pessoal'}
                </Button>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Remover documento</h3>
                <p className="text-xs text-muted-foreground">
                  Informe o sourceKey para remover um documento da sua base pessoal.
                </p>
                <Input
                  value={deleteSourceKey}
                  onChange={(event) => setDeleteSourceKey(event.target.value)}
                  placeholder="sourceKey para remover"
                  className="bg-white/5 border-white/10 focus:border-sky-500/50"
                  tabIndex={isRagOpen ? undefined : -1}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteRagMutation.isPending || !deleteSourceKey.trim()}
                  onClick={() => deleteRagMutation.mutate()}
                  tabIndex={isRagOpen ? undefined : -1}
                >
                  {deleteRagMutation.isPending ? 'Removendo…' : 'Remover do RAG pessoal'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Header do assistente */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-emerald-500 shadow-soft-md text-white">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white/90 tracking-tight">Wallet Assistant</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              IA Online e conectada ao seu banco
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleRag()}
            aria-expanded={isRagOpen}
            aria-controls="rag-panel"
            className="gap-1.5 border-white/10 bg-white/5 text-xs"
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Base RAG</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", isRagOpen && "rotate-180")} />
          </Button>
          {providers.length > 1 && (
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-1.5 text-sm font-medium text-foreground focus:border-sky-500/50 outline-none hover:bg-slate-800/50 cursor-pointer transition-colors"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden border-white/10 bg-slate-900/40 backdrop-blur-xl flex flex-col relative">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-thin scrollbar-thumb-white/10"
        >
          {isLoadingHistory ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500/50" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4 space-y-4">
              <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                <Sparkles className="h-8 w-8 text-sky-400/50" />
              </div>
              <h3 className="text-lg font-medium text-white/80">Como posso ajudar hoje?</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                Tente perguntar: &quot;Qual meu saldo atual?&quot;, &quot;Quanto gastei com lazer esse mês?&quot; ou &quot;Crie uma despesa de 50 reais em Restaurante&quot;.
              </p>
            </div>
          ) : (
            history.filter(m => m.role === 'user' || m.role === 'assistant').map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform hover:scale-110",
                  msg.role === 'user' ? "bg-sky-500 text-white" : "bg-gradient-to-br from-indigo-500 to-emerald-500 text-white"
                )}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl p-4 text-sm shadow-soft-sm relative group",
                  msg.role === 'user' 
                    ? "bg-sky-500/90 text-white rounded-tr-none" 
                    : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-md"
                )}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <span className={cn(
                    "text-[10px] opacity-0 group-hover:opacity-50 transition-opacity absolute bottom-1",
                    msg.role === 'user' ? "left-2" : "right-2"
                  )}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
          {chatMutation.isPending && (
            <div className="flex items-start gap-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center animate-pulse">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-4 backdrop-blur-md">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-slate-950/20">
          <form onSubmit={handleSend} className="flex gap-2 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa sobre suas finanças..."
              disabled={chatMutation.isPending}
              className="pr-12 bg-white/5 border-white/10 focus:border-sky-500/50 h-11 rounded-xl shadow-inner-sm"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || chatMutation.isPending}
              className={cn(
                "absolute right-1 top-1 h-9 w-9 rounded-lg transition-all",
                input.trim() ? "bg-sky-500 text-white shadow-lg" : "bg-transparent text-white/20"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
