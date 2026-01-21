import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendChatMessage, ChatMessage } from '@/services/chat';
import { Send, Loader2, Bot, User, Sparkles, MessageSquarePlus, Trash2, Clock } from 'lucide-react';

interface ChatHistory {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const Chat = () => {
  const { t } = useTranslation();
  const { storeId } = useParams<{ storeId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat histories from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`chat-histories-${storeId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setChatHistories(parsed.map((chat: any) => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt)
      })));
    }
  }, [storeId]);

  // Save chat histories to localStorage whenever they change
  useEffect(() => {
    if (chatHistories.length > 0) {
      localStorage.setItem(`chat-histories-${storeId}`, JSON.stringify(chatHistories));
    }
  }, [chatHistories, storeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const generateChatTitle = (firstMessage: string): string => {
    return firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
  };

  const saveCurrentChat = () => {
    if (messages.length === 0) return;

    const now = new Date();
    if (currentChatId) {
      // Update existing chat
      setChatHistories(prev => prev.map(chat =>
        chat.id === currentChatId
          ? { ...chat, messages, updatedAt: now }
          : chat
      ));
    } else {
      // Create new chat
      const newChat: ChatHistory = {
        id: `chat-${Date.now()}`,
        title: generateChatTitle(messages[0].content),
        messages,
        createdAt: now,
        updatedAt: now
      };
      setChatHistories(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
    }};

  const handleSend = async () => {
    if (!input.trim() || isLoading || !storeId) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        store_id: storeId,
        message: userMessage.content,
        history: messages,
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
      };
      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      // Auto-save after receiving response
      setTimeout(() => saveCurrentChat(), 100);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: t('chat.errorMessage'),
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    if (messages.length > 0) {
      saveCurrentChat();
    }
    setMessages([]);
    setCurrentChatId(null);
  };

  const loadChat = (chatId: string) => {
    const chat = chatHistories.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setCurrentChatId(chatId);
    }
  };

  const deleteChat = (chatId: string) => {
    setChatHistories(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const suggestedQuestions = [
    t('chat.question1'),
    t('chat.question2'),
    t('chat.question3'),
    t('chat.question4'),
  ];

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('chat.inventoryAssistant')}</h1>
              <p className="text-sm text-muted-foreground">{t('chat.aiPoweredInsights')}</p>
            </div>
          </div>
        </div>
      <div className="h-[calc(100vh-120px)] flex gap-4 p-4">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Inventory Assistant</h1>
                <p className="text-sm text-muted-foreground">AI-powered insights for your store</p>
              </div>
            </div>
            <Button
              onClick={startNewChat}
              variant="outline"
              className="gap-2"
            >
              <MessageSquarePlus className="w-4 h-4" />
              New Chat
            </Button>
          </div>

          {/* Chat Container */}
          <Card className="flex-1 flex flex-col shadow-xl border-none bg-white/80 backdrop-blur-md overflow-hidden">
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full p-6" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6">
                      <Sparkles className="w-10 h-10 text-blue-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">How can I help you today?</h2>
                    <p className="text-muted-foreground mb-8 max-w-md">
                      Ask me about stock levels, forecasts, orders, or any inventory-related questions.
                    </p>
        {/* Chat Container */}
        <Card className="flex-1 flex flex-col shadow-xl border-none bg-white/80 backdrop-blur-md overflow-hidden">
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-6" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6">
                    <Sparkles className="w-10 h-10 text-blue-500" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2">{t('chat.howCanIHelp')}</h2>
                  <p className="text-muted-foreground mb-8 max-w-md">
                    {t('chat.askAboutDetails')}
                  </p>

                  {/* Suggested Questions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                    {suggestedQuestions.map((question, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        className="text-left h-auto py-3 px-4 justify-start text-sm font-medium hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
                        onClick={() => setInput(question)}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-slate-100 rounded-2xl px-4 py-3">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-4 border-t border-slate-100 bg-white/50">
            <div className="flex w-full gap-3">
              <Input
                placeholder={t('chat.placeholderDetailed')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1 h-12 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </CardFooter>
                    {/* Suggested Questions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                      {suggestedQuestions.map((question, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          className="text-left h-auto py-4 px-5 justify-start text-sm font-medium hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all whitespace-normal leading-relaxed"
                          onClick={() => setInput(question)}
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-slate-600" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-slate-100 rounded-2xl px-4 py-3">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent><CardFooter className="p-4 border-t border-slate-100 bg-white/50">
              <div className="flex w-full gap-3">
                <Input
                  placeholder="Ask about inventory, forecasts, orders..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1 h-12 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Chat History Sidebar */}
        <Card className="w-80 shadow-xl border-none bg-white/80 backdrop-blur-md">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Chat History
            </h2>
          </div>
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="p-4 space-y-2">
              {chatHistories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No chat history yet. Start a conversation!
                </p>
              ) : (
                chatHistories.map((chat) => (
                  <div
                    key={chat.id}
                    className={`group p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 ${
                      currentChatId === chat.id ? 'bg-blue-50 border-blue-200' : 'border-slate-200'
                    }`}
                    onClick={() => loadChat(chat.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{chat.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(chat.updatedAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {chat.messages.length} messages
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Chat;