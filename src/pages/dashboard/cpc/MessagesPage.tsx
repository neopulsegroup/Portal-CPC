import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { addDocument, queryDocuments, serverTimestamp, subscribeQuery, updateDocument } from '@/integrations/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  CirclePlus,
  EllipsisVertical,
  Loader2,
  MessagesSquare,
  Paperclip,
  Phone,
  Plus,
  Send,
  Smile,
  Video,
} from 'lucide-react';

type UserRow = { id: string; name?: string | null; email?: string | null };

type ConversationDoc = {
  id: string;
  participants?: string[] | null;
  title?: string | null;
  last_message_text?: string | null;
  updatedAt?: unknown;
};

type MessageDoc = {
  id: string;
  conversation_id?: string | null;
  sender_id?: string | null;
  text?: string | null;
  created_at?: unknown;
};

function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function getInitials(value?: string | null): string {
  const parts = (value || '').trim().split(/\s+/g).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p.slice(0, 1).toUpperCase()).join('');
  return initials || 'U';
}

export default function CPCMessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationDoc[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDoc[]>([]);

  const [compose, setCompose] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeQuery<ConversationDoc>({
      collectionName: 'conversations',
      filters: [{ field: 'participants', operator: 'array-contains', value: user.uid }],
      orderByField: { field: 'updatedAt', direction: 'desc' },
      onNext: (docs) => {
        setConversations(docs);
        setLoading(false);
        setActiveConversationId((prev) => {
          if (prev && docs.some((d) => d.id === prev)) return prev;
          return docs[0]?.id ?? null;
        });
      },
      onError: () => {
        setError('Não foi possível carregar as conversas.');
        setLoading(false);
      },
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!activeConversationId) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    setMessagesError(null);

    const unsubscribe = subscribeQuery<MessageDoc>({
      collectionName: 'conversation_messages',
      filters: [{ field: 'conversation_id', operator: '==', value: activeConversationId }],
      orderByField: { field: 'created_at', direction: 'asc' },
      onNext: (docs) => {
        setMessages(docs);
        setMessagesLoading(false);
      },
      onError: () => {
        setMessagesError('Não foi possível carregar as mensagens.');
        setMessagesLoading(false);
      },
    });
    return () => unsubscribe();
  }, [activeConversationId, user?.uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, activeConversationId]);

  const activeConversation = useMemo(
    () => (activeConversationId ? conversations.find((c) => c.id === activeConversationId) ?? null : null),
    [activeConversationId, conversations]
  );

  async function send() {
    if (!user?.uid) return;
    if (!activeConversationId) return;
    const text = compose.trim();
    if (!text) return;

    setCompose('');
    try {
      await addDocument('conversation_messages', {
        conversation_id: activeConversationId,
        sender_id: user.uid,
        text,
        created_at: serverTimestamp(),
      });
      await updateDocument('conversations', activeConversationId, {
        last_message_text: text,
        updatedAt: serverTimestamp(),
      });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível enviar a mensagem.', variant: 'destructive' });
      setCompose(text);
    }
  }

  async function createConversation() {
    if (!user?.uid) return;
    if (!isValidEmail(newEmail)) {
      toast({ title: 'Validação', description: 'Insira um email válido.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const users = await queryDocuments<UserRow>('users', [{ field: 'email', operator: '==', value: newEmail.trim() }], undefined, 1);
      const target = users[0];
      if (!target?.id) {
        toast({ title: 'Não encontrado', description: 'Não existe utilizador com esse email.', variant: 'destructive' });
        return;
      }
      if (target.id === user.uid) {
        toast({ title: 'Validação', description: 'Escolha um email diferente do seu.', variant: 'destructive' });
        return;
      }

      const id = await addDocument('conversations', {
        participants: [user.uid, target.id],
        title: target.name || target.email || 'Conversa',
        last_message_text: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewOpen(false);
      setNewEmail('');
      setActiveConversationId(id);
      toast({ title: 'Conversa criada', description: 'A nova conversa foi criada com sucesso.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível criar a conversa.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  if (!user?.uid) {
    return (
      <div className="cpc-card p-8 text-center text-sm text-muted-foreground">
        Inicie sessão para aceder às mensagens.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cpc-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="cpc-card overflow-hidden">
        <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] min-h-[640px]">
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight">Conversas</h1>
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova
              </Button>
            </div>

            <div className="mt-6 space-y-2">
              {conversations.length === 0 ? (
                <div className="cpc-card p-6 text-center text-sm text-muted-foreground">
                  Sem conversas. Crie uma nova conversa para começar.
                </div>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  const title = conversation.title || 'Conversa';
                  const last = conversation.last_message_text || 'Sem mensagens';
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={`w-full text-left rounded-2xl px-4 py-4 transition-colors ${
                        isActive ? 'bg-primary/5 border-l-4 border-primary' : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-muted-foreground">{getInitials(title)}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{title}</p>
                          <p className="text-sm text-muted-foreground truncate mt-1">{last}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t lg:border-t-0 lg:border-l bg-muted/20">
            {!activeConversation ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Selecione uma conversa para ver as mensagens.
              </div>
            ) : (
              <>
                <div className="p-6 bg-background border-b">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {getInitials(activeConversation.title)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{activeConversation.title || 'Conversa'}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Online agora
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center"
                        aria-label="Videochamada"
                      >
                        <Video className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center"
                        aria-label="Chamada"
                      >
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center"
                        aria-label="Mais opções"
                      >
                        <EllipsisVertical className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 overflow-auto">
                  <div className="flex items-center justify-center">
                    <span className="text-xs font-semibold tracking-widest text-muted-foreground bg-background px-4 py-2 rounded-full border">
                      HOJE
                    </span>
                  </div>

                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messagesError ? (
                    <div className="cpc-card p-6 text-center text-sm text-muted-foreground">{messagesError}</div>
                  ) : messages.length === 0 ? (
                    <div className="cpc-card p-6 text-center text-sm text-muted-foreground">
                      Sem mensagens nesta conversa.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = (m.sender_id || '') === user.uid;
                      const text = m.text || '';
                      return (
                        <div key={m.id} className={`flex items-start gap-3 max-w-2xl ${mine ? 'ml-auto justify-end' : ''}`}>
                          {mine ? null : (
                            <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                              <span className="text-sm font-semibold text-muted-foreground">
                                {getInitials(activeConversation.title)}
                              </span>
                            </div>
                          )}
                          <div className={`rounded-3xl px-6 py-4 text-sm leading-relaxed ${mine ? 'bg-primary text-primary-foreground' : 'bg-background border'}`}>
                            {text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <div className="p-6 bg-background border-t">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="h-11 w-11 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center"
                      aria-label="Adicionar"
                    >
                      <CirclePlus className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      className="h-11 w-11 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center"
                      aria-label="Emoji"
                    >
                      <Smile className="h-5 w-5 text-muted-foreground" />
                    </button>

                    <div className="relative flex-1">
                      <Input
                        placeholder="Escreva a sua mensagem aqui..."
                        className="h-12 rounded-full pl-12 pr-14 bg-muted/30 border-muted"
                        value={compose}
                        onChange={(e) => setCompose(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                          aria-label="Enviar"
                          onClick={() => void send()}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={(open) => (creating ? null : setNewOpen(open))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Email do utilizador</p>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@dominio.com" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button onClick={() => void createConversation()} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessagesSquare className="h-4 w-4 mr-2" />}
                Criar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
