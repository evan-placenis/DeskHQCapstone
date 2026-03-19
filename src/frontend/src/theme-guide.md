# Pretium AI Theme System Guide

## 📋 Overview

This centralized theme system allows you to change the entire app's color scheme by editing CSS variables in ONE place: `/styles/globals.css`

---

## 🎨 **Theme Variables**

### **Main Theme Colors**
```css
--theme-primary: #3c6e71;     /* Primary brand color */
--theme-secondary: #284b63;   /* Secondary brand color */
```

### **Status Colors** (NEW!)
```css
/* Draft Status - Orange/Amber */
--theme-status-draft: #d97706;
--theme-status-draft-light: #fef3c7;

/* Under Review Status - Blue */
--theme-status-review: #2563eb;
--theme-status-review-light: #dbeafe;

/* Completed/Success Status - Green */
--theme-status-complete: #16a34a;
--theme-status-complete-light: #dcfce7;
```

### **Action Colors** (NEW!)
```css
/* Primary Actions - Buttons, CTAs */
--theme-action-primary: #2563eb;
--theme-action-primary-hover: #1d4ed8;

/* Destructive Actions - Delete, Remove */
--theme-action-destructive: #dc2626;
--theme-action-destructive-hover: #b91c1c;
--theme-action-destructive-light: #fee2e2;
```

### **Hover States** (NEW!)
```css
/* Card Hover Effects */
--theme-hover-border: #93c5fd;
--theme-hover-bg: #eff6ff;
```

---

## 🛠️ **How to Use Theme Classes**

### **Background Colors**
```tsx
<div className="bg-theme-primary" />
<div className="bg-theme-secondary" />
<div className="bg-theme-primary-10" />  /* 10% opacity */
<div className="bg-theme-status-draft-light" />
<div className="bg-theme-action-primary" />
```

### **Text Colors**
```tsx
<span className="text-theme-primary" />
<span className="text-theme-secondary" />
<span className="text-theme-status-draft" />
<span className="text-theme-action-primary" />
```

### **Border Colors**
```tsx
<div className="border-theme-primary" />
<div className="border-theme-secondary" />
<div className="border-theme-primary-30" />
```

### **Hover States**
```tsx
<div className="hover:bg-theme-primary" />
<div className="hover:border-theme-primary" />
<div className="hover:text-theme-primary" />
<div className="hover:bg-theme-action-primary-hover" />
<div className="hover:border-theme-hover" />
```

### **Status Indicators**
```tsx
/* Draft Reports */
<Clock className="text-theme-status-draft" />
<Badge className="bg-theme-status-draft text-white" />

/* Under Review */
<AlertCircle className="text-theme-status-review" />
<Badge className="bg-theme-status-review text-white" />

/* Completed */
<CheckCircle2 className="text-theme-status-complete" />
<Badge className="bg-theme-status-complete text-white" />
```

### **Action Buttons**
```tsx
/* Primary CTA Button */
<Button className="bg-theme-action-primary hover:bg-theme-action-primary-hover text-white" />

/* Destructive Button */
<Button className="hover:bg-theme-action-destructive-light hover:border-theme-action-destructive" />
```

---

## ✅ **Pages Using Theme System**

### **Fully Migrated:**
1. ✅ **DashboardPage** - All colors centralized
2. ✅ **ProjectDetailPage** - All colors centralized
   - Stats cards (Reports/Photos icons)
   - Status indicators (Draft/Review/Complete)
   - Action buttons (Create Report, Upload Photos)
   - Knowledge Base cards
3. ✅ **PhotoFolderView** - Mobile-optimized

### **Shared Components:**
- ✅ **ProjectCard** (`/components/shared/ProjectCard.tsx`)
- ✅ **ReportCard** (`/components/shared/ReportCard.tsx`)

---

## 📊 **Common Patterns to Replace**

### **OLD** → **NEW**

#### **Primary Buttons**
```tsx
// ❌ OLD
<Button className="bg-blue-600 hover:bg-blue-700" />

// ✅ NEW
<Button className="bg-theme-action-primary hover:bg-theme-action-primary-hover text-white" />
```

