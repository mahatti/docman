#!/bin/bash
set -e
echo "health:"
curl -sS -m 5 http://host.docker.internal:5000/api/health
echo
echo "callback:"
curl -sS -m 8 -X POST \
  -H "Content-Type: application/json" \
  -d '{"status":1,"key":"probe-from-oo"}' \
  http://host.docker.internal:5000/api/documents/33/onlyoffice/callback
echo
echo "content head:"
curl -sS -m 8 -o /tmp/docman-probe.docx -w "code=%{http_code} size=%{size_download}\n" \
  http://host.docker.internal:5000/api/documents/33/onlyoffice/content
