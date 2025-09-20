from stockfish import Stockfish
import os

# Make sure Stockfish binary is installed in Termux
STOCKFISH_PATH = "/data/data/com.termux/files/home/stockfish"  # adjust path if needed

stockfish = Stockfish(path=STOCKFISH_PATH)
stockfish.update_engine_parameters({
    "Skill Level": 20,
    "Threads": 2,
    "Minimum Thinking Time": 30
})

def get_best_move(fen):
    """
    Given a FEN string, return the best move suggested by Stockfish.
    """
    stockfish.set_fen_position(fen)
    return stockfish.get_best_move()
