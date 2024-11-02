from flask import Flask, jsonify
from flask_cors import CORS
import pyautogui

app = Flask(__name__)
CORS(app)

@app.route('/mouse-position', methods=['GET'])
def get_and_set_mouse_position():
    x, y = pyautogui.position()
    if x is not None and y is not None:
        pyautogui.moveTo(x+3, y+3)
    return jsonify({
        'x': x+3,
        'y': y+3
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000) 