import logging
import os
from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext
from board_handler import recognize_board
from engine import get_best_move

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# Store user sessions
user_data = {}

# /start command
def start(update: Update, context: CallbackContext):
    update.message.reply_text(
        "Welcome to Chess Bot! Please upload a picture of your chessboard."
    )

# Handle uploaded images
def handle_photo(update: Update, context: CallbackContext):
    user_id = update.message.from_user.id

    if not update.message.photo:
        update.message.reply_text("Please upload a valid chessboard image.")
        return

    # Download image
    photo_file = update.message.photo[-1].get_file()
    file_path = f"{user_id}_board.jpg"
    photo_file.download(file_path)

    # Recognize pieces
    positions = recognize_board(file_path)
    user_data[user_id] = {
        "board_image": file_path,
        "board_positions": positions
    }

    update.message.reply_text("Image received! Board positions detected:\n" + str(positions))
    update.message.reply_text("Next: Who's turn? (You can implement inline buttons here later.)")

# Main function
def main():
    TOKEN = "8396269907:AAH9VURRq33VX_E6-_5_QJKMWpG8nPEeDQY"  # replace with your token
    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher

    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(MessageHandler(Filters.photo, handle_photo))

    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
