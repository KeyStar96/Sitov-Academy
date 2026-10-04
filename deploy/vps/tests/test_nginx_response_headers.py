"""Response-header capacity without enabling buffering for streamed app bodies."""
from pathlib import Path
import re
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'nginx.conf'


class NginxResponseHeaderTests(unittest.TestCase):
    def app_location(self):
        source = SOURCE.read_text()
        return source.split('    location / {', 1)[1].split('\n    }', 1)[0]

    def test_app_header_capacity_and_body_streaming(self):
        location = self.app_location()
        self.assertIn('proxy_buffer_size 32k;', location)
        self.assertIn('proxy_buffering off;', location)
        self.assertIn('include /etc/nginx/snippets/sitov-trusted-proxy.conf;', location)
        self.assertIn('proxy_set_header Host $host;', location)

    def test_buffer_sizes_satisfy_nginx_configuration_constraints(self):
        location = self.app_location()
        header = int(re.search(r'proxy_buffer_size (\d+)k;', location).group(1))
        count, size = map(int, re.search(r'proxy_buffers (\d+) (\d+)k;', location).groups())
        busy = int(re.search(r'proxy_busy_buffers_size (\d+)k;', location).group(1))
        self.assertGreaterEqual(count, 2)
        self.assertGreaterEqual(busy, max(header, size))
        self.assertLessEqual(busy, (count - 1) * size)

    def test_header_change_is_scoped_to_next_app_not_media_proxy(self):
        source = SOURCE.read_text()
        media = source.split('    location /supabase/ {', 1)[1].split('\n    }', 1)[0]
        self.assertNotIn('proxy_buffer_size', media)
        self.assertIn('proxy_request_buffering off;', media)
        self.assertIn('proxy_buffering off;', media)


if __name__ == '__main__':
    unittest.main()
