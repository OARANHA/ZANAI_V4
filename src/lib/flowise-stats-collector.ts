import { createFlowiseClient, defaultFlowiseConfig } from './flowise-client';
import { FLOWISE_CONFIG, FlowiseStats, calculateSuccessRate, calculateAverageResponseTime, getMostUsedActions } from './flowise-config';
import { db } from '@/lib/db';

export interface AgentExecutionStats {
  agentId: string;
  flowiseChatflowId: string;
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
  lastSyncAt: string;
}

export class FlowiseStatsCollector {
  private client: any;
  private isExternal: boolean;

  constructor(config?: any) {
    this.isExternal = config?.baseUrl?.includes('hf.space') || false;
    this.client = createFlowiseClient(config || {
      ...defaultFlowiseConfig,
      baseUrl: FLOWISE_CONFIG.baseUrl,
      apiKey: FLOWISE_CONFIG.apiKey
    });
  }

  /**
   * Coleta estatísticas completas de um agente do Flowise
   */
  async collectAgentStats(agentId: string, flowiseChatflowId: string): Promise<AgentExecutionStats | null> {
    try {
      console.log(`Coletando estatísticas para o agente ${agentId} do Flowise...`);

      // Busca estatísticas do chatflow
      const chatflowStats = await this.fetchChatflowStats(flowiseChatflowId);
      
      // Coleta dados de execuções recentes
      const executions = await this.fetchRecentExecutions(flowiseChatflowId);
      
      // Processa e formata os dados
      const processedStats = this.processStatsData(chatflowStats, executions);
      
      // Salva no banco ZANAI
      await this.saveAgentStats(agentId, processedStats);
      
      return {
        agentId,
        flowiseChatflowId,
        ...processedStats,
        lastSyncAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Erro ao coletar estatísticas do Flowise:', error);
      return null;
    }
  }

  /**
   * Busca estatísticas do chatflow via API
   */
  private async fetchChatflowStats(chatflowId: string): Promise<any> {
    try {
      // Tenta buscar estatísticas específicas do chatflow
      const response = await fetch(`${FLOWISE_CONFIG.baseUrl}/api/v1/chatflows/${chatflowId}/stats`, {
        headers: {
          'Authorization': `Bearer ${FLOWISE_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      }

      // Se não tiver endpoint de stats, usa dados gerais
      return await this.getGenericChatflowStats(chatflowId);
      
    } catch (error) {
      console.warn('Erro ao buscar estatísticas do chatflow, usando dados genéricos:', error);
      return await this.getGenericChatflowStats(chatflowId);
    }
  }

  /**
   * Busca estatísticas genéricas quando não há endpoint específico
   */
  private async getGenericChatflowStats(chatflowId: string): Promise<any> {
    try {
      // Busca informações do chatflow
      const chatflowResponse = await fetch(`${FLOWISE_CONFIG.baseUrl}/api/v1/chatflows/${chatflowId}`, {
        headers: {
          'Authorization': `Bearer ${FLOWISE_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!chatflowResponse.ok) {
        throw new Error('Chatflow não encontrado');
      }

      const chatflow = await chatflowResponse.json();
      
      // Retorna estatísticas básicas
      return {
        chatflow,
        basicStats: {
          createdDate: chatflow.createdDate,
          updatedDate: chatflow.updatedDate,
          deployed: chatflow.deployed || false,
          isPublic: chatflow.isPublic || false
        }
      };
      
    } catch (error) {
      throw new Error(`Não foi possível obter estatísticas do chatflow: ${error.message}`);
    }
  }

  /**
   * Coleta execuções recentes do chatflow
   */
  private async fetchRecentExecutions(chatflowId: string): Promise<any[]> {
    try {
      // Busca execuções recentes (últimas 100)
      const response = await fetch(`${FLOWISE_CONFIG.baseUrl}/api/v1/chatflows/${chatflowId}/executions?limit=100`, {
        headers: {
          'Authorization': `Bearer ${FLOWISE_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data || data || [];
      }

      // Se não tiver endpoint de execuções, tenta o endpoint de prediction
      return await this.fetchPredictionHistory(chatflowId);
      
    } catch (error) {
      console.warn('Erro ao buscar execuções, tentando prediction history:', error);
      return await this.fetchPredictionHistory(chatflowId);
    }
  }

  /**
   * Busca histórico de predictions quando não há endpoint de execuções
   */
  private async fetchPredictionHistory(chatflowId: string): Promise<any[]> {
    try {
      const response = await fetch(`${FLOWISE_CONFIG.baseUrl}/api/v1/prediction/${chatflowId}/history`, {
        headers: {
          'Authorization': `Bearer ${FLOWISE_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : (data.data || []);
      }

      return [];
      
    } catch (error) {
      console.warn('Não foi possível buscar histórico de predictions:', error);
      return [];
    }
  }

  /**
   * Processa os dados brutos em estatísticas formatadas
   */
  private processStatsData(stats: any, executions: any[]): FlowiseStats {
    // Converte execuções para formato padrão
    const normalizedExecutions = executions.map(exec => ({
      id: exec.id || exec.executionId,
      state: exec.state || exec.status || 'FINISHED',
      success: this.isSuccessExecution(exec),
      duration: exec.duration || this.extractDuration(exec),
      createdDate: exec.createdDate || exec.createdAt || new Date().toISOString(),
      action: this.extractAction(exec)
    }));

    return {
      totalExecutions: normalizedExecutions.length,
      successRate: calculateSuccessRate(normalizedExecutions as any),
      averageResponseTime: calculateAverageResponseTime(normalizedExecutions as any),
      mostUsedActions: getMostUsedActions(normalizedExecutions as any),
      lastExecution: this.getLastExecutionTime(normalizedExecutions),
      performanceMetrics: {
        throughput: this.calculateThroughput(normalizedExecutions),
        errorRate: this.calculateErrorRate(normalizedExecutions),
        uptime: this.calculateUptime(stats)
      },
      userFeedback: {
        satisfaction: this.calculateSatisfaction(normalizedExecutions),
        ratings: this.extractRatings(normalizedExecutions)
      }
    };
  }

  /**
   * Determina se uma execução foi bem-sucedida
   */
  private isSuccessExecution(execution: any): boolean {
    return execution.state === 'FINISHED' || 
           execution.success === true || 
           execution.status === 'completed' ||
           !execution.errorMessage;
  }

  /**
   * Extrai duração da execução
   */
  private extractDuration(execution: any): number {
    if (execution.duration) return execution.duration;
    
    const created = new Date(execution.createdDate || execution.createdAt);
    const updated = new Date(execution.updatedDate || execution.stoppedDate || new Date());
    return updated.getTime() - created.getTime();
  }

  /**
   * Extrai ação da execução
   */
  private extractAction(execution: any): string {
    return execution.action || 
           execution.type || 
           execution.operation || 
           'default_action';
  }

  /**
   * Obtém o tempo da última execução
   */
  private getLastExecutionTime(executions: any[]): string {
    if (executions.length === 0) return null;
    
    const latest = executions.reduce((latest, current) => {
      const latestTime = new Date(latest.createdDate);
      const currentTime = new Date(current.createdDate);
      return currentTime > latestTime ? current : latest;
    });
    
    return latest.createdDate;
  }

  /**
   * Calcula throughput (execuções por hora)
   */
  private calculateThroughput(executions: any[]): number {
    if (executions.length === 0) return 0;
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentExecutions = executions.filter(exec => 
      new Date(exec.createdDate) > twentyFourHoursAgo
    );
    
    return Math.round((recentExecutions.length / 24) * 100) / 100;
  }

  /**
   * Calcula taxa de erro
   */
  private calculateErrorRate(executions: any[]): number {
    if (executions.length === 0) return 0;
    
    const errorCount = executions.filter(exec => !this.isSuccessExecution(exec)).length;
    return Math.round((errorCount / executions.length) * 100 * 100) / 100;
  }

  /**
   * Calcula uptime do chatflow
   */
  private calculateUptime(stats: any): number {
    // Se tiver dados de uptime, usa eles
    if (stats.uptime !== undefined) return stats.uptime;
    
    // Se não, assume 100% (está online)
    return 100;
  }

  /**
   * Calcula satisfação do usuário baseada nas execuções
   */
  private calculateSatisfaction(executions: any[]): number {
    if (executions.length === 0) return 0;
    
    // Lógica simples: baseada na taxa de sucesso
    const successRate = calculateSuccessRate(executions as any);
    return Math.round(successRate * 0.8 + 20); // 80% do sucesso + 20% base
  }

  /**
   * Extrai avaliações das execuções
   */
  private extractRatings(executions: any[]): Array<{ score: number; comment?: string; timestamp: string }> {
    // Se não tiver avaliações explícitas, gera baseado no sucesso
    return executions.map(exec => ({
      score: this.isSuccessExecution(exec) ? 5 : 1,
      comment: exec.feedback || exec.comment,
      timestamp: exec.createdDate
    }));
  }

  /**
   * Salva estatísticas no banco de dados ZANAI
   */
  private async saveAgentStats(agentId: string, stats: FlowiseStats): Promise<void> {
    try {
      // Atualiza o agente com as estatísticas do Flowise
      await db.agent.update({
        where: { id: agentId },
        data: {
          // Salva as estatísticas como JSON no campo de configuração ou em um campo específico
          config: JSON.stringify({
            flowiseStats: stats,
            lastStatsSync: new Date().toISOString()
          })
        }
      });

      // Também salva na tabela de métricas se existir
      try {
        await db.agentMetrics.create({
          data: {
            agentId,
            timestamp: BigInt(Date.now()),
            metricName: 'flowise_total_executions',
            metricValue: stats.totalExecutions,
            tags: JSON.stringify({ source: 'flowise' })
          }
        });

        await db.agentMetrics.create({
          data: {
            agentId,
            timestamp: BigInt(Date.now()),
            metricName: 'flowise_success_rate',
            metricValue: stats.successRate,
            tags: JSON.stringify({ source: 'flowise' })
          }
        });

        await db.agentMetrics.create({
          data: {
            agentId,
            timestamp: BigInt(Date.now()),
            metricName: 'flowise_avg_response_time',
            metricValue: stats.averageResponseTime,
            tags: JSON.stringify({ source: 'flowise' })
          }
        });

      } catch (error) {
        console.warn('Não foi possível salvar métricas detalhadas:', error);
      }

      console.log(`Estatísticas do Flowise salvas para o agente ${agentId}`);
      
    } catch (error) {
      console.error('Erro ao salvar estatísticas no banco:', error);
    }
  }

  /**
   * Coleta estatísticas de múltiplos agentes
   */
  async collectMultipleAgentsStats(agents: Array<{ agentId: string; flowiseChatflowId: string }>): Promise<AgentExecutionStats[]> {
    const results: AgentExecutionStats[] = [];
    
    for (const agent of agents) {
      try {
        const stats = await this.collectAgentStats(agent.agentId, agent.flowiseChatflowId);
        if (stats) {
          results.push(stats);
        }
      } catch (error) {
        console.error(`Erro ao coletar estatísticas do agente ${agent.agentId}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Inicia coleta periódica de estatísticas
   */
  startPeriodicCollection(agents: Array<{ agentId: string; flowiseChatflowId: string }>, intervalMs: number = 300000) {
    console.log(`Iniciando coleta periódica de estatísticas a cada ${intervalMs}ms`);
    
    const collect = async () => {
      try {
        await this.collectMultipleAgentsStats(agents);
      } catch (error) {
        console.error('Erro na coleta periódica:', error);
      }
    };

    // Executa imediatamente
    collect();
    
    // Configura intervalo periódico
    const intervalId = setInterval(collect, intervalMs);
    
    // Retorna função para parar a coleta
    return () => clearInterval(intervalId);
  }
}

// Factory function
export function createFlowiseStatsCollector(config?: any): FlowiseStatsCollector {
  return new FlowiseStatsCollector(config);
}

// Configuração padrão
export const defaultFlowiseStatsConfig = {
  baseUrl: FLOWISE_CONFIG.baseUrl,
  apiKey: FLOWISE_CONFIG.apiKey,
  timeout: 60000,
  retryAttempts: 3
};