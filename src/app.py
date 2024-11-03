import threading

from flask import Flask, jsonify
from hand_tracker import start_hand_tracking


app = Flask(__name__)

hand_data = {
    'Left': {},
    'Right': {}
}

@app.route("/")
def index():
    return "Hello, World!"

@app.route("/mouse_position")
def mouse_position():
    return {"x": 10, "y": 20}

@app.route("/gesture")
def gesture():
    return {"gesture": "up"}

@app.route("/get_hand_data")
def get_hand_data():
    return jsonify(hand_data)

if __name__ == "__main__":
    # flask_thread = threading.Thread(target=app.run, kwargs={"host": "0.0.0.0", "port": 5000, "debug": True})
    # flask_thread.start()
    start_hand_tracking(hand_data)
