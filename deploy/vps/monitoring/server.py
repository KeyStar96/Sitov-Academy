"""Single-threaded, read-only status viewer; Nginx owns authentication."""
import html
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from common import read_status

DATA = Path('/data')


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ('/', '/status.json', '/history.json', '/health'):
            self.send_error(404)
            return
        status = read_status(DATA / 'status.json')
        code = 503 if self.path == '/health' and any(a.startswith('collector_') for a in status['alarms']) else 200
        mime = 'application/json; charset=utf-8'
        if self.path == '/':
            mime = 'text/html; charset=utf-8'
            alarms = ', '.join(status['alarms']) or 'Keine Alarme'
            body = '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="60"><title>Sitov Status</title><style>body{max-width:900px;margin:3rem auto;padding:0 1rem;background:#f8fafc;color:#0f172a;font:18px/1.6 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;padding:1rem;background:#e2e8f0}a{color:#075985}</style><h1>Sitov Status</h1><p>' + html.escape(alarms) + '</p><p>Messintervall: 60 Sekunden · Verlauf: maximal 24 Stunden</p><pre>' + html.escape(json.dumps(status, ensure_ascii=False, indent=2)) + '</pre><p><a href="history.json">Messverlauf (JSON)</a></p></html>'
        elif self.path == '/history.json':
            try:
                body = (DATA / 'history.json').read_text()
            except OSError:
                body = '[]'
        else:
            body = json.dumps(status, ensure_ascii=False)
        encoded = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args):
        pass


class Server(HTTPServer):
    def get_request(self):
        socket, address = super().get_request()
        socket.settimeout(5)
        return socket, address


if __name__ == '__main__':
    server = Server(('0.0.0.0', 8080), Handler)
    server.socket.settimeout(5)
    server.serve_forever()
