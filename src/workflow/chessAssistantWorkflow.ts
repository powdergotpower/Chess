import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { chessAssistantAgent } from "../agents/chessAgent";

// Schema for structured agent output
const agentOutputSchema = z.object({
  replyText: z.string().describe("The text response to send to the user"),
  inlineKeyboard: z.array(z.array(z.object({
    text: z.string().describe("Button label text"),
    callback_data: z.string().describe("Callback data for the button"),
  }))).optional().describe("Optional inline keyboard buttons"),
});

const step1 = createStep({
  id: "use-chess-agent",
  description: "Process user message with chess assistant agent",
  inputSchema: z.object({
    message: z.string(),
    threadId: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
    chatId: z.string(),
    inlineKeyboard: z.array(z.array(z.object({
      text: z.string(),
      callback_data: z.string(),
    }))).optional(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [ChessWorkflow] Step 1: Processing with chess agent', { 
      messageLength: inputData.message.length,
      threadId: inputData.threadId 
    });

    try {
      // Parse the Telegram payload to extract user info
      const telegramPayload = JSON.parse(inputData.message);
      const chatId = telegramPayload.message?.chat?.id || telegramPayload.callback_query?.message?.chat?.id;
      const userId = telegramPayload.message?.from?.id || telegramPayload.callback_query?.from?.id;
      
      let userMessage = "";
      let messageType = "text";

      // Handle different types of Telegram updates
      if (telegramPayload.message) {
        if (telegramPayload.message.photo) {
          userMessage = "I've sent a photo of my chess board. Please help me analyze it.";
          messageType = "photo";
        } else {
          userMessage = telegramPayload.message.text || "Hello";
        }
      } else if (telegramPayload.callback_query) {
        userMessage = `Button pressed: ${telegramPayload.callback_query.data}`;
        messageType = "callback";
      }

      logger?.info('📝 [ChessWorkflow] Extracted message data', { 
        chatId, 
        userId, 
        messageType,
        userMessage: userMessage.substring(0, 100) 
      });

      // Call the chess assistant agent with structured output
      const result = await chessAssistantAgent.generate([
        { 
          role: "user", 
          content: `User ID: ${userId}, Message Type: ${messageType}, Message: ${userMessage}` 
        }
      ], {
        resourceId: "chess-bot",
        threadId: inputData.threadId,
        maxSteps: 8, // Allow multiple tool calls for complex chess operations
        experimental_output: agentOutputSchema,
      });

      logger?.info('✅ [ChessWorkflow] Agent response generated', { 
        hasText: !!result.object?.replyText,
        hasKeyboard: !!result.object?.inlineKeyboard,
        keyboardButtons: result.object?.inlineKeyboard?.length || 0
      });

      return {
        response: result.object?.replyText || result.text || "Sorry, I couldn't process your request.",
        chatId: chatId.toString(),
        inlineKeyboard: result.object?.inlineKeyboard,
      };

    } catch (error) {
      logger?.error('❌ [ChessWorkflow] Step 1 failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });

      // Fallback response for errors
      return {
        response: "Sorry, I encountered an error processing your chess request. Please try again or type /start to begin a new game.",
        chatId: "unknown",
        inlineKeyboard: undefined,
      };
    }
  }
});

const step2 = createStep({
  id: "send-telegram-reply",
  description: "Send chess assistant response to Telegram",
  inputSchema: z.object({
    response: z.string(),
    chatId: z.string(),
    inlineKeyboard: z.array(z.array(z.object({
      text: z.string(),
      callback_data: z.string(),
    }))).optional(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.string().optional(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [ChessWorkflow] Step 2: Sending Telegram reply', { 
      chatId: inputData.chatId,
      responseLength: inputData.response.length
    });

    try {
      // Check if we have a bot token
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        logger?.warn('⚠️ [ChessWorkflow] No TELEGRAM_BOT_TOKEN, using mock response');
        return {
          sent: true,
          messageId: "mock_message_id",
        };
      }

      // Send message via Telegram Bot API
      const payload: any = {
        chat_id: inputData.chatId,
        text: inputData.response,
        parse_mode: 'HTML',
      };

      if (inputData.inlineKeyboard && inputData.inlineKeyboard.length > 0) {
        payload.reply_markup = {
          inline_keyboard: inputData.inlineKeyboard,
        };
        logger?.info('📝 [ChessWorkflow] Adding inline keyboard', { 
          buttonRows: inputData.inlineKeyboard.length 
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

      if (!response.ok || !responseData.ok) {
        throw new Error(`Telegram API error: ${responseData.description || 'Unknown error'}`);
      }

      logger?.info('✅ [ChessWorkflow] Message sent successfully', { 
        messageId: responseData.result.message_id 
      });

      return {
        sent: true,
        messageId: responseData.result.message_id.toString(),
      };

    } catch (error) {
      logger?.error('❌ [ChessWorkflow] Step 2 failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });

      return {
        sent: false,
      };
    }
  }
});

export const chessAssistantWorkflow = createWorkflow({
  id: "chess-assistant-workflow",
  description: "Telegram Chess Assistant workflow that processes user messages and provides chess analysis",
  inputSchema: z.object({
    message: z.string(),
    threadId: z.string(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.string().optional(),
  })
})
  .then(step1)
  .then(step2)
  .commit();
