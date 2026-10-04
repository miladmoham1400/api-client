HTTP fixtures bind only to loopback and use synthetic data. `tls-test-only.key` and
`tls-test-only.crt` are a public, self-signed test pair, generated with OpenSSL for
localhost/127.0.0.1. They establish rejection of untrusted certificates and must
never be used by a deployed service or as application credentials.
