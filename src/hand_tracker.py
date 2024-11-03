import json
import cv2
from cvzone.HandTrackingModule import HandDetector


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
    
    if hands:
        hand1 = hands[0]  # first hand detected
        lmList1 = hand1["lmList"]  # List of 21 landmarks for the first hand
        bbox1 = hand1["bbox"]  # Bounding box around the first hand (x,y,w,h coordinates)
        center1 = hand1['center']  # Center coordinates of the first hand
        handType1 = hand1["type"]  # Type of the first hand ("Left" or "Right")

        # Count the number of fingers up for the first hand
        fingers1 = detector.fingersUp(hand1)
        # print(f'H1 = {fingers1.count(1)}', end=" ")  # Print the count of fingers that are up
        hand_data[handType1] = {
            'fingers': fingers1,
            'center': center1,
            'lmList': lmList1
        }

        # Calculate distance between specific landmarks on the first hand and draw it on the image
        # length, info, img = detector.findDistance(lmList1[8][0:2], lmList1[12][0:2], img, color=(255, 0, 255),scale=10)

        # Check if a second hand is detected
        if len(hands) == 2:
            # Information for the second hand
            hand2 = hands[1]
            lmList2 = hand2["lmList"]
            bbox2 = hand2["bbox"]
            center2 = hand2['center']
            handType2 = hand2["type"]

            # Count the number of fingers up for the second hand
            fingers2 = detector.fingersUp(hand2)
            # print(f'H2 = {fingers2.count(1)}', end=" ")

            hand_data[handType2] = {
                'fingers': fingers2,
                'center': center2,
                'lmList': lmList2
            }

            # Calculate distance between the index fingers of both hands and draw it on the image
            print(f"Left: {lmList1[8][0:2]}, Right: {lmList2[8][0:2]}")
            length, info, img = detector.findDistance(lmList1[8][0:2], lmList2[8][0:2], img, color=(255, 0, 0),
                                                    scale=10)

        print(" ")  # New line for better readability of the printed output

    # print(json.dumps(hand_data, indent=2))
    # print(hand_data)
    
    return img
