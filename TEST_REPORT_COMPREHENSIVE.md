# LogikSense Comprehensive Endpoint Test Report

**Date/Time:** 2026-06-20T15:01:26.002Z
**API Target:** `http://localhost:8080`

## Summary
- **Total Tested Endpoints:** 39
- **Passed/Routed successfully:** 39
- **Failed/Network Errors:** 0

## Detailed Endpoint Test Results

| Test Name | Method | Endpoint | Status Code | Result |
|-----------|--------|----------|-------------|--------|
| API Health Check | `GET` | `/api/health` | `200` | ✅ PASS |
| Get Me Profile & Workspace | `GET` | `/api/auth/me` | `200` | ✅ PASS |
| Get User Profile details | `GET` | `/api/auth/profile` | `200` | ✅ PASS |
| Get Workspace Settings | `GET` | `/api/auth/settings` | `200` | ✅ PASS |
| List all workspaces | `GET` | `/api/workspaces` | `200` | ✅ PASS |
| List team members | `GET` | `/api/team/members` | `200` | ✅ PASS |
| List team invitations | `GET` | `/api/team/invites` | `200` | ✅ PASS |
| List leads | `GET` | `/api/leads` | `200` | ✅ PASS |
| Get leads stats | `GET` | `/api/leads/stats` | `200` | ✅ PASS |
| Get available standard fields | `GET` | `/api/leads/fields/available` | `200` | ✅ PASS |
| List lead segments | `GET` | `/api/leads/segments` | `200` | ✅ PASS |
| Get built-in segment (high-value) | `GET` | `/api/leads/segments/built-in/high-value` | `200` | ✅ PASS |
| Get built-in segment (at-risk) | `GET` | `/api/leads/segments/built-in/at-risk` | `200` | ✅ PASS |
| Get email analytics workspace summary | `GET` | `/api/leads/analytics/workspace/summary` | `200` | ✅ PASS |
| Get top campaigns analytic | `GET` | `/api/leads/analytics/campaigns/top` | `200` | ✅ PASS |
| Get most engaged leads | `GET` | `/api/leads/analytics/most-engaged` | `200` | ✅ PASS |
| Get pipeline board | `GET` | `/api/pipeline` | `200` | ✅ PASS |
| Get pipeline stage counts | `GET` | `/api/pipeline/stages` | `200` | ✅ PASS |
| Get pipeline replies | `GET` | `/api/pipeline/replies` | `200` | ✅ PASS |
| Get inbound token | `GET` | `/api/pipeline/inbound/token` | `200` | ✅ PASS |
| Get KPIs dashboard analytics | `GET` | `/api/analytics/dashboard` | `200` | ✅ PASS |
| Get top campaigns analytics list | `GET` | `/api/analytics/top-campaigns` | `200` | ✅ PASS |
| Get sends by day chart data | `GET` | `/api/analytics/sends-by-day` | `200` | ✅ PASS |
| List compliance requests | `GET` | `/api/compliance/requests` | `200` | ✅ PASS |
| List audit logs | `GET` | `/api/audit` | `200` | ✅ PASS |
| Get audit action counts | `GET` | `/api/audit/counts` | `200` | ✅ PASS |
| Get LinkedIn integration status | `GET` | `/api/linkedin/status` | `200` | ✅ PASS |
| List LinkedIn paired accounts | `GET` | `/api/linkedin/accounts` | `200` | ✅ PASS |
| List LinkedIn campaigns | `GET` | `/api/linkedin/campaigns` | `200` | ✅ PASS |
| Get Web Scraper status | `GET` | `/api/scraper/status` | `200` | ✅ PASS |
| List Scraper profiles | `GET` | `/api/scraper/profiles` | `200` | ✅ PASS |
| List Scraper jobs | `GET` | `/api/scraper/jobs` | `200` | ✅ PASS |
| List email templates | `GET` | `/api/marketing-email/templates` | `200` | ✅ PASS |
| List email campaigns | `GET` | `/api/marketing-email/campaigns` | `200` | ✅ PASS |
| List email sequences | `GET` | `/api/marketing-email/sequences` | `200` | ✅ PASS |
| List email configuration accounts | `GET` | `/api/email/configs` | `200` | ✅ PASS |
| Get AI config settings | `GET` | `/api/ai/settings` | `200` | ✅ PASS |
| Get AI usage summary | `GET` | `/api/ai/usage/summary` | `200` | ✅ PASS |
| Get AI recent requests | `GET` | `/api/ai/usage/recent` | `200` | ✅ PASS |
