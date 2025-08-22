"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FunctionalCard } from '@/components/FunctionalCard';
import { FlowiseChat } from '@/components/flowise-chat';
import { AgentCardWithFlowiseStats } from '@/components/AgentCardWithFlowiseStats';
import { 
  Brain, 
  Settings, 
  Play, 
  Archive, 
  Loader2, 
  MessageSquare,
  Activity,
  BarChart3,
  Zap,
  RefreshCw
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: 'template' | 'custom' | 'composed';
  roleDefinition: string;
  groups: any[];
  customInstructions: string;
  workspaceId: string;
  workspace?: {
    name: string;
    description: string;
  };
  config?: string;
  knowledge?: string;
  status?: 'active' | 'inactive' | 'training';
  chatflowUrl?: string;
  flowiseId?: string;
  exportedToFlowise?: boolean;
  exportedAt?: string;
}

interface AgentCardWithFlowiseIntegrationProps {
  agent: Agent;
  viewMode: 'functional' | 'traditional';
  onExecute: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onViewDetails: (agent: Agent) => void;
  onExportToFlowise: (agent: Agent) => void;
  onArchive: (agent: Agent) => void;
  onStatsUpdate?: (stats: any) => void;
}

export function AgentCardWithFlowiseIntegration({
  agent,
  viewMode,
  onExecute,
  onEdit,
  onViewDetails,
  onExportToFlowise,
  onArchive,
  onStatsUpdate
}: AgentCardWithFlowiseIntegrationProps) {
  const [showFlowiseStats, setShowFlowiseStats] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [agentActions, setAgentActions] = useState<Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
  }>>([]);

  // Extrair ações do agente da configuração
  useEffect(() => {
    const actions = extractAgentActions(agent);
    setAgentActions(actions);
  }, [agent]);

  // Extrair ações da configuração do agente
  const extractAgentActions = (agent: Agent) => {
    const defaultActions = [
      {
        id: 'analyze',
        name: 'Analisar',
        description: 'Analisar dados e informações',
        icon: 'Brain',
        category: 'analysis'
      },
      {
        id: 'advise',
        name: 'Aconselhar',
        description: 'Fornecer recomendações',
        icon: 'Settings',
        category: 'consulting'
      }
    ];

    try {
      if (agent.config) {
        // Tentar fazer parse da configuração
        const config = typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config;
        
        if (config.actions && Array.isArray(config.actions)) {
          return config.actions.map((action: any, index: number) => ({
            id: action.id || `action_${index}`,
            name: action.name || `Ação ${index + 1}`,
            description: action.description || 'Descrição não disponível',
            icon: action.icon || 'Zap',
            category: action.category || 'general'
          }));
        }
      }
    } catch (error) {
      console.warn('Erro ao extrair ações do agente:', error);
    }

    return defaultActions;
  };

  // Verificar se o agente está conectado ao Flowise
  const isFlowiseConnected = !!(agent.flowiseId || agent.chatflowUrl);
  const flowiseChatflowId = agent.flowiseId || extractChatflowIdFromUrl(agent.chatflowUrl);

  // Extrair chatflow ID da URL
  function extractChatflowIdFromUrl(url: string): string | null {
    if (!url) return null;
    
    try {
      const match = url.match(/\/agentflows\/([a-f0-9-]{36})/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // Exportar para Flowise
  const handleExportToFlowise = async () => {
    setIsExporting(true);
    try {
      await onExportToFlowise(agent);
    } finally {
      setIsExporting(false);
    }
  };

  // Se estiver no modo funcional, usa o FunctionalCard existente
  if (viewMode === 'functional') {
    return (
      <div className="space-y-4">
        {/* Card Funcional Principal */}
        <FunctionalCard
          key={agent.id}
          title={agent.name}
          description={agent.description}
          category={extractAgentCategory(agent)}
          difficulty={extractAgentDifficulty(agent)}
          actions={agentActions.map(action => ({
            id: action.id,
            label: action.name,
            description: action.description,
            icon: getActionIcon(action.icon),
            category: action.category,
            onClick: async () => {
              // Executa a ação através da API existente
              try {
                const response = await fetch('/api/card/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    agentId: agent.id,
                    action: action.id,
                    input: `Executar ação: ${action.name}`
                  })
                });
                
                const result = await response.json();
                console.log('Ação executada:', result);
              } catch (error) {
                console.error('Erro ao executar ação:', error);
              }
            }
          }))}
          metadata={{
            type: agent.type,
            status: agent.status || 'active',
            workspace: agent.workspace?.name,
            isFlowiseConnected,
            exportedToFlowise: agent.exportedToFlowise
          }}
          onExecute={() => onExecute(agent)}
          onEdit={() => onEdit(agent)}
          onViewDetails={() => onViewDetails(agent)}
          onExportToFlowise={handleExportToFlowise}
          onArchive={() => onArchive(agent)}
        />

        {/* Controles do Flowise */}
        {isFlowiseConnected && (
          <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-semibold">Integração Flowise</h4>
                    <p className="text-sm text-muted-foreground">
                      Estatísticas e chat em tempo real
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant={showFlowiseStats ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFlowiseStats(!showFlowiseStats)}
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {showFlowiseStats ? 'Ocultar Estatísticas' : 'Mostrar Estatísticas'}
                  </Button>
                  
                  <Button
                    variant={showChat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowChat(!showChat)}
                    className="flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {showChat ? 'Ocultar Chat' : 'Mostrar Chat'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estatísticas do Flowise */}
        {showFlowiseStats && flowiseChatflowId && (
          <AgentCardWithFlowiseStats
            agent={{
              id: agent.id,
              name: agent.name,
              description: agent.description,
              actions: agentActions
            }}
            flowiseChatflowId={flowiseChatflowId}
            onStatsUpdate={onStatsUpdate}
          />
        )}

        {/* Chat do Flowise */}
        {showChat && flowiseChatflowId && (
          <Card>
            <CardContent className="p-4">
              <FlowiseChat
                flowiseId={flowiseChatflowId}
                title={agent.name}
                description={`Converse diretamente com ${agent.name} via Flowise`}
                placeholder="Digite sua mensagem aqui..."
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Modo tradicional - usa o card com estatísticas integradas
  return (
    <AgentCardWithFlowiseStats
      agent={{
        id: agent.id,
        name: agent.name,
        description: agent.description,
        actions: agentActions
      }}
      flowiseChatflowId={flowiseChatflowId}
      onStatsUpdate={onStatsUpdate}
    />
  );
}

// Funções auxiliares
function extractAgentCategory(agent: Agent): string {
  if (agent.name.toLowerCase().includes('analista')) return 'business';
  if (agent.name.toLowerCase().includes('consultor')) return 'consulting';
  if (agent.name.toLowerCase().includes('especialista')) return 'expert';
  return 'general';
}

function extractAgentDifficulty(agent: Agent): 'beginner' | 'intermediate' | 'advanced' {
  if (agent.type === 'template') return 'beginner';
  if (agent.type === 'custom') return 'intermediate';
  return 'advanced';
}

function getActionIcon(iconName: string) {
  const iconMap: Record<string, any> = {
    'Brain': Brain,
    'Settings': Settings,
    'Play': Play,
    'Archive': Archive,
    'Zap': Zap,
    'BarChart3': BarChart3,
    'Activity': Activity,
    'MessageSquare': MessageSquare,
    'RefreshCw': RefreshCw
  };
  
  return iconMap[iconName] || Zap;
}