import chess

class ChessBoardHandler:
    def __init__(self):
        self.board = chess.Board()
        self.turn = None
        self.last_piece = None
    
    def set_turn(self, color):
        self.turn = color
    
    def set_last_piece(self, piece):
        self.last_piece = piece
    
    def get_valid_squares(self):
        moves = []
        for move in self.board.legal_moves:
            if self.last_piece and chess.PIECE_NAMES[move.piece_type] == self.last_piece.lower():
                moves.append(move.uci()[2:4])
        return moves
    
    def make_opponent_move(self, square):
        for move in self.board.legal_moves:
            if move.uci()[2:4] == square:
                self.board.push(move)
                break
    
    def get_fen(self):
        return self.board.fen()
