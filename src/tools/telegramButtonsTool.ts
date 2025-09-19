import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";

export const telegramButtonsTool = createTool({
  id: "telegram-buttons-tool",
  description: `Generates inline keyboard buttons for Telegram chess interactions including piece selection and square selection`,
  inputSchema: z.object({
    buttonType: z.enum(["pieces", "squares", "turns", "confirmation"]).describe("Type of buttons to generate"),
    context: z.string().optional().describe("Additional context for button generation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    inlineKeyboard: z.array(z.array(z.object({
      text: z.string(),
      callback_data: z.string(),
    }))),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { buttonType, context: additionalContext } = context;
    
    logger?.info('🔧 [TelegramButtonsTool] Generating buttons', { 
      buttonType, 
      context: additionalContext 
    });

    try {
      let inlineKeyboard: any[][] = [];

      switch (buttonType) {
        case "pieces": {
          // Generate piece selection buttons
          inlineKeyboard = [
            [
              { text: "♔ King", callback_data: "piece_king" },
              { text: "♕ Queen", callback_data: "piece_queen" },
            ],
            [
              { text: "♖ Rook", callback_data: "piece_rook" },
              { text: "♗ Bishop", callback_data: "piece_bishop" },
            ],
            [
              { text: "♘ Knight", callback_data: "piece_knight" },
              { text: "♙ Pawn", callback_data: "piece_pawn" },
            ],
          ];
          logger?.info('✅ [TelegramButtonsTool] Generated piece buttons');
          break;
        }

        case "squares": {
          // Generate chess square selection buttons (a1-h8)
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
          
          // Create buttons in a grid format, 4 squares per row for better mobile UX
          inlineKeyboard = [];
          let currentRow: any[] = [];
          
          for (const rank of ranks) {
            for (const file of files) {
              const square = file + rank;
              currentRow.push({
                text: square.toUpperCase(),
                callback_data: `square_${square}`
              });
              
              if (currentRow.length === 4) {
                inlineKeyboard.push(currentRow);
                currentRow = [];
              }
            }
          }
          
          // Add remaining squares if any
          if (currentRow.length > 0) {
            inlineKeyboard.push(currentRow);
          }
          
          logger?.info('✅ [TelegramButtonsTool] Generated square buttons', { 
            totalSquares: 64,
            rows: inlineKeyboard.length 
          });
          break;
        }

        case "turns": {
          // Generate turn selection buttons
          inlineKeyboard = [
            [
              { text: "⚪ White to move", callback_data: "turn_white" },
              { text: "⚫ Black to move", callback_data: "turn_black" },
            ],
          ];
          logger?.info('✅ [TelegramButtonsTool] Generated turn buttons');
          break;
        }

        case "confirmation": {
          // Generate confirmation buttons
          inlineKeyboard = [
            [
              { text: "✅ Confirm Move", callback_data: "confirm_yes" },
              { text: "❌ Cancel", callback_data: "confirm_no" },
            ],
            [
              { text: "🔄 Start Over", callback_data: "reset_game" },
            ],
          ];
          logger?.info('✅ [TelegramButtonsTool] Generated confirmation buttons');
          break;
        }

        default:
          logger?.error('❌ [TelegramButtonsTool] Unknown button type', { buttonType });
          return {
            success: false,
            message: `Unknown button type: ${buttonType}`,
            inlineKeyboard: [],
          };
      }

      return {
        success: true,
        message: `Generated ${buttonType} buttons successfully`,
        inlineKeyboard,
      };

    } catch (error) {
      logger?.error('❌ [TelegramButtonsTool] Button generation failed', { 
        buttonType,
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        message: `Button generation failed: ${error instanceof Error ? error.message : String(error)}`,
        inlineKeyboard: [],
      };
    }
  },
});
