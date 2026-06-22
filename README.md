# Court Control AI 🎾

Court Control AI is an elite, multi-tenant sports management platform designed to automate tournament logistics using Generative AI.

## Key Features
- **AI Tournament Director**: Automated match scheduling with Genkit AI, optimizing for venue efficiency and player recovery.
- **Live Arena Hub**: Real-time scoring broadcast for stadium screens and mobile guests.
- **Multi-Venue Management**: Coordinate multiple physical locations and dozens of courts from a single console.
- **Player Circuit**: Integrated player profiles, club rankings, and automated QR check-ins.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Database/Auth**: Firebase (Firestore, Auth, App Hosting)
- **AI**: Google Genkit + Gemini 2.5
- **UI**: Shadcn/UI, Tailwind CSS, Lucide Icons

## Getting Started

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your Firebase credentials and AI API keys.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Development Commands
- `npm run dev`: Start Next.js development server.
- `npm run lint`: Run ESLint checks.
- `npm run typecheck`: Run TypeScript compiler check.
- `npm test`: Run unit tests with Vitest.
- `npm run format`: Format code with Prettier.

## Deployment
This project is optimized for **Firebase App Hosting**. 
Pushes to the `main` branch will trigger the CI/CD pipeline via GitHub Actions.

---
© 2024 Court Control AI. The infrastructure for professional sports.
