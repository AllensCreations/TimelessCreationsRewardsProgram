# Timeless Creations Rewards Program (TCRP)

![TCRP Test Suite](https://github.com/TimelessCreationsRP/TimelessCreationsRewardsProgram/actions/workflows/test.yml/badge.svg)
[![Vercel Deployment](https://img.shields.io/badge/vercel-deployed-success?logo=vercel)](https://vercel.com)
[![Turso Database](https://img.shields.io/badge/turso-sqlite-blue?logo=sqlite)](https://turso.tech)

Command center, Messenger bot engagement engine, and automated 18/24-month spiritual curriculum drip system for LDS missionaries across the Philippines.

---

### Key Features
* **Automated Monthly Drip Engine:** Dispatches personalized monthly encouragement letters (up to 24 months for elders, 18 for sisters) via Brevo REST API v3.
* **Oldest-to-Newest Priority Queue:** Intelligently sorts dispatches to ensure missionaries waiting the longest are served first.
* **Vercel Hobby Optimized:** Processes safe, throttled batches (15 Elders & 15 Sisters per run) to stay well within 10-second serverless timeout limits and daily free-tier quotas.
* **Messenger Integration:** Fully interactive bot state machine handling verification codes, point ledger updates, and reward catalog claims.
* **Strict Cache-First Architecture:** Eliminates unnecessary Turso database read quotas by caching operational state locally and syncing via a Global Refresh trigger.
