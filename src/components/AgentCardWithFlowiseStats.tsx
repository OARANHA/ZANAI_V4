"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlowiseChat } from './flowise-chat';
import { 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  Users,
  Zap,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

interface AgentAction {
  id: string;
  name: string;
  description: string;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  actions: AgentAction[];
}

interface FlowiseStats {
  totalExecutions: number;
  successRate: number;
  averageResponseTime: number;
  mostUsedActions: Array<{ action: string; count: number }>;
  lastExecution: string;
  performanceMetrics: {
    throughput: number;
    errorRate: number;
    uptime: number;
  };
  userFeedback: {
    satisfaction: number;
    ratings: Array<{ score: number; comment?: string; timestamp: string }>;
  };
}

interface AgentCardWithFlowiseStatsProps {
  agent: Agent;
  flowiseChatflowId?: string;
  onStatsUpdate?: (stats: FlowiseStats) => void;
}

export function AgentCardWithFlowiseStats({ 
  agent, 
  flowiseChatflowId, 
  onStatsUpdate 
}: AgentCardWithFlowiseStatsProps) {
  const [stats, setStats] = useState<FlowiseStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (flowiseChatflowId) {
      loadAgentStats();
      checkConnection();
    }
  }, [flowiseChatflowId]);

  const loadAgentStats = async () => {
    if (!flowiseChatflowId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/flowise-stats?agentId=${agent.id}&flowiseChatflowId=${flowiseChatflowId}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
        onStatsUpdate?.(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnection = async () => {
    if (!flowiseChatflowId) return;
    
    try {
      const response = await fetch(`/api/flowise-chat?flowiseChatflowId=${flowiseChatflowId}`);
      const data = await response.json();
      setIsConnected(data.success);
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setIsConnected(false);
    }
  };

  const executeAction = async (actionId: string) => {
    try {
      const response = await fetch('/api/card/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          action: actionId,
          input: 'Executar ação'
        })
      });
      
      const result = await response.json();
      
      // Atualiza estatísticas após execução
      if (flowiseChatflowId) {
        setTimeout(loadAgentStats, 1000); // Pequeno delay para garantir que as estatísticas sejam atualizadas
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao executar ação:', error);
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleString('pt-BR');
    } catch {
      return timeString;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-600';
    if (uptime >= 95) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">{agent.name}</span>
            {flowiseChatflowId && (
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isConnected ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {isConnected ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Flowise
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      Offline
                    </>
                  )}
                </Badge>
              </div>
            )}
          </div>
          
          {flowiseChatflowId && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadAgentStats}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          )}
        </CardTitle>
        {agent.description && (
          <p className="text-muted-foreground">{agent.description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Estatísticas do Flowise */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total de Execuções */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Execuções</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {stats.totalExecutions.toLocaleString()}
              </div>
            </div>

            {/* Taxa de Sucesso */}
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">Sucesso</span>
              </div>
              <div className={`text-2xl font-bold ${getSuccessRateColor(stats.successRate)}`}>
                {stats.successRate}%
              </div>
            </div>

            {/* Tempo Médio */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Tempo Médio</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {formatDuration(stats.averageResponseTime)}
              </div>
            </div>

            {/* Satisfação */}
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Satisfação</span>
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {stats.userFeedback.satisfaction.toFixed(1)}/5.0
              </div>
            </div>
          </div>
        )}

        {/* Métricas Detalhadas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Performance
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Throughput:</span>
                  <span className="font-medium">{stats.performanceMetrics.throughput}/h</span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate:</span>
                  <span className="font-medium text-red-600">{stats.performanceMetrics.errorRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className={`font-medium ${getUptimeColor(stats.performanceMetrics.uptime)}`}>
                    {stats.performanceMetrics.uptime}%
                  </span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Ações Mais Usadas
              </h4>
              <div className="space-y-2 text-sm">
                {stats.mostUsedActions.slice(0, 3).map((action, index) => (
                  <div key={action.action} className="flex justify-between">
                    <span>{action.action}:</span>
                    <span className="font-medium">{action.count}</span>
                  </div>
                ))}
                {stats.mostUsedActions.length === 0 && (
                  <div className="text-muted-foreground">Nenhuma ação registrada</div>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Última Atividade
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Última execução:</span>
                  <div className="font-medium">
                    {stats.lastExecution ? formatTime(stats.lastExecution) : 'Nunca'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ações do Agente */}
        <div>
          <h4 className="font-semibold mb-3">Ações Disponíveis</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {agent.actions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => executeAction(action.id)}
                disabled={isLoading}
                className="h-auto p-3 flex flex-col items-center text-center"
              >
                <span className="font-medium">{action.name}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {action.description}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Chat Interface */}
        {flowiseChatflowId && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat com Agente
              </h4>
              <Button
                variant={showChat ? "outline" : "default"}
                size="sm"
                onClick={() => setShowChat(!showChat)}
              >
                {showChat ? 'Ocultar Chat' : 'Mostrar Chat'}
              </Button>
            </div>
            
            {showChat && (
              <FlowiseChat
                flowiseId={flowiseChatflowId}
                title={agent.name}
                description={`Converse diretamente com ${agent.name} via Flowise`}
                placeholder="Digite sua mensagem aqui..."
                className="border rounded-lg"
              />
            )}
          </div>
        )}

        {/* Status de Conexão */}
        {!flowiseChatflowId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Agente não conectado ao Flowise</span>
            </div>
            <p className="text-sm text-yellow-700 mt-2">
              Este agente não está configurado para integração com o Flowise. 
              Configure um flowiseChatflowId para habilitar estatísticas e chat em tempo real.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}