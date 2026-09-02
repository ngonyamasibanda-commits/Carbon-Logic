# 🚀 Quick Deployment Guide - Get Your App Online for Clients

This guide will help you deploy Carbon Logic to the cloud for FREE so clients can access it via a URL without downloading anything.

## What You'll Get
- **Backend API**: Live at https://your-backend.onrender.com
- **Frontend App**: Live at https://your-app.vercel.app
- **Total Cost**: $0 (free tiers)
- **No Downloads Required**: Clients just visit the URL

## Prerequisites
- GitHub account (free)
- Render account (free) - render.com
- Vercel account (free) - vercel.com

## Step 1: Push Code to GitHub (5 minutes)

1. **Create a GitHub repository**
   - Go to github.com and create a new repository called "carbon-logic-engine"
   - Don't initialize with README (we have one)

2. **Push your code**
   ```bash
   cd /Users/hlulanisibanda/carbon-logic-engine
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/carbon-logic-engine.git
   git push -u origin main
   ```

## Step 2: Deploy Backend to Render (5 minutes)

1. **Go to render.com** and sign up/login
2. Click "New +" → "Web Service"
3. **Connect your GitHub repository**
   - Click "Connect" next to your repo
   - Authorize Render to access your GitHub

4. **Configure the Backend**
   - **Name**: carbon-logic-backend
   - **Region**: Oregon (or closest to you)
   - **Branch**: main
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

5. **Click "Deploy Web Service"**

6. **Wait for deployment** (2-3 minutes)
   - Render will build and deploy your backend
   - You'll get a URL like: https://carbon-logic-backend.onrender.com

7. **Test it**
   - Visit https://carbon-logic-backend.onrender.com/health
   - You should see: `{"status":"healthy"}`

## Step 3: Deploy Frontend to Vercel (5 minutes)

1. **Go to vercel.com** and sign up/login
2. Click "Add New" → "Project"
3. **Import your GitHub repository**
   - Find "carbon-logic-engine" and click "Import"

4. **Configure the Frontend**
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

5. **Add Environment Variable**
   - Click "Environment Variables"
   - Add: `NEXT_PUBLIC_API_URL` = `https://carbon-logic-backend.onrender.com`
   - (Use your actual Render backend URL from Step 2)

6. **Click "Deploy"**

7. **Wait for deployment** (1-2 minutes)
   - Vercel will build and deploy your frontend
   - You'll get a URL like: https://carbon-logic-engine.vercel.app

## Step 4: Your App is Live! 🎉

**For Clients:**
- Share this URL: https://carbon-logic-engine.vercel.app
- No downloads required
- Works on any device with a browser
- Professional dark mode interface
- Real-time emission calculations

**For You:**
- Backend: https://carbon-logic-backend.onrender.com
- API Docs: https://carbon-logic-backend.onrender.com/docs
- Frontend: https://carbon-logic-engine.vercel.app

## Troubleshooting

### Frontend shows "Failed to load data"
- Check `NEXT_PUBLIC_API_URL` environment variable in Vercel
- Make sure backend URL is correct (from Render)
- Redeploy frontend after changing environment variable

### Backend deployment fails
- Make sure `requirements.txt` is in the `backend/` folder
- Check build logs in Render dashboard
- Ensure `main.py` and `emission_engine.py` are in `backend/` folder

### Can't access the app
- Check both services are "Live" in their dashboards
- Wait a few minutes for DNS to propagate
- Try accessing via incognito mode

## What Clients Will See

When clients visit your URL, they'll see:
- Professional dark mode dashboard
- Carbon footprint calculator
- Emissions tracking
- Compliance monitoring
- Executive reports
- All without downloading anything!

## Custom Domain (Optional)

To use your own domain (e.g., carbonlogic.com):
1. Buy a domain (Namecheap, GoDaddy, etc.)
2. In Vercel, go to Settings → Domains
3. Add your custom domain
4. Follow DNS instructions
5. Your app will be at https://carbonlogic.com

## Summary

**Time Required**: 15 minutes
**Cost**: $0 (free tiers)
**Result**: Live web app accessible worldwide
**Client Experience**: Visit URL → Use app → No downloads

Your clients can now access Carbon Logic from anywhere in the world just by visiting a URL!
