# Growvest Stock Screener - Frontend

A modern, responsive React frontend for the Growvest stock market screener platform.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **React Query** for data fetching and caching
- **React Router** for navigation
- **React Hook Form** for form handling
- **Recharts** for data visualization
- **Zustand** for state management
- **Lucide Icons** for iconography

## Project Structure

```
react-frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── auth/           # Authentication components
│   │   ├── layout/         # Layout components (Header, MainLayout)
│   │   └── ui/             # Reusable UI components
│   ├── context/
│   │   └── AuthContext.tsx # Authentication context
│   ├── hooks/              # Custom React hooks
│   ├── lib/
│   │   └── utils.ts        # Utility functions
│   ├── pages/              # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Stocks.tsx
│   │   ├── Strategies.tsx
│   │   ├── Scans.tsx
│   │   ├── ScanResults.tsx
│   │   └── Analytics.tsx
│   ├── services/
│   │   └── api.ts          # API client
│   ├── styles/
│   │   └── globals.css     # Global styles
│   ├── types/
│   │   └── index.ts        # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

1. **Install dependencies**
   ```bash
   cd react-frontend
   npm install
   ```

2. **Configure environment** (optional)
   Create `.env` file:
   ```
   VITE_API_URL=http://localhost:8080/api/v1
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

Output will be in the `dist` folder.

## Features

### Authentication
- Login & Registration with form validation
- JWT-based authentication with cookies
- Automatic token refresh
- Protected routes

### Dashboard
- Overview statistics
- Strategy status
- Recent scans
- Performance metrics

### Stocks Management
- List, search, and filter stocks
- Add, edit, delete stocks
- Pagination

### Strategies
- View available strategies
- Enable/disable strategies
- Configure strategy parameters

### Scans
- Start new scans
- View scan history
- Real-time status updates
- Detailed results with expandable rows

### Analytics
- Strategy performance charts
- Top stocks leaderboard
- Interactive visualizations

## Design System

### Colors
- **Primary**: Green gradient (growth theme)
- **Accent**: Purple (for highlights)
- **Surface**: Neutral grays

### Typography
- **Sans**: Plus Jakarta Sans
- **Mono**: JetBrains Mono

### Components
- Button (primary, secondary, ghost, danger variants)
- Card (with header, content, footer)
- Input (with label, error, helper text, icons)
- Badge (default, success, warning, danger, info)
- Table (with hover, sorting, pagination)

## API Integration

The frontend uses a centralized API client (`src/services/api.ts`) with:
- Automatic CSRF token handling
- Request/response interceptors
- Token refresh on 401
- Type-safe API methods

## License

MIT License

