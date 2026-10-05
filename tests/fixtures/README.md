HTTP fixtures bind only to loopback and use synthetic data. `tls-test-only.key` and
`tls-test-only.crt` are a public, self-signed test pair, generated with OpenSSL for
localhost/127.0.0.1. They establish rejection of untrusted certificates and must
never be used by a deployed service or as application credentials.

`native-upload-dialog.py` is Linux X11 smoke-test automation only. It uses Python 3
and system libX11/libXtst to find the chooser titled “Select upload file”, enter a
temporary fixture path or press Escape. It is not shipped or used by the application.
The desktop test skips this platform-specific check outside Linux/X11; a skip is
not Windows or Wayland acceptance evidence. GTK location entry needs two Return
confirmations: select the typed file, then accept the chooser.
