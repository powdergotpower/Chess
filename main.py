#!/usr/bin/env python3
# main.py - Telegram Chess Bot with Stockfish (rule-based)

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters
import chess
from stockfish import Stockfish
import os

# -------------------------
# CONFIGURATION
# -------------------------
TELEGRAM_TOKEN = "8396269907:AAH9VURRq33VX_E6-_5_QJKMWpG8nPEeDQY"
STOCKFISH_PATH = "/data/data/com.termux/files/home/Stockfish/src/stockfish"

# Logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# -------------------------
# GAME STATE STORAGE
# -------------------------
games = {}  # key = chat_id, value = chess.Board object

# -------------------------
# HELPER FUNCTIONS
# -------------------------
def get_stockfish_best_move(fen: str):
    stockfish = Stockfish(STOCKFISH_PATH)
    stockfish.set_fen_position(fen)
    best_move = stockfish.get_best_move()
    return best_move

def board_to_text(board: chess.Board):
    return str(board)

# -------------------------
# HANDLERS
# -------------------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    games[chat_id] = chess.Board()

    keyboard = [
        [InlineKeyboardButton("White", callback_data="turn_white"),
         InlineKeyboardButton("Black", callback_data="turn_black")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "♟️ Welcome to Chess Bot!\n\nWhose turn is it?", reply_markup=reply_markup
    )

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id not in games:
        games[chat_id] = chess.Board()

    await update.message.reply_text(
        "📸 Photo received! Currently, automatic piece recognition is not implemented.\n"
        "Please tell me which piece your opponent moved."
    )

    keyboard = [
        [InlineKeyboardButton("King", callback_data="piece_K")],
        [InlineKeyboardButton("Queen", callback_data="piece_Q")],
        [InlineKeyboardButton("Rook", callback_data="piece_R")],
        [InlineKeyboardButton("Bishop", callback_data="piece_B")],
        [InlineKeyboardButton("Knight", callback_data="piece_N")],
        [InlineKeyboardButton("Pawn", callback_data="piece_P")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Select the piece your opponent moved:", reply_markup=reply_markup)

async def button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    chat_id = query.message.chat.id

    if chat_id not in games:
        games[chat_id] = chess.Board()

    data = query.data

    # Handle turn selection
    if data.startswith("turn_"):
        turn = data.split("_")[1]
        await query.edit_message_text(f"Turn set: {turn.capitalize()}\nNow tell me which piece your opponent moved.")
        # Show pieces
        keyboard = [
            [InlineKeyboardButton("King", callback_data="piece_K")],
            [InlineKeyboardButton("Queen", callback_data="piece_Q")],
            [InlineKeyboardButton("Rook", callback_data="piece_R")],
            [InlineKeyboardButton("Bishop", callback_data="piece_B")],
            [InlineKeyboardButton("Knight", callback_data="piece_N")],
            [InlineKeyboardButton("Pawn", callback_data="piece_P")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.message.reply_text("Select the piece your opponent moved:", reply_markup=reply_markup)
        return

    # Handle piece selection
    if data.startswith("piece_"):
        piece = data.split("_")[1]
        context.user_data["last_piece"] = piece

        # Show all squares as buttons
        squares = [f"{file}{rank}" for rank in range(1, 9) for file in "abcdefgh"]
        keyboard = [[InlineKeyboardButton(sq, callback_data=f"square_{sq}") for sq in squares[i:i+4]] for i in range(0, 64, 4)]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(f"Selected piece: {piece}\nSelect destination square:")
        await query.message.reply_text("Choose the square your opponent moved to:", reply_markup=reply_markup)
        return

    # Handle square selection
    if data.startswith("square_"):
        square = data.split("_")[1]
        board = games[chat_id]

        # Apply move (simplified: assumes legal move)
        last_piece = context.user_data.get("last_piece", "P")
        move_uci = None

        for move in board.legal_moves:
            if str(move)[2:] == square:
                move_uci = move.uci()
                break

        if move_uci:
            board.push_uci(move_uci)
            best_move = get_stockfish_best_move(board.fen())
            await query.edit_message_text(
                f"Move applied: {last_piece} to {square}\n\nBest move for you: {best_move}\n\nCurrent board:\n{board_to_text(board)}"
            )
        else:
            await query.edit_message_text(f"Move to {square} not recognized. Make sure it is valid.")
        return

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "♟️ Commands:\n"
        "/start - Start new game\n"
        "Send photo of board - Begin move input\n"
        "Bot suggests best move after each opponent move."
    )

# -------------------------
# MAIN
# -------------------------
if __name__ == "__main__":
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(CallbackQueryHandler(button))

    print("🤖 Chess Bot is running...")
    app.run_polling()
