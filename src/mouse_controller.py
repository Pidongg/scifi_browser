import time
import pyautogui
from pynput import keyboard
import threading

# Speed of scrolling
SCROLL_SPEED = 4
ZOOM_STEPS = 20  # Number of small increments for smooth zooming
ZOOM_DELAY = 0.02  # Delay between each zoom step for smooth effect


def process_action(action: tuple) -> None:
    # print(action)
    if action[0] == "scroll up":
        threading.Thread(target=scroll, args=(-SCROLL_SPEED, 0)).start()
    elif action[0] == "mouse down":
        threading.Thread(target=mouse_down).start()
    elif action[0] == "mouse up":
        threading.Thread(target=mouse_up).start()
    elif action[0] == "mouse move":
        mouse_x = action[1]
        mouse_y = action[2]
        threading.Thread(target=move_mouse, args=(mouse_x, mouse_y)).start()


def scroll(vertical, horizontal):
    pyautogui.scroll(vertical)  # Scroll up/down
    if horizontal != 0:
        pyautogui.keyDown('shift')
        pyautogui.scroll(horizontal)
        pyautogui.keyUp('shift')
    pyautogui.sleep(0.01)  # Controls the smoothness of scrolling


def smooth_zoom(direction):
    for _ in range(ZOOM_STEPS):
        if direction == "in":
            pyautogui.keyDown('command')  # Use 'cmd' instead of 'ctrl' on Mac
            pyautogui.press('+')
            pyautogui.keyUp('command')
        elif direction == "out":
            pyautogui.keyDown('command')  # Use 'cmd' instead of 'ctrl' on Mac
            pyautogui.press('-')
            pyautogui.keyUp('command')
        time.sleep(ZOOM_DELAY)  # Delay to make the zooming smooth


def move_mouse(x, y):
    pyautogui.moveRel(x, y)


def mouse_down():
    pyautogui.mouseDown(button='left')


def mouse_up():
    pyautogui.mouseUp(button='left')
