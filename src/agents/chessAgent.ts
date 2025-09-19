import { Agent } from "@mastra/core/agent";
import { chessBoardTool } from "../tools/chessBoardTool";
import { stockfishTool } from "../tools/stockfishTool";
import { telegramButtonsTool } from "../tools/telegramButtonsTool";
import { chessGameFlowTool } from "../tools/chessGameFlowTool";

// Rule-based chess assistant without AI language model
class ChessAssistantBot {
  async processMessage(
    userId: string,
    messageType: string,
    userMessage: string,
    threadId: string,
    mastra?: any
  ): Promise<{
    replyText: string;
    inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>;
  }> {
    const logger = mastra?.getLogger();
    logger?.info("🎯 [ChessBot] Processing message", {
      userId,
      messageType,
      userMessage: userMessage.substring(0, 100),
    });

    if (userMessage.toLowerCase().includes("/start") || userMessage.toLowerCase().includes("start")) {
      return await this.handleStartCommand(userId, mastra);
    }

    if (messageType === "photo") {
      return await this.handlePhotoMessage(userId, mastra);
    }

    if (messageType === "callback") {
      return await this.handleButtonCallback(userId, userMessage, mastra);
    }

    if (userMessage.toLowerCase().includes("help")) {
      return await this.handleHelpCommand();
    }

    if (userMessage.toLowerCase().includes("analyze") || userMessage.toLowerCase().includes("analysis")) {
      return await this.handleAnalysisRequest(userId, mastra);
    }

    return await this.handleMoveInput(userId, userMessage, mastra);
  }

  private async handleStartCommand(userId: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info("🏁 [ChessBot] Starting new game for user", { userId });

    try {
      const gameResult = await chessBoardTool.execute({
        context: { action: "initialize" }, // corrected
        mastra,
      });

      const buttonsResult = await telegramButtonsTool.execute({
        context: {
          buttonType: "game_menu", // corrected
          options: ["New Game", "Load Game", "Puzzle Mode", "Analysis Mode"],
        },
        mastra,
      });

      logger?.info("✅ [ChessBot] New game created successfully");

      return {
        replyText: `♟️ Welcome to Chess Assistant!\n\n${gameResult.message}\n\nChoose an option to get started:`,
        inlineKeyboard: buttonsResult.inlineKeyboard,
      };
    } catch (error) {
      logger?.error("❌ [ChessBot] Error creating new game", { error });

      return {
        replyText:
          "♟️ Welcome to Chess Assistant! Ready to start a new chess game? Use the menu below:",
        inlineKeyboard: [
          [
            { text: "♟️ New Game", callback_data: "initialize" },
            { text: "📚 Help", callback_data: "help" },
          ],
        ],
      };
    }
  }

  private async handlePhotoMessage(userId: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info("📸 [ChessBot] Processing photo message", { userId });

    try {
      const squareButtons = await telegramButtonsTool.execute({
        context: {
          buttonType: "input_method",
          context: "photo_input",
          options: ["Enter FEN", "Describe Position", "Manual Setup"],
        },
        mastra,
      });

      return {
        replyText:
          "📸 I can see your chess board photo! \n\nWhile I can't automatically read board images yet, I can help you input the position:\n\n• Use FEN notation if you know it\n• Describe the position in words\n• Set up the position step by step\n\nHow would you like to input this position?",
        inlineKeyboard: squareButtons.inlineKeyboard,
      };
    } catch (error) {
      logger?.error("❌ [ChessBot] Error processing photo", { error });

      return {
        replyText:
          "📸 I can see your chess board photo! Please describe the position or use the buttons below:",
        inlineKeyboard: [
          [
            { text: "📝 Enter FEN", callback_data: "enter_fen" },
            { text: "🎯 Manual Setup", callback_data: "manual_setup" },
          ],
        ],
      };
    }
  }

  private async handleButtonCallback(userId: string, callbackData: string, mastra?: any) {
    const logger = mastra?.getLogger();
    const buttonPressed = callbackData.replace("Button pressed: ", "");
    logger?.info("🔘 [ChessBot] Button callback", { userId, buttonPressed });

    if (buttonPressed === "initialize") return await this.handleStartCommand(userId, mastra);
    if (buttonPressed === "help") return await this.handleHelpCommand();
    if (buttonPressed.includes("square_")) return await this.handleSquareSelection(userId, buttonPressed);
    if (buttonPressed.includes("piece_"))
      return await this.handlePieceSelection(userId, buttonPressed, mastra);

    return {
      replyText: `You selected: ${buttonPressed}\n\nThis feature is being processed...`,
      inlineKeyboard: [
        [
          { text: "🏠 Main Menu", callback_data: "initialize" },
          { text: "📚 Help", callback_data: "help" },
        ],
      ],
    };
  }

