# detect.py
from PIL import Image
import numpy as np
import os

def detect_pieces(board_file, pieces_folder="pieces"):
    """
    Detects all pieces on the board using template matching.
    
    Args:
        board_file (str): Path to the board screenshot (PNG/JPG)
        pieces_folder (str): Folder containing piece templates (wP.png, bK.png, etc.)
    
    Returns:
        dict: {piece_filename: (x, y)}
    """
    board_gray = Image.open(board_file).convert("L")
    board_arr = np.array(board_gray)
    board_h, board_w = board_arr.shape

    piece_positions = {}

    piece_files = [f for f in os.listdir(pieces_folder) if f.endswith(".png")]

    for pf in piece_files:
        piece_gray = Image.open(os.path.join(pieces_folder, pf)).convert("L")
        piece_arr = np.array(piece_gray)
        piece_h, piece_w = piece_arr.shape

        best_score = -1
        best_pos = (0, 0)
        for y in range(board_h - piece_h):
            for x in range(board_w - piece_w):
                region = board_arr[y:y+piece_h, x:x+piece_w]
                score = np.sum((region - piece_arr) ** 2)
                if best_score == -1 or score < best_score:
                    best_score = score
                    best_pos = (x, y)

        piece_positions[pf] = best_pos

    return piece_positions
