import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";

export const telegramMessageTool = createTool({
  id: "telegram-message-tool",
  description: `Sends messages and inline keyboards to Telegram users via the Telegram Bot API`,
  inputSchema: z.object({
    chatId: z.string().describe("Telegram chat ID to send message to"),
    text: z.string().describe("Message text to send"),
    inlineKeyboard: z.array(z.array(z.object({
      text: z.string(),
      callback_data: z.string(),
    }))).optional().describe("Optional inline keyboard buttons"),
    replyToMessageId: z.string().optional().describe("Message ID to reply to"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    messageId: z.string().optional(),
    errorCode: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { chatId, text, inlineKeyboard, replyToMessageId } = context;
    
    logger?.info('🔧 [TelegramMessageTool] Sending message', { 
      chatId, 
      textLength: text.length,
      hasKeyboard: !!inlineKeyboard,
      replyTo: replyToMessageId
    });

    // Check if we're in test/development mode
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger?.warn('⚠️ [TelegramMessageTool] No TELEGRAM_BOT_TOKEN, returning mock response');
      return {
        success: true,
        message: "Mock response: Message would be sent to Telegram",
        messageId: "mock_message_id_123",
      };
    }

    try {
      const payload: any = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      };

      if (replyToMessageId) {
        payload.reply_to_message_id = parseInt(replyToMessageId);
      }

      if (inlineKeyboard && inlineKeyboard.length > 0) {
        payload.reply_markup = {
          inline_keyboard: inlineKeyboard,
        };
        logger?.info('📝 [TelegramMessageTool] Adding inline keyboard', { 
          buttonRows: inlineKeyboard.length 
        });
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger?.error('❌ [TelegramMessageTool] API request failed', { 
          status: response.status,
          statusText: response.statusText,
          responseData
        });
        
        return {
          success: false,
          message: `Telegram API error: ${responseData.description || 'Unknown error'}`,
          errorCode: responseData.error_code?.toString(),
        };
      }

      if (!responseData.ok) {
        logger?.error('❌ [TelegramMessageTool] Telegram API returned error', { responseData });
        return {
          success: false,
          message: `Telegram error: ${responseData.description || 'Unknown error'}`,
          errorCode: responseData.error_code?.toString(),
        };
      }

      logger?.info('✅ [TelegramMessageTool] Message sent successfully', { 
        messageId: responseData.result.message_id 
      });

      return {
        success: true,
        message: "Message sent successfully",
        messageId: responseData.result.message_id.toString(),
      };

    } catch (error) {
      logger?.error('❌ [TelegramMessageTool] Request failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        message: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
