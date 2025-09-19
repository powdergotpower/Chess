import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";

// Import Stockfish engine
let Stockfish: any;
try {
  Stockfish = require("stockfish");
} catch (error) {
  console.warn("Stockfish module not available:", error);
}

export const stockfishTool = createTool({
  id: "stockfish-analysis-tool", 
  description: `Analyzes chess positions using Stockfish engine and provides best move suggestions with human-readable explanations`,
  inputSchema: z.object({
    fen: z.string().describe("FEN string representing the current board position"),
    depth: z.number().default(10).describe("Analysis depth (1-20, default: 10)"),
    timeLimit: z.number().default(3000).describe("Time limit for analysis in milliseconds (default: 3000)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    bestMove: z.string().optional(),
    humanReadableMove: z.string().optional(),
    evaluation: z.string().optional(),
    principalVariation: z.array(z.string()).optional(),
    engineOutput: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { fen, depth, timeLimit } = context;
    
    logger?.info('🔧 [StockfishTool] Starting analysis', { 
      fen, 
      depth, 
      timeLimit 
    });

    if (!Stockfish) {
      logger?.error('❌ [StockfishTool] Stockfish engine not available');
      return {
        success: false,
        message: "Stockfish engine is not available. Please ensure the stockfish package is installed.",
      };
    }

    try {
      return new Promise((resolve) => {
        const engine = new Stockfish();
        let bestMove = '';
        let evaluation = '';
        let principalVariation: string[] = [];
        let engineOutput = '';
        let analysisTimeout: NodeJS.Timeout;

        // Set timeout for analysis
        const analysisPromiseTimeout = setTimeout(() => {
          engine.terminate && engine.terminate();
          logger?.warn('⚠️ [StockfishTool] Analysis timed out', { timeLimit });
          resolve({
            success: false,
            message: `Analysis timed out after ${timeLimit}ms`,
            engineOutput,
          });
        }, timeLimit + 1000); // Add buffer to internal timeout

        engine.onmessage = (message: string) => {
          engineOutput += message + '\n';
          logger?.debug('📝 [StockfishTool] Engine message', { message });

          // Parse best move
          if (message.startsWith('bestmove')) {
            const parts = message.split(' ');
            bestMove = parts[1] || '';
            logger?.info('✅ [StockfishTool] Found best move', { bestMove });
          }

          // Parse evaluation and principal variation
          if (message.includes('info depth') && message.includes('pv')) {
            const depthMatch = message.match(/depth (\d+)/);
            const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;
            
            if (currentDepth >= Math.min(depth, 5)) { // Get info from reasonable depth
              // Extract evaluation
              const scoreMatch = message.match(/score (cp|mate) ([-\d]+)/);
              if (scoreMatch) {
                if (scoreMatch[1] === 'mate') {
                  evaluation = `Mate in ${Math.abs(parseInt(scoreMatch[2]))} moves`;
                } else {
                  const centipawns = parseInt(scoreMatch[2]);
                  const pawns = (centipawns / 100).toFixed(1);
                  evaluation = `${pawns > '0' ? '+' : ''}${pawns} pawns`;
                }
              }

              // Extract principal variation
              const pvMatch = message.match(/pv (.+)$/);
              if (pvMatch) {
                principalVariation = pvMatch[1].split(' ').slice(0, 5); // First 5 moves
              }
            }
          }

          // Check if analysis is complete
          if (message.startsWith('bestmove') && bestMove) {
            clearTimeout(analysisPromiseTimeout);
            engine.terminate && engine.terminate();
            
            const humanReadable = convertMoveToHuman(bestMove, fen);
            
            logger?.info('✅ [StockfishTool] Analysis complete', { 
              bestMove, 
              humanReadable, 
              evaluation 
            });

            resolve({
              success: true,
              message: `Best move found: ${humanReadable}`,
              bestMove,
              humanReadableMove: humanReadable,
              evaluation,
              principalVariation,
              engineOutput: engineOutput.slice(-500), // Keep last 500 chars
            });
          }
        };

        // Start analysis
        logger?.info('📝 [StockfishTool] Starting engine analysis');
        engine.postMessage('uci');
        engine.postMessage('ucinewgame');
        engine.postMessage(`position fen ${fen}`);
        engine.postMessage(`go depth ${depth}`);
      });

    } catch (error) {
      logger?.error('❌ [StockfishTool] Analysis failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        message: `Stockfish analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

function convertMoveToHuman(uciMove: string, fen: string): string {
  if (!uciMove || uciMove === '(none)') {
    return "No legal moves available";
  }

  try {
    // Basic UCI to human-readable conversion
    // This is a simplified version - in a full implementation you'd use chess.js
    // to properly convert UCI notation to algebraic notation
    
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove.substring(4) : '';
    
    // Convert file letters to more readable format
    const fromReadable = from.charAt(0).toUpperCase() + from.charAt(1);
    const toReadable = to.charAt(0).toUpperCase() + to.charAt(1);
    
    let moveDescription = `Move from ${fromReadable} to ${toReadable}`;
    
    // Handle special cases
    if (uciMove === 'e1g1' || uciMove === 'e8g8') {
      moveDescription = "Castle kingside (O-O)";
    } else if (uciMove === 'e1c1' || uciMove === 'e8c8') {
      moveDescription = "Castle queenside (O-O-O)";
    } else if (promotion) {
      const pieces = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
      moveDescription += ` and promote to ${pieces[promotion as keyof typeof pieces] || promotion}`;
    }
    
    return moveDescription;
    
  } catch (error) {
    return `Move: ${uciMove}`;
  }
    }
