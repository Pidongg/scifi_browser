import math
from mouse_controller import process_action


# Constants
Y_VELOCITY_THRESHOLD = 20
MIDDLE_FINGER_SLOPE_THRESHOLD = 0.5
GESTURES = ["None", "Thumb_Down", "Thumb_Up", "Closed_Fist", "Pointing_Up", "Pointing_Down", "Victory"]
X_DIFF_VELOCITY_THRESHOLD = 20
MOUSE_MOVE_VELOCITY_THRESHOLD = 10

previous_action = "idle"


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


def direction_of_thumbs(hand_data: dict) -> str:
    left = get_left_hand(hand_data)
    right = get_right_hand(hand_data)

    if left and right:
        x1_thumb, y1_thumb = left["lmList"][4][:2]
        x1_outer, y1_outer = left["lmList"][17][:2]
        x2_thumb, y2_thumb = right["lmList"][4][:2]
        x2_outer, y2_outer = right["lmList"][17][:2]

        threshold = 30

        if x1_thumb - threshold > x1_outer and x2_thumb + threshold < x2_outer:
            return "outwards"
        elif x1_thumb + threshold < x1_outer and x2_thumb - threshold > x2_outer:
            return "inwards"
    return "none"




def interpret_gesture(hand_data: dict) -> None:
    global previous_action
    action = "idle"

    right = get_right_hand(hand_data)
    hand_velocity = math.sqrt(right["x_velocity"] ** 2 + right["y_velocity"] ** 2) if right else 0

    if (
        1.5 < get_proportional_hand_distance(hand_data) < 4.0 and
        hand_data.get("num_hands") >= 2 and
        hand_data.get("middle_finger_slope") < MIDDLE_FINGER_SLOPE_THRESHOLD and 
        abs(hand_data.get("y_velocity")) > Y_VELOCITY_THRESHOLD and
        hand_data.get("gesture") in ["Open_Palm", "None"]
    ):
        thumb_direction = direction_of_thumbs(hand_data)
        if hand_data.get("y_velocity") > Y_VELOCITY_THRESHOLD and thumb_direction == "outwards":
            action = "scroll up"
        elif hand_data.get("y_velocity") < -Y_VELOCITY_THRESHOLD and thumb_direction == "inwards":
            action = "scroll down"

    # elif (
    #     hand_data.get("gesture") == "Closed_Fist" and
    #     hand_velocity > MOUSE_MOVE_VELOCITY_THRESHOLD
    # ):
    #     action = "mouse move"

    # elif (
    #     hand_data.get("gesture") == "Pointing_Up"
    # ):
    #     action = "mouse down"

    # elif previous_action == "mouse down":
    #     action = "mouse up"

    
    # elif (
    #     abs(hand_data.get("x_diff_velocity")) > X_DIFF_VELOCITY_THRESHOLD and
    #     hand_data.get("gesture") == "Open_Palm"
    # ):
    #     if hand_data.get("x_diff_velocity") > X_DIFF_VELOCITY_THRESHOLD:
    #         action = "zoom in"
    #     elif hand_data.get("x_diff_velocity") < -X_DIFF_VELOCITY_THRESHOLD:
    #         action = "zoom out"
    
    # print(action)

    mouse_x = right["x_velocity"] / 10 if right else 0
    mouse_y = right["y_velocity"] / 10 if right else 0

    process_action((action, mouse_x, mouse_y))
    previous_action = action
