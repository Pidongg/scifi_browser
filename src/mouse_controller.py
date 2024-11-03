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
    elif action == "zoom in":
        threading.Thread(target=zoom, args=(False,)).start()
    elif action == "zoom out":
        threading.Thread(target=zoom, args=(True,)).start()


def scroll(vertical, horizontal):
    pyautogui.scroll(vertical)  # Scroll up/down
    if horizontal != 0:
        pyautogui.keyDown('shift')
        pyautogui.scroll(horizontal)
        pyautogui.keyUp('shift')
    pyautogui.sleep(0.01)  # Controls the smoothness of scrolling

def zoom(out=False):
    pyautogui.keyDown('command')
    if out:
        pyautogui.press('-')
    else:
        pyautogui.keyDown('+')
    pyautogui.sleep(0.01)
    if out:
        pyautogui.keyUp('-')
    else:
        pyautogui.keyUp('+')
    pyautogui.keyUp('command')

