# Carbon Logic Engine - Web App Deployment Guide

This guide explains how to deploy the Carbon Logic Engine as a web application using Docker.

## Quick Start with Docker Compose

The easiest way to run the full-stack application is using Docker Compose.

### Prerequisites
- Docker
- Docker Compose

### Steps

1. **Build and Run with Docker Compose**
   ```bash
   cd /Users/hlulanisibanda/carbon-logic-engine
   docker-compose up --build
   ```

2. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

3. **Stop the Application**
   ```bash
   docker-compose down
   ```

## Deployment Options

### Option 1: Deploy to Vercel (Frontend Only)

The Next.js frontend can be deployed to Vercel for free with their Git integration.

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically detect it's a Next.js app
4. Configure environment variable:
   - `NEXT_PUBLIC_API_URL`: Your backend API URL (e.g., https://your-backend.render.com)
5. Deploy

### Option 2: Deploy to Render (Backend + Frontend)

Render offers free hosting for both services.

#### Backend (FastAPI)
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set root directory to `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Deploy

#### Frontend (Next.js)
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set root directory to `frontend`
4. Build command: `npm run build`
5. Start command: `npm start`
6. Add environment variable: `NEXT_PUBLIC_API_URL` = backend URL
7. Deploy

### Option 3: Deploy to Railway

Railway provides an easy way to deploy both services together.

1. Create a new project on Railway
2. Add two services:
   - **Backend**: Python, Dockerfile in `backend/`
   - **Frontend**: Node.js, Dockerfile in `frontend/`
3. Railway will automatically detect the services and deploy
4. Configure environment variables for frontend to point to backend

### Option 4: Self-Host with Docker

You can host this on any server with Docker installed.

```bash
# Clone the repository
git clone <your-repo-url>
cd carbon-logic-engine

# Build and run
docker-compose up -d

# The app will be available on ports 3000 (frontend) and 8000 (backend)
```

To run behind a reverse proxy (nginx):
- Configure nginx to proxy `/api` to backend:8000
- Configure nginx to serve frontend:3000 as root

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000  # Change to production URL
NODE_ENV=production
```

### Backend
The backend uses environment variables via Uvicorn:
- `HOST`: defaults to 0.0.0.0
- `PORT`: defaults to 8000

## Production Configuration

### Database (Optional)

To add persistent data storage, update the backend to use a real database:

1. **Supabase** (PostgreSQL)
   - Create a Supabase project
   - Add environment variables to backend
   - Update `database.py` to use Supabase

2. **MongoDB Atlas**
   - Create a MongoDB Atlas cluster
   - Add connection string to environment variables
   - Update backend to use MongoDB

### Authentication

To add authentication:

1. **Backend**: Add JWT authentication to FastAPI
2. **Frontend**: Add login page and token management
3. **API**: Protect endpoints with `@app.get("/api/v1/...", dependencies=[Depends(HTTPToken)])`

## Monitoring

### Health Checks

The backend includes a health check endpoint:
```bash
curl http://your-backend-url/health
```

Response:
```json
{
  "status": "healthy"
}
```

## Performance Optimization

The Next.js app is configured with:
- `output: 'standalone'` - Optimized Docker image size
- Static optimization
- Automatic CSS optimization
- Font optimization

## Troubleshooting

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_API_URL` environment variable
- Ensure backend is running and accessible
- Check CORS configuration in backend

### Docker build fails
- Ensure Docker has enough memory
- Try building with `--no-cache` flag
- Check that Node.js version matches `package.json`

### Backend API calls failing
- Check backend logs: `docker-compose logs backend`
- Verify FastAPI is running: `curl http://localhost:8000/health`
- Check CORS configuration

## Current Architecture

```
Internet → Nginx (Optional) → Frontend (Next.js:3000) → Backend (FastAPI:8000)
                                              ↓
                                         Database (Optional)
```

## Scaling

### Horizontal Scaling
- Use Docker Swarm or Kubernetes
- Run multiple instances of frontend and backend
- Add load balancer (nginx, Traefik)

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Add caching layer (Redis)
- Use CDN for static assets

## Security Considerations

- Use HTTPS in production (SSL certificates)
- Add rate limiting to API
- Implement authentication
- Validate all inputs (Pydantic models already do this)
- Keep dependencies updated
- Use environment variables for secrets
