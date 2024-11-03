import pyautogui
from pynput import keyboard
import threading

# Speed of mouse movement and scrolling
MOVE_SPEED = 20
SCROLL_SPEED = 10
stop_event = threading.Event()

# Function to move the mouse continuously
def move_mouse(x_offset, y_offset):
    while not stop_event.is_set():
        pyautogui.moveRel(x_offset, y_offset)
        pyautogui.sleep(0.01)  # Controls how fast the mouse moves

# Function to scroll continuously
def scroll_mouse(vertical, horizontal):
    while not stop_event.is_set():
        pyautogui.scroll(vertical)
        pyautogui.hscroll(horizontal)
        pyautogui.sleep(0.01)  # Controls how fast the scrolling happens

# Function to handle key presses
def on_press(key):
    try:
        print(f"key: {key}")
        if key.char == '1':  # Scroll up
            stop_event.clear()
            threading.Thread(target=scroll_mouse, args=(SCROLL_SPEED, 0)).start()
        elif key.char == '2':  # Scroll down
            stop_event.clear()
            threading.Thread(target=scroll_mouse, args=(-SCROLL_SPEED, 0)).start()
        elif key.char == '3':  # Scroll left
            stop_event.clear()
            threading.Thread(target=scroll_mouse, args=(0, -SCROLL_SPEED)).start()
        elif key.char == '4':  # Scroll right
            stop_event.clear()
            threading.Thread(target=scroll_mouse, args=(0, SCROLL_SPEED)).start()
    except Exception as e:
        print(f"key: {key}")

# Function to handle key releases
def on_release(key):
    try:
        if isinstance(key, keyboard.KeyCode) and key.char in {'1', '2', '3', '4'}:
            stop_event.set()  # Stop moving or scrolling
    except AttributeError:
        print(f"Error: {key}")

    if key == keyboard.Key.esc:
        # Stop the listener
        return False

# Start listening for keyboard input
with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
    listener.join()
