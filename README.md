# GoChart - Charter Flight Management System

A web application for Part 135 charter operators to manage their fleet and plan trips efficiently.

## Features

- User authentication for charter operators
- Interactive map display with fleet tracking
- Fleet management with aircraft details
- Trip planning and cost estimation
- Real-time flight tracking and status updates

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- MapBox API key

## Setup

1. Clone the repository:
```bash
git clone https://github.com/zakarlyya/gochart.git
cd gochart
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=5000
JWT_SECRET=your_jwt_secret_key_here
MAPBOX_TOKEN=your_mapbox_token_here
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Development

- Frontend: React with TypeScript
- Backend: Express.js
- Database: SQLite
- Map: MapBox GL JS
- Styling: Tailwind CSS

APIs used:
- AeroDataBox API

## API Endpoints

### Authentication
- POST `/api/register` - Register a new operator
- POST `/api/login` - Login to the system

### Planes
- GET `/api/planes` - Get all planes for the operator
- POST `/api/planes` - Add a new plane

### Trips
- GET `/api/trips` - Get all trips
- POST `/api/trips` - Create a new trip

## License

MIT 