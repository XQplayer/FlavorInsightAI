"""Opt-in hosted PCA API. No production deployment is configured by this file."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
from urllib.parse import urlsplit

from services.ai_gateway import AIGateway, GatewayError
from services.analysis.hosted import HostedPca, HostedPcaError, SupabasePcaStore
from services.analysis.server import AnalysisService


JOB_PATH = re.compile(r'^/jobs/([0-9a-f-]{36})$')


def create_server(hosted, gateway, port=10000, host='127.0.0.1'):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'FlavorPCA/1.0'

        def log_message(self, *_args):
            pass  # Never log JWTs, raw matrices or paths.

        def respond(self, status, body):
            encoded = json.dumps(body, ensure_ascii=False, allow_nan=False).encode('utf-8')
            self.send_response(status)
            origin = self.headers.get('Origin')
            if origin and origin in gateway.allowed_origins:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def principal(self):
            if len(self.headers.get_all('Authorization', [])) != 1 or not self.headers.get('Authorization', '').startswith('Bearer '):
                raise HostedPcaError('AUTH_REQUIRED', 401)
            if len(self.headers.get_all('Origin', [])) > 1:
                raise HostedPcaError('ORIGIN_DENIED', 403)
            return gateway.principal(self.headers['Authorization'], '', self.client_address[0], self.headers.get('Origin', ''))

        def body(self):
            if self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length', [])) != 1:
                raise HostedPcaError('INVALID_BODY')
            try:
                length = int(self.headers['Content-Length'])
            except (TypeError, ValueError):
                raise HostedPcaError('INVALID_BODY') from None
            if length <= 0 or length > 1_100_000:
                raise HostedPcaError('PAYLOAD_LIMIT', 413)
            if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
                raise HostedPcaError('INVALID_BODY')
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise HostedPcaError('INVALID_BODY')
            try:
                return json.loads(raw, parse_constant=lambda _value: (_ for _ in ()).throw(ValueError()))
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError, RecursionError):
                raise HostedPcaError('INVALID_BODY') from None

        def dispatch(self):
            try:
                if self.path == '/health' and self.command == 'GET':
                    ready = bool(hosted and hosted.broker.capabilities.get('runtimeReady'))
                    self.respond(200 if ready else 503, {
                        'status': 'ready' if ready else 'unavailable',
                        'capabilities': {'runtimeReady': ready, 'methods': ['pca'] if ready else []},
                        'limits': {'maxRequestBytes': 1_048_576, 'maxResultBytes': 2_097_152,
                                   'maxSamples': 1000, 'maxFeatures': 200, 'timeoutSeconds': 120},
                        'persistence': 'owner-scoped Supabase table' if ready else 'unavailable',
                    })
                    return
                if hosted is None:
                    raise HostedPcaError('PCA_DISABLED', 503)
                principal = self.principal()
                match = JOB_PATH.fullmatch(self.path)
                if self.command == 'POST' and self.path == '/jobs':
                    self.respond(202, hosted.submit(principal, self.body()))
                elif self.command == 'GET' and match:
                    job = hosted.get(principal, match[1])
                    self.respond(200 if job else 404, job or {'error': {'code': 'NOT_FOUND'}})
                elif self.command == 'DELETE' and match:
                    self.respond(200, hosted.cancel(principal, match[1]))
                else:
                    raise HostedPcaError('NOT_FOUND', 404)
            except (HostedPcaError, GatewayError) as exc:
                self.respond(exc.status, {'error': {'code': exc.code}})
            except (TypeError, ValueError, OSError):
                self.respond(500, {'error': {'code': 'SERVER_ERROR'}})

        do_GET = dispatch
        do_POST = dispatch
        do_DELETE = dispatch

        def do_OPTIONS(self):
            origin = self.headers.get('Origin')
            if len(self.headers.get_all('Origin', [])) != 1 or origin not in gateway.allowed_origins:
                self.respond(403, {'error': {'code': 'ORIGIN_DENIED'}})
                return
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Max-Age', '600')
            self.send_header('Content-Length', '0')
            self.end_headers()

    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    return server


def main():
    enabled = os.environ.get('FLAVOR_AI_PCA_ENABLED', 'false').lower() == 'true'
    gateway = AIGateway(mode='disabled')
    hosted = broker = None
    if enabled:
        if os.environ.get('FLAVOR_AI_PCA_SINGLE_INSTANCE', '').lower() != 'true':
            raise SystemExit('PCA requires an explicitly configured single instance')
        supabase_url = os.environ.get('FLAVOR_AI_SUPABASE_URL', '').rstrip('/')
        expected_ref = os.environ.get('FLAVOR_AI_PCA_PROJECT_REF', '')
        actual_ref = (urlsplit(supabase_url).hostname or '').split('.')[0]
        if not expected_ref or actual_ref != expected_ref:
            raise SystemExit('PCA project identity mismatch')
        store = SupabasePcaStore(supabase_url, os.environ.get('FLAVOR_AI_SUPABASE_ANON_KEY', ''),
                                os.environ.get('FLAVOR_AI_PCA_SUPABASE_SECRET_KEY', ''))
        broker = AnalysisService(rscript=os.environ.get('ANALYSIS_RSCRIPT', '/usr/bin/Rscript'),
                                 max_running=1, max_queued=4, timeout=120, max_history=32)
        hosted = HostedPca(store, broker)
    port = int(os.environ.get('PORT', '10000'))
    server = create_server(hosted, gateway, port=port, host='0.0.0.0')
    try:
        server.serve_forever()
    finally:
        server.server_close()
        if broker:
            broker.close()


if __name__ == '__main__':
    main()
