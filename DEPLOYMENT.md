# Deployment Guide for Lugn & Trygg

## Backend Deployment

1. Set up environment variables using `.env.example` as template.
2. Install dependencies: `pip install -r requirements.txt`
3. Run: `python main.py`

For production, use Gunicorn or similar.

## Frontend Deployment

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