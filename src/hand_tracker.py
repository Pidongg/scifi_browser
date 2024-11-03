import time
import cv2
import mediapipe as mp
import numpy as np
from cvzone.HandTrackingModule import HandDetector
from interpret_gestures import interpret_gesture


def start_hand_tracking(hand_data: dict) -> None:
    """
    Start the hand tracking process.
    """
    

    # Initialize the webcam and hand detector
    cap: cv2.VideoCapture = cv2.VideoCapture(0) # 0 for built-in camera
    detector = HandDetector(staticMode=False, maxHands=2, modelComplexity=1, detectionCon=0.5, minTrackCon=0.5)

    # Continuously get frames from the webcam
    try:
        while True:
            # Capture each frame from the webcam
            success, img = cap.read() # img contains the frame
            if not success:
                print("Error capturing frame")
                continue

            img = process_frame(detector, img, hand_data)
            cv2.imshow("Image", img)
            if cv2.waitKey(10) & 0xFF == ord('q'): # wait for 5ms and if q is pressed, break
                break
    
    except Exception as e:
        print(f"Error: {e}")
    
    finally:
        print("Exiting gracefully")
        cap.release()
        cv2.destroyAllWindows()


def process_frame(detector: HandDetector, img: cv2.Mat, hand_data: dict) -> cv2.Mat:
    """
    Process a frame from the webcam.
    """
    hands, img = detector.findHands(img, draw=True, flipType=True)
    process_hands(hands, detector, img, hand_data)
    return img


def process_hands(hands: list[dict], detector: HandDetector, img: cv2.Mat, hand_data: dict) -> None:
    """
    Process hand coordinates and add them to the hand_data dictionary.
    """

    hand_data["num_hands"] = len(hands)
    centers = []

    for i, hand in enumerate(hands):
        name = f"hand{i+1}"
        lmList = hand["lmList"]  # List of 21 landmarks for the hand
        bbox = hand["bbox"]  # Bounding box around the first hand (x,y,w,h coordinates)
        center = hand['center']  # Center coordinates of the hand
        handType = hand["type"]  # Type of the hand ("Left" or "Right")
        fingers = detector.fingersUp(hand)

        hand_data[name] = {
            'type': handType,
            'fingers': fingers,
            'center': center,
            'bbox': bbox,
            'lmList': lmList,
        }

        centers.append(center[:2])

    # Center of both hands
    if centers:
        x_center = sum(center[0] for center in centers) / len(centers)
        y_center = sum(center[1] for center in centers) / len(centers)

        # Y velocity of the center of both hands
        cur_time = time.time()
        hand_data["x_velocity"] = (x_center - hand_data["center"][0]) / (cur_time - hand_data["last_update"])
        hand_data["y_velocity"] = - (y_center - hand_data["center"][1]) / (cur_time - hand_data["last_update"])
        hand_data["last_update"] = cur_time
        hand_data["center"] = [x_center, y_center]
    else:
        hand_data["x_velocity"] = 0
        hand_data["y_velocity"] = 0
    
    if len(hands) >= 2:
        check_horizontal_alignment(detector, img, hand_data)
    interpret_gesture(hand_data)


def check_horizontal_alignment(detector: HandDetector, img: cv2.Mat, hand_data: dict) -> None:
    """
    Check if the hands are horizontally aligned.
    """

    hand1 = hand_data["hand1"]
    hand2 = hand_data["hand2"]

    middle_finger_tip_1 = hand1["lmList"][12][0:2] # x, y coordinates
    middle_finger_tip_2 = hand2["lmList"][12][0:2]

    length, info, img = detector.findDistance(
        middle_finger_tip_1, middle_finger_tip_2, img, color=(255, 0, 255), scale=10
    )

    # Calculate the angle between the two middle finger tips
    delta_y = max(abs(middle_finger_tip_2[1] - middle_finger_tip_1[1]), 1)
    delta_x = max(abs(middle_finger_tip_2[0] - middle_finger_tip_1[0]), 1)
    slope = delta_y / delta_x

    hand_data["middle_finger_slope"] = slope