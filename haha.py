# main.py
import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Updater, CommandHandler, CallbackQueryHandler, CallbackContext, ConversationHandler, MessageHandler, filters
import chess
import chess.engine

# Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# States
FEN, TURN, OPPONENT_PIECE, OPPONENT_MOVE = range(4)

# Stockfish
STOCKFISH_PATH = "/data/data/com.termux/files/home/Chess/stockfish/stockfish-android-armv8"  # Change this path
engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)

# Boards per chat
boards = {}

# Start command
def start(update: Update, context: CallbackContext):
    update.message.reply_text("Send me the FEN string of the board to start:")
    return FEN

# FEN received
def fen_received(update: Update, context: CallbackContext):
    fen = update.message.text.strip()
    try:
        board = chess.Board(fen)
    except:
        update.message.reply_text("Invalid FEN. Send again.")
        return FEN

    chat_id = update.message.chat_id
    boards[chat_id] = board
    return ask_turn(update, context, board)

# Ask whose turn
def ask_turn(update: Update, context: CallbackContext, board=None):
    if board is None:
        board = boards[update.callback_query.message.chat_id]

    keyboard = [
        [InlineKeyboardButton("White", callback_data="white")],
        [InlineKeyboardButton("Black", callback_data="black")]
    ]

    if hasattr(update, 'callback_query') and update.callback_query:
        update.callback_query.edit_message_text("Whose turn is it?", reply_markup=InlineKeyboardMarkup(keyboard))
    else:
        update.message.reply_text("Whose turn is it?", reply_markup=InlineKeyboardMarkup(keyboard))

    return TURN

# Turn selected
def turn_selected(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    turn = query.data
    chat_id = query.message.chat_id
    board = boards[chat_id]
    board.turn = chess.WHITE if turn == "white" else chess.BLACK
    return show_pieces(update, context, board)

# Show pieces to select
def show_pieces(update: Update, context: CallbackContext, board):
    chat_id = update.callback_query.message.chat_id
    pieces = [(piece.symbol(), square) for square in chess.SQUARES if (piece := board.piece_at(square)) and piece.color == board.turn]

    if not pieces:
        update.callback_query.edit_message_text("No pieces to move! Game over?")
        return ConversationHandler.END

    keyboard = [[InlineKeyboardButton(f"{p[0]} ({chess.square_name(p[1])})", callback_data=str(p[1]))] for p in pieces]
    update.callback_query.edit_message_text("Select the piece your opponent moved:", reply_markup=InlineKeyboardMarkup(keyboard))
    return OPPONENT_PIECE

# Opponent piece selected
def opponent_piece_selected(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    square_from = int(query.data)
    chat_id = query.message.chat_id
    board = boards[chat_id]
    board.selected_square = square_from

    legal_moves = [move for move in board.legal_moves if move.from_square == square_from]
    keyboard = [[InlineKeyboardButton(chess.square_name(move.to_square), callback_data=str(move.to_square))] for move in legal_moves]
    query.edit_message_text("Select the square your opponent moved to:", reply_markup=InlineKeyboardMarkup(keyboard))
    return OPPONENT_MOVE

# Opponent move selected
def opponent_move_selected(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    square_to = int(query.data)
    chat_id = query.message.chat_id
    board = boards[chat_id]
    move = chess.Move(from_square=board.selected_square, to_square=square_to)

    if move in board.legal_moves:
        board.push(move)
        if board.is_game_over():
            query.edit_message_text(f"Opponent moved: {move.uci()}\nGame Over! Result: {board.result()}")
            return ConversationHandler.END

        # Stockfish best move
        result = engine.play(board, chess.engine.Limit(time=0.1))
        best_move = result.move
        board.push(best_move)
        message = f"Opponent moved: {move.uci()}\nYour best move: {best_move.uci()}"
        if board.is_game_over():
            message += f"\nGame Over! Result: {board.result()}"
            query.edit_message_text(message)
            return ConversationHandler.END
        else:
            query.edit_message_text(message)
            return ask_turn(update, context, board)
    else:
        query.edit_message_text("Invalid move selected. Try again.")
        return show_pieces(update, context, board)

# Cancel command
def cancel(update: Update, context: CallbackContext):
    update.message.reply_text("Cancelled.")
    return ConversationHandler.END

# Main function
def main():
    TOKEN = "8396269907:AAH9VURRq33VX_E6-_5_QJKMWpG8nPEeDQY"
    updater = Updater(TOKEN)
    dp = updater.dispatcher

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            FEN: [MessageHandler(filters.TEXT & ~filters.COMMAND, fen_received)],
            TURN: [CallbackQueryHandler(turn_selected)],
            OPPONENT_PIECE: [CallbackQueryHandler(opponent_piece_selected)],
            OPPONENT_MOVE: [CallbackQueryHandler(opponent_move_selected)],
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )

    dp.add_handler(conv_handler)
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
