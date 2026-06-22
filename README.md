# Court Control AI 🎾

Court Control AI is an elite, multi-tenant sports management platform designed to automate tournament logistics using Generative AI.

## Key Features
- **AI Tournament Director**: Automated match scheduling with Genkit AI, optimizing for venue efficiency and player recovery.
- **Live Arena Hub**: Real-time scoring broadcast for stadium screens and mobile guests.
- **Multi-Venue Management**: Coordinate multiple physical locations and dozens of courts from a single console.
- **Player Circuit**: Integrated player profiles, club rankings, and automated QR check-ins.

## CLI Commands

### Development
- `npm run dev`: Start Next.js development server on port 9002.
- `npm run genkit:dev`: Start Genkit Developer UI for flow testing.

### Quality Assurance
- `npm run lint`: Run ESLint static analysis.
- `npm run typecheck`: Run TypeScript compiler validation.
- `npm test`: Run logic and component unit tests via Vitest.

### Production
- `npm run build`: Create an optimized production build for Firebase App Hosting.
- `npm start`: Start the production server.

## Deployment
This project is optimized for **Firebase App Hosting**. 
Pushes to the `main` branch will trigger the CI/CD pipeline via GitHub Actions.

---
© 2024 Court Control AI. The infrastructure for professional sports.