"""Linux X11 test helper: operate only the native chooser titled for this smoke test.

Requires Python 3 and system libX11/libXtst, no Python packages. Never used by the app.
"""
import ctypes
import sys
import time

x11 = ctypes.CDLL('libX11.so.6')
xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
x11.XDefaultRootWindow.restype = ctypes.c_ulong
x11.XQueryTree.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)), ctypes.POINTER(ctypes.c_uint)]
x11.XFetchName.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_char_p)]
x11.XFree.argtypes = [ctypes.c_void_p]
x11.XRaiseWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XSetInputFocus.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XKeysymToKeycode.restype = ctypes.c_uint
x11.XFlush.argtypes = [ctypes.c_void_p]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
if not display:
    raise RuntimeError('Native dialog smoke requires an X11 display')


def find(window):
    name = ctypes.c_char_p()
    x11.XFetchName(display, window, ctypes.byref(name))
    title = name.value.decode('utf-8', errors='replace') if name.value else ''
    if name:
        x11.XFree(name)
    if title == 'Select upload file':
        return window
    root, parent, children, count = ctypes.c_ulong(), ctypes.c_ulong(), ctypes.POINTER(ctypes.c_ulong)(), ctypes.c_uint()
    x11.XQueryTree(display, window, ctypes.byref(root), ctypes.byref(parent), ctypes.byref(children), ctypes.byref(count))
    found = 0
    for index in range(count.value):
        found = find(children[index])
        if found:
            break
    if children:
        x11.XFree(children)
    return found


def key(name, pressed):
    symbol = x11.XStringToKeysym(name.encode('ascii'))
    code = x11.XKeysymToKeycode(display, symbol)
    if not code:
        raise RuntimeError('Keyboard mapping missing')
    xtst.XTestFakeKeyEvent(display, code, int(pressed), 0)
    x11.XFlush(display)


def tap(name):
    key(name, True)
    key(name, False)


try:
    deadline = time.monotonic() + 10
    window = 0
    while not window and time.monotonic() < deadline:
        window = find(x11.XDefaultRootWindow(display))
        time.sleep(0.1)
    if not window:
        raise RuntimeError('Native upload chooser did not appear')
    x11.XRaiseWindow(display, window)
    x11.XSetInputFocus(display, window, 2, 0)
    x11.XFlush(display)
    time.sleep(0.2)
    if sys.argv[1] == 'cancel':
        tap('Escape')
    else:
        path = sys.argv[1]
        if any(char not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.-' for char in path):
            raise RuntimeError('Fixture path must use the supported ASCII keyboard mapping')
        key('Control_L', True)
        tap('l')
        key('Control_L', False)
        time.sleep(0.15)
        for char in path:
            if char.isupper():
                key('Shift_L', True)
            tap({'/': 'slash', '.': 'period', '-': 'minus'}.get(char, char.lower()))
            if char.isupper():
                key('Shift_L', False)
        tap('Return')
        time.sleep(0.3)
        tap('Return')
finally:
    x11.XCloseDisplay(display)
