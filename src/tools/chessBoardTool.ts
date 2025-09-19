import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";
import { Chess } from "chess.js";

const gameSessions = new Map<string, Chess>();

export const chessBoardTool = createTool({
  id: "chess-board-tool",
  description: `Manages chess board state, validates moves, and provides FEN strings for analysis. Handles game sessions per user.`,
  inputSchema: z.object({
    userId: z.string().describe("Unique user identifier"),
    action: z.enum(["initialize", "makeMove", "getState", "reset"]).describe("Action to perform"),
    move: z.string().optional().describe("Move in algebraic notation (e.g., 'Nf3', 'e4', 'O-O')"),
    fromSquare: z.string().optional().describe("Source square (e.g., 'e2')"),
    toSquare: z.string().optional().describe("Target square (e.g., 'e4')"),
    promotion: z.string().optional().describe("Promotion piece for pawn promotion (q, r, b, n)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    fen: z.string().optional(),
    currentTurn: z.string().optional(),
    gameOver: z.boolean().optional(),
    inCheck: z.boolean().optional(),
    possibleMoves: z.array(z.string()).optional(),
    lastMove: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { userId, action, move, fromSquare, toSquare, promotion } = context;
    
    logger?.info('🔧 [ChessBoardTool] Starting execution', { 
      userId, 
      action, 
      move, 
      fromSquare, 
      toSquare 
    });

    try {
      switch (action) {
        case "initialize": {
          const chess = new Chess();
          gameSessions.set(userId, chess);
          logger?.info('📝 [ChessBoardTool] Initialized new game', { userId });
          
          return {
            success: true,
            message: "Chess board initialized successfully",
            fen: chess.fen(),
            currentTurn: chess.turn() === 'w' ? 'white' : 'black',
            gameOver: false,
            inCheck: chess.inCheck(),
          };
        }

        case "makeMove": {
          let chess = gameSessions.get(userId);
          if (!chess) {
            chess = new Chess();
            gameSessions.set(userId, chess);
            logger?.info('📝 [ChessBoardTool] Created new session for makeMove', { userId });
          }

          let moveResult;
          if (move) {
            // Try algebraic notation first
            try {
              moveResult = chess.move(move);
            } catch (error) {
              logger?.error('❌ [ChessBoardTool] Invalid move (algebraic)', { move, error });
            }
          }

          // If algebraic notation failed or wasn't provided, try from/to squares
          if (!moveResult && fromSquare && toSquare) {
            try {
              moveResult = chess.move({
                from: fromSquare,
                to: toSquare,
                promotion: promotion as any
              });
            } catch (error) {
              logger?.error('❌ [ChessBoardTool] Invalid move (from/to)', { 
                fromSquare, 
                toSquare, 
                promotion, 
                error 
              });
              return {
                success: false,
                message: `Invalid move: ${fromSquare} to ${toSquare}. ${error}`,
                fen: chess.fen(),
                currentTurn: chess.turn() === 'w' ? 'white' : 'black',
                gameOver: chess.isGameOver(),
                inCheck: chess.inCheck(),
              };
            }
          }

          if (!moveResult) {
            return {
              success: false,
              message: "Invalid move format or illegal move",
              fen: chess.fen(),
              currentTurn: chess.turn() === 'w' ? 'white' : 'black',
              gameOver: chess.isGameOver(),
              inCheck: chess.inCheck(),
            };
          }

          logger?.info('✅ [ChessBoardTool] Move made successfully', { 
            userId, 
            move: moveResult.san 
          });

          return {
            success: true,
            message: `Move made: ${moveResult.san}`,
            fen: chess.fen(),
            currentTurn: chess.turn() === 'w' ? 'white' : 'black',
            gameOver: chess.isGameOver(),
            inCheck: chess.inCheck(),
            lastMove: moveResult.san,
          };
        }

        case "getState": {
          let chess = gameSessions.get(userId);
          if (!chess) {
            chess = new Chess();
            gameSessions.set(userId, chess);
            logger?.info('📝 [ChessBoardTool] Created new session for getState', { userId });
          }

          const moves = chess.moves();
          
          return {
            success: true,
            message: "Current board state retrieved",
            fen: chess.fen(),
            currentTurn: chess.turn() === 'w' ? 'white' : 'black',
            gameOver: chess.isGameOver(),
            inCheck: chess.inCheck(),
            possibleMoves: moves.slice(0, 10), // Limit to avoid overwhelming output
          };
        }

        case "reset": {
          const chess = new Chess();
          gameSessions.set(userId, chess);
          logger?.info('📝 [ChessBoardTool] Reset game', { userId });
          
          return {
            success: true,
            message: "Chess board reset to starting position",
            fen: chess.fen(),
            currentTurn: chess.turn() === 'w' ? 'white' : 'black',
            gameOver: false,
            inCheck: false,
          };
        }

        default:
          return {
            success: false,
            message: "Unknown action",
          };
      }
    } catch (error) {
      logger?.error('❌ [ChessBoardTool] Execution failed', { 
        userId, 
        action, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        message: `Chess board operation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
