# 💾 Database Setup Guide for Pretium AI

## Current State
Right now, all data is stored in **React state** (`useState`) which means:
- ✅ Works perfectly for prototyping and testing
- ❌ Data is lost when you refresh the page
- ❌ No multi-user support
- ❌ No file storage for photos/Excel files

## When You Download This Project

You need to add a backend to persist data. Here are your options:

---

## Option 1: Supabase (Recommended - Easiest)

**Why Supabase?**
- No backend code needed
- PostgreSQL database hosted for you
- Built-in authentication
- File storage included
- Real-time updates
- Free tier available

**Setup Steps:**

1. **Create a Supabase project:**
   - Go to [supabase.com](https://supabase.com)
   - Create free account
   - Create new project

2. **Create tables:**
   ```sql
   -- Projects table
   CREATE TABLE projects (
     id BIGSERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     status TEXT DEFAULT 'Active',
     reports INTEGER DEFAULT 0,
     photos INTEGER DEFAULT 0,
     excel_data JSONB,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Reports table
   CREATE TABLE reports (
     id BIGSERIAL PRIMARY KEY,
     project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     content JSONB,
     status TEXT DEFAULT 'Draft',
     created_by TEXT,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Photos table
   CREATE TABLE photos (
     id BIGSERIAL PRIMARY KEY,
     project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
     report_id BIGINT REFERENCES reports(id) ON DELETE SET NULL,
     url TEXT NOT NULL,
     name TEXT,
     location TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Install Supabase client:**
   ```bash
   npm install @supabase/supabase-js
   ```

4. **Add environment variables:**
   Create `.env.local` file:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. **Create Supabase client:**
   Create `/lib/supabase.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

   export const supabase = createClient(supabaseUrl, supabaseAnonKey)
   ```

6. **Replace mock functions with real API calls:**

   Example in `DashboardPage.tsx`:
   ```typescript
   // OLD (current mock):
   const handleCreateProject = (newProject) => {
     console.log("Creating project:", newProject);
   };

   // NEW (with Supabase):
   const handleCreateProject = async (newProject) => {
     const { data, error } = await supabase
       .from('projects')
       .insert([{
         name: newProject.name,
         status: newProject.status,
         excel_data: newProject.excelData
       }])
       .select();
     
     if (error) {
       console.error('Error creating project:', error);
       return;
     }
     
     // Refresh project list
     fetchProjects();
   };
   ```

---

## Option 2: Build Your Own Backend

**If you prefer full control:**

1. **Choose your stack:**
   - Node.js + Express + PostgreSQL
   - Python + Django/FastAPI + PostgreSQL
   - Ruby on Rails + PostgreSQL
   - Any other backend framework

2. **Create API endpoints:**
   ```
   POST   /api/projects          - Create project
   GET    /api/projects          - List projects
   GET    /api/projects/:id      - Get project
   PUT    /api/projects/:id      - Update project
   DELETE /api/projects/:id      - Delete project
   
   POST   /api/reports           - Create report
   GET    /api/projects/:id/reports - List reports for project
   etc...
   ```

3. **Replace fetch calls in frontend:**
   ```typescript
   const handleCreateProject = async (newProject) => {
     const response = await fetch('http://localhost:3000/api/projects', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(newProject)
     });
     const data = await response.json();
     // Handle response...
   };
   ```

---

## Option 3: Firebase

Similar to Supabase but from Google:
- Go to [firebase.google.com](https://firebase.google.com)
- Create project
- Use Firestore for database
- Use Firebase Storage for files
- Install `firebase` package

---

## What Needs Database Integration

### Currently using mock data:

1. **Projects** (`/components/DashboardPage.tsx`)
   - Create, read, update, delete projects
   - Store Excel data as JSON

2. **Reports** (`/components/ProjectDetailPage.tsx`, `/components/ReportViewerPage.tsx`)
   - Create, read, update reports
   - Store report content (sections, observations)
   - Chat history with AI

3. **Photos** (`/components/ProjectDetailPage.tsx`)
   - Upload photos
   - Link photos to projects/reports
   - Store metadata (location, date, etc.)

4. **Authentication** (`/components/LoginPage.tsx`)
   - Currently just sets `isAuthenticated = true`
   - No real user verification

---

## File Storage (Photos & Excel)

**For Supabase:**
```typescript
// Upload photo
const { data, error } = await supabase.storage
  .from('project-photos')
  .upload(`${projectId}/${fileName}`, file);

// Get public URL
const { data: urlData } = supabase.storage
  .from('project-photos')
  .getPublicUrl(`${projectId}/${fileName}`);
```

**For your own backend:**
- Use AWS S3, Google Cloud Storage, or local file system
- Return URLs to frontend

---

## Quick Start Recommendation

1. **Start with Supabase** - It's the fastest way to get persistence
2. **Add authentication** using Supabase Auth
3. **Gradually add API calls** to replace mock data
4. **Later migrate** to your own backend if needed

The frontend code is already structured to easily swap mock functions with real API calls!
