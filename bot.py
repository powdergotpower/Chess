import logging
import os
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters
)
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
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to Chess Bot! Please upload a picture of your chessboard."
    )

# Handle uploaded images
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id

    if not update.message.photo:
        await update.message.reply_text("Please upload a valid chessboard image.")
        return

    # Download image
    photo_file = await update.message.photo[-1].get_file()
    file_path = f"{user_id}_board.jpg"
    await photo_file.download_to_drive(file_path)

    # Recognize pieces
    positions = recognize_board(file_path)
    user_data[user_id] = {
        "board_image": file_path,
        "board_positions": positions
    }

    await update.message.reply_text(
        "Image received! Board positions detected:\n" + str(positions)
    )
    await update.message.reply_text(
        "Next: Who's turn? (You can implement inline buttons here later.)"
    )

# Main function
def main():
    TOKEN = "8396269907:AAH9VURRq33VX_E6-_5_QJKMWpG8nPEeDQY"  # replace with your bot token

    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    app.run_polling()

if __name__ == "__main__":
    main()
