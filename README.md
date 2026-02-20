<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1t-wNnRRqulGaXMOLQVelOi-OMIOubfKK

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend Setup (Supabase + Vercel)

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
3. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (server-side for `/api/ai-advice`)

### Local API Dev (optional)
If you want to use the AI route locally, run Vercel Functions alongside Vite:
1. Terminal A: `vercel dev --listen 3001`
2. Terminal B: `npm run dev`
3. Set `VITE_API_BASE_URL=http://localhost:3001` in `.env.local`
