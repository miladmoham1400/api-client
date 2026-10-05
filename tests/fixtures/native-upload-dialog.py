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
class Attributes(ctypes.Structure):
    _fields_ = [(name, kind) for name, kind in [
        ('x', ctypes.c_int), ('y', ctypes.c_int), ('width', ctypes.c_int), ('height', ctypes.c_int),
        ('border_width', ctypes.c_int), ('depth', ctypes.c_int), ('visual', ctypes.c_void_p),
        ('root', ctypes.c_ulong), ('window_class', ctypes.c_int), ('bit_gravity', ctypes.c_int),
        ('win_gravity', ctypes.c_int), ('backing_store', ctypes.c_int), ('backing_planes', ctypes.c_ulong),
        ('backing_pixel', ctypes.c_ulong), ('save_under', ctypes.c_int), ('colormap', ctypes.c_ulong),
        ('map_installed', ctypes.c_int), ('map_state', ctypes.c_int), ('all_event_masks', ctypes.c_long),
        ('your_event_mask', ctypes.c_long), ('do_not_propagate_mask', ctypes.c_long),
        ('override_redirect', ctypes.c_int), ('screen', ctypes.c_void_p)
    ]]

x11.XGetWindowAttributes.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(Attributes)]
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
        attributes = Attributes()
        x11.XGetWindowAttributes(display, window, ctypes.byref(attributes))
        if attributes.map_state == 2:
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
        # GTK location completion is asynchronous. Retry confirmation only while this chooser is visible.
        time.sleep(0.2)
        for _ in range(12):
            if not find(x11.XDefaultRootWindow(display)):
                break
            x11.XSetInputFocus(display, window, 2, 0)
            tap('Return')
            time.sleep(0.4)
        else:
            raise RuntimeError('Native chooser did not accept the fixture location')
finally:
    x11.XCloseDisplay(display)
