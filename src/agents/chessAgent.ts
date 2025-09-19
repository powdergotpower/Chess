import { Agent } from "@mastra/core/agent";
import { chessBoardTool } from "../tools/chessBoardTool";
import { stockfishTool } from "../tools/stockfishTool";
import { telegramButtonsTool } from "../tools/telegramButtonsTool";
import { chessGameFlowTool } from "../tools/chessGameFlowTool";

// Rule-based chess assistant without AI language model
class ChessAssistantBot {
  async processMessage(userId: string, messageType: string, userMessage: string, threadId: string, mastra?: any): Promise<{
    replyText: string;
    inlineKeyboard?: Array<Array<{text: string; callback_data: string}>>;
  }> {
    const logger = mastra?.getLogger();
    logger?.info('🎯 [ChessBot] Processing message', { userId, messageType, userMessage: userMessage.substring(0, 100) });
    
    // Handle different message types
    if (userMessage.toLowerCase().includes('/start') || userMessage.toLowerCase().includes('start')) {
      return await this.handleStartCommand(userId, mastra);
    }
    
    if (messageType === 'photo') {
      return await this.handlePhotoMessage(userId, mastra);
    }
    
    if (messageType === 'callback') {
      return await this.handleButtonCallback(userId, userMessage, mastra);
    }
    
    if (userMessage.toLowerCase().includes('help')) {
      return await this.handleHelpCommand();
    }
    
    if (userMessage.toLowerCase().includes('analyze') || userMessage.toLowerCase().includes('analysis')) {
      return await this.handleAnalysisRequest(userId, mastra);
    }
    
    // Default: treat as move input or general chess query
    return await this.handleMoveInput(userId, userMessage, mastra);
  }
  
  private async handleStartCommand(userId: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info('🏁 [ChessBot] Starting new game for user', { userId });
    
    // Create new chess game
    try {
      const gameResult = await chessBoardTool.execute({
        context: { action: 'new_game' },
        mastra
      });
      
      const buttonsResult = await telegramButtonsTool.execute({
        context: { 
          type: 'game_menu',
          options: ['New Game', 'Load Game', 'Puzzle Mode', 'Analysis Mode']
        },
        mastra
      });
      
      logger?.info('✅ [ChessBot] New game created successfully');
      
      return {
        replyText: `♟️ Welcome to Chess Assistant!\n\n${gameResult.board_display}\n\nChoose an option to get started:`,
        inlineKeyboard: buttonsResult.buttons
      };
    } catch (error) {
      logger?.error('❌ [ChessBot] Error creating new game', { error });
      
      return {
        replyText: "♟️ Welcome to Chess Assistant! Ready to start a new chess game? Use the menu below:",
        inlineKeyboard: [[
          { text: "♟️ New Game", callback_data: "new_game" },
          { text: "📚 Help", callback_data: "help" }
        ]]
      };
    }
  }
  
  private async handlePhotoMessage(userId: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info('📸 [ChessBot] Processing photo message', { userId });
    
    try {
      const buttonsResult = await telegramButtonsTool.execute({
        context: { 
          type: 'input_method',
          options: ['Enter FEN', 'Describe Position', 'Manual Setup']
        },
        mastra
      });
      
      return {
        replyText: "📸 I can see your chess board photo! \n\nWhile I can't automatically read board images yet, I can help you input the position:\n\n• Use FEN notation if you know it\n• Describe the position in words\n• Set up the position step by step\n\nHow would you like to input this position?",
        inlineKeyboard: buttonsResult.buttons
      };
    } catch (error) {
      logger?.error('❌ [ChessBot] Error processing photo', { error });
      
      return {
        replyText: "📸 I can see your chess board photo! Please describe the position or use the buttons below:",
        inlineKeyboard: [[
          { text: "📝 Enter FEN", callback_data: "enter_fen" },
          { text: "🎯 Manual Setup", callback_data: "manual_setup" }
        ]]
      };
    }
  }
  
