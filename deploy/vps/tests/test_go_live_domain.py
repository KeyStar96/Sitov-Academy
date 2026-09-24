#!/usr/bin/env python3
"""Domain go-live tests; pure functions only, no production access or subprocesses."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'go-live-domain.py'
SPEC = importlib.util.spec_from_file_location('sitov_go_live_domain', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

APP_ENV = '''NODE_ENV=production
NEXT_PUBLIC_SITE_URL="https://217.154.228.254"
SITE_URL="https://217.154.228.254"
NEXT_PUBLIC_SUPABASE_URL="https://217.154.228.254/supabase"
NEXT_PUBLIC_SUPABASE_ANON_KEY="secret-anon"
TRUSTED_PROXY_HOPS=1
CANONICAL_SITE_URL="https://www.sitov-academy.com"
'''
COMPOSE = '''services:
  supabase-kong:
    environment:
    - API_EXTERNAL_URL=http://supabase-kong:8000
    mem_limit: 192m
  supabase-auth:
    image: supabase/gotrue:v2.186.0
    environment:
    - GOTRUE_API_HOST=0.0.0.0
    - API_EXTERNAL_URL=https://217.154.228.254/supabase
    - GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${SERVICE_PASSWORD_POSTGRES}@db/postgres
    - GOTRUE_SITE_URL=https://217.154.228.254
    - GOTRUE_URI_ALLOW_LIST=https://217.154.228.254/**
    container_name: supabase-auth-eknmzxvqilojjicinatnllbt
    mem_limit: 256m
    memswap_limit: 268435456
  realtime-dev:
    environment:
    - GOTRUE_SITE_URL=untouched
'''


class GoLiveDomainTest(unittest.TestCase):
    def test_env_switches_only_the_three_origins(self):
        patched = MODULE.patch_env(APP_ENV, MODULE.APP_VALUES)
        self.assertIn('NEXT_PUBLIC_SITE_URL="https://www.sitov-academy.com"\n', patched)
        self.assertIn('SITE_URL="https://www.sitov-academy.com"\n', patched)
        self.assertIn('NEXT_PUBLIC_SUPABASE_URL="https://www.sitov-academy.com/supabase"\n', patched)
        untouched = [line for line in APP_ENV.splitlines() if not line.startswith(tuple(MODULE.APP_VALUES))]
        self.assertEqual([line for line in patched.splitlines() if not line.startswith(tuple(MODULE.APP_VALUES))], untouched)
        self.assertEqual(MODULE.patch_env(patched, MODULE.APP_VALUES), patched)

    def test_env_with_missing_or_duplicate_key_aborts(self):
        for broken in (APP_ENV.replace('SITE_URL="https://217.154.228.254"\n', '', 1),
                       APP_ENV + 'SITE_URL="https://evil.example"\n'):
            with self.assertRaises(RuntimeError):
                MODULE.patch_env(broken, MODULE.APP_VALUES)

    def test_auth_block_only(self):
        patched = MODULE.patch_auth(COMPOSE, MODULE.AUTH_VALUES)
        self.assertIn('    - API_EXTERNAL_URL=https://www.sitov-academy.com/supabase\n', patched)
        self.assertIn('    - GOTRUE_SITE_URL=https://www.sitov-academy.com\n', patched)
        self.assertIn('    - GOTRUE_URI_ALLOW_LIST=https://www.sitov-academy.com/**,https://217.154.228.254/**\n', patched)
        self.assertIn('    - API_EXTERNAL_URL=http://supabase-kong:8000\n', patched)
        self.assertIn('    - GOTRUE_SITE_URL=untouched\n', patched)
        self.assertIn('${SERVICE_PASSWORD_POSTGRES}', patched)
        self.assertEqual(len(patched.splitlines()), len(COMPOSE.splitlines()))

    def test_auth_without_pinned_swap_aborts(self):
        with self.assertRaisesRegex(RuntimeError, 'memswap_limit'):
            MODULE.patch_auth(COMPOSE.replace('    memswap_limit: 268435456\n', ''), MODULE.AUTH_VALUES)

    def test_auth_with_duplicate_key_aborts(self):
        duplicate = COMPOSE.replace('    container_name:', '    - GOTRUE_SITE_URL=https://other\n    container_name:')
        with self.assertRaises(RuntimeError):
            MODULE.patch_auth(duplicate, MODULE.AUTH_VALUES)

    def test_dns_must_point_here_everywhere(self):
        here = {(name, resolver, 'A'): [MODULE.IP] for name in (MODULE.APEX, MODULE.WWW) for resolver in MODULE.RESOLVERS}
        here.update({(name, resolver, 'AAAA'): [] for name in (MODULE.APEX, MODULE.WWW) for resolver in MODULE.RESOLVERS})
        self.assertEqual(MODULE.dns_problems(here), [])
        netlify = {**here, (MODULE.WWW, '8.8.8.8', 'A'): ['75.2.60.5']}
        self.assertEqual(len(MODULE.dns_problems(netlify)), 1)
        mixed = {**here, (MODULE.APEX, '1.1.1.1', 'A'): [MODULE.IP, '75.2.60.5']}
        self.assertEqual(len(MODULE.dns_problems(mixed)), 1)
        foreign_ipv6 = {**here, (MODULE.APEX, '1.1.1.1', 'AAAA'): ['2001:db8::1']}
        self.assertIn('AAAA', MODULE.dns_problems(foreign_ipv6)[0])
        own_ipv6 = {**here, (MODULE.APEX, '1.1.1.1', 'AAAA'): [MODULE.IPV6]}
        self.assertEqual(MODULE.dns_problems(own_ipv6), [])

    def test_dns_lag_is_acceptable_only_once_published_everywhere_by_name(self):
        here = {(name, resolver, 'A'): [MODULE.IP] for name in (MODULE.APEX, MODULE.WWW) for resolver in ('a', 'b')}
        here.update({(name, resolver, 'AAAA'): [] for name in (MODULE.APEX, MODULE.WWW) for resolver in ('a', 'b')})
        self.assertTrue(MODULE.dns_published({**here, (MODULE.WWW, 'b', 'A'): ['75.2.60.5']}))
        self.assertFalse(MODULE.dns_published({**here, (MODULE.WWW, 'a', 'A'): ['75.2.60.5'], (MODULE.WWW, 'b', 'A'): ['75.2.60.5']}))
        self.assertFalse(MODULE.dns_published({**here, (MODULE.APEX, 'a', 'AAAA'): ['2001:db8::1']}))

    def test_traefik_routes_cover_both_names_with_one_redirect(self):
        try:
            import yaml
        except ImportError:
            self.skipTest('PyYAML not installed')
        config = yaml.safe_load(MODULE.TRAEFIK_SOURCE.read_text())['http']
        routers = config['routers']
        self.assertEqual(routers['sitov-www-https']['middlewares'], ['sitov-security', 'sitov-domain-headers'])
        self.assertEqual(routers['sitov-apex-https']['middlewares'], ['sitov-apex-to-www'])
        self.assertEqual(routers['sitov-apex-http']['middlewares'], ['sitov-apex-to-www'])
        for name in ('sitov-www-https', 'sitov-apex-https'):
            self.assertEqual(routers[name]['tls']['certResolver'], 'letsencrypt')
        import re
        redirect = config['middlewares']['sitov-apex-to-www']['redirectRegex']
        for url in ('http://sitov-academy.com/de/agb?x=1', 'https://sitov-academy.com/de/agb?x=1'):
            self.assertEqual(re.sub(redirect['regex'], redirect['replacement'].replace('${1}', r'\1'), url),
                             'https://www.sitov-academy.com/de/agb?x=1')


if __name__ == '__main__':
    unittest.main()
