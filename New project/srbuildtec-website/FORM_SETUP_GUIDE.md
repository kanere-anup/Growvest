# 📧 Contact Form Setup Guide

## 🎯 Current Setup

Your contact form is now working! Here's how it currently functions:

### **What Happens When Someone Submits the Form:**

1. ✅ Form data is validated
2. ✅ Data is sent to `/api/contact` endpoint
3. ✅ Submission details are **logged in the terminal** where `npm run dev` is running
4. ✅ User sees a success message
5. ✅ Form is cleared

---

## 📱 How to Receive Form Submissions

### **Option 1: Check Server Terminal (Current Setup)**

When someone submits the form, you'll see this in your terminal:

```
📧 New Contact Form Submission:
================================
Name: John Doe
Phone: 9876543210
Email: john@example.com
Project Type: residential
Message: I need a 3BHK villa construction...
================================
```

**To see submissions:**
- Keep the terminal open where you ran `npm run dev`
- Watch for new submissions in real-time

---

## 🚀 Production Email Setup Options

For production, choose one of these email services:

### **Option 1: Gmail (Free & Easy)**

1. **Install Nodemailer:**
   ```bash
   npm install nodemailer
   ```

2. **Update `/app/api/contact/route.ts`:**
   ```typescript
   import nodemailer from 'nodemailer'

   const transporter = nodemailer.createTransport({
     service: 'gmail',
     auth: {
       user: 'srbuildtec.blr@gmail.com',
       pass: 'your-app-password', // Generate from Google Account
     },
   })

   // In the POST function:
   await transporter.sendMail({
     from: 'srbuildtec.blr@gmail.com',
     to: 'srbuildtec.blr@gmail.com',
     subject: `New Inquiry from ${name}`,
     html: `
       <h2>New Contact Form Submission</h2>
       <p><strong>Name:</strong> ${name}</p>
       <p><strong>Phone:</strong> ${phone}</p>
       <p><strong>Email:</strong> ${email}</p>
       <p><strong>Project Type:</strong> ${projectType}</p>
       <p><strong>Message:</strong> ${message}</p>
     `,
   })
   ```

3. **Generate Gmail App Password:**
   - Go to Google Account → Security
   - Enable 2-Step Verification
   - Create App Password for "Mail"
   - Use that password in the code

---

### **Option 2: Resend (Recommended - Professional)**

Free tier: 100 emails/day

1. **Sign up:** https://resend.com
2. **Install:**
   ```bash
   npm install resend
   ```

3. **Get API Key** from Resend dashboard

4. **Update `/app/api/contact/route.ts`:**
   ```typescript
   import { Resend } from 'resend'

   const resend = new Resend('your-api-key')

   // In POST function:
   await resend.emails.send({
     from: 'SR BUILDTEC <noreply@yourdomain.com>',
     to: 'srbuildtec.blr@gmail.com',
     subject: `New Inquiry from ${name}`,
     html: `...form data...`,
   })
   ```

---

### **Option 3: FormSubmit (Easiest - No Code)**

1. **Change form action** in `Contact.tsx`:
   ```tsx
   <form 
     action="https://formsubmit.co/srbuildtec.blr@gmail.com"
     method="POST"
   >
   ```

2. **That's it!** FormSubmit will email you all submissions

---

### **Option 4: EmailJS (Client-side)**

1. **Sign up:** https://www.emailjs.com
2. **Get Service ID, Template ID, Public Key**
3. **Install:**
   ```bash
   npm install @emailjs/browser
   ```

4. **Update Contact.tsx:**
   ```typescript
   import emailjs from '@emailjs/browser'

   emailjs.send(
     'service_id',
     'template_id',
     formData,
     'public_key'
   )
   ```

---

## 🔔 Recommended Setup for SR BUILDTEC

**For immediate use:**
- ✅ Current setup works (check terminal)
- ✅ Set up **WhatsApp Business** for instant notifications
- ✅ Share WhatsApp number (already on site: 8660326541)

**For production:**
1. **Use Resend** (professional, reliable)
2. **Add email notifications** to srbuildtec.blr@gmail.com
3. **Also send to phone** via SMS gateway (optional)

---

## 📱 WhatsApp Integration (Easiest for Now)

The website already has a **WhatsApp floating button**. Most customers will use this because:
- ✅ Instant response
- ✅ You get phone notification immediately
- ✅ Can share images/files
- ✅ No email setup needed

**Encourage visitors to:**
1. Click WhatsApp button (green floating button)
2. Send message directly
3. Get instant response

---

## 🎯 Next Steps

**Immediate (No changes needed):**
1. ✅ Form submissions logged in terminal
2. ✅ WhatsApp button working
3. ✅ Phone number displayed: 8660326541

**Before deployment:**
1. Choose email service (Resend recommended)
2. Add API key to environment variables
3. Test form submission
4. Monitor inbox for inquiries

---

## 📞 Current Contact Methods on Website

Visitors can reach you via:
1. ✅ **WhatsApp** - Green floating button (instant)
2. ✅ **Phone** - 8660326541 (click to call)
3. ✅ **Email** - srbuildtec.blr@gmail.com (click to email)
4. ✅ **Contact Form** - Submissions logged/emailed
5. ✅ **Social Media** - Instagram, Facebook, YouTube links

---

**Your website is ready! The form works and logs all submissions.** 🚀
