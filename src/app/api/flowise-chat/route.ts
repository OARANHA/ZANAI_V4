import { NextRequest, NextResponse } from 'next/server';
import { FLOWISE_CONFIG, generateSessionId, identifyResponseType, calculateConfidence } from '@/lib/flowise-config';
import { createFlowiseStatsCollector, defaultFlowiseStatsConfig } from '@/lib/flowise-stats-collector';

// Coletor de estatísticas
const statsCollector = createFlowiseStatsCollector(defaultFlowiseStatsConfig);

/**
 * POST /api/flowise-chat - Chat bidirecional com Flowise
 * Body:
 * - agentId: ID do agente ZANAI
 * - flowiseChatflowId: ID do chatflow no Flowise
 * - message: Mensagem do usuário
 * - sessionId: ID da sessão (opcional)
 * - context: Contexto adicional (opcional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, flowiseChatflowId, message, sessionId, context } = body;

    if (!agentId || !flowiseChatflowId || !message) {
      return NextResponse.json({
        success: false,
        error: 'agentId, flowiseChatflowId e message são obrigatórios'
      }, { status: 400 });
    }

    // Gerar session ID se não fornecido
    const session = sessionId || generateSessionId();

    // Envia mensagem para o Flowise
    const flowiseResponse = await sendToFlowise(flowiseChatflowId, message, session, context);
    
    // Processa resposta do Flowise
    const processedResponse = await processFlowiseResponse(flowiseResponse);
    
    // Coleta estatísticas após a interação
    try {
      await statsCollector.collectAgentStats(agentId, flowiseChatflowId);
    } catch (statsError) {
      console.warn('Não foi possível coletar estatísticas após o chat:', statsError);
    }

    // Retorna resposta formatada para o cliente
    return NextResponse.json({
      success: true,
      response: processedResponse,
      sessionId: session,
      timestamp: new Date().toISOString(),
      metadata: {
        agentId,
        flowiseChatflowId,
        processingTime: processedResponse.metadata?.processingTime || 0
      }
    });

  } catch (error) {
    console.error('Erro na API de chat bidirecional:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/flowise-chat - Verifica status do serviço
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flowiseChatflowId = searchParams.get('flowiseChatflowId');

    if (!flowiseChatflowId) {
      // Verifica conexão básica com Flowise
      const isConnected = await testFlowiseConnection();
      
      return NextResponse.json({
        success: isConnected,
        message: isConnected ? 'Conexão com Flowise estabelecida' : 'Falha na conexão com Flowise',
        timestamp: new Date().toISOString()
      });
    }

    // Verifica status específico do chatflow
    const chatflowStatus = await testChatflowStatus(flowiseChatflowId);
    
    return NextResponse.json({
      success: chatflowStatus.connected,
      message: chatflowStatus.message,
      chatflowStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao verificar status do chat:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao verificar status',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Envia mensagem para o Flowise
 */
async function sendToFlowise(chatflowId: string, message: string, sessionId: string, context?: any): Promise<any> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${FLOWISE_CONFIG.baseUrl}/api/v1/prediction/${chatflowId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FLOWISE_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        question: message,
        sessionId,
        overrideConfig: {
          ...context,
          streaming: false
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Flowise API error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    // Adiciona metadata de processamento
    return {
      ...data,
      _metadata: {
        processingTime: Date.now() - startTime,
        sessionId,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Erro ao enviar mensagem para Flowise:', error);
    throw new Error(`Falha ao comunicar com Flowise: ${error.message}`);
  }
}

/**
 * Processa resposta do Flowise
 */
async function processFlowiseResponse(flowiseResponse: any): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Extrai dados da resposta
    const text = flowiseResponse.text || flowiseResponse.response || flowiseResponse.answer || '';
    const data = flowiseResponse.data || {};
    const metadata = flowiseResponse._metadata || {};

    // Identifica tipo de resposta
    const responseType = identifyResponseType(text);
    
    // Extrai estatísticas se disponíveis
    const stats = extractStatsFromResponse(flowiseResponse);
    
    // Formata resposta para o cliente
    return {
      type: responseType,
      content: text,
      data: data || {},
      metadata: {
        ...metadata,
        processedAt: new Date().toISOString(),
        confidence: calculateConfidence(text),
        processingTime: Date.now() - startTime,
        responseType,
        stats
      }
    };

  } catch (error) {
    console.error('Erro ao processar resposta do Flowise:', error);
    
    // Retorna resposta de erro formatada
    return {
      type: 'error',
      content: 'Desculpe, ocorreu um erro ao processar a resposta do assistente.',
      data: {},
      metadata: {
        processedAt: new Date().toISOString(),
        confidence: 0,
        processingTime: Date.now() - startTime,
        responseType: 'error',
        error: error.message
      }
    };
  }
}

/**
 * Extrai estatísticas da resposta do Flowise
 */
function extractStatsFromResponse(response: any): any {
  const stats = {
    executionTime: response._metadata?.processingTime || 0,
    hasData: !!(response.data && Object.keys(response.data).length > 0),
    textLength: (response.text || response.response || '').length,
    hasError: !!(response.error || response.errorMessage)
  };

  // Tenta extrair métricas adicionais se disponíveis
  if (response.metrics) {
    stats.metrics = response.metrics;
  }

  if (response.performance) {
    stats.performance = response.performance;
  }

  return stats;
}

/**
 * Testa conexão básica com Flowise
 */
async function testFlowiseConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${FLOWISE_CONFIG.baseUrl}/api/v1/ping`, {
      headers: {
        'Authorization': `Bearer ${FLOWISE_CONFIG.apiKey}`
      }
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Testa status específico de um chatflow
 */
async function testChatflowStatus(chatflowId: string): Promise<{
  connected: boolean;
  message: string;
  chatflowId: string;
  deployed?: boolean;
  lastExecution?: string;
}> {
  try {
    // Verifica se o chatflow existe
    const response = await fetch(`${FLOWISE_CONFIG.baseUrl}/api/v1/chatflows/${chatflowId}`, {
      headers: {
        'Authorization': `Bearer ${FLOWISE_CONFIG.apiKey}`
      }
    });

    if (!response.ok) {
      return {
        connected: false,
        message: 'Chatflow não encontrado',
        chatflowId
      };
    }

    const chatflow = await response.json();
    
    return {
      connected: true,
      message: 'Chatflow disponível',
      chatflowId,
      deployed: chatflow.deployed || false,
      lastExecution: chatflow.lastExecution || chatflow.updatedDate
    };

  } catch (error) {
    return {
      connected: false,
      message: `Erro ao verificar chatflow: ${error.message}`,
      chatflowId
    };
  }
}