# SR BUILDTEC - Premium Construction & Engineering Website

A modern, responsive, and feature-rich website for SR BUILDTEC, showcasing construction and engineering services with premium dark-themed design.

## 🌟 Features

- ✅ **Modern Tech Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS
- ✅ **Premium Animations**: Framer Motion for smooth, professional animations
- ✅ **Fully Responsive**: Mobile-first design, works perfectly on all devices
- ✅ **Dark Theme**: Professional dark navy theme (#0F172A) with orange accents (#FF6B00)
- ✅ **SEO Optimized**: Meta tags, semantic HTML, performance optimized
- ✅ **Interactive Sections**:
  - Cinematic hero with animated stats and background
  - About section with mission, vision & core values
  - 12+ service cards with custom icons
  - Filterable project portfolio with categories
  - Building animation timeline (Blueprint → Foundation → Structure → Finishing)
  - Client testimonials carousel with auto-play
  - Social media integration (Instagram, Facebook, YouTube)
  - Contact information with WhatsApp integration
  - Floating WhatsApp button
- ✅ **Content Management**: All content in JSON files for easy updates
- ✅ **Performance**: Fast loading, optimized images, code splitting
- ✅ **Brand Icons**: React Icons for social media (Instagram, Facebook, YouTube)

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js**: Version 18 or higher ([Download](https://nodejs.org/))
- **npm**: Version 9 or higher (comes with Node.js)

Check your versions:
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be v9.0.0 or higher
```

### Installation Steps

1. **Clone or Download the Project**
   ```bash
   cd /path/to/srbuildtec-website
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```
   
   This will install all required packages:
   - Next.js 16.2.6
   - React 19
   - TypeScript
   - Tailwind CSS
   - Framer Motion
   - React Icons
   - Lucide React (for icons)

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   
   The server will start on: [http://localhost:3000](http://localhost:3000)

4. **Open in Browser**
   - Navigate to `http://localhost:3000`
   - You should see the SR BUILDTEC homepage

### First Time Setup

After installation, verify everything works:

1. ✅ **Company logo visible** in navbar (top-left)
2. ✅ **Dark theme** applied throughout
3. ✅ **Social media icons** clickable in footer and contact section
4. ✅ **WhatsApp button** visible in bottom-right corner
5. ✅ **All images loading** (hero, about, projects, timeline)

## 📁 Project Structure

```
srbuildtec-website/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with SEO
│   ├── page.tsx           # Main homepage
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── sections/         # Page sections
│   └── ui/               # Reusable UI components
├── data/                  # Content JSON files
├── lib/                   # Utilities
├── public/               # Static assets
└── tailwind.config.ts    # Tailwind configuration
```

## 🎨 Customization Guide

All website content is stored in JSON files for easy updates without touching code.

### 1. Update Company Information
**File:** `/data/company.json`

```json
{
  "name": "SR BUILDTEC",
  "tagline": "Building Excellence, Engineering The Future",
  "contact": {
    "phone": "8660326541",
    "email": "srbuildtec.blr@gmail.com",
    "address": "Bangalore, Karnataka, India",
    "whatsapp": "918660326541"
  },
  "social": {
    "instagram": "https://www.instagram.com/srbuildtec",
    "facebook": "https://www.facebook.com/share/1E4LGLbP85/",
    "youtube": "https://youtube.com/@srbuildtec"
  }
}
```

### 2. Add/Edit Services
**File:** `/data/services.json`

Each service includes:
- Title, description, icon name
- Features list
- Automatically displayed in service cards

### 3. Manage Projects
**File:** `/data/projects.json`

Each project includes:
- Title, description, category
- Status (Completed/Ongoing)
- Location, area, year
- Features and tags

### 4. Update Testimonials
**File:** `/data/testimonials.json`

Each testimonial includes:
- Client name, role, project type
- Rating (1-5 stars)
- Testimonial text

### 5. Update Features (Why Choose Us)
**File:** `/data/features.json`

Each feature includes:
- Title, description
- Icon name (from Lucide React)

### 6. Change Company Logo
**Replace:** `/public/company-logo.jpeg`

- Image size: 500x500px or larger
- Format: JPEG, PNG, or WebP
- Keep filename as `company-logo.jpeg` or update imports in:
  - `components/sections/Navbar.tsx`
  - `components/sections/Footer.tsx`

### 7. Customize Colors
**File:** `/tailwind.config.ts`

```typescript
colors: {
  primary: '#FF6B00',  // Orange accent
  navy: '#0F172A',     // Dark background
}
```

## 🔧 Production Build

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `.next` folder.

### Test Production Build Locally

```bash
npm run build
npm start
```

Then open [http://localhost:3000](http://localhost:3000)

### Build Output

- ✅ Static pages pre-rendered
- ✅ Images optimized
- ✅ JavaScript minified
- ✅ CSS optimized
- ✅ Ready for deployment

## 🌐 Deployment

### Option 1: Vercel (Recommended - Free)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Click "Deploy"

3. **Done!** ✅
   - Your site is live with automatic SSL
   - Auto-deploys on every push to main
   - Global CDN for fast loading worldwide

### Option 2: Netlify

1. Build the project: `npm run build`
2. Drag `.next` folder to [netlify.com](https://netlify.com)
3. Site is live!

### Option 3: Self-Hosted

1. Build: `npm run build`
2. Start: `npm start` or use PM2
3. Set up reverse proxy (Nginx)
4. Configure SSL (Let's Encrypt)

## 🐛 Troubleshooting

### Issue: Logo not visible in navbar/footer

**Solution:**
1. Ensure `/public/company-logo.jpeg` exists
2. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. Clear browser cache:
   ```javascript
   // In browser console (F12)
   localStorage.clear();
   location.reload();
   ```

### Issue: Social media icons not clickable

**Solution:**
1. Check browser console (F12) for errors
2. Verify links in `/data/company.json`
3. Hard refresh the page

### Issue: Port 3000 already in use

**Solution:**
```bash
# Kill the process using port 3000
npx kill-port 3000

# Or use a different port
npm run dev -- -p 3001
```

### Issue: Module not found errors

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Images not loading

**Solution:**
1. Check if images exist in `/public` folder
2. Verify image paths (should start with `/`)
3. Check browser Network tab (F12) for 404 errors

### Issue: Build fails

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

### Issue: Dark theme not applying

**Solution:**
- Dark theme is now **permanent** (no toggle)
- Check `tailwind.config.ts` has `darkMode: 'class'`
- Verify `<html>` tag has `className="dark"` in `app/layout.tsx`

## 📋 Available Scripts

```bash
npm run dev      # Start development server (port 3000)
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## 🛠️ Tech Stack Details

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 16.2.6 | React framework |
| React | 19 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| Framer Motion | 11.x | Animations |
| React Icons | 5.6.0 | Social media icons |
| Lucide React | Latest | UI icons |

## 📞 Support & Contact

**SR BUILDTEC**
- **Email**: srbuildtec.blr@gmail.com
- **Phone**: +91 8660326541
- **WhatsApp**: +91 8660326541
- **Location**: Bangalore, Karnataka, India

**Social Media:**
- Instagram: [@srbuildtec](https://www.instagram.com/srbuildtec)
- Facebook: [SR BUILDTEC](https://www.facebook.com/share/1E4LGLbP85/)
- YouTube: [@srbuildtec](https://youtube.com/@srbuildtec)

## 📄 License

This project is proprietary and confidential. All rights reserved by SR BUILDTEC.

---

**Built with ❤️ for SR BUILDTEC**  
*Premium Construction & Engineering Solutions*