  private async handleButtonCallback(userId: string, callbackData: string, mastra?: any) {
    const logger = mastra?.getLogger();
    const buttonPressed = callbackData.replace('Button pressed: ', '');
    logger?.info('🔘 [ChessBot] Button callback', { userId, buttonPressed });
    
    if (buttonPressed === 'new_game') {
      return await this.handleStartCommand(userId, mastra);
    }
    
    if (buttonPressed === 'help') {
      return await this.handleHelpCommand();
    }
    
    if (buttonPressed.includes('square_')) {
      return await this.handleSquareSelection(userId, buttonPressed);
    }
    
    if (buttonPressed.includes('piece_')) {
      return await this.handlePieceSelection(userId, buttonPressed, mastra);
    }
    
    return {
      replyText: `You selected: ${buttonPressed}\n\nThis feature is being processed...`,
      inlineKeyboard: [[
        { text: "🏠 Main Menu", callback_data: "start" },
        { text: "📚 Help", callback_data: "help" }
      ]]
    };
  }
  
  private async handleSquareSelection(userId: string, selection: string) {
    return {
      replyText: `Square ${selection.replace('square_', '')} selected.\n\nChoose your next action:`,
      inlineKeyboard: [[
        { text: "✅ Confirm Move", callback_data: "confirm_move" },
        { text: "🔄 Select Different Square", callback_data: "select_square" },
        { text: "❌ Cancel", callback_data: "cancel" }
      ]]
    };
  }
  
  private async handlePieceSelection(userId: string, selection: string, mastra?: any) {
    const piece = selection.replace('piece_', '');
    const logger = mastra?.getLogger();
    logger?.info('♟️ [ChessBot] Piece selection', { userId, piece });
    
    // Generate square selection buttons
    try {
      const squareButtons = await telegramButtonsTool.execute({
        context: { 
          type: 'squares',
          piece: piece
        },
        mastra
      });
      
      return {
        replyText: `${piece} selected. Now choose the destination square:`,
        inlineKeyboard: squareButtons.buttons
      };
    } catch (error) {
      logger?.error('❌ [ChessBot] Error generating square buttons', { error });
      
      return {
        replyText: `${piece} selected. Please type the destination square (e.g., e4, d5):`,
        inlineKeyboard: [[
          { text: "🏠 Main Menu", callback_data: "start" },
          { text: "❌ Cancel", callback_data: "cancel" }
        ]]
      };
    }
  }
  
  private async handleAnalysisRequest(userId: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info('🤖 [ChessBot] Analysis request', { userId });
    
    try {
      const analysisResult = await stockfishTool.execute({
        context: { 
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          depth: 15
        },
        mastra
      });
      
      return {
        replyText: `🤖 Chess Engine Analysis:\n\n${analysisResult.analysis || 'Analysis in progress...'}\n\nBest move: ${analysisResult.best_move || 'Calculating...'}\nEvaluation: ${analysisResult.evaluation || 'N/A'}`,
        inlineKeyboard: [[
          { text: "🎯 Get More Suggestions", callback_data: "more_analysis" },
          { text: "🏠 Main Menu", callback_data: "start" }
        ]]
      };
    } catch (error) {
      logger?.error('❌ [ChessBot] Analysis error', { error });
      
      return {
        replyText: "🤖 Chess engine analysis is currently being processed. The engine provides move suggestions and position evaluation when available.",
        inlineKeyboard: [[
          { text: "🏠 Main Menu", callback_data: "start" },
          { text: "📚 Help", callback_data: "help" }
        ]]
      };
    }
  }
  
  private async handleMoveInput(userId: string, userMessage: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info('🎯 [ChessBot] Move input', { userId, move: userMessage });
    
    // Try to parse as chess move
    if (this.isChessMove(userMessage)) {
      try {
        const moveResult = await chessBoardTool.execute({
          context: { 
            action: 'make_move',
            move: userMessage
          },
          mastra
        });
        
        logger?.info('✅ [ChessBot] Move executed successfully', { move: userMessage });
        
        return {
          replyText: `✅ Move played: ${userMessage}\n\n${moveResult.board_display || 'Board updated!'}\n\nWhat's your next move?`,
          inlineKeyboard: [[
            { text: "🤖 Get Suggestion", callback_data: "analysis" },
            { text: "↩️ Undo Move", callback_data: "undo" },
            { text: "🏠 Main Menu", callback_data: "start" }
          ]]
        };
      } catch (error) {
        logger?.error('❌ [ChessBot] Invalid move', { move: userMessage, error });
        
        return {
          replyText: `❌ Invalid move: ${userMessage}\n\nPlease try again with valid chess notation (e.g., e4, Nf3, O-O)`,
          inlineKeyboard: [[
            { text: "📚 Move Help", callback_data: "move_help" },
            { text: "🏠 Main Menu", callback_data: "start" }
          ]]
        };
      }
    }
    
    return {
      replyText: "I didn't understand that command. Here are your options:",
      inlineKeyboard: [[
        { text: "♟️ New Game", callback_data: "new_game" },
        { text: "🤖 Analysis", callback_data: "analysis" }
      ], [
        { text: "📚 Help", callback_data: "help" },
        { text: "🧩 Puzzles", callback_data: "puzzles" }
      ]]
    };
  }
  
