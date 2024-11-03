from mouse_controller import process_action


# Constants
Y_VELOCITY_THRESHOLD = 80
MIDDLE_FINGER_SLOPE_THRESHOLD = 0.15


def get_proportional_hand_distance(hand_data: dict) -> float:
    left = get_left_hand(hand_data)
    right = get_right_hand(hand_data)

    if left and right:
        bbox1 = left["bbox"]
        bbox2 = right["bbox"]
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2 

        proportional_distance = (x1 - x2) / max(w1, w2, 0.1) # divide by max width of both hands
        return proportional_distance
    return 0


def get_left_hand(hand_data: dict) -> dict:
    for key, item in hand_data.items():
        if key.startswith("hand"):
            if item["type"] == "Left" and hand_data["num_hands"] >= 2:
                return item
    return None

def get_right_hand(hand_data: dict) -> dict:
    for key, item in hand_data.items():
        if key.startswith("hand"):
            if item["type"] == "Right" and hand_data["num_hands"] >= 2:
                return item
    return None

# def get_gesture_type(hand_data: dict) -> str:


def interpret_gesture(hand_data: dict) -> None:
    action = ""

    if (
        1.5 < get_proportional_hand_distance(hand_data) < 4.0 and
        hand_data.get("num_hands") >= 2 and
        hand_data.get("middle_finger_slope") < MIDDLE_FINGER_SLOPE_THRESHOLD and 
        abs(hand_data.get("y_velocity")) > Y_VELOCITY_THRESHOLD
    ):
        if hand_data.get("y_velocity") > Y_VELOCITY_THRESHOLD:
            action = "scroll up"
        else:
            action = "scroll down"
    
    else:
        action = "idle"

    process_action(action)
