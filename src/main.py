import time
from hand_tracker import start_hand_tracking


def main():
    hand_data = {
        "last_update": time.time(),
        "num_hands": 0,
        "x_velocity": 0,
        "y_velocity": 0,
        "x_diff": 0,
        "x_diff_velocity": 0,
        "middle_finger_slope": 1,
        "center": [0, 0],
        "hand1": {
            "type": "",
            "fingers": 0,
            "center": (0, 0),
            "bbox": [0, 0, 0, 0]
        },
        "hand2": {
            "type": "",
            "fingers": 0,
            "center": (0, 0),
            "bbox": [0, 0, 0, 0]
        }
    }
    print("starting")
    start_hand_tracking(hand_data)
    print("exited")


if __name__ == "__main__":
    main()
