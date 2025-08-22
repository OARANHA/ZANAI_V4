import { NextRequest, NextResponse } from 'next/server';
import { createFlowiseStatsCollector, defaultFlowiseStatsConfig } from '@/lib/flowise-stats-collector';
import { db } from '@/lib/db';

// Coletor de estatísticas
const statsCollector = createFlowiseStatsCollector(defaultFlowiseStatsConfig);

/**
 * GET /api/flowise-stats - Obtém estatísticas de agentes
 * Query params:
 * - agentId: ID do agente específico
 * - flowiseChatflowId: ID do chatflow no Flowise
 * - all: true para buscar todos os agentes com Flowise
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const flowiseChatflowId = searchParams.get('flowiseChatflowId');
    const all = searchParams.get('all') === 'true';

    if (all) {
      // Buscar todos os agentes que têm integração com Flowise
      return await getAllAgentsStats();
    }

    if (!agentId || !flowiseChatflowId) {
      return NextResponse.json({
        success: false,
        error: 'agentId e flowiseChatflowId são obrigatórios'
      }, { status: 400 });
    }

    // Coletar estatísticas de um agente específico
    const stats = await statsCollector.collectAgentStats(agentId, flowiseChatflowId);
    
    if (!stats) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível coletar estatísticas do agente'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erro na API de estatísticas Flowise:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/flowise-stats - Dispara coleta de estatísticas
 * Body:
 * - agents: Array de { agentId, flowiseChatflowId }
 * - forceSync: boolean para forçar sincronização
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agents, forceSync = false } = body;

    if (!agents || !Array.isArray(agents)) {
      return NextResponse.json({
        success: false,
        error: 'agents é obrigatório e deve ser um array'
      }, { status: 400 });
    }

    // Validar formato dos agentes
    const invalidAgents = agents.filter(agent => !agent.agentId || !agent.flowiseChatflowId);
    if (invalidAgents.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Todos os agentes devem ter agentId e flowiseChatflowId',
        invalidAgents
      }, { status: 400 });
    }

    // Coletar estatísticas de múltiplos agentes
    const results = await statsCollector.collectMultipleAgentsStats(agents);

    return NextResponse.json({
      success: true,
      data: {
        collected: results.length,
        total: agents.length,
        results,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro na API de estatísticas Flowise (POST):', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Busca estatísticas de todos os agentes com integração Flowise
 */
async function getAllAgentsStats() {
  try {
    // Buscar agentes que têm flowiseChatflowId configurado
    const agents = await db.agent.findMany({
      where: {
        OR: [
          { flowiseId: { not: null } },
          { chatflowUrl: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        flowiseId: true,
        chatflowUrl: true,
        config: true
      }
    });

    // Extrair IDs dos chatflows
    const agentsWithFlowise = agents
      .map(agent => ({
        agentId: agent.id,
        flowiseChatflowId: agent.flowiseId || extractChatflowIdFromUrl(agent.chatflowUrl)
      }))
      .filter(agent => agent.flowiseChatflowId);

    if (agentsWithFlowise.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          agents: [],
          message: 'Nenhum agente com integração Flowise encontrado'
        }
      });
    }

    // Coletar estatísticas de todos os agentes
    const results = await statsCollector.collectMultipleAgentsStats(agentsWithFlowise);

    return NextResponse.json({
      success: true,
      data: {
        totalAgents: agents.length,
        agentsWithFlowise: agentsWithFlowise.length,
        collectedStats: results.length,
        agents: agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          flowiseChatflowId: agent.flowiseId || extractChatflowIdFromUrl(agent.chatflowUrl),
          stats: results.find(r => r.agentId === agent.id)
        })),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de todos os agentes:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar estatísticas',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Extrai chatflow ID da URL
 */
function extractChatflowIdFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    // Exemplo: https://aaranha-zania.hf.space/agentflows/d84b3578-daff-4161-bbe1-451f87f11423
    const match = url.match(/\/agentflows\/([a-f0-9-]{36})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}