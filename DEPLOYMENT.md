# Deployment Guide for Lugn & Trygg

## Docker Deployment (Recommended)

### Prerequisites
- Install Docker and Docker Compose:
  - **Ubuntu/Debian**: `sudo apt-get install docker.io docker-compose`
  - **Windows**: Install Docker Desktop (includes Docker Compose)
  - **macOS**: Install Docker Desktop

### Deploy with Docker Compose

1. Clone the repository:
   ```bash
   git clone https://github.com/omar1u7777/Lugn-Trygg.git
   cd Lugn-Trygg
   ```

2. Set up environment variables:
   - Copy `Backend/.env.example` to `Backend/.env` and fill with real Firebase credentials
   - Copy `frontend/.env.example` to `frontend/.env` and configure

3. Build and run the application:
   ```bash
   docker-compose up --build
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001
   - Swagger UI: http://localhost:5001/apidocs

### Stop the Application
```bash
docker-compose down
```

## Manual Deployment

### Backend Deployment

1. Set up environment variables using `.env.example` as template.
2. Install dependencies: `pip install -r requirements.txt`
3. Run: `python main.py`

For production, use Gunicorn or similar.

### Frontend Deployment

1. Set `VITE_API_BASE_URL` in `.env` to production backend URL.
2. Build: `npm run build`
3. Deploy `dist/` folder to web server.

## Environment Variables

- Backend: Copy `.env.example` to `.env` and fill with real Firebase credentials.
- Frontend: Set `VITE_API_BASE_URL` to backend URL.

## Security Notes

- Keep Firebase keys secure.
- Use HTTPS in production.
- Validate all inputs.