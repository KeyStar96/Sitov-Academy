#!/usr/bin/env python3
"""Run as root on the backed-up Sitov VPS; never prints service secrets."""
import os
import subprocess
from pathlib import Path
import yaml

root=Path('/data/coolify/services/eknmzxvqilojjicinatnllbt')
compose=root/'docker-compose.yml'
config=yaml.safe_load(compose.read_text())
services=config['services']
def env_set(service, updates):
    old=services[service].get('environment', {})
    values=dict(item.split('=',1) if '=' in item else (item,'') for item in old) if isinstance(old,list) else old
    values.update(updates)
    services[service]['environment']=[f'{k}={v}' for k,v in values.items()]

env_set('supabase-auth',{
 'API_EXTERNAL_URL':'https://217.154.228.254/supabase',
 'GOTRUE_SITE_URL':'https://217.154.228.254',
 'GOTRUE_URI_ALLOW_LIST':'https://217.154.228.254/**',
 'GOTRUE_MAILER_AUTOCONFIRM':'false',
 'GOTRUE_SMTP_HOST':'host.docker.internal', 'GOTRUE_SMTP_PORT':'2525',
 'GOTRUE_SMTP_USER':'', 'GOTRUE_SMTP_PASS':'',
 'GOTRUE_SMTP_ADMIN_EMAIL':'info@sitov-academy.com',
 'GOTRUE_SMTP_SENDER_NAME':'Sitov Academy',
 'GOTRUE_MAILER_TEMPLATES_CONFIRMATION':'http://host.docker.internal:8088/mail-templates/confirmation.html',
 'GOTRUE_MAILER_TEMPLATES_RECOVERY':'http://host.docker.internal:8088/mail-templates/recovery.html',
 'GOTRUE_MAILER_TEMPLATES_INVITE':'http://host.docker.internal:8088/mail-templates/invite.html',
 'GOTRUE_MAILER_TEMPLATES_MAGIC_LINK':'http://host.docker.internal:8088/mail-templates/magic_link.html',
 'GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE':'http://host.docker.internal:8088/mail-templates/email_change.html',
})
services['supabase-auth']['extra_hosts']=['host.docker.internal:host-gateway']
services['supabase-kong']['ports']=['127.0.0.1:9080:8000']
services['supabase-db']['ports']=['127.0.0.1:5432:5432']
services['supabase-db']['command']=['postgres','-c','config_file=/etc/postgresql/postgresql.conf','-c','log_min_messages=warning','-c','shared_buffers=512MB','-c','effective_cache_size=3GB','-c','work_mem=8MB','-c','maintenance_work_mem=128MB','-c','max_connections=100']
# Keep V8/BEAM overhead inside the reduced cgroups. Scheduler counts must not
# follow the host's CPU count independently in every Erlang service.
env_set('supabase-studio', {'NODE_OPTIONS':'--max-old-space-size=128'})
env_set('supabase-meta', {'NODE_OPTIONS':'--max-old-space-size=128'})
for service in ('supabase-analytics','realtime-dev','supabase-supavisor'):
    env_set(service, {'ERL_AFLAGS':'+S 2:2 +SDcpu 1 +SDio 1'})
# Caps bound exceptional load; they do not reserve memory.
# Analytics needs 640 MiB for reliable startup; unused edge-functions lends 128.
# Supabase 5632 MiB + Next.js 2048 MiB + monitoring allowance 128 = 7808 MiB.
# This tranche excludes unchanged host/Coolify/TTS/mail processes; the Phase-4
# report includes their measured use. Validate host MemAvailable under load.

limits={'supabase-db':('1728m',2),'supabase-analytics':('640m',0.75),
 'supabase-studio':('192m',0.5),'supabase-vector':('128m',0.25),
 'supabase-kong':('512m',1),'supabase-meta':('256m',0.5),
 'supabase-auth':('256m',0.5),'supabase-rest':('192m',1),
 'realtime-dev':('256m',0.75),'supabase-minio':('512m',1),
 'supabase-storage':('384m',1),'imgproxy':('192m',0.5),
 'supabase-supavisor':('256m',0.5),'supabase-edge-functions':('128m',0.5)}
for name,(memory,cpu) in limits.items():
    if name in services:
        services[name]['mem_limit']=memory; services[name]['cpus']=cpu
compose.write_text(yaml.safe_dump(config,sort_keys=False))
os.chmod(compose,0o600)

# SMTP relay exists only on the Docker host bridge. Public SMTP keeps its
# existing authentication/TLS policy; only the app network can use this listener.
master=Path('/etc/postfix/master.cf')
text=master.read_text(); marker='# Sitov Docker Auth SMTP\n'
if marker in text: text=text.split(marker)[0].rstrip()+'\n'
text+='\n'+marker+'''10.0.0.1:2525 inet n - y - - smtpd
  -o syslog_name=postfix/sitov-auth
  -o smtpd_tls_security_level=none
  -o mynetworks=127.0.0.0/8,10.0.2.0/24
  -o smtpd_relay_restrictions=permit_mynetworks,reject
  -o smtpd_recipient_restrictions=permit_mynetworks,reject
'''
master.write_text(text)
subprocess.run(['postfix','check'],check=True)
subprocess.run(['systemctl','reload','postfix'],check=True)
print('Local Supabase ports, Auth mail settings and resource limits configured.')