  private async handleHelpCommand() {
    return {
      replyText: `♟️ Chess Assistant Help\n\n🎮 COMMANDS:\n• /start - Start new game\n• Send chess moves like: e4, Nf3, O-O\n• Send photos of chess boards for analysis\n\n🎯 FEATURES:\n• Interactive move selection\n• Stockfish engine analysis\n• Game state tracking\n• Chess puzzle solving\n\n🔤 NOTATION:\n• Use algebraic notation (e4, Nf3, Qh5)\n• Castling: O-O (kingside), O-O-O (queenside)\n• Captures: exd5, Nxf7\n• Check: Qh5+, Checkmate: Qh7#`,
      inlineKeyboard: [[
        { text: "♟️ Start Playing", callback_data: "new_game" },
        { text: "🤖 Try Analysis", callback_data: "analysis" }
      ]]
    };
  }
  
  private isChessMove(input: string): boolean {
    // Basic regex for chess moves (can be improved)
    const movePattern = /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](\+|#)?|O-O(-O)?|\d+-\d+)$/i;
    return movePattern.test(input.trim());
  }
}

// Create a minimal agent that works without OpenAI
export const chessAssistantAgent = new Agent({
  name: "Chess Assistant Agent",
  instructions: "Rule-based chess assistant that works without AI language models. Handles chess gameplay, move validation, and engine analysis through structured logic.",
  
  // Use a mock model that doesn't actually call any external service
  model: {
    provider: "rule-based",
    modelId: "chess-logic-v1",
    
    // Mock the model interface for compatibility
    doGenerate: async () => {
      throw new Error("This agent uses rule-based logic, not language model generation");
    },
    
    doStream: async () => {
      throw new Error("This agent uses rule-based logic, not language model streaming");
    }
  } as any,
  
  tools: {
    chessBoard: chessBoardTool,
    stockfish: stockfishTool,
    telegramButtons: telegramButtonsTool,
    chessGameFlow: chessGameFlowTool,
  },
});

// Override the generate method to use our rule-based logic
(chessAssistantAgent as any).originalGenerate = chessAssistantAgent.generate;
chessAssistantAgent.generate = async function(messages: Array<{role: string; content: string}>, options?: any) {
  const bot = new ChessAssistantBot();
  const lastMessage = messages[messages.length - 1];
  const mastra = (this as any).mastra;
  
  // Parse the message content to extract user info
  const content = lastMessage.content;
  const userIdMatch = content.match(/User ID: (\d+)/);
  const messageTypeMatch = content.match(/Message Type: (\w+)/);
  const userMessageMatch = content.match(/Message: (.+)$/);
  
  const userId = userIdMatch ? userIdMatch[1] : 'unknown';
  const messageType = messageTypeMatch ? messageTypeMatch[1] : 'text';
  const userMessage = userMessageMatch ? userMessageMatch[1] : content;
  const threadId = options?.threadId || 'default';
  
  const logger = mastra?.getLogger();
  logger?.info('🎯 [ChessAgent] Processing request', { userId, messageType, threadId });
  
  const response = await bot.processMessage(userId, messageType, userMessage, threadId, mastra);
  
  logger?.info('✅ [ChessAgent] Response generated', { 
    hasKeyboard: !!response.inlineKeyboard,
    responseLength: response.replyText.length 
  });
  
  // Return in the format expected by the workflow
  return {
    text: response.replyText,
    object: response
  };
};
