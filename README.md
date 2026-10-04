# ClientFollow

> **Autonomous Revenue Recovery & Lead Follow-Up Engine** for high-ticket service businesses (dentists, agencies, photographers, lawyers, home services).

ClientFollow automatically detects incoming leads across channels (Gmail, WhatsApp, custom webhooks), classifies intent with AI, and runs durable multi-step follow-up cadences with human-in-the-loop approval safeguards to convert inquiries into booked appointments.

---

## Key Features

- **Multi-Channel Lead Ingestion**: Seamless integration with Gmail (OAuth2 + Google Cloud Pub/Sub), Meta WhatsApp Business Cloud API, and generic JSON Inbound Webhooks.
- **AI Intent Classification**: Automatic extraction of intent, requested service, urgency, and sentiment via OpenAI or local LLMs (Ollama / LM Studio).
- **Durable Sequence Engine**: Powered by [Inngest](https://www.inngest.com/) for reliable multi-day follow-up cadences that pause for approval and automatically cancel on lead reply or booking.
- **Human-in-the-Loop Approvals**: Review, edit, approve, or reject follow-up drafts — LLM-drafted when an `OPENAI_API_KEY` is configured, otherwise curated vertical templates — before dispatch.
- **NIST SP 800-57 & FIPS 140-3 Encryption**: OAuth tokens and lead snippets are encrypted using AWS KMS envelope encryption (AES-256-GCM with tenant-bound AAD).
- **Multi-Tenant Architecture**: Strict PostgreSQL Row Level Security (RLS) policies isolating tenant data per organization.
- **Stripe Billing Integration**: Tiered subscription management (Starter, Growth, Pro) with webhook-driven seat and lead quota provisioning.
- **Morning Pipeline Digest**: Daily automated summary of pending approvals, scheduled touches, and recovered bookings.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, Server Actions, React 19) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security) |
| **Workflows & Crons** | [Inngest](https://www.inngest.com/) |
| **Encryption** | [AWS KMS](https://aws.amazon.com/kms/) (AES-256-GCM Envelope Encryption) |
| **Payments** | [Stripe](https://stripe.com/) |
| **Testing** | [Vitest](https://vitest.dev/) (Unit and integration suites) |

---

## Getting Started

### 1. Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.18 or newer recommended)
- `npm` (or your preferred package manager)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/808THRONE/ClientFollow.git
cd ClientFollow
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure your keys:

```bash
cp .env.example .env.local
```

Key variables in `.env.local`:

```env
# App Core
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
SESSION_SECRET="your-at-least-32-characters-secure-random-session-secret"

# Supabase (Database & Authentication)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AWS KMS (Envelope Encryption)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
KMS_MASTER_KEY_ID="arn:aws:kms:us-east-1:123456789012:key/your-key-uuid"

# Inngest (Workflow Automation)
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"

# Meta WhatsApp Cloud API
WHATSAPP_API_TOKEN="your-whatsapp-token"
WHATSAPP_PHONE_NUMBER_ID="your-phone-id"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="your-verify-token"
WHATSAPP_APP_SECRET="your-app-secret"

# Stripe Billing
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

> **Note**: For local development and testing, built-in mock modes allow the application to boot and pass all test suites even before external production keys are provided.

### 4. Database Setup

Apply the SQL migrations located in `supabase/migrations/` to your Supabase project in order:
1. `001_initial_schema.sql` — Multi-tenant tables, indexes, and initial constraints.
2. `002_seed_playbooks.sql` — Default industry playbooks.
3. `003_rls_and_settings.sql` — Row-Level Security policies and notification settings.

### 5. Running the Application

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To run the local Inngest development server alongside Next.js:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server at `localhost:3000` |
| `npm run build` | Compiles an optimized production build |
| `npm run start` | Starts the Next.js production server |
| `npm test` | Runs the Vitest test suite |
| `npm run test:watch` | Runs Vitest in watch mode |
| `npm run test:coverage` | Runs Vitest with code coverage report |

---

## Security & Architecture

- **Defense in Depth**: Zero hardcoded secrets; validated startup configuration via `src/lib/env.ts`.
- **Tenant Isolation**: Every database interaction is scoped to the tenant `org_id` with Postgres RLS enforcement.
- **Webhook Integrity**:
  - Stripe webhooks enforce cryptographic signatures (`stripe-signature`).
  - WhatsApp webhooks enforce HMAC-SHA256 signature verification (`x-hub-signature-256`).
- **Encrypted Integrations**: Third-party OAuth tokens are encrypted before storage and only decrypted in-memory during outbound API dispatch.

---

## License

Distributed under the [MIT License](LICENSE). See `LICENSE` for more information.
