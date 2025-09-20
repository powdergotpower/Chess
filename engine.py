from stockfish import Stockfish

class StockfishEngine:
    stockfish = Stockfish("/data/data/com.termux/files/home/Stockfish/src/stockfish", depth=15)

    @classmethod
    def get_best_move(cls, fen):
        cls.stockfish.set_fen_position(fen)
        move = cls.stockfish.get_best_move()
        return cls.uci_to_human(move)
    
    @staticmethod
    def uci_to_human(uci):
        # Convert UCI e2e4 → "Pawn to e4"
        piece_map = {'p': 'Pawn', 'n': 'Knight', 'b': 'Bishop', 'r': 'Rook', 'q': 'Queen', 'k': 'King'}
        from_square = uci[:2]
        to_square = uci[2:4]
        return f"{piece_map.get('p', 'Piece')} to {to_square}"  # Simplified
