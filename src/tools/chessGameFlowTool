import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";

// Game state storage
const gameStates = new Map<string, {
  initialized: boolean;
  currentTurn?: 'white' | 'black';
  awaitingInput?: 'piece' | 'square' | 'turn' | 'none';
  selectedPiece?: string;
  lastUserMessage?: string;
  moveHistory: string[];
}>();

export const chessGameFlowTool = createTool({
  id: "chess-game-flow-tool",
  description: `Manages the chess game flow, tracks user interactions, and determines what input is needed next`,
  inputSchema: z.object({
    userId: z.string().describe("Unique user identifier"),
    action: z.enum(["initGame", "setTurn", "selectPiece", "selectSquare", "getNextStep", "resetGame"]).describe("Flow action to perform"),
    value: z.string().optional().describe("Value for the action (piece type, square, turn)"),
    messageType: z.enum(["photo", "text", "callback"]).optional().describe("Type of user message received"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    nextStep: z.enum(["ask_turn", "ask_piece", "ask_square", "provide_analysis", "game_complete"]),
    needsButtons: z.boolean(),
    buttonType: z.enum(["pieces", "squares", "turns", "confirmation"]).optional(),
    gameState: z.object({
      initialized: z.boolean(),
      currentTurn: z.enum(["white", "black"]).optional(),
      awaitingInput: z.enum(["piece", "square", "turn", "none"]).optional(),
      selectedPiece: z.string().optional(),
    }).optional(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { userId, action, value, messageType } = context;
    
    logger?.info('🔧 [ChessGameFlowTool] Processing flow action', { 
      userId, 
      action, 
      value, 
      messageType 
    });

    try {
      // Get or initialize game state
      let gameState = gameStates.get(userId);
      if (!gameState) {
        gameState = {
          initialized: false,
          awaitingInput: 'turn',
          moveHistory: [],
        };
        gameStates.set(userId, gameState);
        logger?.info('📝 [ChessGameFlowTool] Created new game state', { userId });
      }

      switch (action) {
        case "initGame": {
          gameState.initialized = true;
          gameState.awaitingInput = 'turn';
          gameState.moveHistory = [];
          logger?.info('✅ [ChessGameFlowTool] Game initialized', { userId });

          return {
            success: true,
            message: "Welcome to Chess Assistant! I'll help you analyze your chess positions and find the best moves using Stockfish.",
            nextStep: "ask_turn" as const,
            needsButtons: true,
            buttonType: "turns" as const,
            gameState: {
              initialized: gameState.initialized,
              currentTurn: gameState.currentTurn,
              awaitingInput: gameState.awaitingInput,
              selectedPiece: gameState.selectedPiece,
            },
          };
        }

        case "setTurn": {
          if (value === "white" || value === "black") {
            gameState.currentTurn = value;
            gameState.awaitingInput = 'piece';
            logger?.info('📝 [ChessGameFlowTool] Turn set', { userId, turn: value });

            return {
              success: true,
              message: `Great! ${value === 'white' ? 'White' : 'Black'} to move. Now, which piece did your opponent just move?`,
              nextStep: "ask_piece" as const,
              needsButtons: true,
              buttonType: "pieces" as const,
              gameState: {
                initialized: gameState.initialized,
                currentTurn: gameState.currentTurn,
                awaitingInput: gameState.awaitingInput,
                selectedPiece: gameState.selectedPiece,
              },
            };
          }
          
          return {
            success: false,
            message: "Invalid turn selection. Please choose white or black.",
            nextStep: "ask_turn" as const,
            needsButtons: true,
            buttonType: "turns" as const,
          };
        }

        case "selectPiece": {
          if (value && ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(value)) {
            gameState.selectedPiece = value;
            gameState.awaitingInput = 'square';
            logger?.info('📝 [ChessGameFlowTool] Piece selected', { userId, piece: value });

            const pieceNames = {
              king: 'King ♔',
              queen: 'Queen ♕', 
              rook: 'Rook ♖',
              bishop: 'Bishop ♗',
              knight: 'Knight ♘',
              pawn: 'Pawn ♙'
            };

            return {
              success: true,
              message: `${pieceNames[value as keyof typeof pieceNames]} selected. Where did it move to?`,
              nextStep: "ask_square" as const,
              needsButtons: true,
              buttonType: "squares" as const,
              gameState: {
                initialized: gameState.initialized,
                currentTurn: gameState.currentTurn,
                awaitingInput: gameState.awaitingInput,
                selectedPiece: gameState.selectedPiece,
              },
            };
          }

          return {
            success: false,
            message: "Invalid piece selection.",
            nextStep: "ask_piece" as const,
            needsButtons: true,
            buttonType: "pieces" as const,
          };
        }

        case "selectSquare": {
          if (value && /^[a-h][1-8]$/.test(value)) {
            gameState.awaitingInput = 'none';
            const move = `${gameState.selectedPiece} to ${value.toUpperCase()}`;
            gameState.moveHistory.push(move);
            logger?.info('📝 [ChessGameFlowTool] Square selected, ready for analysis', { 
              userId, 
              square: value,
              move 
            });

            return {
              success: true,
              message: `Move recorded: ${move}. Let me analyze the position and find the best move for you...`,
              nextStep: "provide_analysis" as const,
              needsButtons: false,
              gameState: {
                initialized: gameState.initialized,
                currentTurn: gameState.currentTurn,
                awaitingInput: gameState.awaitingInput,
                selectedPiece: gameState.selectedPiece,
              },
            };
          }

          return {
            success: false,
            message: "Invalid square selection. Please choose a valid square (a1-h8).",
            nextStep: "ask_square" as const,
            needsButtons: true,
            buttonType: "squares" as const,
          };
        }

        case "getNextStep": {
          // Determine what the user needs to do next based on current state
          if (!gameState.initialized) {
            return {
              success: true,
              message: "Let's start by setting up your chess position.",
              nextStep: "ask_turn" as const,
              needsButtons: true,
              buttonType: "turns" as const,
              gameState: {
                initialized: gameState.initialized,
                currentTurn: gameState.currentTurn,
                awaitingInput: gameState.awaitingInput,
                selectedPiece: gameState.selectedPiece,
              },
            };
          }

          if (gameState.awaitingInput === 'turn') {
            return {
              success: true,
              message: "Whose turn is it to move?",
              nextStep: "ask_turn" as const,
              needsButtons: true,
              buttonType: "turns" as const,
            };
          }

          if (gameState.awaitingInput === 'piece') {
            return {
              success: true,
              message: "Which piece did your opponent move?",
              nextStep: "ask_piece" as const,
              needsButtons: true,
              buttonType: "pieces" as const,
            };
          }

          if (gameState.awaitingInput === 'square') {
            return {
              success: true,
              message: "Where did the piece move to?",
              nextStep: "ask_square" as const,
              needsButtons: true,
              buttonType: "squares" as const,
            };
          }

          return {
            success: true,
            message: "Ready for next move analysis.",
            nextStep: "provide_analysis" as const,
            needsButtons: false,
          };
        }

        case "resetGame": {
          gameState.initialized = false;
          gameState.currentTurn = undefined;
          gameState.awaitingInput = 'turn';
          gameState.selectedPiece = undefined;
          gameState.moveHistory = [];
          logger?.info('📝 [ChessGameFlowTool] Game reset', { userId });

          return {
            success: true,
            message: "Game reset! Let's start fresh.",
            nextStep: "ask_turn" as const,
            needsButtons: true,
            buttonType: "turns" as const,
            gameState: {
              initialized: gameState.initialized,
              currentTurn: gameState.currentTurn,
              awaitingInput: gameState.awaitingInput,
              selectedPiece: gameState.selectedPiece,
            },
          };
        }

        default:
          return {
            success: false,
            message: "Unknown action",
            nextStep: "ask_turn" as const,
            needsButtons: false,
          };
      }

    } catch (error) {
      logger?.error('❌ [ChessGameFlowTool] Flow processing failed', { 
        userId,
        action,
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        message: `Game flow error: ${error instanceof Error ? error.message : String(error)}`,
        nextStep: "ask_turn" as const,
        needsButtons: false,
      };
    }
  },
});
