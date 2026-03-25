#!/bin/bash
# Pings the Supabase XingLian AI project to prevent auto-pausing
curl -s -o /dev/null -w "%{http_code}" \
  'https://kcdaaavcnvbzzzvceenb.supabase.co/rest/v1/' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjZGFhYXZjbnZienp6dmNlZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTQxNzMsImV4cCI6MjA4ODY5MDE3M30.aOk7Ck3kXj6j0_uexLUc6-ZSPX1tXtqFnCldlVMbGX4" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjZGFhYXZjbnZienp6dmNlZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTQxNzMsImV4cCI6MjA4ODY5MDE3M30.aOk7Ck3kXj6j0_uexLUc6-ZSPX1tXtqFnCldlVMbGX4"
echo " - $(date)" >> /Users/jingjingyang/Desktop/projects/xinglian-ai/keepalive.log