  private async handleSquareSelection(userId: string, selection: string) {
    return {
      replyText: `Square ${selection.replace("square_", "")} selected.\n\nChoose your next action:`,
      inlineKeyboard: [
        [
          { text: "✅ Confirm Move", callback_data: "confirm_move" },
          { text: "🔄 Select Different Square", callback_data: "select_square" },
          { text: "❌ Cancel", callback_data: "cancel" },
        ],
      ],
    };
  }

  private async handlePieceSelection(userId: string, selection: string, mastra?: any) {
    const piece = selection.replace("piece_", "");
    const logger = mastra?.getLogger();
    logger?.info("♟️ [ChessBot] Piece selection", { userId, piece });

    try {
      const squareButtons = await telegramButtonsTool.execute({
        context: {
          buttonType: "squares",
          context: piece,
        },
        mastra,
      });

      return {
        replyText: `${piece} selected. Now choose the destination square:`,
        inlineKeyboard: squareButtons.inlineKeyboard,
      };
    } catch (error) {
      logger?.error("❌ [ChessBot] Error generating square buttons", { error });

      return {
        replyText: `${piece} selected. Please type the destination square (e.g., e4, d5):`,
        inlineKeyboard: [
          [
            { text: "🏠 Main Menu", callback_data: "initialize" },
            { text: "❌ Cancel", callback_data: "cancel" },
          ],
        ],
      };
    }
  }

  private async handleAnalysisRequest(userId: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info("🤖 [ChessBot] Analysis request", { userId });

    try {
      const analysisResult = await stockfishTool.execute({
        context: {
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          depth: 15,
          timeLimit: 3000, // added
        },
        mastra,
      });

      return {
        replyText: `🤖 Chess Engine Analysis:\n\n${
          analysisResult.engineOutput || "Analysis in progress..."
        }\n\nBest move: ${analysisResult.bestMove || "Calculating..."}\nEvaluation: ${
          analysisResult.evaluation || "N/A"
        }`,
        inlineKeyboard: [
          [
            { text: "🎯 Get More Suggestions", callback_data: "more_analysis" },
            { text: "🏠 Main Menu", callback_data: "initialize" },
          ],
        ],
      };
    } catch (error) {
      logger?.error("❌ [ChessBot] Analysis error", { error });

      return {
        replyText:
          "🤖 Chess engine analysis is currently being processed. The engine provides move suggestions and position evaluation when available.",
        inlineKeyboard: [
          [
            { text: "🏠 Main Menu", callback_data: "initialize" },
            { text: "📚 Help", callback_data: "help" },
          ],
        ],
      };
    }
  }

  private async handleMoveInput(userId: string, userMessage: string, mastra?: any) {
    const logger = mastra?.getLogger();
    logger?.info("🎯 [ChessBot] Move input", { userId, move: userMessage });

    if (this.isChessMove(userMessage)) {
      try {
        const moveResult = await chessBoardTool.execute({
          context: { action: "makeMove", move: userMessage }, // corrected
          mastra,
        });

        logger?.info("✅ [ChessBot] Move executed successfully", { move: userMessage });

        return {
          replyText: `✅ Move played: ${userMessage}\n\n${
            moveResult.message || "Board updated!"
          }\n\nWhat's your next move?`,
          inlineKeyboard: [
            [
              { text: "🤖 Get Suggestion", callback_data: "analysis" },
              { text: "↩️ Undo Move", callback_data: "undo" },
 { text: "🏠 Main Menu", callback_data: "initialize" }
          ]
        ]
      };
    }

    return {
      replyText: "I didn't understand that command. Here are your options:",
      inlineKeyboard: [
        [
          { text: "♟️ New Game", callback_data: "initialize" },
          { text: "🤖 Analysis", callback_data: "analysis" }
        ],
        [
          { text: "📚 Help", callback_data: "help" },
          { text: "🧩 Puzzles", callback_data: "puzzles" }
        ]
      ]
    };
    }
