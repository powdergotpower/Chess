import { Mastra } from "@mastra/core";
import { MastraError } from "@mastra/core/error";
import { PinoLogger } from "@mastra/loggers";
import { LogLevel, MastraLogger } from "@mastra/core/logger";
import pino from "pino";
import { MCPServer } from "@mastra/mcp";
import { NonRetriableError } from "inngest";
import { z } from "zod";

// Local files
import { sharedPostgresStorage } from "./storage";
import { inngest, inngestServe } from "./inngest";

// Chess assistant components
import { chessAssistantAgent } from "./agents/chessAgent";
import { chessAssistantWorkflow } from "./workflow/chessAssistantWorkflow"; // corrected path
import { registerTelegramTrigger } from "./triggers/telegramTriggers";       // corrected path

// Chess tools for MCP server
import { chessBoardTool } from "./tools/chessBoardTool";
import { stockfishTool } from "./tools/stockfishTool";
import { telegramButtonsTool } from "./tools/telegramButtonsTool";
import { telegramMessageTool } from "./tools/telegramMessageTool";
import { chessGameFlowTool } from "./tools/chessGameFlowTool";

class ProductionPinoLogger extends MastraLogger {
  protected logger: pino.Logger;

  constructor(options: { name?: string; level?: LogLevel } = {}) {
    super(options);
    this.logger = pino({
      name: options.name || "app",
      level: options.level || LogLevel.INFO,
      base: {},
      formatters: { level: (label: string) => ({ level: label }) },
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    });
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
  }
  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
  }
  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
  }
  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
  }
}

export const mastra = new Mastra({
  storage: sharedPostgresStorage,
  agents: { chessAssistant: chessAssistantAgent },
  workflows: { chessAssistantWorkflow },
  mcpServers: {
    allTools: new MCPServer({
      name: "allTools",
      version: "1.0.0",
      tools: { chessBoardTool, stockfishTool, telegramButtonsTool, telegramMessageTool, chessGameFlowTool },
    }),
  },
  bundler: { externals: ["@slack/web-api", "inngest", "inngest/hono", "hono", "hono/streaming"], sourcemap: true },
  server: {
    host: "0.0.0.0",
    port: 5000,
    middleware: [
      async (c, next) => {
        const mastra = c.get("mastra");
        const logger = mastra?.getLogger();
        logger?.debug("[Request]", { method: c.req.method, url: c.req.url });
        try {
          await next();
        } catch (error) {
          logger?.error("[Response]", { method: c.req.method, url: c.req.url, error });
          if (error instanceof MastraError && error.id === "AGENT_MEMORY_MISSING_RESOURCE_ID") {
            throw new NonRetriableError(error.message, { cause: error });
          } else if (error instanceof z.ZodError) {
            throw new NonRetriableError(error.message, { cause: error });
          }
          throw error;
        }
      },
    ],
    apiRoutes: [
      { path: "/api/inngest", method: "ALL", createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }) },
      ...registerTelegramTrigger({
        triggerType: "telegram/message",
        handler: async (mastra: Mastra, triggerInfo: any) => {
          const logger = mastra.getLogger();
          logger?.info("📝 [Telegram Trigger] Chess assistant message received:", { triggerInfo });

          const run = await mastra.getWorkflow("chessAssistantWorkflow").createRunAsync();
          await run.start({
            inputData: {
              message: JSON.stringify(triggerInfo.payload),
              threadId: `telegram/${triggerInfo.payload.message?.from?.id || triggerInfo.payload.callback_query?.from?.id}`,
            },
          });
        },
      }),
    ],
  },
  logger:
    process.env.NODE_ENV === "production"
      ? new ProductionPinoLogger({ name: "Mastra", level: "info" })
      : new PinoLogger({ name: "Mastra", level: "info" }),
});

/* Sanity checks */
if (Object.keys(mastra.getWorkflows()).length > 1)
  throw new Error("More than 1 workflows found. Currently not supported in the UI.");
if (Object.keys(mastra.getAgents()).length > 1)
  throw new Error("More than 1 agents found. Currently not supported in the UI.");
