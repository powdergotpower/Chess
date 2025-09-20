from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, filters
from board_handler import ChessBoardHandler
from engine import StockfishEngine

# Global board per user (for demo)
user_boards = {}

async def start(update: Update, context):
    user_id = update.effective_user.id
    user_boards[user_id] = ChessBoardHandler()
    
    keyboard = [
        [InlineKeyboardButton("White", callback_data="turn_white"),
         InlineKeyboardButton("Black", callback_data="turn_black")]
    ]
    await update.message.reply_text(
        "Whose turn is it?", reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def photo(update: Update, context):
    await update.message.reply_text("Photo received. Please input FEN manually for now.")
    # Future: integrate CV to detect board

async def button(update: Update, context):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    board = user_boards.get(user_id)
    
    if query.data.startswith("turn_"):
        color = query.data.split("_")[1]
        board.set_turn(color)
        await query.edit_message_text(f"Turn set to {color}. Now enter opponent's move piece.")
        await show_piece_buttons(query, board)
    
    elif query.data.startswith("piece_"):
        piece = query.data.split("_")[1]
        board.set_last_piece(piece)
        await show_valid_squares(query, board)

    elif query.data.startswith("square_"):
        square = query.data.split("_")[1]
        board.make_opponent_move(square)
        # Stockfish suggestion
        best_move = StockfishEngine.get_best_move(board.get_fen())
        await query.edit_message_text(f"Opponent moved. Best move for you: {best_move}")

async def show_piece_buttons(query, board):
    keyboard = [[InlineKeyboardButton(p, callback_data=f"piece_{p.lower()}") for p in ["King","Queen","Rook","Bishop","Knight","Pawn"]]]
    await query.edit_message_text("Select opponent's piece:", reply_markup=InlineKeyboardMarkup(keyboard))

async def show_valid_squares(query, board):
    squares = board.get_valid_squares()
    keyboard = []
    row = []
    for i, sq in enumerate(squares, 1):
        row.append(InlineKeyboardButton(sq, callback_data=f"square_{sq}"))
        if i % 4 == 0:
            keyboard.append(row)
            row = []
    if row:
        keyboard.append(row)
    await query.edit_message_text("Select destination square:", reply_markup=InlineKeyboardMarkup(keyboard))

app = ApplicationBuilder().token("8396269907:AAH9VURRq33VX_E6-_5_QJKMWpG8nPEeDQY").build()
app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.PHOTO, photo))
app.add_handler(CallbackQueryHandler(button))
app.run_polling()
