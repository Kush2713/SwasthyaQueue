# Frontend Component

This is the Next.js frontend for SwasthyaQueue.

## Install

```powershell
npm.cmd install
```

## Run

```powershell
npm.cmd run dev
```

Default dev URL:

- `http://localhost:3001`

If you want to use `3000`:

```powershell
$env:PORT='3000'
npm.cmd run dev
```

## Build

```powershell
npm.cmd run build
```

## Environment

Create `.env.local` from `.env.example` when needed:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
```

## Main Frontend Files

- `src/frontend/AppRouter.jsx`
- `src/frontend/lib/api.js`
- `src/frontend/pages/LoginPage.jsx`
- `src/frontend/pages/patient/*`
- `src/frontend/pages/staff/*`
- `src/frontend/pages/display/*`
- `scripts/dev-direct.mjs`

## Notes

- the dev script uses a direct launcher to avoid the Windows `spawn EPERM` issue seen with the default Next dev wrapper
- patient, staff, and display flows are connected to the backend
- login is still a demo flow until backend auth is added
