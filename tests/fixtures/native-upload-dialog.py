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
x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
if not display:
    raise RuntimeError('Native dialog smoke requires an X11 display')


class KeyboardState(ctypes.Structure):
    _fields_ = [('group', ctypes.c_ubyte), ('locked_group', ctypes.c_ubyte),
                ('base_group', ctypes.c_ushort), ('latched_group', ctypes.c_ushort),
                ('mods', ctypes.c_ubyte), ('base_mods', ctypes.c_ubyte),
                ('latched_mods', ctypes.c_ubyte), ('locked_mods', ctypes.c_ubyte),
                ('compat_state', ctypes.c_ubyte), ('grab_mods', ctypes.c_ubyte),
                ('compat_grab_mods', ctypes.c_ubyte), ('lookup_mods', ctypes.c_ubyte),
                ('compat_lookup_mods', ctypes.c_ubyte), ('ptr_buttons', ctypes.c_ushort)]

x11.XkbGetState.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.POINTER(KeyboardState)]
x11.XkbLockGroup.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint]
keyboard_state = KeyboardState()
x11.XkbGetState(display, 0x100, ctypes.byref(keyboard_state))


def find(window):
    name = ctypes.c_char_p()
    x11.XFetchName(display, window, ctypes.byref(name))
    title = name.value.decode('utf-8', errors='replace') if name.value else ''
    if name:
        x11.XFree(name)
    if title == (sys.argv[2] if len(sys.argv) > 2 else 'Select upload file'):
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
    x11.XkbLockGroup(display, 0x100, 0)
    x11.XFlush(display)
    symbol = x11.XStringToKeysym(name.encode('ascii'))
    code = x11.XKeysymToKeycode(display, symbol)
    if not code:
        raise RuntimeError('Keyboard mapping missing')
    xtst.XTestFakeKeyEvent(display, code, int(pressed), 0)
    x11.XSync(display, 0)
    time.sleep(0.01)


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
        # Fixture paths use Latin keys; restore the user's group in finally.
        x11.XkbLockGroup(display, 0x100, 0)
        x11.XFlush(display)
        path = sys.argv[1]
        if any(char not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.-' for char in path):
            raise RuntimeError('Fixture path must use the supported ASCII keyboard mapping')
        save_dialog = len(sys.argv) > 2 and sys.argv[2] == 'Export workspace JSON'
        def type_text(value):
            for char in value:
                if char.isupper():
                    key('Shift_L', True)
                tap({'/': 'slash', '.': 'period', '-': 'minus'}.get(char, char.lower()))
                if char.isupper():
                    key('Shift_L', False)
        if save_dialog:
            key('Control_L', True)
            tap('l')
            key('Control_L', False)
        else:
            # GTK opens its location entry for an absolute path with slash.
            tap('slash')
        time.sleep(0.3)
        key('Control_L', True)
        tap('a')
        key('Control_L', False)
        type_text(path)
        # GTK location completion is asynchronous. Retry confirmation only while this chooser is visible.
        time.sleep(0.2)
        for _ in range(12):
            if not find(x11.XDefaultRootWindow(display)):
                break
            x11.XSetInputFocus(display, window, 2, 0)
            if save_dialog:
                key('Alt_L', True)
                tap('s')
                key('Alt_L', False)
            else:
                tap('Return')
            time.sleep(0.4)
        else:
            raise RuntimeError('Native chooser did not accept the fixture location')
finally:
    x11.XkbLockGroup(display, 0x100, keyboard_state.locked_group)
    x11.XFlush(display)
    x11.XCloseDisplay(display)