#### **Status Icons**
```tsx
// ❌ OLD  
<Clock className="text-amber-600" />
<AlertCircle className="text-blue-600" />
<CheckCircle2 className="text-green-600" />

// ✅ NEW
<Clock className="text-theme-status-draft" />
<AlertCircle className="text-theme-status-review" />
<CheckCircle2 className="text-theme-status-complete" />
```

#### **Stat Cards**
```tsx
// ❌ OLD
<div className="bg-blue-100">
  <FileText className="text-blue-600" />
</div>

// ✅ NEW
<div className="bg-theme-status-review-light">
  <FileText className="text-theme-status-review" />
</div>
```

#### **Card Hover States**
```tsx
// ❌ OLD
<div className="hover:border-blue-300 hover:bg-blue-50" />

// ✅ NEW
<div className="hover:border-theme-hover hover:bg-theme-hover" />
```

#### **Delete Buttons**
```tsx
// ❌ OLD
<Button className="hover:bg-red-50 hover:border-red-300" />

// ✅ NEW
<Button className="hover:bg-theme-action-destructive-light hover:border-theme-action-destructive" />
```

---

## 🎯 **Quick Reference: All Available Classes**

### **Background Classes**
- `bg-theme-primary` / `bg-theme-secondary`
- `bg-theme-primary-5` / `bg-theme-primary-10` / `bg-theme-primary-20` / `bg-theme-primary-30`
- `bg-theme-status-draft` / `bg-theme-status-draft-light`
- `bg-theme-status-review` / `bg-theme-status-review-light`
- `bg-theme-status-complete` / `bg-theme-status-complete-light`
- `bg-theme-action-primary` / `bg-theme-action-primary-light`
- `bg-theme-action-destructive` / `bg-theme-action-destructive-light`

### **Text Classes**
- `text-theme-primary` / `text-theme-secondary`
- `text-theme-status-draft` / `text-theme-status-review` / `text-theme-status-complete`
- `text-theme-action-primary` / `text-theme-action-destructive`

### **Border Classes**
- `border-theme-primary` / `border-theme-secondary`
- `border-theme-primary-30` / `border-theme-secondary-30`

### **Hover Classes**
- `hover:bg-theme-primary` / `hover:bg-theme-secondary`
- `hover:bg-theme-primary-hover`
- `hover:bg-theme-action-primary-hover`
- `hover:bg-theme-action-destructive-hover`
- `hover:border-theme-hover` / `hover:bg-theme-hover`
- `hover:text-theme-primary` / `hover:text-theme-secondary`

---

## 🚀 **To Change Site-Wide Theme**

**Just edit 2 lines in `/styles/globals.css`:**
```css
--theme-primary: #3c6e71;     /* Change this! */
--theme-secondary: #284b63;   /* Change this! */
```

All pages using the theme system will update automatically! 🎉

---

## 🔄 **Migration Checklist for New Pages**

1. Search for hardcoded colors: `#[hex code]`
2. Replace with theme variables:
   - `#3c6e71` → `bg-theme-primary` or `text-theme-primary`
   - `#284b63` → `bg-theme-secondary` or `text-theme-secondary`
   - Blue buttons → `bg-theme-action-primary hover:bg-theme-action-primary-hover`
   - Status colors → Use `theme-status-draft/review/complete`
   - Hover effects → Use `hover:border-theme-hover hover:bg-theme-hover`
3. Test responsive design on mobile
4. Verify all interactive states work

---

## 📝 **Notes**

- **Status Colors** are semantic - change them to match your brand's status visualization
- **Action Colors** control all primary CTAs and destructive actions
- **Hover States** provide consistent interaction feedback
- **Opacity Variations** (`-5`, `-10`, `-20`, etc.) are auto-calculated from main colors
- The theme system is fully responsive and mobile-optimized

---

**Last Updated:** Dashboard & ProjectDetailPage fully migrated ✅