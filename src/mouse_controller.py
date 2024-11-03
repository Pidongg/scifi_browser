import pyautogui
from pynput import keyboard
import threading

# Speed of scrolling
SCROLL_SPEED = 4

def process_action(action: str) -> None:
    # print(action)
    if action == "scroll up":
        threading.Thread(target=scroll, args=(-SCROLL_SPEED, 0)).start()
    elif action == "scroll down":
        threading.Thread(target=scroll, args=(SCROLL_SPEED, 0)).start()


def scroll(vertical, horizontal):
    pyautogui.scroll(vertical)  # Scroll up/down
    if horizontal != 0:
        pyautogui.keyDown('shift')
        pyautogui.scroll(horizontal)
        pyautogui.keyUp('shift')
    pyautogui.sleep(0.01)  # Controls the smoothness of scrolling
