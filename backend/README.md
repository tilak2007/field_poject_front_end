# FieldAssist Backend Foundation

Build the backend foundation for FieldAssist, a Field Sales Management SaaS application.

Important context:
- The frontend has already been developed separately using Google Antigravity on another laptop.
- Do not build or redesign any frontend pages.
- This project is for backend development only.
- The backend will eventually connect to the existing React, TypeScript and Vite frontend through APIs.

Requirements:
1. Use Lovable Cloud if available and suitable, or use a supported Supabase integration.
2. Use PostgreSQL as the intended relational database.
3. Prepare a backend structure that can support sales representatives, retailers, distributors, products, inventory, orders, beat plans, visits, attendance, targets and reports.
4. Keep the architecture secure and maintainable.
5. Do not create all database tables yet.
6. Do not implement authentication or business APIs yet.
7. Do not invent a frontend or create mock pages.
8. Do not expose secrets or privileged database credentials in client-side code.
9. Report what was successfully configured and identify any manual setup required.

Stop after establishing the backend foundation. Wait for confirmation before proceeding to database setup.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cea60885-2a63-4a84-9f58-7dad4c9cdc88).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
