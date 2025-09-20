import cv2
import numpy as np
import os

PIECES_PATH = os.path.join(os.getcwd(), "pieces")  # folder with PNGs

def recognize_board(board_image_path):
    """
    Recognize pieces on the board image using PNG templates.
    Returns a dictionary mapping squares (A1-H8) to piece names.
    """
    board_img = cv2.imread(board_image_path)
    board_positions = {}  # e.g., {'A1': 'white_rook'}

    # divide board into 8x8 grid
    h, w = board_img.shape[:2]
    square_h, square_w = h / 8, w / 8

    for piece_file in os.listdir(PIECES_PATH):
        piece_name = piece_file.split('.')[0]  # e.g., whiteking
        template = cv2.imread(os.path.join(PIECES_PATH, piece_file), cv2.IMREAD_UNCHANGED)
        res = cv2.matchTemplate(board_img, template, cv2.TM_CCOEFF_NORMED)
        threshold = 0.8
        loc = np.where(res >= threshold)

        for pt in zip(*loc[::-1]):
            col = int(pt[0] // square_w)
            row = int(pt[1] // square_h)
            square = f"{chr(65 + col)}{row + 1}"
            board_positions[square] = piece_name

    return board_positions
