#!/bin/bash
# Run this ON THE SERVER (ssh root@89.167.31.206) AFTER DNS for files2convert.com points to 89.167.31.206
# Replace admin@files2convert.com with your email for Let's Encrypt expiry notices
set -e
certbot --nginx -d files2convert.com -d www.files2convert.com --non-interactive --agree-tos -m admin@files2convert.com
echo "SSL installed. Restart app: cd /opt/image-converter-fe && docker compose up -d"
