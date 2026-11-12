"""Run the existing AI Gateway routes without exposing the legacy API surface."""

from http.server import ThreadingHTTPServer
from urllib.parse import urlparse

from fema_proxy_server import HOST, PORT, Handler


class AIGatewayHandler(Handler):
    def _not_found(self) -> None:
        self.send_response(404)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health" or path.startswith("/ai/"):
            super().do_GET()
        else:
            self._not_found()

    def do_POST(self) -> None:
        if urlparse(self.path).path.startswith("/ai/"):
            super().do_POST()
        else:
            self._not_found()

    def do_OPTIONS(self) -> None:
        if urlparse(self.path).path.startswith("/ai/"):
            super().do_OPTIONS()
        else:
            self._not_found()


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), AIGatewayHandler)
    print(f"AI Gateway running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
